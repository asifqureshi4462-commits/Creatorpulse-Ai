import { api } from './api.js';
import { barChart, destroyCharts, doughnutChart, lineChart } from '../components/charts.js';
import { compact, delta, emptyBlock, errorBlock, esc, icon, loadingBlock, num, pct, renderIcons, secs, trafficLabel, unavailable } from './utils.js';

export async function render(el) {
  let days = 28;
  el.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div><h1 class="page-title">Analytics Overview</h1><div class="page-sub">Track your channel performance in detail</div></div>
      <div class="pill-group" id="range">${[7, 28, 90, 365].map((d) => `<button class="pill ${d === days ? 'active' : ''}" data-d="${d}">${d === 7 ? '7D' : d === 28 ? '28D' : d === 90 ? '90D' : '1Y'}</button>`).join('')}</div>
    </div><div id="an-body">${loadingBlock(4, 110)}</div>`;
  const body = el.querySelector('#an-body');
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
    let d;
    let hist;
    try {
      [d, hist] = await Promise.all([api.get('/analytics/overview', { days }), api.get('/analytics/history').catch(() => ({ items: [] }))]);
    } catch (err) { body.innerHTML = errorBlock(err); return; }

    const ch = d.channel;
    const ov = ch.available ? ch.data : null;
    const stat = (ic, label, val, sub) => `<div class="card stat-card"><div class="stat-icon">${icon(ic, 20)}</div><div class="muted text-sm">${label}</div><div class="stat-value">${val}</div><div>${sub}</div></div>`;

    body.innerHTML = `
    ${ov ? `<div class="grid-stats">
      ${stat('eye', 'Views', compact(ov.current.views), delta(ov.current.views, ov.previous.views))}
      ${stat('clock', 'Watch time', `${compact(ov.current.watchHours)} h`, delta(ov.current.watchHours, ov.previous.watchHours))}
      ${stat('users', 'Net subscribers', `${ov.current.netSubscribers >= 0 ? '+' : ''}${compact(ov.current.netSubscribers)}`, `<span class="muted text-xs">+${num(ov.current.subscribersGained)} / -${num(ov.current.subscribersLost)}</span>`)}
      ${stat('target', 'Avg % viewed', pct(ov.current.avgViewPercentage), `<span class="muted text-xs">Avg duration ${secs(ov.current.avgViewDuration)}</span>`)}
    </div>
    <div class="note-box mt-3">Click-through rate and impressions are not provided by the YouTube Analytics API, so they cannot be shown here. Check them in YouTube Studio.</div>
    <div class="grid-main mt-4">
      <div class="card"><div class="card-title">Channel Growth</div><div class="chart-box tall"><canvas id="c-growth"></canvas></div></div>
      <div class="card"><div class="card-title">Top Traffic Sources</div>${d.traffic.available && d.traffic.data.length ? '<div class="chart-box tall"><canvas id="c-traffic"></canvas></div>' : unavailable('Traffic sources', d.traffic.error || 'No data for this period.')}</div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card"><div class="card-title">Engagement Metrics</div><div class="chart-box"><canvas id="c-eng"></canvas></div></div>
      <div class="card"><div class="card-title">Recent Performance (daily watch hours)</div><div class="chart-box"><canvas id="c-watch"></canvas></div></div>
    </div>` : unavailable('Channel analytics', ch.error)}
    <div class="grid-2 mt-4">
      <div class="card"><div class="card-title">Top Performing Videos</div>${d.topVideos.available && d.topVideos.data.length ? d.topVideos.data.map((r, i) => `<a class="video-row" href="${r.videoRef ? `#/videos/${esc(r.videoRef.id)}` : '#/videos'}" style="grid-template-columns:28px 1fr auto"><div class="font-bold muted">${i + 1}</div><div class="video-title">${esc(r.videoRef?.title || r.video)}</div><div class="video-metrics"><span>${icon('eye', 14)} ${compact(r.views)}</span><span class="hide-sm">${pct(r.averageViewPercentage, 0)} viewed</span></div></a>`).join('') : unavailable('Top videos', d.topVideos.error || 'No data for this period.')}</div>
      <div class="card"><div class="card-title">Estimated Revenue</div>${d.revenue.available && d.revenue.data ? `<div class="stat-value">$${Number(d.revenue.data.estimatedRevenue || 0).toFixed(2)}</div><div class="muted text-sm mt-2">Ad revenue $${Number(d.revenue.data.estimatedAdRevenue || 0).toFixed(2)} &bull; CPM $${Number(d.revenue.data.cpm || 0).toFixed(2)}</div>` : unavailable('Revenue', 'Revenue is only available for monetized channels that granted the revenue permission.')}</div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card"><div class="card-title">Audience Demographics (viewer %)</div>${d.demographics.available && d.demographics.data.length ? `<div class="chart-box"><canvas id="c-demo"></canvas></div>` : unavailable('Audience demographics', d.demographics.error || 'YouTube only shows demographics when there is enough viewer data.')}</div>
      <div class="card"><div class="card-title">Totals tracked since you connected</div>${hist.items.length > 1 ? '<div class="chart-box"><canvas id="c-hist"></canvas></div>' : '<div class="note-box">CreatorPulse records channel totals daily. A trend will appear after at least two daily snapshots.</div>'}</div>
    </div>`;

    if (ov) {
      const labels = ov.daily.map((x) => x.day.slice(5));
      lineChart(body.querySelector('#c-growth'), labels, [
        { label: 'Views', data: ov.daily.map((x) => x.views), color: '#6d5dfc' },
        { label: 'Net subscribers', data: ov.daily.map((x) => x.netSubscribers), color: '#2f9bff', axis: 'y1' },
      ]);
      barChart(body.querySelector('#c-eng'), ['Likes', 'Comments', 'Shares'], [{ label: 'Period total', data: [ov.current.likes, ov.current.comments, ov.current.shares], color: '#a855f7' }]);
      barChart(body.querySelector('#c-watch'), labels, [{ label: 'Watch hours', data: ov.daily.map((x) => +x.watchHours.toFixed(2)), color: '#22c55e' }]);
    }
    if (d.traffic.available && d.traffic.data.length && body.querySelector('#c-traffic')) {
      doughnutChart(body.querySelector('#c-traffic'), d.traffic.data.map((r) => trafficLabel(r.insightTrafficSourceType)), d.traffic.data.map((r) => r.views));
    }
    if (body.querySelector('#c-demo')) {
      const groups = [...new Set(d.demographics.data.map((r) => r.ageGroup))];
      const gender = (g) => groups.map((a) => d.demographics.data.find((r) => r.ageGroup === a && r.gender === g)?.viewerPercentage || 0);
      barChart(body.querySelector('#c-demo'), groups.map((g) => g.replace('age', '')), [{ label: 'Female', data: gender('female'), color: '#ec4899' }, { label: 'Male', data: gender('male'), color: '#2f9bff' }, { label: 'Other', data: gender('user_specified'), color: '#a855f7' }]);
    }
    if (body.querySelector('#c-hist')) {
      lineChart(body.querySelector('#c-hist'), hist.items.map((h) => new Date(h.capturedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), [{ label: 'Subscribers', data: hist.items.map((h) => h.subscribers), color: '#2f9bff' }]);
    }
    renderIcons(body);
  }
  await load();
}
