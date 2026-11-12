import { api } from './api.js';
import { confirmDialog, debounce, emptyBlock, errorBlock, esc, icon, loadingBlock, renderIcons, setBusy, timeAgo, toast } from './utils.js';

export async function render(el) {
  const state = { q: '', filter: 'all', token: undefined };
  el.innerHTML = `<div class="mb-5"><h1 class="page-title">Comments</h1><div class="page-sub">Read and reply to comments on your videos. AI replies are only drafts: nothing is posted without your approval.</div></div>
    <div class="card"><div class="flex flex-wrap gap-3 mb-4">
      <div class="tabs" id="c-tabs" style="flex:none"><button class="tab active" data-f="all">Recent</button><button class="tab" data-f="unanswered">Unanswered</button></div>
      <div class="search-box" style="max-width:none;flex:1;min-width:200px">${icon('search', 18)}<input class="input" id="c-q" type="search" placeholder="Search comments..." aria-label="Search comments" /></div></div>
      <div id="c-list">${loadingBlock(3, 90)}</div><div class="mt-4 text-center" id="c-more"></div></div>`;
  const listEl = el.querySelector('#c-list');
  const moreEl = el.querySelector('#c-more');

  const card = (c) => `<div class="notif mb-3" style="display:block" data-cid="${esc(c.commentId)}">
    <div class="flex gap-3"><img class="avatar" style="width:38px;height:38px" src="${esc(c.authorImage || '/logo.svg')}" alt="" referrerpolicy="no-referrer" />
      <div class="flex-1 min-w-0"><div class="text-sm"><strong>${esc(c.authorName)}</strong> <span class="muted text-xs">${timeAgo(c.publishedAt)}</span> ${c.ownerReplied ? '<span class="badge badge-green">Replied</span>' : c.isOwn ? '<span class="badge badge-blue">You</span>' : ''}</div>
        <div class="text-sm mt-1" style="white-space:pre-wrap;word-break:break-word">${esc(c.text)}</div>
        <div class="muted text-xs mt-1">${c.videoTitle ? `On: ${esc(c.videoTitle)} &bull; ` : ''}${icon('thumbs-up', 12)} ${c.likeCount} &bull; ${c.replyCount} repl${c.replyCount === 1 ? 'y' : 'ies'}</div>
        <div class="flex gap-2 mt-3"><button class="btn btn-sm" data-act="reply">${icon('send', 14)} Reply</button><button class="btn btn-sm" data-act="suggest">${icon('sparkles', 14)} AI suggestions</button></div>
        <div class="reply-box" hidden><div class="suggestions flex flex-wrap gap-2 mt-3"></div><textarea class="textarea mt-3" maxlength="10000" placeholder="Write your reply..."></textarea><div class="flex gap-2 mt-2 justify-end"><button class="btn btn-sm" data-act="cancel">Cancel</button><button class="btn btn-primary btn-sm" data-act="post">Post reply</button></div></div></div></div></div>`;

  let items = [];
  async function load(append) {
    if (!append) { listEl.innerHTML = loadingBlock(3, 90); items = []; state.token = undefined; }
    moreEl.innerHTML = '';
    try {
      const d = await api.get('/comments', { q: state.q, filter: state.filter, pageToken: state.token });
      items = append ? items.concat(d.items) : d.items;
      state.token = d.nextPageToken;
      if (append) listEl.insertAdjacentHTML('beforeend', d.items.map(card).join(''));
      else listEl.innerHTML = d.items.length ? d.items.map(card).join('') : emptyBlock('No comments found', state.filter === 'unanswered' ? 'Everything on this page has a reply.' : 'No comments match.', 'message-square');
      if (state.token) moreEl.innerHTML = `<button class="btn" id="more">Load more</button>`;
      moreEl.querySelector('#more')?.addEventListener('click', () => load(true));
    } catch (err) { listEl.innerHTML = errorBlock(err); }
    renderIcons(el);
  }

  el.querySelector('#c-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-f]');
    if (!t) return;
    state.filter = t.dataset.f;
    el.querySelectorAll('#c-tabs .tab').forEach((x) => x.classList.toggle('active', x === t));
    load();
  });
  el.querySelector('#c-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const root = btn.closest('[data-cid]');
    const c = items.find((x) => x.commentId === root.dataset.cid);
    const box = root.querySelector('.reply-box');
    const ta = box.querySelector('textarea');
    switch (btn.dataset.act) {
      case 'reply': box.hidden = false; ta.focus(); break;
      case 'cancel': box.hidden = true; break;
      case 'suggest': {
        box.hidden = false;
        setBusy(btn, true, 'Thinking...');
        try {
          const { result } = await api.post('/ai/reply-suggestions', { commentText: c.text.slice(0, 5000), videoTitle: c.videoTitle || undefined });
          const sg = box.querySelector('.suggestions');
          sg.innerHTML = (result.suggestions || []).map((s, i) => `<button class="chip" data-s="${i}" title="Use this draft"><strong>${esc(s.tone)}:</strong> ${esc(s.text.slice(0, 90))}${s.text.length > 90 ? '...' : ''}</button>`).join('');
          sg.onclick = (ev) => { const ch = ev.target.closest('[data-s]'); if (ch) { ta.value = result.suggestions[ch.dataset.s].text; ta.focus(); } };
        } catch (err) { toast(err.message, 'error'); }
        setBusy(btn, false);
        break;
      }
      case 'post': {
        const text = ta.value.trim();
        if (!text) return toast('Write a reply first.', 'error');
        if (!(await confirmDialog({ title: 'Post this reply publicly?', text: `Reply to ${c.authorName}:\n\n${text}`, confirmText: 'Post reply' }))) return;
        setBusy(btn, true, 'Posting...');
        try {
          await api.post(`/comments/${c.commentId}/reply`, { text });
          toast('Reply posted', 'success');
          box.hidden = true; ta.value = '';
        } catch (err) { toast(err.message, 'error'); }
        setBusy(btn, false);
        break;
      }
      default:
    }
  });
  await load();
}
