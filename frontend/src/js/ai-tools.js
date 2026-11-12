import { api } from './api.js';
import { confirmDialog, copyText, errorBlock, esc, icon, renderIcons, setBusy, toast } from './utils.js';

const CFG = {
  titles: { path: '/ai/generate-title', label: 'Generate Titles', hint: 'Suggested titles with reasons. Pick one to copy or apply.' },
  description: { path: '/ai/generate-description', label: 'Generate Description', hint: 'SEO-friendly description, keywords, hashtags and chapters (only when timestamps are provided).' },
  tags: { path: '/ai/generate-tags', label: 'Suggest Tags', hint: 'Relevant keyword, long-tail and related tags.' },
  thumbnails: { path: '/ai/thumbnail-suggestions', label: 'Thumbnail Ideas', hint: 'Concept, text, color and layout ideas. These are suggestions and do not guarantee a higher CTR.' },
};
const CATEGORY = { search: 'Search-friendly', curiosity: 'Curiosity', educational: 'Educational', short: 'Short', long: 'Long' };

export function renderTool(box, kind, { videos, aiOk, canManage }) {
  const cfg = CFG[kind];
  box.innerHTML = `
    <div class="grid-main">
      <div class="card"><div class="card-title">${cfg.label}</div><p class="muted text-sm mb-3">${cfg.hint}</p>
        <label class="label" for="t-video">Your video (optional)</label>
        <select class="select" id="t-video"><option value="">- Enter a topic instead -</option>${videos.map((v) => `<option value="${esc(v.id)}">${esc(v.title)}</option>`).join('')}</select>
        <label class="label mt-3" for="t-topic">Topic</label><input class="input" id="t-topic" maxlength="300" placeholder="e.g. How to grow a YouTube channel from zero" />
        <label class="label mt-3" for="t-ctx">${kind === 'description' ? 'Transcript or notes (include timestamps for chapters)' : 'Extra context (optional)'}</label><textarea class="textarea" id="t-ctx" maxlength="8000"></textarea>
        <button class="btn btn-primary mt-4 w-full" id="t-go" ${aiOk ? '' : 'disabled'}>${icon('sparkles', 16)} ${cfg.label}</button></div>
      <div class="card"><div class="card-title">Results</div><div id="t-out" class="muted text-sm">Results will appear here.</div></div>
    </div>`;
  renderIcons(box);
  const out = box.querySelector('#t-out');
  const videoSel = box.querySelector('#t-video');

  async function apply(patch, confirmText) {
    if (!videoSel.value) return toast('Choose one of your videos above to apply changes.', 'error');
    if (canManage === false) return toast('Editing needs YouTube management permission. Sign in again to grant it.', 'error');
    if (!(await confirmDialog({ title: 'Apply to YouTube?', text: confirmText, confirmText: 'Apply' }))) return false;
    try {
      await api.put(`/videos/${videoSel.value}/metadata`, patch);
      toast('Updated on YouTube', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  box.querySelector('#t-go').addEventListener('click', async (e) => {
    const body = { videoId: videoSel.value || undefined, topic: box.querySelector('#t-topic').value.trim() || undefined, context: box.querySelector('#t-ctx').value.trim() || undefined };
    if (!body.videoId && !body.topic) return toast('Choose a video or enter a topic.', 'error');
    setBusy(e.currentTarget, true, 'Generating...');
    out.innerHTML = '<span class="spinner"></span>';
    try {
      const { result } = await api.post(cfg.path, body);
      out.innerHTML = '';
      ({ titles, description, tags, thumbnails })[kind](out, result);
      renderIcons(out);
    } catch (err) { out.innerHTML = errorBlock(err); }
    setBusy(e.currentTarget, false);
  });

  const limits = (r) => (r.limitations ? `<div class="note-box mt-3">${esc(r.limitations)}</div>` : '');

  function titles(o, r) {
    const list = r.titles || [];
    o.innerHTML = `<div class="grid gap-2">${list.map((t, i) => `<label class="notif" style="cursor:pointer"><input type="radio" name="title" value="${i}" ${i === 0 ? 'checked' : ''} /><div class="flex-1 min-w-0"><div class="font-semibold text-sm">${esc(t.title)}</div><div class="muted text-xs mt-1"><span class="badge badge-blue">${esc(CATEGORY[t.category] || t.category)}</span> ${esc(t.reason)}</div></div><button type="button" class="btn btn-sm btn-icon" data-copy="${i}" aria-label="Copy title" style="width:34px;height:34px;min-height:34px">${icon('copy', 14)}</button></label>`).join('')}</div>
      <button class="btn btn-primary mt-4 w-full" id="apply">${icon('check', 16)} Apply Selected Title</button>${limits(r)}`;
    o.onclick = (e) => { const c = e.target.closest('[data-copy]'); if (c) { e.preventDefault(); copyText(list[c.dataset.copy].title); } };
    o.querySelector('#apply').onclick = () => {
      const t = list[Number(o.querySelector('input[name=title]:checked').value)].title;
      apply({ title: t.slice(0, 100) }, `Change the video title to:\n"${t}"`);
    };
  }

  function description(o, r) {
    o.innerHTML = `<label class="label" for="d-text">Description (editable)</label><textarea class="textarea" id="d-text" style="min-height:220px">${esc(r.description)}</textarea>
      ${r.summary ? `<div class="muted text-sm mt-3"><strong>Summary:</strong> ${esc(r.summary)}</div>` : ''}
      ${(r.keywords || []).length ? `<div class="mt-3 flex flex-wrap gap-2">${r.keywords.map((k) => `<span class="chip">${esc(k)}</span>`).join('')}</div>` : ''}
      ${(r.hashtags || []).length ? `<div class="mt-3 muted text-sm">${r.hashtags.map(esc).join(' ')}</div>` : ''}
      ${(r.chapters || []).length ? `<div class="mt-3"><div class="label">Chapters</div><ul class="list-clean">${r.chapters.map((c) => `<li>${esc(c.time)} - ${esc(c.title)}</li>`).join('')}</ul></div>` : ''}
      ${r.callToAction ? `<div class="muted text-sm mt-3"><strong>Call to action:</strong> ${esc(r.callToAction)}</div>` : ''}
      <div class="flex gap-2 mt-4"><button class="btn flex-1" id="d-copy">${icon('copy', 16)} Copy</button><button class="btn btn-primary flex-1" id="d-apply">${icon('check', 16)} Apply</button></div>${limits(r)}`;
    o.querySelector('#d-copy').onclick = () => copyText(o.querySelector('#d-text').value);
    o.querySelector('#d-apply').onclick = () => apply({ description: o.querySelector('#d-text').value.slice(0, 5000) }, 'Replace the video description with the text shown.');
  }

  function tags(o, r) {
    const list = (r.tags || []).map((t) => ({ tag: String(t.tag).trim(), type: t.type, on: true })).filter((t) => t.tag);
    const draw = () => {
      const total = list.filter((t) => t.on).map((t) => t.tag).join(',').length;
      o.innerHTML = `<div class="flex flex-wrap gap-2" id="chips">${list.map((t, i) => `<span class="chip ${t.on ? 'selected' : ''}" data-i="${i}" title="${esc(t.type || '')}">${t.on ? icon('check', 12) : ''} ${esc(t.tag)}</span>`).join('')}</div>
        <div class="flex gap-2 mt-4"><input class="input" id="add-tag" maxlength="100" placeholder="Add your own tag" /><button class="btn" id="add-btn">Add</button></div>
        <div class="muted text-xs mt-2">${total}/500 characters selected</div>
        <div class="flex gap-2 mt-4"><button class="btn flex-1" id="copy-tags">${icon('copy', 16)} Copy selected</button><button class="btn btn-primary flex-1" id="apply-tags">${icon('check', 16)} Apply</button></div>${limits(r)}`;
      renderIcons(o);
      o.querySelector('#chips').onclick = (e) => { const c = e.target.closest('[data-i]'); if (c) { list[c.dataset.i].on = !list[c.dataset.i].on; draw(); } };
      o.querySelector('#add-btn').onclick = () => { const v = o.querySelector('#add-tag').value.trim(); if (v) { list.push({ tag: v, on: true }); draw(); } };
      const selected = () => list.filter((t) => t.on).map((t) => t.tag);
      o.querySelector('#copy-tags').onclick = () => copyText(selected().join(', '));
      o.querySelector('#apply-tags').onclick = () => {
        if (selected().join(',').length > 500) return toast('Selected tags exceed 500 characters. Deselect some.', 'error');
        apply({ tags: selected() }, `Replace the video tags with ${selected().length} selected tags.`);
      };
    };
    draw();
  }

  function thumbnails(o, r) {
    o.innerHTML = `<div class="grid gap-3">${(r.concepts || []).map((c) => `<div class="notif" style="display:block"><div class="font-bold">${esc(c.name)}</div><div class="muted text-sm mt-1">${esc(c.description)}</div>
      <div class="text-sm mt-2"><strong>Text:</strong> ${esc(c.textOverlay)}</div><div class="text-sm mt-1"><strong>Layout:</strong> ${esc(c.layout)}</div>
      <div class="flex flex-wrap gap-2 mt-2">${(c.colors || []).map((col) => `<span class="chip" style="cursor:default"><i style="width:12px;height:12px;border-radius:50%;background:${/^#[0-9a-f]{3,8}$/i.test(col) ? esc(col) : '#888'};display:inline-block"></i>${esc(col)}</span>`).join('')}</div></div>`).join('')}</div>
      ${(r.improvements || []).length ? `<div class="mt-4"><div class="label">Visual improvements</div><ul class="list-clean">${r.improvements.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}
      ${r.note ? `<div class="note-box mt-3">${esc(r.note)}</div>` : ''}`;
  }
}
