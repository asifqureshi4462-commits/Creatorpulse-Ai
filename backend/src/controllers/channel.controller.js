import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/errors.js';
import { getAuthClientForUser } from '../services/oauth.service.js';
import { syncChannelProfile } from '../services/youtube.service.js';

export const profile = asyncHandler(async (req, res) => {
  res.json({ channel: req.channel, user: { name: req.user.name, email: req.user.email, picture: req.user.picture } });
});

/** Live channel totals from YouTube plus aggregated likes of stored videos. */
export const statistics = asyncHandler(async (req, res) => {
  const auth = await getAuthClientForUser(req.user.id);
  const channel = await syncChannelProfile(req.user.id, auth);
  const agg = await prisma.video.aggregate({ where: { channelId: channel.id }, _sum: { likeCount: true, commentCount: true }, _count: true });
  res.json({
    channel,
    totals: {
      views: channel.viewCount,
      subscribers: channel.hiddenSubscribers ? null : channel.subscriberCount,
      videos: channel.videoCount,
      likes: agg._sum.likeCount ?? 0,
      comments: agg._sum.commentCount ?? 0,
      likesCoverage: agg._count,
    },
  });
});
