import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/errors.js';
import { audit } from '../services/notification.service.js';

export const get = asyncHandler(async (req, res) => {
  const settings = await prisma.userSettings.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id }, update: {} });
  res.json({ settings });
});

export const update = asyncHandler(async (req, res) => {
  const settings = await prisma.userSettings.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, ...req.body }, update: req.body });
  await audit(req.user.id, 'settings_updated', { fields: Object.keys(req.body) }, req.ip);
  res.json({ settings });
});
