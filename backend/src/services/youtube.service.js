import { google } from 'googleapis';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';

const youtube = (auth) => google.youtube({ version: 'v3', auth });
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function mapVideo(item) {
  const s = item.snippet || {};
  const st = item.statistics || {};
  return {
    youtubeVideoId: item.id,
    title: s.title || '(untitled)',
    description: s.description || '',
    tags: s.tags || [],
    categoryId: s.categoryId || null,
    publishedAt: new Date(s.publishedAt),
    thumbnail: s.thumbnails?.maxres?.url || s.thumbnails?.high?.url || s.thumbnails?.medium?.url || s.thumbnails?.default?.url || null,
    privacyStatus: item.status?.privacyStatus || 'public',
    duration: item.contentDetails?.duration || null,
    viewCount: BigInt(st.viewCount || 0),
    likeCount: BigInt(st.likeCount || 0),
    commentCount: BigInt(st.commentCount || 0),
    lastSyncedAt: new Date(),
  };
}

/** Refreshes the stored channel profile and statistics from YouTube. */
export async function syncChannelProfile(userId, auth) {
  const { data } = await youtube(auth).channels.list({ part: ['snippet', 'statistics', 'contentDetails'], mine: true });
  const ch = data.items?.[0];
  if (!ch) throw new AppError(404, 'NO_CHANNEL', 'No YouTube channel found for this Google account.');
  const stored = await prisma.connectedChannel.findFirst({ where: { userId, youtubeChannelId: ch.id } });
  if (!stored) throw new AppError(409, 'CHANNEL_CHANGED', 'The connected channel changed. Please sign in again.');
  return prisma.connectedChannel.update({
    where: { id: stored.id },
    data: {
      title: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url || stored.thumbnail,
      uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads || stored.uploadsPlaylistId,
      subscriberCount: Number(ch.statistics?.subscriberCount || 0),
      hiddenSubscribers: Boolean(ch.statistics?.hiddenSubscriberCount),
      viewCount: BigInt(ch.statistics?.viewCount || 0),
      videoCount: Number(ch.statistics?.videoCount || 0),
    },
  });
}

/** Pulls uploads from YouTube into the database. Returns the videos that were not stored before. */
export async function syncVideos(userId, auth, { maxPages = 20 } = {}) {
  const channel = await syncChannelProfile(userId, auth);
  if (!channel.uploadsPlaylistId) return { synced: 0, newVideos: [] };
  const yt = youtube(auth);

  const ids = [];
  let pageToken;
  for (let i = 0; i < maxPages; i++) {
    const { data } = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: channel.uploadsPlaylistId, maxResults: 50, pageToken });
    ids.push(...(data.items || []).map((it) => it.contentDetails.videoId));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  const known = new Set((await prisma.video.findMany({ where: { channelId: channel.id, youtubeVideoId: { in: ids } }, select: { youtubeVideoId: true } })).map((v) => v.youtubeVideoId));
  const newVideos = [];
  for (const group of chunk(ids, 50)) {
    const { data } = await yt.videos.list({ part: ['snippet', 'statistics', 'status', 'contentDetails'], id: group, maxResults: 50 });
    const rows = (data.items || []).map(mapVideo);
    await prisma.$transaction(
      rows.map((r) =>
        prisma.video.upsert({
          where: { channelId_youtubeVideoId: { channelId: channel.id, youtubeVideoId: r.youtubeVideoId } },
          create: { channelId: channel.id, ...r },
          update: r,
        }),
      ),
    );
    newVideos.push(...rows.filter((r) => !known.has(r.youtubeVideoId)));
  }
  await prisma.connectedChannel.update({ where: { id: channel.id }, data: { lastSyncedAt: new Date() } });
  return { synced: ids.length, newVideos };
}

