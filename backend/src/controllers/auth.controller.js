import { prisma } from '../config/database.js';
import { env } from '../config/environment.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { log } from '../utils/logger.js';
import { audit } from '../services/notification.service.js';
import { buildAuthUrl, completeSignIn, createExchangeCode, redeemExchangeCode, revokeAccess, verifyState } from '../services/oauth.service.js';

/** GET /api/auth/google?platform=web|android - redirects to Google's consent screen. */
export const start = (req, res) => {
  const platform = req.query.platform === 'android' ? 'android' : 'web';
  res.redirect(buildAuthUrl(platform));
};

/** GET /api/auth/callback - Google redirects here. */
export const callback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  let platform = 'web';
  try {
    platform = verifyState(state).p;
  } catch (err) {
    return res.redirect(`${env.frontendUrl}/#/auth/error?reason=${err.code}`);
  }
  const target = (hashPath) => (platform === 'android' ? `${env.androidRedirectUri}?${hashPath}` : `${env.frontendUrl}/#/auth/${hashPath.startsWith('code') ? 'callback' : 'error'}?${hashPath}`);

  if (error || !code) return res.redirect(target('reason=access_denied'));
  try {
    const user = await completeSignIn(String(code));
    await audit(user.id, 'login', { platform }, req.ip);
    return res.redirect(target(`code=${createExchangeCode(user.id)}`));
  } catch (err) {
    const reason = err instanceof AppError ? err.code : 'server_error';
    if (!(err instanceof AppError)) log.error('oauth callback failed', { message: err.message });
    return res.redirect(target(`reason=${reason}`));
  }
});

/** POST /api/auth/exchange - swaps the one-time code for an app session token. */
export const exchange = asyncHandler(async (req, res) => {
  res.json({ token: redeemExchangeCode(req.body.code) });
});

export const logout = asyncHandler(async (req, res) => {
  await audit(req.user.id, 'logout', null, req.ip);
  res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
  const [channel, settings, token] = await Promise.all([
    prisma.connectedChannel.findFirst({ where: { userId: req.user.id } }),
    prisma.userSettings.findUnique({ where: { userId: req.user.id } }),
    prisma.oAuthToken.findUnique({ where: { userId: req.user.id }, select: { needsReauth: true, scope: true } }),
  ]);
  res.json({
    user: { id: req.user.id, name: req.user.name, email: req.user.email, picture: req.user.picture },
    channel,
    settings,
    needsReauth: token?.needsReauth ?? true,
    canManage: String(token?.scope || '').includes('youtube.force-ssl'),
    canSeeRevenue: String(token?.scope || '').includes('yt-analytics-monetary'),
  });
});

export const disconnect = asyncHandler(async (req, res) => {
  await revokeAccess(req.user.id);
  await audit(null, 'account_deleted', { userId: req.user.id }, req.ip);
  await prisma.user.delete({ where: { id: req.user.id } });
  res.json({ ok: true });
});
