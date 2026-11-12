import { api } from './api.js';
import { dateTime, errorBlock, esc, icon, renderIcons, setBusy, toast } from './utils.js';

export async function render(el) {
  el.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-4 mb-5"><div><h1 class="page-title">AI Channel Strategist</h1><div class="page-sub">Get a data-based strategy for your channel growth</div></div>
    <button class="btn btn-primary" id="gen">${icon('sparkles', 16)} Generate New Strategy</button></div><div id="aiwarn"></div><div id="strat"><span class="spinner"></span></div>`;
  const out = el.querySelector('#strat');
  let aiOk = true;
  try {
    const [st, latest] = await Promise.all([api.get('/ai/status'), api.get('/ai/recommendations/latest')]);
    aiOk = st.configured;
    if (!aiOk) { el.querySelector('#aiwarn').innerHTML = '<div class="error-box mb-4">AI is not configured on this server. The administrator must set <code>GEMINI_API_KEY</code>.</div>'; el.querySelector('#gen').disabled = true; }
    show(latest.recommendation);
  } catch (err) { out.innerHTML = errorBlock(err); }

  el.querySelector('#gen').addEventListener('click', async (e) => {
    setBusy(e.currentTarget, true, 'Analyzing your channel...');
    out.innerHTML = '<div class="empty"><span class="spinner"></span><div class="mt-3">Analyzing your videos, analytics and public trends. This can take up to a minute.</div></div>';
    try {
      const { recommendation } = await api.post('/ai/channel-strategy');
      show(recommendation);
      window.dispatchEvent(new Event('cp:badge'));
    } catch (err) { out.innerHTML = errorBlock(err); toast(err.message, 'error'); }
    setBusy(e.currentTarget, false);
  });

  function show(rec) {
    if (!rec) { out.innerHTML = `<div class="card empty">${icon('compass', 36)}<h3>No strategy yet</h3><div>Generate a strategy built from your real video history, analytics and public trending data.</div></div>`; renderIcons(out); return; }
    const p = rec.payload;
    const n = p.nextVideo || {};
    const used = p.dataUsed || {};
    const list = (a) => `<ul class="list-clean">${(a || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    out.innerHTML = `
    <div class="muted text-xs mb-3">Generated ${dateTime(rec.createdAt)} from ${used.videosAnalyzed ?? '?'} videos${used.historicalAnalytics ? ', 90-day analytics' : ''}${used.audienceDemographics ? ', audience demographics' : ''}${used.publicTrends ? `, public trending videos (${esc(used.trendRegion)})` : ''}.</div>
    <div class="grid-main">
      <div class="card"><div class="card-title">Next Video</div>
        <div class="flex items-start gap-3">${icon('target', 26)}<div><div class="text-xl font-extrabold">${esc(n.topic)}</div><div class="muted text-sm mt-2">${esc(n.whyRecommended)}</div></div></div>
        <div class="label mt-4">Suggested title</div><div class="font-semibold">${esc(n.title)}</div>
        <div class="label mt-4">Suggested description</div><div class="text-sm muted" style="white-space:pre-wrap">${esc(n.description)}</div>
        <div class="label mt-4">Keywords</div><div class="flex flex-wrap gap-2">${(n.keywords || []).map((k) => `<span class="chip" style="cursor:default">${esc(k)}</span>`).join('')}</div>
        <div class="grid-2 mt-4"><div><div class="label">Format</div><div class="text-sm">${esc(n.format)}</div></div><div><div class="label">Target audience</div><div class="text-sm">${esc(n.targetAudience)}</div></div></div></div>
      <div class="card"><div class="card-title">Weekly Planner</div><div class="grid gap-2">${(p.weeklyPlanner || []).map((d) => `<div class="notif" style="display:block"><div class="font-bold text-sm">${esc(d.day)}</div><div class="text-sm">${esc(d.idea)}</div><div class="muted text-xs mt-1">${esc(d.format)}${d.notes ? ` &bull; ${esc(d.notes)}` : ''}</div></div>`).join('')}</div></div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card"><div class="card-title">Content Strategy</div><p class="text-sm muted">${esc(p.contentStrategy?.summary)}</p><div class="label mt-3">Content pillars</div>${list(p.contentStrategy?.pillars)}<div class="label mt-3">Do more</div>${list(p.contentStrategy?.doMore)}<div class="label mt-3">Do less</div>${list(p.contentStrategy?.doLess)}</div>
      <div class="card"><div class="card-title">Trend Insights</div>${(p.trendInsights || []).length ? (p.trendInsights).map((t) => `<div class="notif mb-2" style="display:block"><div class="font-semibold text-sm">${esc(t.trend)}</div><div class="muted text-sm">${esc(t.relevance)}</div></div>`).join('') : '<div class="note-box">No public trend data was available for this run.</div>'}</div>
    </div>
    <div class="note-box mt-4"><strong>Limitations:</strong> ${esc(p.limitations || 'Recommendations are based on available data and do not guarantee results.')} Results are never guaranteed.</div>`;
    renderIcons(out);
  }
}
