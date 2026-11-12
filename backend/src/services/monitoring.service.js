import { prisma } from '../config/database.js';
import { env } from '../config/environment.js';
import { log } from '../utils/logger.js';
import { isAuthError, isPermissionError, isQuotaError } from '../utils/googleErrors.js';
import { getAuthClientForUser, markReauthRequired } from './oauth.service.js';
import { refreshVideoStats, syncVideos } from './youtube.service.js';
import * as analytics from './analytics.service.js';
import { diagnosePerformance, isGeminiConfigured } from './gemini.service.js';
import { notify } from './notification.service.js';

const HOUR = 3600000;
let running = false;

const nearest = (snaps, targetMs, toleranceMs = 90 * 60000) => {
  let best = null;
  for (const s of snaps) {
    const d = Math.abs(s.capturedAt.getTime() - targetMs);
    if (d <= toleranceMs && (!best || d < best.d)) best = { s, d };
  }
  return best?.s || null;
};

const pctChange = (from, to) => (from > 0 ? ((to - from) / from) * 100 : 0);

/** Runs one monitoring pass over every connected channel. Safe to call hourly. */
export async function runMonitoringCycle() {
  if (running) return { skipped: true };
  running = true;
  const job = await prisma.scheduledJob.create({ data: { name: 'video-monitoring', status: 'running' } });
  const stats = { channels: 0, videos: 0, alerts: 0, errors: 0 };
  let status = 'success';
  let message = '';
  try {
    const channels = await prisma.connectedChannel.findMany({ where: { user: { token: { needsReauth: false } } } });
    for (const channel of channels) {
      try {
        const r = await monitorChannel(channel);
        stats.channels++;
        stats.videos += r.videos;
        stats.alerts += r.alerts;
      } catch (err) {
        stats.errors++;
        if (isQuotaError(err)) {
          message = 'YouTube API quota reached; remaining channels skipped until next run.';
          status = 'partial';
          log.warn(message);
          break;
        }
        if (isAuthError(err)) await markReauthRequired(channel.userId);
        else log.error('monitor channel failed', { channelId: channel.id, message: err.message });
      }
    }
    if (stats.errors && status === 'success') status = 'partial';
  } catch (err) {
    status = 'failed';
    message = err.message;
    log.error('monitoring cycle failed', { message: err.message });
  } finally {
    running = false;
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: { status, finishedAt: new Date(), message: message || JSON.stringify(stats) },
    });
  }
  return stats;
}

async function monitorChannel(channel) {
  const userId = channel.userId;
  const auth = await getAuthClientForUser(userId);
  const now = Date.now();

  // 1. Detect newly published videos and refresh channel profile
  const { newVideos } = await syncVideos(userId, auth, { maxPages: 1 });
  for (const v of newVideos.filter((x) => now - x.publishedAt.getTime() < 7 * 24 * HOUR)) {
    await notify(userId, {
      type: 'analytics',
      title: 'New video detected',
      body: `"${v.title}" is now tracked. Performance monitoring starts 24 hours after publication.`,
      link: '#/videos',
    });
  }

  // 2. Daily channel snapshot
  const fresh = await prisma.channelAnalytics.findFirst({ where: { channelId: channel.id, capturedAt: { gte: new Date(now - 23 * HOUR) } } });
  if (!fresh) {
    const c = await prisma.connectedChannel.findUnique({ where: { id: channel.id } });
    await prisma.channelAnalytics.create({ data: { channelId: c.id, subscribers: c.subscriberCount, views: c.viewCount, videos: c.videoCount } });
  }

  // 3. Videos in the monitoring window that are at least 24h old
  const windowStart = new Date(now - env.monitorWindowDays * 24 * HOUR);
  const candidates = await prisma.video.findMany({
    where: { channelId: channel.id, privacyStatus: 'public', publishedAt: { gte: windowStart, lte: new Date(now - 24 * HOUR) } },
  });
  if (!candidates.length) return { videos: 0, alerts: 0 };

  const refreshed = await refreshVideoStats(auth, candidates);
  let metricMap = new Map();
  try {
    metricMap = await analytics.batchVideoMetrics(auth, refreshed.map((v) => v.youtubeVideoId), analytics.toDateString(windowStart));
  } catch (err) {
    if (isQuotaError(err) || isAuthError(err)) throw err;
    if (!isPermissionError(err)) log.warn('analytics batch unavailable', { message: err.message });
  }

  let alerts = 0;
  for (const video of refreshed) {
    const m = metricMap.get(video.youtubeVideoId);
    const prior = await prisma.videoAnalytics.count({ where: { videoId: video.id } });
    await prisma.videoAnalytics.create({
      data: {
        videoId: video.id,
        views: video.viewCount,
        likes: video.likeCount,
        comments: video.commentCount,
        watchMinutes: m?.estimatedMinutesWatched ?? null,
        avgViewDuration: m?.averageViewDuration ?? null,
        avgViewPercentage: m?.averageViewPercentage ?? null,
        isInitialCheck: prior === 0,
      },
    });
    alerts += await detectChanges(auth, channel, video);
  }
  return { videos: refreshed.length, alerts };
}

