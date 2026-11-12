import { api } from './api.js';
import { renderTool } from './ai-tools.js';
import { errorBlock, esc, icon, renderIcons, setBusy, toast } from './utils.js';

const TABS = [['analyze', 'Analyzer'], ['titles', 'Titles'], ['description', 'Description'], ['tags', 'Tags'], ['thumbnails', 'Thumbnails']];
const MAX_BYTES = 14 * 1024 * 1024;

export async function render(el, ctx) {
  el.innerHTML = `<div class="mb-5"><h1 class="page-title">AI Video Analyzer</h1><div class="page-sub">Get AI-powered insights, titles, descriptions, tags and thumbnail ideas</div></div><div id="ai-banner"></div>
    <div class="tabs mb-4" id="ai-tabs">${TABS.map(([k, l], i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-k="${k}">${l}</button>`).join('')}</div><div id="ai-pane"></div>`;
  const pane = el.querySelector('#ai-pane');

  let aiOk = true;
  let videos = [];
  try {
    const [st, list] = await Promise.all([api.get('/ai/status'), api.get('/videos', { pageSize: 50, sort: 'newest' })]);
    aiOk = st.configured;
    videos = list.items;
  } catch (err) { pane.innerHTML = errorBlock(err); return; }
  if (!aiOk) el.querySelector('#ai-banner').innerHTML = '<div class="error-box mb-4">AI is not configured on this server. The administrator must set <code>GEMINI_API_KEY</code> in the backend environment. See docs/RENDER_DEPLOYMENT.md.</div>';

  const show = (k) => {
    el.querySelectorAll('#ai-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.k === k));
    if (k === 'analyze') renderAnalyzer(pane, { videos, aiOk }); else renderTool(pane, k, { videos, aiOk, canManage: ctx.canManage });
    renderIcons(pane);
  };
  el.querySelector('#ai-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-k]'); if (t) show(t.dataset.k); });
  show('analyze');
}

function renderAnalyzer(pane, { videos, aiOk }) {
  let file = null;
  pane.innerHTML = `<div class="grid-main">
    <div class="card"><div class="card-title">Provide your video</div>
      <label class="dropzone" id="drop" for="file-in" style="display:block">${icon('upload', 34)}<div class="font-bold mt-2">Upload Video</div><div class="muted text-sm">or drag and drop here</div><div class="muted text-xs mt-1" id="file-name">MP4, MOV, WEBM &bull; up to 14 MB</div><input type="file" id="file-in" accept="video/mp4,video/quicktime,video/webm" hidden /></label>
      <div class="muted text-xs mt-2">Larger videos: analyze a public YouTube URL or paste a transcript instead.</div>
      <label class="label mt-4" for="a-url">Or analyze by public YouTube URL</label><input class="input" id="a-url" type="url" placeholder="https://www.youtube.com/watch?v=..." />
      <label class="label mt-3" for="a-video">Or choose one of your videos</label><select class="select" id="a-video"><option value="">-</option>${videos.map((v) => `<option value="${esc(v.id)}">${esc(v.title)}${v.privacyStatus !== 'public' ? ` (${esc(v.privacyStatus)})` : ''}</option>`).join('')}</select>
      <label class="label mt-3" for="a-tr">Transcript (optional, recommended for private videos)</label><textarea class="textarea" id="a-tr" maxlength="60000"></textarea>
      <button class="btn btn-primary mt-4 w-full" id="a-go" ${aiOk ? '' : 'disabled'}>${icon('sparkles', 16)} Analyze Video</button></div>
    <div class="card"><div class="card-title">Analysis Results</div><div id="a-out" class="muted text-sm">Results will appear here after analysis. Private videos cannot be fetched by the AI from YouTube: upload the file or paste a transcript for a full content analysis.</div></div></div>`;
  renderIcons(pane);
  const drop = pane.querySelector('#drop');
  const input = pane.querySelector('#file-in');
  const setFile = (f) => {
    if (!f) return;
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(f.type)) return toast('Only MP4, MOV or WEBM files are supported.', 'error');
    if (f.size > MAX_BYTES) return toast('File is larger than 14 MB. Use a YouTube URL or transcript instead.', 'error');
    file = f;
    pane.querySelector('#file-name').textContent = `${f.name} (${(f.size / 1048576).toFixed(1)} MB)`;
  };
  input.addEventListener('change', () => setFile(input.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

  pane.querySelector('#a-go').addEventListener('click', async (e) => {
    const url = pane.querySelector('#a-url').value.trim();
    const vid = pane.querySelector('#a-video').value;
    const tr = pane.querySelector('#a-tr').value.trim();
    if (!file && !url && !vid && !tr) return toast('Upload a video, enter a URL, choose a video or paste a transcript.', 'error');
    const form = new FormData();
    if (file) form.append('video', file);
    if (url) form.append('youtubeUrl', url);
    if (vid) form.append('videoId', vid);
    if (tr) form.append('transcript', tr);
    const out = pane.querySelector('#a-out');
    setBusy(e.currentTarget, true, 'Analyzing...');
    out.innerHTML = '<span class="spinner"></span> <span class="muted">This can take up to a minute for video input...</span>';
    try {
      const { result } = await api.upload('/ai/analyze-video', form);
      out.innerHTML = renderResult(result);
      renderIcons(out);
    } catch (err) { out.innerHTML = errorBlock(err); }
    setBusy(e.currentTarget, false);
  });
}

const list = (a) => (a && a.length ? `<ul class="list-clean">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const section = (title, ic, html) => `<div class="mt-4"><div class="font-bold flex items-center gap-2">${icon(ic, 16)} ${title}</div><div class="mt-2 text-sm">${html}</div></div>`;

