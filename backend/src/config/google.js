import { google } from 'googleapis';
import { env } from './environment.js';

export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

export const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  ...REQUIRED_SCOPES,
  // Needed to edit titles/descriptions/tags and reply to comments
  'https://www.googleapis.com/auth/youtube.force-ssl',
  // Optional: only returns data for monetized channels
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
];

export function createOAuthClient() {
  return new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}
