import { api, apiUrl, clearToken, setToken } from './api.js';
import { esc, icon, renderIcons } from './utils.js';

const REASONS = {
  NO_CHANNEL: 'This Google account has no YouTube channel. Sign in with the Google account that owns your channel, or create a channel on YouTube first.',
  MISSING_SCOPES: 'The required YouTube permissions were not granted. Please try again and allow all requested access.',
  access_denied: 'Sign-in was cancelled. You can try again whenever you are ready.',
  INVALID_STATE: 'The sign-in request expired. Please try again.',
  INVALID_CODE: 'The sign-in code expired. Please try again.',
  REAUTH_REQUIRED: 'Google access expired or was revoked. Please sign in again to continue.',
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
  server_error: 'Something went wrong while signing in. Please try again.',
};
export const reasonText = (r) => REASONS[r] || 'Sign-in failed. Please try again.';

export const fetchSession = () => api.get('/auth/me');
export const startLogin = () => { location.href = apiUrl('/api/auth/google'); };

export async function redeemCode(code) {
  const { token } = await api.post('/auth/exchange', { code });
  setToken(token);
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  clearToken();
  location.hash = '';
  location.reload();
}

export function renderSplash(root) {
  root.innerHTML = `<div class="screen"><div class="text-center fade-in">
    <img class="logo-big" src="/logo.svg" alt="CreatorPulse AI logo" />
    <h1 class="text-4xl font-extrabold mt-5">CreatorPulse <span class="grad-text">AI</span></h1>
    <p class="muted mt-2">Grow &bull; Analyze &bull; Optimize</p>
    <div class="mt-8"><span class="spinner" style="width:38px;height:38px"></span></div>
    <p class="muted text-sm mt-3">Loading Your Creator Studio...</p></div></div>`;
  return new Promise((r) => setTimeout(r, 1800));
}

export function renderIntro(root) {
  const points = ['AI Video Analyzer', 'Smart SEO Suggestions', 'Performance Insights', 'Next Topic Ideas'];
  root.innerHTML = `<div class="screen"><div class="card screen-card fade-in" style="text-align:left;width:min(520px,100%)">
    <div class="brand" style="padding-top:0"><img src="/logo.svg" alt="" style="width:30px;height:30px" /> CreatorPulse AI</div>
    <h1 class="text-3xl font-extrabold leading-tight">Your AI-Powered <span class="grad-text">YouTube Growth Partner</span></h1>
    <p class="muted mt-3 text-sm">Connect your channel to see real analytics, get AI-assisted SEO and content ideas, and be alerted when a video's performance changes. Powered by official YouTube APIs and Google Gemini.</p>
    <ul class="list-clean mt-5">${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <button class="btn btn-primary mt-7 w-full" id="intro-next">Get Started ${icon('chevron-right', 18)}</button></div></div>`;
  renderIcons(root);
  return new Promise((r) => root.querySelector('#intro-next').addEventListener('click', r));
}

export function renderLogin(root, message) {
  root.innerHTML = `<div class="screen"><div class="card screen-card fade-in">
    <img src="/logo.svg" alt="CreatorPulse AI logo" style="width:72px;height:72px;margin:0 auto" />
    <h1 class="text-2xl font-extrabold mt-3">CreatorPulse AI</h1>
    <h2 class="text-xl font-bold mt-4">Sign in to Continue</h2>
    <p class="muted text-sm mt-2">Use the Google account that owns your YouTube channel.</p>
    ${message ? `<div class="error-box mt-5" style="text-align:left" role="alert">${esc(message)}</div>` : ''}
    <button class="btn btn-google mt-6" id="google-btn"><svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Continue with Google</button>
    <p class="muted text-xs mt-5">${icon('shield', 14)} Secure &bull; Private &bull; We never see your Google password</p>
    <p class="muted text-xs mt-3">Independent app. Not affiliated with Google or YouTube.</p></div></div>`;
  renderIcons(root);
  root.querySelector('#google-btn').addEventListener('click', startLogin);
}