async function detectChanges(auth, channel, video) {
  const now = Date.now();
  const snaps = await prisma.videoAnalytics.findMany({
    where: { videoId: video.id, capturedAt: { gte: new Date(now - 52 * HOUR) } },
    orderBy: { capturedAt: 'asc' },
  });
  const cur = snaps[snaps.length - 1];
  const s24 = nearest(snaps, now - 24 * HOUR);
  const s48 = nearest(snaps, now - 48 * HOUR);
  let raised = 0;

  // Same-length windows (last 24h vs the 24h before) so the time of day is comparable
  if (cur && s24 && s48) {
    const last24 = Number(cur.views - s24.views);
    const prev24 = Number(s24.views - s48.views);
    if (prev24 >= env.monitorMinViews && last24 <= prev24 * 0.5) {
      const drop = Math.round(-pctChange(prev24, last24));
      raised += await raiseAlert(auth, channel, video, {
        kind: 'views_decline',
        priority: drop >= 70 ? 'high' : 'medium',
        title: 'Views are declining',
        detectedChange: `Views in the last 24 hours (${last24}) are ${drop}% lower than in the previous 24 hours (${prev24}).`,
        evidence: { last24Views: last24, previous24Views: prev24, dropPercent: drop },
      });
    }
  }

  if (cur?.avgViewDuration && s24?.avgViewDuration && s24.avgViewDuration > 0) {
    const change = pctChange(s24.avgViewDuration, cur.avgViewDuration);
    if (change <= -10) {
      raised += await raiseAlert(auth, channel, video, {
        kind: 'duration_decline',
        priority: change <= -25 ? 'high' : 'medium',
        title: 'Average view duration decreased',
        detectedChange: `Average view duration moved from ${Math.round(s24.avgViewDuration)}s to ${Math.round(cur.avgViewDuration)}s (${Math.round(change)}%) in 24 hours.`,
        evidence: {
          avgViewDurationBefore: s24.avgViewDuration,
          avgViewDurationNow: cur.avgViewDuration,
          avgViewPercentageBefore: s24.avgViewPercentage,
          avgViewPercentageNow: cur.avgViewPercentage,
        },
      });
    }
  }
  return raised;
}

async function raiseAlert(auth, channel, video, { kind, priority, title, detectedChange, evidence }) {
  const recent = await prisma.performanceAlert.findFirst({ where: { videoId: video.id, kind, createdAt: { gte: new Date(Date.now() - 24 * HOUR) } } });
  if (recent) return 0;

  let possibleExplanation = 'Automatic AI diagnosis is not available, so no cause has been inferred from the data.';
  let recommendedAction = 'Open the video analytics to review traffic sources and the audience retention curve.';
  let finalPriority = priority;
  let metrics = { ...evidence };

  try {
    const [traffic, curve] = await Promise.allSettled([
      analytics.trafficSources(auth, { youtubeVideoId: video.youtubeVideoId, startDate: analytics.toDateString(video.publishedAt) }),
      analytics.retentionCurve(auth, video.youtubeVideoId, analytics.toDateString(video.publishedAt)),
    ]);
    if (traffic.status === 'fulfilled') metrics.trafficSources = traffic.value;
    if (curve.status === 'fulfilled' && curve.value.length) {
      const at = (r) => curve.value.find((p) => Math.abs(p.ratio - r) < 0.011)?.watchRatio;
      metrics.retention = { at5pct: at(0.05), at25pct: at(0.25), at50pct: at(0.5), at75pct: at(0.75) };
    }
    if (isGeminiConfigured()) {
      const settings = await prisma.userSettings.findUnique({ where: { userId: channel.userId } });
      const d = await diagnosePerformance({ prefs: settings, video, evidence: { alertType: kind, detected: detectedChange, ...metrics } });
      possibleExplanation = [d.observation, d.possibleReason, d.supportingAnalytics].filter(Boolean).join(' ');
      recommendedAction = d.recommendedImprovement || recommendedAction;
      if (['low', 'medium', 'high'].includes(d.priority)) finalPriority = d.priority;
      metrics.confidence = d.confidence;
    }
  } catch (err) {
    log.warn('diagnosis unavailable', { message: err.message });
  }

  const alert = await prisma.performanceAlert.create({
    data: {
      userId: channel.userId,
      videoId: video.id,
      kind,
      priority: finalPriority,
      title,
      detectedChange,
      possibleExplanation,
      recommendedAction,
      metrics: JSON.parse(JSON.stringify(metrics)),
    },
  });
  await notify(channel.userId, {
    type: 'alert',
    title: `${title}: ${video.title}`,
    body: `${detectedChange} Recommended: ${recommendedAction}`,
    link: `#/notifications?alert=${alert.id}`,
  });
  return 1;
}
