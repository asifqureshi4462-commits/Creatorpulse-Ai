import { prisma } from '../config/database.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const list = asyncHandler(async (req, res) => {
  const { unread, limit } = req.validatedQuery;
  const items = await prisma.notification.findMany({
    where: { userId: req.user.id, ...(unread === '1' ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ items });
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ count: await prisma.notification.count({ where: { userId: req.user.id, read: false } }) });
});

export const markRead = asyncHandler(async (req, res) => {
  const { count } = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { read: true } });
  if (!count) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  res.json({ ok: true });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});

export const alerts = asyncHandler(async (req, res) => {
  const items = await prisma.performanceAlert.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: req.validatedQuery.limit,
    include: { video: { select: { id: true, title: true, thumbnail: true, youtubeVideoId: true } } },
  });
  res.json({ items });
});

export const jobs = asyncHandler(async (_req, res) => {
  const items = await prisma.scheduledJob.findMany({ where: { name: 'video-monitoring' }, orderBy: { startedAt: 'desc' }, take: 8 });
  res.json({ items });
});
