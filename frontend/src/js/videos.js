import { api } from './api.js';
import { doughnutChart, lineChart } from '../components/charts.js';
import { compact, confirmDialog, dateOnly, dateTime, debounce, emptyBlock, errorBlock, esc, icon, loadingBlock, num, pct, renderIcons, secs, setBusy, timeAgo, toast, trafficLabel, unavailable, watchUrl } from './utils.js';

const statusBadge = (s) => ({ public: '<span class="badge badge-green">Public</span>', unlisted: '<span class="badge badge-amber">Unlisted</span>', private: '<span class="badge badge-red">Private</span>' })[s] || `<span class="badge badge-blue">${esc(s)}</span>`;

export async function render(el, ctx) {
  return ctx.params.id ? renderDetail(el, ctx) : renderList(el, ctx);
}

async function renderList(el, ctx) {
  const state = { q: ctx.query.q || '', sort: 'newest', status: 'all', page: 1 };
  el.innerHTML = `
    <div class="mb-5"><h1 class="page-title">Video Manager</h1><div class="page-sub">Manage all your videos in one place</div></div>
    <div class="card">
      <div class="flex flex-wrap gap-3 mb-4">
        <div class="search-box" style="max-width:none;flex:1;min-width:200px">${icon('search', 18)}<input class="input" id="v-q" type="search" placeholder="Search videos..." value="${esc(state.q)}" aria-label="Search videos" /></div>
        <select class="select" id="v-sort" style="width:auto" aria-label="Sort"><option value="newest">Sort: Newest</option><option value="oldest">Sort: Oldest</option><option value="views">Sort: Most views</option><option value="likes">Sort: Most likes</option><option value="comments">Sort: Most comments</option></select>
        <select class="select" id="v-status" style="width:auto" aria-label="Status"><option value="all">All status</option><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select>
        <button class="btn" id="v-sync">${icon('refresh-cw', 16)} Sync</button>
      </div>
      <div id="v-list">${loadingBlock(4, 80)}</div><div id="v-pager" class="flex items-center justify-between mt-4"></div>
    </div>`;
  const list = el.querySelector('#v-list');
  const pager = el.querySelector('#v-pager');

  async function load(refresh) {
    list.innerHTML = loadingBlock(4, 80);
    try {
      const d = await api.get('/videos', { q: state.q, sort: state.sort, status: state.status, page: state.page, pageSize: 10, refresh: refresh ? '1' : undefined });
      list.innerHTML = d.items.length
        ? d.items.map((v) => `<a class="video-row" href="#/videos/${esc(v.id)}"><img class="video-thumb" src="${esc(v.thumbnail || '')}" alt="" loading="lazy" referrerpolicy="no-referrer" /><div class="min-w-0"><div class="video-title">${esc(v.title)}</div><div class="muted text-xs mt-1">Published ${timeAgo(v.publishedAt)} &bull; ${dateOnly(v.publishedAt)}</div></div><div class="video-metrics video-extra"><span>${icon('eye', 14)} ${compact(v.viewCount)}</span><span>${icon('thumbs-up', 14)} ${compact(v.likeCount)}</span><span>${icon('message-square', 14)} ${compact(v.commentCount)}</span>${statusBadge(v.privacyStatus)}</div></a>`).join('')
        : emptyBlock('No videos found', state.q ? 'Try a different search.' : 'No videos on this channel yet.', 'video');
      pager.innerHTML = `<span class="muted text-sm">${num(d.total)} video${d.total === 1 ? '' : 's'} &bull; page ${d.page} of ${d.pages}</span><div class="flex gap-2"><button class="btn btn-sm" id="prev" ${d.page <= 1 ? 'disabled' : ''}>${icon('chevron-left', 16)} Prev</button><button class="btn btn-sm" id="next" ${d.page >= d.pages ? 'disabled' : ''}>Next ${icon('chevron-right', 16)}</button></div>`;
      pager.querySelector('#prev').onclick = () => { state.page--; load(); };
      pager.querySelector('#next').onclick = () => { state.page++; load(); };
    } catch (err) {
      list.innerHTML = errorBlock(err);
      pager.innerHTML = '';
    }
    renderIcons(el);
  }
  el.querySelector('#v-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }));
  el.querySelector('#v-sort').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });
  el.querySelector('#v-status').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  el.querySelector('#v-sync').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true, 'Syncing...');
    await load(true);
    setBusy(btn, false);
    toast('Videos synced from YouTube', 'success');
  });
  await load();
}

