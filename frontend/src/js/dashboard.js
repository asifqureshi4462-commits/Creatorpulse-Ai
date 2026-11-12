import { api } from './api.js';
import { barChart, destroyCharts, lineChart } from '../components/charts.js';
import { compact, delta, dateOnly, emptyBlock, esc, errorBlock, icon, loadingBlock, num, renderIcons, timeAgo } from './utils.js';

const safe = (p) => p.then((data) => ({ ok: true, data })).catch((error) => ({ ok: false, error }));

export async function render(el, ctx) {
  let days = 28;
  const first = (ctx.user.name || 'Creator').split(' ')[0];
  el.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5 fade-in">
      <div class="flex items-center gap-4">
        <img class="avatar" style="width:64px;height:64px" src="${esc(ctx.user.picture || '/logo.svg')}" alt="" referrerpolicy="no-referrer" />
        <div><h1 class="page-title">Welcome back, ${esc(ctx.user.name || first)} &#128075;</h1><div class="page-sub">Let's grow your channel together!</div></div>
      </div>
      <div class="pill-group" id="range">${[7, 28, 90, 365].map((d) => `<button class="pill ${d === days ? 'active' : ''}" data-d="${d}">${d === 365 ? 'Last 365 Days' : `Last ${d} Days`}</button>`).join('')}</div>
    </div>
    <div id="dash-body">${loadingBlock(4, 110)}</div>`;

  const body = el.querySelector('#dash-body');
  el.querySelector('#range').addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    days = Number(b.dataset.d);
    el.querySelectorAll('#range .pill').forEach((p) => p.classList.toggle('active', p === b));
    load();
  });

  async function load() {
    destroyCharts();
    body.innerHTML = loadingBlock(4, 110);
    const [stats, overview, videos, alerts, rec] = await Promise.all([
      safe(api.get('/channel/statistics')),
      safe(api.get('/analytics/overview', { days })),
      safe(api.get('/videos', { pageSize: 5, sort: 'newest' })),
      safe(api.get('/alerts', { limit: 3 })),
      safe(api.get('/ai/recommendations/latest')),
    ]);
    if (!stats.ok) { body.innerHTML = errorBlock(stats.error); return; }

    const t = stats.data.totals;
    const ov = overview.ok && overview.data.channel.available ? overview.data.channel.data : null;
    const cards = [
      ['youtube-views', 'eye', 'Total Views', compact(t.views), ov ? delta(ov.current.views, ov.previous.views) : '<span class="muted text-xs">period change unavailable</span>'],
      ['subs', 'users', 'Subscribers', t.subscribers === null ? 'Hidden' : compact(t.subscribers), ov ? `<span class="${ov.current.netSubscribers >= 0 ? 'delta-up' : 'delta-down'}">${ov.current.netSubscribers >= 0 ? '+' : ''}${num(ov.current.netSubscribers)}</span> <span class="muted text-xs">in period</span>` : ''],
      ['videos', 'play', 'Total Videos', num(t.videos), '<span class="muted text-xs">on your channel</span>'],
      ['likes', 'thumbs-up', 'Total Likes', compact(t.likes), ov ? delta(ov.current.likes, ov.previous.likes) : `<span class="muted text-xs">across ${num(t.likesCoverage)} synced videos</span>`],
    ];
    const strategy = rec.ok ? rec.data.recommendation : null;
    const list = videos.ok ? videos.data.items : [];
    const alertItems = alerts.ok ? alerts.data.items : [];

    body.innerHTML = `
    <div class="grid-stats fade-in">${cards.map(([, ic, label, val, d]) => `<div class="card stat-card"><div class="stat-icon">${icon(ic, 22)}</div><div class="muted text-sm">${label}</div><div class="stat-value">${val}</div><div>${d}</div></div>`).join('')}</div>
    <div class="grid-main mt-4">
      <div class="card"><div class="card-title">Views Overview</div>${ov ? '<div class="chart-box"><canvas id="c-views"></canvas></div>' : `<div class="note-box">Analytics unavailable: ${esc(overview.ok ? overview.data.channel.error : overview.error.message)}</div>`}</div>
      <div class="card"><div class="card-title">AI Recommendation</div>${strategy ? `<div class="flex items-start gap-3">${icon('lightbulb', 22, 'text-yellow-300')}<div><div class="font-semibold">${esc(strategy.payload.nextVideo?.topic || 'Your latest strategy')}</div><div class="muted text-sm mt-1">${esc(strategy.payload.nextVideo?.whyRecommended || '')}</div><div class="muted text-xs mt-2">Generated ${timeAgo(strategy.createdAt)}</div></div></div>` : '<div class="muted text-sm">No recommendations yet. Generate a data-based strategy for your next video.</div>'}
        <a class="btn btn-primary mt-4" href="#/channel-strategist">${strategy ? 'View Strategy' : 'Generate Strategy'} ${icon('chevron-right', 16)}</a></div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card"><div class="card-title">Subscribers Growth (net per day)</div>${ov ? '<div class="chart-box"><canvas id="c-subs"></canvas></div>' : '<div class="note-box">Unavailable without analytics access.</div>'}</div>
      <div class="card"><div class="card-title">Engagement Overview</div>${ov ? '<div class="chart-box"><canvas id="c-eng"></canvas></div>' : '<div class="note-box">Unavailable without analytics access.</div>'}</div>
    </div>
    <div class="grid-main mt-4">
      <div class="card"><div class="flex items-center justify-between"><div class="card-title">Recent Video Performance</div><a class="muted text-sm" href="#/videos">View all</a></div>
        ${list.length ? list.map((v) => `<a class="video-row" href="#/videos/${esc(v.id)}"><img class="video-thumb" src="${esc(v.thumbnail || '')}" alt="" loading="lazy" referrerpolicy="no-referrer" /><div><div class="video-title">${esc(v.title)}</div><div class="muted text-xs mt-1">${timeAgo(v.publishedAt)}</div></div><div class="video-metrics video-extra"><span>${icon('eye', 14)} ${compact(v.viewCount)}</span><span>${icon('thumbs-up', 14)} ${compact(v.likeCount)}</span></div></a>`).join('') : emptyBlock('No videos yet', videos.ok ? 'Upload a video to see its performance here.' : videos.error.message, 'video')}</div>
      <div class="card"><div class="flex items-center justify-between"><div class="card-title">Recent Alerts</div><a class="muted text-sm" href="#/notifications">View all</a></div>
        ${alertItems.length ? alertItems.map((a) => `<a class="notif mb-2" href="#/notifications" style="text-decoration:none;color:inherit"><div class="notif-icon" style="background:rgba(239,68,68,.18);color:#ff7b7b">${icon('alert-triangle', 18)}</div><div class="min-w-0"><div class="font-semibold text-sm">${esc(a.title)}</div><div class="muted text-xs mt-1">${esc(a.video.title)} &bull; ${timeAgo(a.createdAt)}</div></div></a>`).join('') : emptyBlock('No alerts', 'Monitoring starts 24 hours after a video is published. Alerts appear here when performance changes.', 'bell')}</div>
    </div>`;

    if (ov) {
      const labels = ov.daily.map((d) => d.day.slice(5));
      lineChart(body.querySelector('#c-views'), labels, [{ label: 'Views', data: ov.daily.map((d) => d.views), color: '#6d5dfc' }]);
      barChart(body.querySelector('#c-subs'), labels, [{ label: 'Net subscribers', data: ov.daily.map((d) => d.netSubscribers), color: '#2f9bff' }]);
      barChart(body.querySelector('#c-eng'), ['Likes', 'Comments', 'Shares'], [{ label: `Last ${days} days`, data: [ov.current.likes, ov.current.comments, ov.current.shares], color: '#a855f7' }]);
    }
    renderIcons(body);
  }
  await load();
}
