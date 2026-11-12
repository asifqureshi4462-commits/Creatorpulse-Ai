import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { prisma } from '../config/database.js';
import { env } from '../config/environment.js';
import { createOAuthClient, REQUIRED_SCOPES, SCOPES } from '../config/google.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { AppError } from '../utils/errors.js';
import { notify } from './notification.service.js';
import { signSession } from '../middleware/auth.js';

const exchangeCodes = new Map(); // one-time, 60 second codes (single web-service instance)

export function buildAuthUrl(platform = 'web') {
  const state = jwt.sign({ p: platform, n: crypto.randomBytes(8).toString('hex'), typ: 'oauth-state' }, env.sessionSecret, { expiresIn: '10m' });
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export function verifyState(state) {
  try {
    const payload = jwt.verify(String(state), env.sessionSecret);
    if (payload.typ !== 'oauth-state') throw new Error('wrong type');
    return payload;
  } catch {
    throw new AppError(400, 'INVALID_STATE', 'Invalid or expired sign-in request. Please try again.');
  }
}

/** Handles the Google callback: verifies the YouTube channel, stores encrypted tokens, returns the user. */
export async function completeSignIn(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const granted = String(tokens.scope || '').split(' ');
  const missing = REQUIRED_SCOPES.filter((s) => !granted.includes(s));
  if (missing.length) throw new AppError(403, 'MISSING_SCOPES', 'Required YouTube permissions were not granted.');

  const { data: profile } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
  const yt = google.youtube({ version: 'v3', auth: client });
  const { data } = await yt.channels.list({ part: ['snippet', 'statistics', 'contentDetails'], mine: true });
  const ch = data.items?.[0];
  if (!ch) throw new AppError(404, 'NO_CHANNEL', 'This Google account has no YouTube channel.');

  const user = await prisma.user.upsert({
    where: { googleId: profile.id },
    create: { googleId: profile.id, email: profile.email, name: profile.name, picture: profile.picture },
    update: { email: profile.email, name: profile.name, picture: profile.picture },
  });
  await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });

  const channelData = {
    title: ch.snippet.title,
    description: ch.snippet.description || null,
    thumbnail: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url || null,
    customUrl: ch.snippet.customUrl || null,
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads || null,
    subscriberCount: Number(ch.statistics?.subscriberCount || 0),
    hiddenSubscribers: Boolean(ch.statistics?.hiddenSubscriberCount),
    viewCount: BigInt(ch.statistics?.viewCount || 0),
    videoCount: Number(ch.statistics?.videoCount || 0),
  };
  await prisma.connectedChannel.upsert({
    where: { userId_youtubeChannelId: { userId: user.id, youtubeChannelId: ch.id } },
    create: { userId: user.id, youtubeChannelId: ch.id, ...channelData },
    update: channelData,
  });

  const existing = await prisma.oAuthToken.findUnique({ where: { userId: user.id } });
  const refreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : existing?.refreshTokenEnc || null;
  const tokenData = {
    accessTokenEnc: encrypt(tokens.access_token),
    refreshTokenEnc: refreshEnc,
    scope: tokens.scope || null,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    needsReauth: false,
  };
  await prisma.oAuthToken.upsert({ where: { userId: user.id }, create: { userId: user.id, ...tokenData }, update: tokenData });
  return user;
}

export function createExchangeCode(userId) {
  const now = Date.now();
  for (const [k, v] of exchangeCodes) if (v.exp < now) exchangeCodes.delete(k);
  const code = crypto.randomBytes(32).toString('hex');
  exchangeCodes.set(code, { userId, exp: now + 60_000 });
  return code;
}

export function redeemExchangeCode(code) {
  const entry = exchangeCodes.get(code);
  exchangeCodes.delete(code);
  if (!entry || entry.exp < Date.now()) throw new AppError(400, 'INVALID_CODE', 'Sign-in code is invalid or expired. Please sign in again.');
  return signSession(entry.userId);
}

/** Returns an authorized Google client for a user; refreshed tokens are persisted (encrypted). */
export async function getAuthClientForUser(userId) {
  const rec = await prisma.oAuthToken.findUnique({ where: { userId } });
  if (!rec || rec.needsReauth) throw new AppError(401, 'REAUTH_REQUIRED', 'Google access expired or was revoked. Please sign in again.');
  const client = createOAuthClient();
  client.setCredentials({
    access_token: decrypt(rec.accessTokenEnc),
    refresh_token: rec.refreshTokenEnc ? decrypt(rec.refreshTokenEnc) : undefined,
    expiry_date: rec.expiryDate ? rec.expiryDate.getTime() : undefined,
  });
  client.on('tokens', async (t) => {
    const data = {};
    if (t.access_token) data.accessTokenEnc = encrypt(t.access_token);
    if (t.refresh_token) data.refreshTokenEnc = encrypt(t.refresh_token);
    if (t.expiry_date) data.expiryDate = new Date(t.expiry_date);
    if (Object.keys(data).length) await prisma.oAuthToken.update({ where: { userId }, data }).catch(() => {});
  });
  return client;
}

export async function markReauthRequired(userId) {
  const rec = await prisma.oAuthToken.findUnique({ where: { userId } });
  if (!rec || rec.needsReauth) return;
  await prisma.oAuthToken.update({ where: { userId }, data: { needsReauth: true } });
  await notify(userId, {
    type: 'auth',
    title: 'Sign-in required',
    body: 'Google access was revoked or expired, so monitoring is paused. Sign in again to resume.',
  });
}

export async function revokeAccess(userId) {
  const rec = await prisma.oAuthToken.findUnique({ where: { userId } });
  if (!rec) return;
  try {
    const client = createOAuthClient();
    await client.revokeToken(decrypt(rec.refreshTokenEnc || rec.accessTokenEnc));
  } catch {
    /* token may already be invalid */
  }
}
