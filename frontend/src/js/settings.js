import { api } from './api.js';
import { logout } from './auth.js';
import { confirmDialog, esc, icon, renderIcons, setBusy, toast } from './utils.js';

export async function render(el, ctx) {
  let s;
  try { ({ settings: s } = await api.get('/settings')); } catch (err) { el.innerHTML = `<div class="error-box">${esc(err.message)}</div>`; return; }
  const ch = ctx.channel;
  const toggle = (key, label, hint) => `<div class="setting-row"><div><div class="font-semibold text-sm">${label}</div><div class="muted text-xs">${hint}</div></div><label class="switch"><input type="checkbox" data-k="${key}" ${s[key] ? 'checked' : ''} aria-label="${label}" /><span></span></label></div>`;

  el.innerHTML = `<div class="mb-5"><h1 class="page-title">Settings</h1><div class="page-sub">Customize your experience</div></div>
  <div class="grid-2">
    <div class="grid gap-4" style="align-content:start">
      <div class="card"><div class="card-title">Account Information</div>
        <div class="flex items-center gap-3"><img class="avatar" style="width:56px;height:56px" src="${esc(ctx.user.picture || '/logo.svg')}" alt="" referrerpolicy="no-referrer" /><div><div class="font-bold">${esc(ctx.user.name || '')}</div><div class="muted text-sm">${esc(ctx.user.email)}</div></div></div></div>
      <div class="card"><div class="card-title">Connected YouTube Channel</div>${ch ? `<div class="flex items-center gap-3">${ch.thumbnail ? `<img class="avatar" style="width:56px;height:56px" src="${esc(ch.thumbnail)}" alt="" referrerpolicy="no-referrer" />` : ''}<div><div class="font-bold">${esc(ch.title)}</div><div class="muted text-sm">${ch.hiddenSubscribers ? 'Subscribers hidden' : `${ch.subscriberCount.toLocaleString()} subscribers`} &bull; ${ch.videoCount} videos</div></div></div><div class="muted text-xs mt-3">To switch channel, log out and sign in with the Google account that owns it.</div>` : '<div class="muted">No channel connected.</div>'}</div>
      <div class="card"><div class="card-title">Appearance</div>
        <div class="setting-row"><div><div class="font-semibold text-sm">Theme</div><div class="muted text-xs">Choose dark or light mode</div></div><select class="select" id="s-theme" style="width:auto"><option value="dark">Dark</option><option value="light">Light</option></select></div></div>
      <div class="card"><div class="card-title">Notification Settings</div>
        ${toggle('notifyAlerts', 'Performance alerts', 'Changes in video performance')}${toggle('notifyAi', 'AI recommendations', 'Finished analyses and strategies')}${toggle('notifyAnalytics', 'Analytics updates', 'New videos detected and tracked')}${toggle('notifyAuth', 'Authentication warnings', 'Expired or revoked Google access')}</div>
    </div>
    <div class="grid gap-4" style="align-content:start">
      <div class="card"><div class="card-title">AI Settings</div>
        <label class="label" for="s-lang">Language for AI output</label><input class="input" id="s-lang" maxlength="40" value="${esc(s.aiLanguage)}" />
        <label class="label mt-3" for="s-tone">Tone</label><select class="select" id="s-tone">${['friendly', 'professional', 'energetic', 'educational'].map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
        <label class="label mt-3" for="s-region">Trend region (2-letter country code)</label><input class="input" id="s-region" maxlength="2" value="${esc(s.regionCode)}" />
        <div class="muted text-xs mt-3">The AI service key is configured by the app administrator on the server. You never need to enter one.</div>
        <button class="btn btn-primary mt-4" id="s-save">${icon('check', 16)} Save Changes</button></div>
      <div class="card"><div class="card-title">Security</div>
        <p class="muted text-sm">CreatorPulse uses Google sign-in; we never see your Google password. Your Google access tokens are stored encrypted on the server. ${ctx.canManage ? 'Management permission granted (edit videos, reply to comments).' : 'Management permission not granted: editing and replying are disabled.'} ${ctx.canSeeRevenue ? 'Revenue permission granted.' : ''}</p>
        <p class="muted text-sm mt-2">You can also review or remove access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">myaccount.google.com/permissions</a>.</p>
        <button class="btn mt-4" id="s-logout">${icon('log-out', 16)} Log out</button></div>
      <div class="card"><div class="card-title">Privacy Settings</div>
        <p class="muted text-sm">Disconnecting revokes CreatorPulse's Google access and permanently deletes your account, channel data, analytics history, AI results and notifications from this app.</p>
        <button class="btn btn-danger mt-4" id="s-delete">${icon('trash-2', 16)} Disconnect &amp; delete my data</button></div>
    </div></div>`;
  el.querySelector('#s-theme').value = s.theme;
  el.querySelector('#s-tone').value = s.aiTone;
  renderIcons(el);

  const save = async (patch, msg = 'Settings saved') => {
    try { ({ settings: s } = await api.put('/settings', patch)); toast(msg, 'success'); return true; } catch (err) { toast(err.message, 'error'); return false; }
  };
  el.querySelector('#s-theme').addEventListener('change', async (e) => {
    const t = e.target.value;
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t !== 'light');
    localStorage.setItem('cp_theme', t);
    await save({ theme: t });
  });
  el.querySelectorAll('input[data-k]').forEach((i) => i.addEventListener('change', () => save({ [i.dataset.k]: i.checked })));
  el.querySelector('#s-save').addEventListener('click', async (e) => {
    const region = el.querySelector('#s-region').value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) return toast('Region must be a 2-letter country code, e.g. US', 'error');
    setBusy(e.currentTarget, true, 'Saving...');
    await save({ aiLanguage: el.querySelector('#s-lang').value.trim() || 'English', aiTone: el.querySelector('#s-tone').value, regionCode: region });
    setBusy(e.currentTarget, false);
  });
  el.querySelector('#s-logout').addEventListener('click', logout);
  el.querySelector('#s-delete').addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete all your data?', text: 'This revokes Google access and permanently deletes your CreatorPulse data. Your YouTube channel is not affected. This cannot be undone.', confirmText: 'Delete everything', danger: true }))) return;
    try { await api.del('/settings/account'); toast('Your data was deleted', 'success'); setTimeout(logout, 800); } catch (err) { toast(err.message, 'error'); }
  });
}