function renderResult(r) {
  const score = Math.max(0, Math.min(100, Number(r.overallScore) || 0));
  const inputLabel = { media: 'actual video', transcript: 'transcript', metadata: 'title and description only' }[r.inputKind] || r.inputKind;
  return `<div class="flex items-center gap-5 flex-wrap"><div class="score-ring" style="--v:${score}"><div>${score}<span class="muted text-xs">/100</span></div></div>
    <div class="flex-1 min-w-0"><div class="font-bold">Overall AI Assessment</div><div class="muted text-xs mt-1">${esc(r.scoreNote || 'AI estimate, not a measured metric.')}</div><div class="badge badge-blue mt-2">Analyzed from: ${esc(inputLabel)}</div></div></div>
    ${section('Topic', 'target', `<p><strong>${esc(r.topic?.mainTopic)}</strong></p><p class="muted">${esc(r.topic?.summary)}</p>${list(r.topic?.subtopics)}`)}
    ${section('Content', 'video', `<p class="muted">${esc(r.content?.assessment)}</p><div class="label mt-2">Strengths</div>${list(r.content?.strengths)}<div class="label mt-2">Weaknesses</div>${list(r.content?.weaknesses)}`)}
    ${section('SEO', 'search', `<p class="muted">${esc(r.seo?.assessment)}</p>${list(r.seo?.issues)}${list(r.seo?.improvements)}`)}
    ${section('Title', 'pencil', `<p class="muted">${esc(r.title?.assessment)}</p>${list(r.title?.alternatives)}`)}
    ${section('Description', 'pencil', `<p class="muted">${esc(r.description?.assessment)}</p>${list(r.description?.improvements)}`)}
    ${section('Keywords', 'search', `<div class="flex flex-wrap gap-2">${[...(r.keywords?.primary || []), ...(r.keywords?.secondary || []), ...(r.keywords?.longTail || [])].map((k) => `<span class="chip" style="cursor:default">${esc(k)}</span>`).join('')}</div>`)}
    ${section('Thumbnail concept', 'image', `<p class="muted">${esc(r.thumbnailConcept?.assessment)}</p>${list(r.thumbnailConcept?.suggestions)}`)}
    ${section('Structure', 'bar-chart-3', `<p class="muted">${esc(r.structure?.assessment)}</p><p><strong>Hook:</strong> ${esc(r.structure?.hookNotes)}</p><p><strong>Pacing:</strong> ${esc(r.structure?.pacingNotes)}</p>${list(r.structure?.suggestions)}`)}
    ${section('Audience', 'users', `<p><strong>${esc(r.audience?.primary)}</strong></p>${list(r.audience?.interests)}${list(r.audience?.suggestions)}`)}
    ${section('Audio / video quality', 'info', `<p class="muted">${r.audioVideoQuality?.assessed ? '' : 'Not assessed. '}${esc(r.audioVideoQuality?.notes)}</p>`)}
    ${r.limitations ? `<div class="note-box mt-4">${esc(r.limitations)}</div>` : ''}`;
}
