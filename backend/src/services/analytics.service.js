import { google } from 'googleapis';

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

async function query(auth, params) {
  const { data } = await google.youtubeAnalytics({ version: 'v2', auth }).reports.query({ ids: 'channel==MINE', ...params });
  const cols = (data.columnHeaders || []).map((c) => c.name);
  return (data.rows || []).map((row) => Object.fromEntries(row.map((v, i) => [cols[i], v])));
}

const sum = (rows, k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
const weighted = (rows, k) => {
  const views = sum(rows, 'views');
  return views ? rows.reduce((a, r) => a + (Number(r[k]) || 0) * (Number(r.views) || 0), 0) / views : 0;
};

function totals(rows) {
  return {
    views: sum(rows, 'views'),
    watchHours: sum(rows, 'estimatedMinutesWatched') / 60,
    avgViewDuration: weighted(rows, 'averageViewDuration'),
    avgViewPercentage: weighted(rows, 'averageViewPercentage'),
    subscribersGained: sum(rows, 'subscribersGained'),
    subscribersLost: sum(rows, 'subscribersLost'),
    netSubscribers: sum(rows, 'subscribersGained') - sum(rows, 'subscribersLost'),
    likes: sum(rows, 'likes'),
    comments: sum(rows, 'comments'),
    shares: sum(rows, 'shares'),
  };
}

/** Daily series for the period plus totals for the period and the previous period of the same length. */
export async function channelOverview(auth, days) {
  const end = new Date();
  const curStart = addDays(end, -(days - 1));
  const prevStart = addDays(end, -(2 * days - 1));
  const rows = await query(auth, {
    startDate: iso(prevStart),
    endDate: iso(end),
    dimensions: 'day',
    sort: 'day',
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares',
  });
  const cut = iso(curStart);
  const current = rows.filter((r) => r.day >= cut);
  const previous = rows.filter((r) => r.day < cut);
  return {
    days,
    current: totals(current),
    previous: totals(previous),
    daily: current.map((r) => ({
      day: r.day,
      views: r.views,
      watchHours: r.estimatedMinutesWatched / 60,
      netSubscribers: r.subscribersGained - r.subscribersLost,
      likes: r.likes,
      comments: r.comments,
    })),
  };
}

export async function trafficSources(auth, { days = 28, youtubeVideoId, startDate } = {}) {
  const end = new Date();
  return query(auth, {
    startDate: startDate || iso(addDays(end, -(days - 1))),
    endDate: iso(end),
    dimensions: 'insightTrafficSourceType',
    metrics: 'views,estimatedMinutesWatched',
    sort: '-views',
    filters: youtubeVideoId ? `video==${youtubeVideoId}` : undefined,
  });
}

export async function topVideos(auth, days) {
  const end = new Date();
  return query(auth, {
    startDate: iso(addDays(end, -(days - 1))),
    endDate: iso(end),
    dimensions: 'video',
    metrics: 'views,estimatedMinutesWatched,averageViewPercentage,likes',
    sort: '-views',
    maxResults: 10,
  });
}

export async function revenue(auth, days) {
  const end = new Date();
  const rows = await query(auth, {
    startDate: iso(addDays(end, -(days - 1))),
    endDate: iso(end),
    metrics: 'estimatedRevenue,estimatedAdRevenue,cpm',
  });
  return rows[0] || null;
}

export async function demographics(auth, days) {
  const end = new Date();
  return query(auth, {
    startDate: iso(addDays(end, -(days - 1))),
    endDate: iso(end),
    dimensions: 'ageGroup,gender',
    metrics: 'viewerPercentage',
    sort: 'ageGroup,gender',
  });
}

export async function videoMetrics(auth, youtubeVideoId, startDate) {
  const rows = await query(auth, {
    startDate,
    endDate: iso(new Date()),
    metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
    filters: `video==${youtubeVideoId}`,
  });
  const r = rows[0] || {};
  return { ...r, watchHours: (r.estimatedMinutesWatched || 0) / 60 };
}

export async function retentionCurve(auth, youtubeVideoId, startDate) {
  const rows = await query(auth, {
    startDate,
    endDate: iso(new Date()),
    dimensions: 'elapsedVideoTimeRatio',
    metrics: 'audienceWatchRatio,relativeRetentionPerformance',
    filters: `video==${youtubeVideoId}`,
  });
  return rows.map((r) => ({ ratio: r.elapsedVideoTimeRatio, watchRatio: r.audienceWatchRatio, relative: r.relativeRetentionPerformance }));
}

/** One call for many videos (used by the hourly monitor). Returns a Map keyed by YouTube video id. */
export async function batchVideoMetrics(auth, youtubeVideoIds, startDate) {
  if (!youtubeVideoIds.length) return new Map();
  const rows = await query(auth, {
    startDate,
    endDate: iso(new Date()),
    dimensions: 'video',
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage',
    filters: `video==${youtubeVideoIds.slice(0, 200).join(',')}`,
    sort: '-views',
    maxResults: 200,
  });
  return new Map(rows.map((r) => [r.video, r]));
}

export const toDateString = iso;