/** Updates live statistics for specific stored videos (batched, 1 quota unit per 50). */
export async function refreshVideoStats(auth, videos) {
  const yt = youtube(auth);
  const out = [];
  for (const group of chunk(videos, 50)) {
    const { data } = await yt.videos.list({ part: ['statistics', 'status'], id: group.map((v) => v.youtubeVideoId), maxResults: 50 });
    const byId = new Map((data.items || []).map((i) => [i.id, i]));
    for (const v of group) {
      const item = byId.get(v.youtubeVideoId);
      if (!item) continue;
      const st = item.statistics || {};
      const updated = await prisma.video.update({
        where: { id: v.id },
        data: {
          viewCount: BigInt(st.viewCount || 0),
          likeCount: BigInt(st.likeCount || 0),
          commentCount: BigInt(st.commentCount || 0),
          privacyStatus: item.status?.privacyStatus || v.privacyStatus,
          lastSyncedAt: new Date(),
        },
      });
      out.push(updated);
    }
  }
  return out;
}

export async function updateVideoMetadata(auth, youtubeVideoId, { title, description, tags }) {
  const yt = youtube(auth);
  const { data } = await yt.videos.list({ part: ['snippet'], id: [youtubeVideoId] });
  const s = data.items?.[0]?.snippet;
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Video not found on YouTube.');
  const snippet = {
    title: title ?? s.title,
    description: description ?? s.description ?? '',
    tags: tags ?? s.tags ?? [],
    categoryId: s.categoryId,
    defaultLanguage: s.defaultLanguage,
  };
  await yt.videos.update({ part: ['snippet'], requestBody: { id: youtubeVideoId, snippet } });
  return snippet;
}

export async function listCommentThreads(auth, channelYoutubeId, { pageToken, search } = {}) {
  const { data } = await youtube(auth).commentThreads.list({
    part: ['snippet', 'replies'],
    allThreadsRelatedToChannelId: channelYoutubeId,
    maxResults: 50,
    order: 'time',
    textFormat: 'plainText',
    pageToken,
    searchTerms: search || undefined,
  });
  const items = (data.items || []).map((t) => {
    const c = t.snippet.topLevelComment.snippet;
    const ownerReplied = (t.replies?.comments || []).some((r) => r.snippet.authorChannelId?.value === channelYoutubeId);
    return {
      threadId: t.id,
      commentId: t.snippet.topLevelComment.id,
      videoId: t.snippet.videoId || c.videoId,
      authorName: c.authorDisplayName,
      authorImage: c.authorProfileImageUrl,
      authorChannelId: c.authorChannelId?.value || null,
      text: c.textOriginal || c.textDisplay,
      likeCount: c.likeCount || 0,
      replyCount: t.snippet.totalReplyCount || 0,
      ownerReplied,
      isOwn: c.authorChannelId?.value === channelYoutubeId,
      publishedAt: c.publishedAt,
    };
  });
  return { items, nextPageToken: data.nextPageToken || null };
}

export async function replyToComment(auth, parentId, text) {
  const { data } = await youtube(auth).comments.insert({
    part: ['snippet'],
    requestBody: { snippet: { parentId, textOriginal: text } },
  });
  return { id: data.id, text: data.snippet?.textOriginal, publishedAt: data.snippet?.publishedAt };
}

/** Public trend signal: most popular videos in a region (optionally in a category). */
export async function mostPopular(auth, regionCode = 'US', categoryId) {
  const yt = youtube(auth);
  const base = { part: ['snippet', 'statistics'], chart: 'mostPopular', regionCode, maxResults: 25 };
  let data;
  try {
    ({ data } = await yt.videos.list(categoryId ? { ...base, videoCategoryId: categoryId } : base));
  } catch {
    ({ data } = await yt.videos.list(base));
  }
  return (data.items || []).map((v) => ({
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    categoryId: v.snippet.categoryId,
    tags: (v.snippet.tags || []).slice(0, 8),
    views: Number(v.statistics?.viewCount || 0),
  }));
}
