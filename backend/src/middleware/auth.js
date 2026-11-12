import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/environment.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export function signSession(userId) {
  return jwt.sign({ sub: userId, typ: 'session' }, env.sessionSecret, { expiresIn: '7d' });
}

/** Authentication: requires a valid Bearer session token. Sets req.user. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  let payload;
  try {
    payload = jwt.verify(token, env.sessionSecret);
  } catch {
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }
  if (payload.typ !== 'session' || !payload.sub) throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session.');
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Account no longer exists.');
  req.user = user;
  next();
});

/** Authorization: loads the signed-in user's connected channel. All data access is scoped through it. */
export const requireChannel = asyncHandler(async (req, _res, next) => {
  const channel = await prisma.connectedChannel.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'asc' } });
  if (!channel) throw new AppError(404, 'NO_CHANNEL', 'No YouTube channel is connected to this account.');
  req.channel = channel;
  next();
});
