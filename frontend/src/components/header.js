import { esc, icon } from '../js/utils.js';

export function renderHeader(user, channel) {
  return `
  <header class="topbar">
    <button class="btn btn-icon menu-btn" id="menu-btn" aria-label="Open menu">${icon('menu', 20)}</button>
    <form class="search-box" id="search-form" role="search">
      ${icon('search', 18)}
      <input class="input" id="search-input" type="search" placeholder="Search your videos..." aria-label="Search your videos" />
    </form>
    <div class="flex-1"></div>
    ${channel ? `<div class="channel-chip flex items-center gap-2 px-3 py-1 rounded-full" style="border:1px solid var(--border)">${channel.thumbnail ? `<img src="${esc(channel.thumbnail)}" alt="" class="avatar" style="width:26px;height:26px;border-width:1px" referrerpolicy="no-referrer" />` : ''}<span class="text-sm font-semibold">${esc(channel.title)}</span></div>` : ''}
    <a class="btn btn-icon" href="#/notifications" aria-label="Notifications" style="position:relative">${icon('bell', 20)}<span id="bell-dot" hidden style="position:absolute;top:8px;right:9px;width:9px;height:9px;border-radius:50%;background:var(--bad)"></span></a>
    <button class="btn btn-icon" id="theme-btn" aria-label="Toggle theme">${icon('sun', 20)}</button>
    <div style="position:relative">
      <button id="profile-btn" aria-label="Profile menu" style="background:none;border:0;padding:0;cursor:pointer"><img class="avatar" src="${esc(user.picture || '/logo.svg')}" alt="" referrerpolicy="no-referrer" /></button>
      <div class="menu" id="profile-menu" hidden>
        <div class="px-3 py-2"><div class="font-bold text-sm">${esc(user.name || 'Creator')}</div><div class="muted text-xs">${esc(user.email)}</div></div>
        <button data-go="/settings">${icon('settings', 16)} Settings</button>
        <button id="logout-btn">${icon('log-out', 16)} Log out</button>
      </div>
    </div>
  </header>`;
}

export function bindHeader({ onSearch, onTheme, onLogout }) {
  const menu = document.getElementById('profile-menu');
  document.getElementById('profile-btn').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.dataset.go;
    if (e.target.closest('#logout-btn')) onLogout();
  });
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    onSearch(document.getElementById('search-input').value.trim());
  });
  document.getElementById('theme-btn').addEventListener('click', onTheme);
}
