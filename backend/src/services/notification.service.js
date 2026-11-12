import { prisma } from '../config/database.js';

const FLAG = { alert: 'notifyAlerts', ai: 'notifyAi', analytics: 'notifyAnalytics', auth: 'notifyAuth' };

/** Creates an in-app notification, respecting the user's notification settings (job status always shows). */
export async function notify(userId, { type, title, body, link }) {
  const flag = FLAG[type];
  if (flag) {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (settings && settings[flag] === false) return null;
  }
  return prisma.notification.create({ data: { userId, type, title, body, link } });
}

export async function audit(userId, action, metadata, ip) {
  try {
    await prisma.auditLog.create({ data: { userId, action, metadata, ip } });
  } catch {
    /* audit must never break a request */
  }
}
