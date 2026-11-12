import { esc, icon, timeAgo } from '../js/utils.js';

const STYLE = {
  alert: ['alert-triangle', 'rgba(239,68,68,.18)', '#ff7b7b'],
  ai: ['sparkles', 'rgba(47,155,255,.18)', '#6cb8ff'],
  analytics: ['bar-chart-3', 'rgba(34,197,94,.18)', '#4ade80'],
  auth: ['shield', 'rgba(245,158,11,.18)', '#fbbf24'],
  job: ['refresh-cw', 'rgba(109,93,252,.22)', '#b9adff'],
};

export function notificationCard(n) {
  const [ic, bg, fg] = STYLE[n.type] || STYLE.job;
  return `<div class="notif ${n.read ? '' : 'unread'}" data-id="${esc(n.id)}" data-link="${esc(n.link || '')}" style="cursor:pointer">
    <div class="notif-icon" style="background:${bg};color:${fg}">${icon(ic, 18)}</div>
    <div class="flex-1 min-w-0"><div class="font-semibold text-sm">${esc(n.title)}</div><div class="muted text-sm mt-1" style="word-break:break-word">${esc(n.body)}</div></div>
    <div class="muted text-xs flex-none">${timeAgo(n.createdAt)}</div></div>`;
}
