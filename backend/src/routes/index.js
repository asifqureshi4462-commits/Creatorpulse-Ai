import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireChannel } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { aiLimiter, authLimiter } from '../middleware/rateLimit.js';
import * as s from '../validators/schemas.js';
import * as auth from '../controllers/auth.controller.js';
import * as channel from '../controllers/channel.controller.js';
import * as video from '../controllers/video.controller.js';
import * as analytics from '../controllers/analytics.controller.js';
import * as comment from '../controllers/comment.controller.js';
import * as ai from '../controllers/ai.controller.js';
import * as notification from '../controllers/notification.controller.js';
import * as settings from '../controllers/settings.controller.js';
import { AppError } from '../utils/errors.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 14 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype) ? cb(null, true) : cb(new AppError(400, 'UNSUPPORTED_FILE', 'Only MP4, MOV or WEBM video files are supported.')),
});

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Auth (public)
router.get('/auth/google', authLimiter, auth.start);
router.get('/auth/callback', authLimiter, auth.callback);
router.post('/auth/exchange', authLimiter, validate(s.exchangeSchema), auth.exchange);

// Everything below requires a signed-in user
router.use(authenticate);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', auth.me);
router.get('/settings', settings.get);
router.put('/settings', validate(s.settingsBody), settings.update);
router.delete('/settings/account', auth.disconnect);
router.get('/notifications', validate(s.notificationsQuery, 'query'), notification.list);
router.get('/notifications/unread-count', notification.unreadCount);
router.get('/notifications/jobs', notification.jobs);
router.post('/notifications/read-all', notification.markAllRead);
router.post('/notifications/:id/read', notification.markRead);
router.get('/alerts', validate(s.alertsQuery, 'query'), notification.alerts);
router.get('/ai/status', ai.status);

// Everything below requires a connected YouTube channel
router.use(requireChannel);
router.get('/channel/profile', channel.profile);
router.get('/channel/statistics', channel.statistics);

router.get('/videos', validate(s.videoListQuery, 'query'), video.list);
router.post('/videos/sync', video.sync);
router.get('/videos/:id', video.get);
router.get('/videos/:id/analytics', video.videoAnalytics);
router.put('/videos/:id/metadata', validate(s.metadataBody), video.updateMetadata);

router.get('/comments', validate(s.commentsQuery, 'query'), comment.list);
router.post('/comments/:id/reply', validate(s.replyBody), comment.reply);

router.get('/analytics/overview', validate(s.analyticsQuery, 'query'), analytics.overview);
router.get('/analytics/history', analytics.history);

router.post('/ai/analyze-video', aiLimiter, upload.single('video'), validate(s.analyzeBody), ai.analyzeVideo);
router.post('/ai/generate-title', aiLimiter, validate(s.generateBody), ai.generateTitle);
router.post('/ai/generate-description', aiLimiter, validate(s.generateBody), ai.generateDescription);
router.post('/ai/generate-tags', aiLimiter, validate(s.generateBody), ai.generateTags);
router.post('/ai/thumbnail-suggestions', aiLimiter, validate(s.generateBody), ai.thumbnailSuggestions);
router.post('/ai/reply-suggestions', aiLimiter, validate(s.replySuggestBody), ai.replySuggestions);
router.post('/ai/channel-strategy', aiLimiter, ai.channelStrategy);
router.get('/ai/recommendations/latest', ai.latestRecommendation);

export default router;
