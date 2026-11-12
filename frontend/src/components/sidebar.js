import { icon } from '../js/utils.js';

export const NAV = [
  { path: '/', label: 'Dashboard', icon: 'layout-dashboard' },
  { path: '/videos', label: 'Videos', icon: 'video' },
  { path: '/analytics', label: 'Analytics', icon: 'bar-chart-3' },
  { path: '/ai-analyzer', label: 'AI Analyzer', icon: 'sparkles' },
  { path: '/channel-strategist', label: 'Channel Strategist', icon: 'compass' },
  { path: '/comments', label: 'Comments', icon: 'message-square' },
  { path: '/notifications', label: 'Notifications', icon: 'bell', badge: true },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export function renderSidebar() {
  return `
  <div class="overlay" id="overlay"></div>
  <aside class="sidebar" id="sidebar" aria-label="Main navigation">
    <div class="brand"><img src="/logo.svg" alt="" /><span>CreatorPulse AI</span></div>
    ${NAV.map((n) => `<a class="nav-item" href="#${n.path}" data-path="${n.path}">${icon(n.icon, 20)}<span>${n.label}</span>${n.badge ? '<span class="nav-badge" id="nav-badge" hidden>0</span>' : ''}</a>`).join('')}
    <div class="sidebar-foot">CreatorPulse AI is an independent tool and is not affiliated with or endorsed by Google or YouTube.</div>
  </aside>`;
}

export function setActiveNav(path) {
  const base = '/' + (path.split('/')[1] || '');
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.path === base));
}

export function bindSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  const close = () => { sb.classList.remove('open'); ov.classList.remove('show'); };
  ov.addEventListener('click', close);
  sb.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.getElementById('menu-btn')?.addEventListener('click', () => { sb.classList.add('open'); ov.classList.add('show'); });
}

export function setBadge(count) {
  const b = document.getElementById('nav-badge');
  const dot = document.getElementById('bell-dot');
  if (b) { b.textContent = count > 99 ? '99+' : count; b.hidden = !count; }
  if (dot) dot.hidden = !count;
}
