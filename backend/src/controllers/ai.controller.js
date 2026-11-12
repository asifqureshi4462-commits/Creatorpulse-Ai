import { prisma } from '../config/database.js';
import { env } from '../config/environment.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { getAuthClientForUser } from '../services/oauth.service.js';
import * as gemini from '../services/gemini.service.js';
import * as analytics from '../services/analytics.service.js';
import { mostPopular } from '../services/youtube.service.js';
import { findOwnedVideo } from './video.controller.js';
import { notify } from '../services/notification.service.js';

async function enforceDailyLimit(userId) {
  const since = new Date(Date.now() - 24 * 3600000);
  const used = await prisma.aiAnalysis.count({ where: { userId, createdAt: { gte: since } } });
  if (used >= env.aiDailyLimit) throw new AppError(429, 'AI_DAILY_LIMIT', `Daily AI limit of ${env.aiDailyLimit} requests reached. Try again tomorrow.`);
}

const prefsOf = (userId) => prisma.userSettings.findUnique({ where: { userId } });

async function save(userId, videoId, type, input, result) {
  await prisma.aiAnalysis.create({ data: { userId, videoId: videoId || null, type, input, result } });
}

export const status = asyncHandler(async (_req, res) => {
  res.json({ configured: gemini.isGeminiConfigured(), model: gemini.isGeminiConfigured() ? env.geminiModel : null });
});

const YT_URL = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/;

export const analyzeVideo = asyncHandler(async (req, res) => {
  await enforceDailyLimit(req.user.id);
  const { videoId, youtubeUrl, transcript } = req.body;
  const video = videoId ? await findOwnedVideo(req.channel.id, videoId) : null;

  let mediaPart = null;
  let inputKind = transcript ? 'transcript' : 'metadata';
  if (req.file) {
    mediaPart = { inline_data: { mime_type: req.file.mimetype, data: req.file.buffer.toString('base64') } };
    inputKind = 'media';
  } else if (youtubeUrl) {
    if (!YT_URL.test(youtubeUrl)) throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid public YouTube video URL.');
    mediaPart = { file_data: { file_uri: youtubeUrl } };
    inputKind = 'media';
  } else if (video && video.privacyStatus === 'public' && !transcript) {
    mediaPart = { file_data: { file_uri: `https://www.youtube.com/watch?v=${video.youtubeVideoId}` } };
    inputKind = 'media';
  }
  if (!mediaPart && !transcript && !video) throw new AppError(400, 'VALIDATION_ERROR', 'Provide a video file, a public YouTube URL, a transcript, or choose one of your videos.');

  const result = await gemini.analyzeVideo({ prefs: await prefsOf(req.user.id), video, transcript, mediaPart, inputKind });
  result.inputKind = inputKind;
  await save(req.user.id, video?.id, 'video-analysis', { videoId, youtubeUrl, hasTranscript: Boolean(transcript), inputKind, fileName: req.file?.originalname }, result);
  await notify(req.user.id, { type: 'ai', title: 'Analysis complete', body: `Your video analysis${video ? ` for "${video.title}"` : ''} is ready.`, link: '#/ai-analyzer' });
  res.json({ result });
});

const generator = (type, fn) =>
  asyncHandler(async (req, res) => {
    await enforceDailyLimit(req.user.id);
    const video = req.body.videoId ? await findOwnedVideo(req.channel.id, req.body.videoId) : null;
    const result = await fn({ prefs: await prefsOf(req.user.id), video, topic: req.body.topic, context: req.body.context });
    await save(req.user.id, video?.id, type, req.body, result);
    res.json({ result });
  });

export const generateTitle = generator('titles', gemini.generateTitles);
export const generateDescription = generator('description', gemini.generateDescription);
export const generateTags = generator('tags', gemini.generateTags);
export const thumbnailSuggestions = generator('thumbnails', gemini.thumbnailSuggestions);

export const replySuggestions = asyncHandler(async (req, res) => {
  await enforceDailyLimit(req.user.id);
  const result = await gemini.replySuggestions({ prefs: await prefsOf(req.user.id), ...req.body });
  await save(req.user.id, null, 'reply-suggestions', req.body, result);
  res.json({ result });
});

const attempt = async (promise) => {
  try { return await promise; } catch { return null; }
};

export const channelStrategy = asyncHandler(async (req, res) => {
  await enforceDailyLimit(req.user.id);
  const auth = await getAuthClientForUser(req.user.id);
  const prefs = await prefsOf(req.user.id);
  const channel = req.channel;

  const videos = await prisma.video.findMany({ where: { channelId: channel.id, privacyStatus: 'public' }, orderBy: { publishedAt: 'desc' }, take: 60 });
  if (videos.length < 1) throw new AppError(400, 'NOT_ENOUGH_DATA', 'Publish at least one public video before generating a strategy.');
  const compact = (v) => ({ title: v.title, publishedAt: v.publishedAt, views: Number(v.viewCount), likes: Number(v.likeCount), comments: Number(v.commentCount), tags: v.tags.slice(0, 8), categoryId: v.categoryId });
  const best = [...videos].sort((a, b) => Number(b.viewCount - a.viewCount)).slice(0, 10).map(compact);
  const category = videos.find((v) => v.categoryId)?.categoryId;

  const [overview, demographics, trends] = await Promise.all([
    attempt(analytics.channelOverview(auth, 90)),
    attempt(analytics.demographics(auth, 90)),
    attempt(mostPopular(auth, prefs?.regionCode || 'US', category)),
  ]);

  const dataUsed = {
    videosAnalyzed: videos.length,
    historicalAnalytics: Boolean(overview),
    audienceDemographics: Boolean(demographics?.length),
    publicTrends: Boolean(trends?.length),
    trendRegion: prefs?.regionCode || 'US',
  };
  const result = await gemini.channelStrategy({
    prefs,
    data: {
      channel: { title: channel.title, subscribers: channel.hiddenSubscribers ? 'hidden' : channel.subscriberCount, totalViews: Number(channel.viewCount), videos: channel.videoCount },
      recentVideos: videos.slice(0, 15).map(compact),
      bestPerforming: best,
      last90DayTotals: overview ? { current: overview.current, previous: overview.previous } : 'unavailable',
      audienceDemographics: demographics?.length ? demographics : 'unavailable',
      publicTrendingVideos: trends?.length ? trends : 'unavailable',
      today: new Date().toISOString().slice(0, 10),
    },
  });
  result.dataUsed = dataUsed;
  const rec = await prisma.aiRecommendation.create({ data: { userId: req.user.id, channelId: channel.id, type: 'channel-strategy', payload: result } });
  await save(req.user.id, null, 'channel-strategy', { dataUsed }, { id: rec.id });
  await notify(req.user.id, { type: 'ai', title: 'New channel strategy', body: `Next video idea: ${result.nextVideo?.topic || 'see your strategy'}`, link: '#/channel-strategist' });
  res.json({ recommendation: { id: rec.id, createdAt: rec.createdAt, payload: result } });
});

export const latestRecommendation = asyncHandler(async (req, res) => {
  const rec = await prisma.aiRecommendation.findFirst({ where: { userId: req.user.id, type: 'channel-strategy' }, orderBy: { createdAt: 'desc' } });
  res.json({ recommendation: rec ? { id: rec.id, createdAt: rec.createdAt, payload: rec.payload } : null });
});
