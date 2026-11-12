import { prisma } from '../config/database.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { getAuthClientForUser } from '../services/oauth.service.js';
import { syncVideos, updateVideoMetadata } from '../services/youtube.service.js';
import * as analytics from '../services/analytics.service.js';
import { audit } from '../services/notification.service.js';

const STALE_MS = 15 * 60 * 1000;
const ORDER = {
  newest: { publishedAt: 'desc' },
  oldest: { publishedAt: 'asc' },
  views: { viewCount: 'desc' },
  likes: { likeCount: 'desc' },
  comments: { commentCount: 'desc' },
};

export async function findOwnedVideo(channelId, idOrYoutubeId) {
  const video = await prisma.video.findFirst({ where: { channelId, OR: [{ id: idOrYoutubeId }, { youtubeVideoId: idOrYoutubeId }] } });
  if (!video) throw new AppError(404, 'NOT_FOUND', 'Video not found.');
  return video;
}

export const list = asyncHandler(async (req, res) => {
  const { q, sort, status, page, pageSize, refresh } = req.validatedQuery;
  const stale = !req.channel.lastSyncedAt || Date.now() - req.channel.lastSyncedAt.getTime() > STALE_MS;
  if (refresh === '1' || stale) {
    const auth = await getAuthClientForUser(req.user.id);
    await syncVideos(req.user.id, auth);
  }
  const where = {
    channelId: req.channel.id,
    ...(status !== 'all' ? { privacyStatus: status } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.video.count({ where }),
    prisma.video.findMany({ where, orderBy: ORDER[sort], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  res.json({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
});

export const sync = asyncHandler(async (req, res) => {
  const auth = await getAuthClientForUser(req.user.id);
  const result = await syncVideos(req.user.id, auth);
  res.json({ synced: result.synced });
});

export const get = asyncHandler(async (req, res) => {
  const video = await findOwnedVideo(req.channel.id, req.params.id);
  const [latestAlerts, snapshots] = await Promise.all([
    prisma.performanceAlert.findMany({ where: { videoId: video.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.videoAnalytics.findMany({ where: { videoId: video.id }, orderBy: { capturedAt: 'asc' }, take: 500 }),
  ]);
  res.json({ video, alerts: latestAlerts, snapshots });
});

const settle = async (promise) => {
  try {
    return { available: true, data: await promise };
  } catch (err) {
    return { available: false, error: err?.response?.data?.error?.message || err.message };
  }
};

export const videoAnalytics = asyncHandler(async (req, res) => {
  const video = await findOwnedVideo(req.channel.id, req.params.id);
  const auth = await getAuthClientForUser(req.user.id);
  const start = analytics.toDateString(video.publishedAt);
  const [metrics, traffic, retention] = await Promise.all([
    settle(analytics.videoMetrics(auth, video.youtubeVideoId, start)),
    settle(analytics.trafficSources(auth, { youtubeVideoId: video.youtubeVideoId, startDate: start })),
    settle(analytics.retentionCurve(auth, video.youtubeVideoId, start)),
  ]);
  res.json({ since: start, metrics, traffic, retention });
});

export const updateMetadata = asyncHandler(async (req, res) => {
  const video = await findOwnedVideo(req.channel.id, req.params.id);
  const auth = await getAuthClientForUser(req.user.id);
  const snippet = await updateVideoMetadata(auth, video.youtubeVideoId, req.body);
  const updated = await prisma.video.update({
    where: { id: video.id },
    data: { title: snippet.title, description: snippet.description, tags: snippet.tags },
  });
  await audit(req.user.id, 'video_metadata_updated', { videoId: video.youtubeVideoId, fields: Object.keys(req.body) }, req.ip);
  res.json({ video: updated });
});