async function renderDetail(el, ctx) {
  el.innerHTML = `<a class="muted text-sm" href="#/videos">&larr; Back to videos</a><div id="vd" class="mt-3">${loadingBlock(4, 110)}</div>`;
  const box = el.querySelector('#vd');
  let detail;
  try {
    detail = await api.get(`/videos/${ctx.params.id}`);
  } catch (err) { box.innerHTML = errorBlock(err); return; }
  const v = detail.video;
  const analyticsP = api.get(`/videos/${v.id}/analytics`);

  box.innerHTML = `
    <div class="card flex flex-wrap gap-4 items-start fade-in">
      <img class="video-thumb" style="width:200px" src="${esc(v.thumbnail || '')}" alt="" referrerpolicy="no-referrer" />
      <div class="flex-1 min-w-0"><h1 class="text-xl font-extrabold">${esc(v.title)}</h1>
        <div class="muted text-sm mt-1">Published ${dateTime(v.publishedAt)} &bull; ${statusBadge(v.privacyStatus)}</div>
        <a class="btn btn-sm mt-3" href="${watchUrl(v.youtubeVideoId)}" target="_blank" rel="noopener noreferrer">${icon('external-link', 14)} Open on YouTube</a></div></div>
    <div class="grid-stats mt-4" id="vd-stats">
      ${[['Views', compact(v.viewCount), 'eye'], ['Likes', compact(v.likeCount), 'thumbs-up'], ['Comments', compact(v.commentCount), 'message-square']].map(([l, val, ic]) => `<div class="card stat-card"><div class="stat-icon">${icon(ic, 20)}</div><div class="muted text-sm">${l}</div><div class="stat-value">${val}</div></div>`).join('')}
      <div class="card stat-card" id="st-watch"><div class="stat-icon">${icon('clock', 20)}</div><div class="muted text-sm">Watch time</div><div class="stat-value">...</div></div>
    </div>
    <div class="grid-2 mt-4" id="vd-extra">
      <div class="card"><div class="card-title">Average View Duration</div><div class="stat-value" id="st-avd">...</div></div>
      <div class="card"><div class="card-title">Average Percentage Viewed</div><div class="stat-value" id="st-avp">...</div></div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card"><div class="card-title">Audience Retention</div><div id="retention">${loadingBlock(1, 220)}</div></div>
      <div class="card"><div class="card-title">Traffic Sources</div><div id="traffic">${loadingBlock(1, 220)}</div></div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card"><div class="card-title">Monitoring History</div>${detail.snapshots.length > 1 ? '<div class="chart-box"><canvas id="c-snap"></canvas></div>' : '<div class="note-box">Hourly monitoring starts 24 hours after publication, so history will appear here once at least two checks have been recorded.</div>'}</div>
      <div class="card"><div class="card-title">Alerts for this video</div>${detail.alerts.length ? detail.alerts.map((a) => `<div class="notif mb-2"><div class="notif-icon" style="background:rgba(239,68,68,.18);color:#ff7b7b">${icon('alert-triangle', 18)}</div><div><div class="font-semibold text-sm">${esc(a.title)} <span class="badge badge-amber">${esc(a.priority)}</span></div><div class="muted text-sm mt-1">${esc(a.detectedChange)}</div><div class="muted text-xs mt-1">${dateTime(a.createdAt)}</div></div></div>`).join('') : emptyBlock('No alerts', 'No unusual changes detected.', 'bell')}</div>
    </div>
    <div class="card mt-4"><div class="card-title">Edit Video Details</div>
      ${ctx.canManage === false ? '<div class="note-box mb-3">Editing needs YouTube management permission. Log out and sign in again to grant it.</div>' : ''}
      <label class="label" for="e-title">Title</label><input class="input" id="e-title" maxlength="100" value="${esc(v.title)}" />
      <label class="label mt-3" for="e-desc">Description</label><textarea class="textarea" id="e-desc" maxlength="5000" style="min-height:160px">${esc(v.description)}</textarea>
      <label class="label mt-3" for="e-tags">Tags (comma separated, 500 characters total)</label><input class="input" id="e-tags" value="${esc(v.tags.join(', '))}" />
      <button class="btn btn-primary mt-4" id="e-save">${icon('check', 16)} Save changes to YouTube</button></div>`;
  renderIcons(box);

  if (detail.snapshots.length > 1) {
    lineChart(box.querySelector('#c-snap'), detail.snapshots.map((s) => new Date(s.capturedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })), [{ label: 'Views', data: detail.snapshots.map((s) => s.views), color: '#6d5dfc' }]);
  }

  box.querySelector('#e-save').addEventListener('click', async (e) => {
    const title = box.querySelector('#e-title').value.trim();
    const description = box.querySelector('#e-desc').value;
    const tags = box.querySelector('#e-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
    if (!title) return toast('Title cannot be empty', 'error');
    if (!(await confirmDialog({ title: 'Update this video on YouTube?', text: 'Your title, description and tags will be changed on YouTube immediately.', confirmText: 'Update video' }))) return;
    setBusy(e.currentTarget, true, 'Saving...');
    try {
      await api.put(`/videos/${v.id}/metadata`, { title, description, tags });
      toast('Video updated on YouTube', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setBusy(e.currentTarget, false);
  });

  try {
    const a = await analyticsP;
    const m = a.metrics;
    const set = (id, val) => { const n = box.querySelector(id); if (n) n.innerHTML = val; };
    if (m.available && m.data.views !== undefined) {
      box.querySelector('#st-watch .stat-value').textContent = `${m.data.watchHours.toFixed(1)} h`;
      set('#st-avd', secs(m.data.averageViewDuration));
      set('#st-avp', pct(m.data.averageViewPercentage));
    } else {
      const reason = m.available ? 'YouTube has no analytics for this video yet (data can lag 24-48 hours).' : m.error;
      box.querySelector('#st-watch .stat-value').textContent = '-';
      set('#st-avd', '-'); set('#st-avp', '-');
      box.querySelector('#vd-extra').insertAdjacentHTML('afterend', unavailable('Video analytics', reason));
    }
    const rt = box.querySelector('#retention');
    if (a.retention.available && a.retention.data.length) {
      rt.innerHTML = '<div class="chart-box"><canvas id="c-ret"></canvas></div>';
      lineChart(rt.querySelector('#c-ret'), a.retention.data.map((p) => `${Math.round(p.ratio * 100)}%`), [{ label: 'Audience still watching', data: a.retention.data.map((p) => +(p.watchRatio * 100).toFixed(1)), color: '#2f9bff' }]);
    } else rt.innerHTML = unavailable('Audience retention', a.retention.available ? 'Not enough views yet.' : a.retention.error);
    const tr = box.querySelector('#traffic');
    if (a.traffic.available && a.traffic.data.length) {
      tr.innerHTML = '<div class="chart-box"><canvas id="c-traffic"></canvas></div>';
      doughnutChart(tr.querySelector('#c-traffic'), a.traffic.data.map((r) => trafficLabel(r.insightTrafficSourceType)), a.traffic.data.map((r) => r.views));
    } else tr.innerHTML = unavailable('Traffic sources', a.traffic.available ? 'No traffic data yet.' : a.traffic.error);
  } catch (err) {
    box.querySelector('#retention').innerHTML = errorBlock(err);
    box.querySelector('#traffic').innerHTML = errorBlock(err);
  }
  renderIcons(box);
}
