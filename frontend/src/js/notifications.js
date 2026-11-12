import { api } from './api.js';
import { notificationCard } from '../components/notification-card.js';
import { dateTime, emptyBlock, errorBlock, esc, icon, loadingBlock, renderIcons, toast } from './utils.js';

const PRIORITY = { high: 'badge-red', medium: 'badge-amber', low: 'badge-blue' };

export async function render(el, ctx) {
  let tab = ctx.query.alert ? 'alerts' : 'all';
  el.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3 mb-5"><div><h1 class="page-title">Notifications</h1><div class="page-sub">Stay updated with the latest alerts</div></div><button class="btn" id="read-all">${icon('check', 16)} Mark all as read</button></div>
    <div class="tabs mb-4" id="n-tabs"><button class="tab" data-t="all">All</button><button class="tab" data-t="unread">Unread</button><button class="tab" data-t="alerts">Performance alerts</button><button class="tab" data-t="jobs">Background jobs</button></div><div id="n-body">${loadingBlock(3, 80)}</div>`;
  const body = el.querySelector('#n-body');
  const sync = () => el.querySelectorAll('#n-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.t === tab));

  async function load() {
    sync();
    body.innerHTML = loadingBlock(3, 80);
    try {
      if (tab === 'alerts') {
        const { items } = await api.get('/alerts', { limit: 50 });
        body.innerHTML = items.length ? items.map((a) => `<div class="card mb-3" ${ctx.query.alert === a.id ? 'style="border-color:var(--primary)"' : ''}>
          <div class="flex flex-wrap items-center gap-2 mb-2"><span class="font-bold">${esc(a.title)}</span><span class="badge ${PRIORITY[a.priority] || 'badge-blue'}">${esc(a.priority)} priority</span><span class="muted text-xs">${dateTime(a.createdAt)}</span></div>
          <a class="text-sm font-semibold" href="#/videos/${esc(a.video.id)}">${esc(a.video.title)}</a>
          <div class="label mt-3">Detected change</div><div class="text-sm">${esc(a.detectedChange)}</div>
          <div class="label mt-3">Possible explanation</div><div class="text-sm muted">${esc(a.possibleExplanation)}</div>
          <div class="label mt-3">Recommended action</div><div class="text-sm">${esc(a.recommendedAction)}</div></div>`).join('')
          : emptyBlock('No performance alerts', 'Videos are checked hourly starting 24 hours after publication. Alerts only appear when a real change is detected.', 'bell');
      } else if (tab === 'jobs') {
        const { items } = await api.get('/notifications/jobs');
        body.innerHTML = items.length ? `<div class="card">${items.map((j) => `<div class="setting-row"><div><div class="font-semibold text-sm">Video monitoring</div><div class="muted text-xs">${dateTime(j.startedAt)}</div><div class="muted text-xs mt-1" style="word-break:break-word">${esc(j.message || '')}</div></div><span class="badge ${j.status === 'success' ? 'badge-green' : j.status === 'failed' ? 'badge-red' : 'badge-amber'}">${esc(j.status)}</span></div>`).join('')}</div>`
          : emptyBlock('No job runs yet', 'The monitoring worker has not run yet. It runs every hour.', 'refresh-cw');
      } else {
        const { items } = await api.get('/notifications', { unread: tab === 'unread' ? '1' : undefined, limit: 60 });
        body.innerHTML = items.length ? `<div class="grid gap-3">${items.map(notificationCard).join('')}</div>` : emptyBlock('You are all caught up', 'No notifications here.', 'bell');
      }
    } catch (err) { body.innerHTML = errorBlock(err); }
    renderIcons(el);
  }

  el.querySelector('#n-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; load(); } });
  el.querySelector('#read-all').addEventListener('click', async () => {
    try { await api.post('/notifications/read-all'); window.dispatchEvent(new Event('cp:badge')); toast('All notifications marked as read', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  });
  body.addEventListener('click', async (e) => {
    const n = e.target.closest('.notif[data-id]');
    if (!n) return;
    try { await api.post(`/notifications/${n.dataset.id}/read`); n.classList.remove('unread'); window.dispatchEvent(new Event('cp:badge')); } catch { /* ignore */ }
    if (n.dataset.link) location.hash = n.dataset.link.replace(/^#/, '');
  });
  await load();
}
