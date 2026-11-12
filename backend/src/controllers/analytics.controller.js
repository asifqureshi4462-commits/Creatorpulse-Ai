import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/errors.js';
import { getAuthClientForUser } from '../services/oauth.service.js';
import * as analytics from '../services/analytics.service.js';

const settle = async (promise) => {
  try {
    return { available: true, data: await promise };
  } catch (err) {
    if (err?.code === 401 || err?.response?.status === 401) throw err; // let the global handler ask for re-auth
    return { available: false, error: err?.response?.data?.error?.message || err.message };
  }
};

/** Every section is optional: only metrics the connected account may access are returned. */
export const overview = asyncHandler(async (req, res) => {
  const { days } = req.validatedQuery;
  const auth = await getAuthClientForUser(req.user.id);
  const [channel, traffic, top, revenue, demographics] = await Promise.all([
    settle(analytics.channelOverview(auth, days)),
    settle(analytics.trafficSources(auth, { days })),
    settle(analytics.topVideos(auth, days)),
    settle(analytics.revenue(auth, days)),
    settle(analytics.demographics(auth, days)),
  ]);
  if (top.available) {
    const videos = await prisma.video.findMany({
      where: { channelId: req.channel.id, youtubeVideoId: { in: top.data.map((r) => r.video) } },
      select: { id: true, youtubeVideoId: true, title: true, thumbnail: true },
    });
    const byId = new Map(videos.map((v) => [v.youtubeVideoId, v]));
    top.data = top.data.map((r) => ({ ...r, videoRef: byId.get(r.video) || null }));
  }
  res.json({ days, channel, traffic, topVideos: top, revenue, demographics });
});

/** Channel totals recorded by the monitor (tracked since the channel was connected). */
export const history = asyncHandler(async (req, res) => {
  const items = await prisma.channelAnalytics.findMany({ where: { channelId: req.channel.id }, orderBy: { capturedAt: 'asc' }, take: 400 });
  res.json({ items });
});
