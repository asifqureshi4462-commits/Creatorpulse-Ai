import { z } from 'zod';

const days = z.coerce.number().int().refine((n) => [7, 28, 90, 365].includes(n), 'days must be 7, 28, 90 or 365').default(28);

export const exchangeSchema = z.object({ code: z.string().min(16).max(128) });

export const videoListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'views', 'likes', 'comments']).default('newest'),
  status: z.enum(['all', 'public', 'unlisted', 'private']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  refresh: z.enum(['0', '1']).optional(),
});

export const analyticsQuery = z.object({ days });

export const metadataBody = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string().trim().min(1).max(100)).max(60).optional(),
  })
  .refine((v) => v.title !== undefined || v.description !== undefined || v.tags !== undefined, 'Nothing to update')
  .refine((v) => !v.tags || v.tags.join(',').length <= 500, 'Tags may not exceed 500 characters in total');

export const commentsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  pageToken: z.string().max(500).optional(),
  filter: z.enum(['all', 'unanswered']).default('all'),
});

export const replyBody = z.object({ text: z.string().trim().min(1).max(10000) });

export const analyzeBody = z.object({
  videoId: z.string().max(64).optional(),
  youtubeUrl: z.string().url().max(300).optional(),
  transcript: z.string().max(60000).optional(),
});

export const generateBody = z
  .object({
    videoId: z.string().max(64).optional(),
    topic: z.string().trim().max(300).optional(),
    context: z.string().trim().max(8000).optional(),
  })
  .refine((v) => v.videoId || v.topic, 'Choose a video or enter a topic');

export const replySuggestBody = z.object({
  commentText: z.string().trim().min(1).max(5000),
  videoTitle: z.string().max(200).optional(),
});

export const settingsBody = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  notifyAlerts: z.boolean().optional(),
  notifyAi: z.boolean().optional(),
  notifyAnalytics: z.boolean().optional(),
  notifyAuth: z.boolean().optional(),
  aiLanguage: z.string().trim().min(2).max(40).optional(),
  aiTone: z.enum(['friendly', 'professional', 'energetic', 'educational']).optional(),
  regionCode: z.string().trim().length(2).toUpperCase().optional(),
});

export const notificationsQuery = z.object({
  unread: z.enum(['0', '1']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const alertsQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });
