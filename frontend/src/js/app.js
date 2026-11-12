import '../css/main.css';
import '../css/components.css';
import '../css/dashboard.css';
import '../css/responsive.css';
import { api, clearToken, getToken } from './api.js';
import { addRoute, parseHash, startRouter } from './router.js';
import { fetchSession, logout, reasonText, redeemCode, renderIntro, renderLogin, renderSplash } from './auth.js';
import { renderSidebar, bindSidebar, setActiveNav, setBadge } from '../components/sidebar.js';
import { renderHeader, bindHeader } from '../components/header.js';
import { renderIcons, toast } from './utils.js';

const root = document.getElementById('app');
let session = null;
let stopRouter = null;
let badgeTimer = null;

const applyTheme = (t) => {
  document.documentElement.classList.toggle('light', t === 'light');
  document.documentElement.classList.toggle('dark', t !== 'light');
  localStorage.setItem('cp_theme', t);
};
applyTheme(localStorage.getItem('cp_theme') || 'dark');

addRoute('/', () => import('./dashboard.js'));
addRoute('/videos', () => import('./videos.js'));
addRoute('/videos/:id', () => import('./videos.js'));
addRoute('/analytics', () => import('./analytics.js'));
addRoute('/ai-analyzer', () => import('./ai-analyzer.js'));
addRoute('/channel-strategist', () => import('./channel-strategist.js'));
addRoute('/comments', () => import('./comments.js'));
addRoute('/notifications', () => import('./notifications.js'));
addRoute('/settings', () => import('./settings.js'));

async function refreshBadge() {
  try { setBadge((await api.get('/notifications/unread-count')).count); } catch { /* ignore */ }
}

function showLogin(message) {
  stopRouter?.();
  clearInterval(badgeTimer);
  session = null;
  clearToken();
  renderLogin(root, message);
}

function showShell() {
  const { user, channel } = session;
  root.innerHTML = `<div class="shell">${renderSidebar()}<div class="main">${renderHeader(user, channel)}<main class="view" id="view" tabindex="-1"></main></div></div>`;
  bindSidebar();
  bindHeader({
    onSearch: (q) => { location.hash = q ? `/videos?q=${encodeURIComponent(q)}` : '/videos'; },
    onTheme: () => {
      const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
      applyTheme(next);
      api.put('/settings', { theme: next }).catch(() => {});
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    onLogout: logout,
  });
  renderIcons(root);
  stopRouter = startRouter(document.getElementById('view'), () => session, (path) => { setActiveNav(path); renderIcons(root); });
  refreshBadge();
  badgeTimer = setInterval(refreshBadge, 60000);
}

async function enterApp() {
  try {
    session = await fetchSession();
  } catch (err) {
    return showLogin(err.status === 401 ? reasonText(err.code) : err.message);
  }
  if (session.needsReauth) return showLogin(reasonText('REAUTH_REQUIRED'));
  if (session.settings?.theme) applyTheme(session.settings.theme);
  if (location.hash.startsWith('#/auth/')) location.hash = '/';
  showShell();
}

window.addEventListener('cp:unauthorized', (e) => { if (session) showLogin(reasonText(e.detail?.code)); });
window.addEventListener('cp:badge', refreshBadge);
window.addEventListener('cp:session-update', (e) => { session = { ...session, ...e.detail }; });

async function boot() {
  const { path, query } = parseHash();
  if (path === '/auth/callback' && query.code) {
    try {
      await redeemCode(query.code);
      history.replaceState(null, '', location.pathname + '#/');
    } catch (err) {
      return renderLogin(root, err.message);
    }
    return enterApp();
  }
  if (path === '/auth/error') return renderLogin(root, reasonText(query.reason));
  if (getToken()) return enterApp();

  if (!sessionStorage.getItem('cp_splash')) {
    await renderSplash(root);
    sessionStorage.setItem('cp_splash', '1');
  }
  if (!localStorage.getItem('cp_intro_seen')) {
    await renderIntro(root);
    localStorage.setItem('cp_intro_seen', '1');
  }
  renderLogin(root);
}

boot().catch((err) => { console.error(err); toast('Failed to start the app.', 'error'); });
