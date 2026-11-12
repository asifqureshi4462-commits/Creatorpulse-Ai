import { AppError } from '../utils/errors.js';
import { log } from '../utils/logger.js';
import { googleMessage, isAuthError, isNotFoundError, isPermissionError, isQuotaError } from '../utils/googleErrors.js';
import { markReauthRequired } from '../services/oauth.service.js';

export const notFound = (req, _res, next) => next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`));

// eslint-disable-next-line no-unused-vars
export async function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on the server.';

  if (err instanceof AppError) {
    ({ status, code, message } = err);
  } else if (err?.code === 'LIMIT_FILE_SIZE') {
    status = 413; code = 'FILE_TOO_LARGE'; message = 'Video file is too large. Use up to 14 MB, or analyze via a public YouTube URL or a transcript.';
  } else if (err?.name === 'MulterError') {
    status = 400; code = 'UPLOAD_ERROR'; message = err.message;
  } else if (isQuotaError(err)) {
    status = 429; code = 'YOUTUBE_QUOTA'; message = 'The YouTube API daily quota has been reached. Try again later.';
  } else if (isAuthError(err)) {
    status = 401; code = 'REAUTH_REQUIRED'; message = 'Google access expired or was revoked. Please sign in again.';
    if (req.user) await markReauthRequired(req.user.id).catch(() => {});
  } else if (isPermissionError(err)) {
    status = 403; code = 'INSUFFICIENT_PERMISSIONS'; message = 'Google permission missing for this action. Sign in again and approve all requested permissions.';
  } else if (isNotFoundError(err)) {
    status = 404; code = 'NOT_FOUND'; message = googleMessage(err);
  } else if (err?.response?.data?.error?.message) {
    status = 502; code = 'GOOGLE_API_ERROR'; message = googleMessage(err);
  }

  if (status >= 500) log.error(err?.message || 'error', { code, path: req.path, stack: err?.stack });
  res.status(status).json({ error: { code, message } });
}
