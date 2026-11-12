import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/errors.js';
import { getAuthClientForUser } from '../services/oauth.service.js';
import { listCommentThreads, replyToComment } from '../services/youtube.service.js';
import { audit } from '../services/notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const { q, pageToken, filter } = req.validatedQuery;
  const auth = await getAuthClientForUser(req.user.id);
  const page = await listCommentThreads(auth, req.channel.youtubeChannelId, { pageToken, search: q });

  const videoIds = [...new Set(page.items.map((c) => c.videoId).filter(Boolean))];
  const videos = await prisma.video.findMany({ where: { channelId: req.channel.id, youtubeVideoId: { in: videoIds } }, select: { youtubeVideoId: true, title: true } });
  const titles = new Map(videos.map((v) => [v.youtubeVideoId, v.title]));

  await prisma.$transaction(
    page.items.map((c) => {
      const data = {
        youtubeThreadId: c.threadId,
        videoYoutubeId: c.videoId,
        authorName: c.authorName,
        authorImage: c.authorImage,
        authorChannelId: c.authorChannelId,
        text: c.text,
        likeCount: c.likeCount,
        replyCount: c.replyCount,
        publishedAt: new Date(c.publishedAt),
      };
      return prisma.comment.upsert({
        where: { channelId_youtubeCommentId: { channelId: req.channel.id, youtubeCommentId: c.commentId } },
        create: { channelId: req.channel.id, youtubeCommentId: c.commentId, ...data },
        update: data,
      });
    }),
  );

  let items = page.items.map((c) => ({ ...c, videoTitle: titles.get(c.videoId) || null }));
  if (filter === 'unanswered') items = items.filter((c) => !c.ownerReplied && !c.isOwn);
  res.json({ items, nextPageToken: page.nextPageToken });
});

/** Posts a reply that the user wrote or explicitly approved. Never called automatically. */
export const reply = asyncHandler(async (req, res) => {
  const auth = await getAuthClientForUser(req.user.id);
  const result = await replyToComment(auth, req.params.id, req.body.text);
  await audit(req.user.id, 'comment_reply', { parentId: req.params.id }, req.ip);
  res.status(201).json({ reply: result });
});
