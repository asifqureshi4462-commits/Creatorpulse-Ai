import { createIcons, icons } from 'lucide';

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const num = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString());
export const compact = (n) => (n === null || n === undefined ? '-' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n)));
export const pct = (n, d = 1) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '-' : `${Number(n).toFixed(d)}%`);
export const secs = (s) => {
  if (!s && s !== 0) return '-';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
};

export function timeAgo(date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, sec] of units) if (s >= sec) { const n = Math.floor(s / sec); return `${n} ${name}${n > 1 ? 's' : ''} ago`; }
  return 'just now';
}
export const dateTime = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const dateOnly = (d) => new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' });

/** change between current and previous period, as HTML */
export function delta(cur, prev) {
  if (!prev) return '<span class="muted text-xs">no previous data</span>';
  const p = ((cur - prev) / prev) * 100;
  const up = p >= 0;
  return `<span class="${up ? 'delta-up' : 'delta-down'}">${up ? '&uarr;' : '&darr;'} ${Math.abs(p).toFixed(1)}%</span> <span class="muted text-xs">vs previous</span>`;
}

export const icon = (name, size = 18, cls = '') => `<i data-lucide="${name}" class="${cls}" style="width:${size}px;height:${size}px"></i>`;
export const renderIcons = (root = document) => createIcons({ icons, root, attrs: { 'stroke-width': 2 } });

export const debounce = (fn, ms = 350) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export function toast(message, type = 'info') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    toast('Copied to clipboard', 'success');
  }
}

export const loadingBlock = (rows = 3, h = 70) =>
  `<div class="grid gap-3">${Array.from({ length: rows }, () => `<div class="skeleton" style="height:${h}px"></div>`).join('')}</div>`;
export const spinner = (text = 'Loading...') => `<div class="empty"><span class="spinner"></span><div class="mt-3">${esc(text)}</div></div>`;
export const emptyBlock = (title, text, ic = 'inbox') => `<div class="empty">${icon(ic, 36)}<h3>${esc(title)}</h3><div>${esc(text)}</div></div>`;
export const errorBlock = (err) => `<div class="error-box">${esc(err?.message || err || 'Something went wrong.')}</div>`;
export const unavailable = (what, reason) => `<div class="note-box"><strong>${esc(what)}</strong> is not available for this account. ${esc(reason || '')}</div>`;

export function confirmDialog({ title, text, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3 class="text-lg font-bold mb-2">${esc(title)}</h3><p class="muted text-sm mb-5" style="white-space:pre-wrap">${esc(text)}</p><div class="flex gap-2 justify-end"><button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmText)}</button></div></div>`;
    const done = (v) => { back.remove(); resolve(v); };
    back.addEventListener('click', (e) => { if (e.target === back || e.target.hasAttribute('data-no')) done(false); if (e.target.hasAttribute('data-yes')) done(true); });
    document.body.appendChild(back);
  });
}

export const setBusy = (btn, busy, label) => {
  if (!btn) return;
  btn.disabled = busy;
  if (label !== undefined) btn.dataset.label ??= btn.innerHTML;
  btn.innerHTML = busy ? `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> ${esc(label || 'Working...')}` : btn.dataset.label || btn.innerHTML;
};

const TRAFFIC = {
  YT_SEARCH: 'YouTube search', RELATED_VIDEO: 'Suggested videos', BROWSE: 'Browse features', EXT_URL: 'External sites',
  NOTIFICATION: 'Notifications', PLAYLIST: 'Playlists', SUBSCRIBER: 'Subscriber feed', YT_CHANNEL: 'Channel pages',
  SHORTS: 'Shorts feed', NO_LINK_EMBEDDED: 'Direct / embedded', NO_LINK_OTHER: 'Direct / unknown', END_SCREEN: 'End screens',
  ADVERTISING: 'Advertising', HASHTAGS: 'Hashtag pages', YT_OTHER_PAGE: 'Other YouTube pages', CAMPAIGN_CARD: 'Cards', ANNOTATION: 'Annotations',
};
export const trafficLabel = (k) => TRAFFIC[k] || String(k).replaceAll('_', ' ').toLowerCase();
export const watchUrl = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
