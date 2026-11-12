import { destroyCharts } from '../components/charts.js';
import { renderIcons, errorBlock } from './utils.js';

const routes = [];
let outlet = null;
let current = null;
let onChange = () => {};

export const addRoute = (pattern, loader) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ re, keys, loader });
};

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export const navigate = (path) => { location.hash = path; };

async function render(ctx) {
  const { path, query } = parseHash();
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    if (current?.destroy) current.destroy();
    destroyCharts();
    outlet.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    outlet.innerHTML = '';
    try {
      const mod = await r.loader();
      current = mod;
      await mod.render(outlet, { params, query, ...ctx });
    } catch (err) {
      outlet.innerHTML = errorBlock(err);
    }
    renderIcons(outlet);
    onChange(path);
    return;
  }
  navigate('/');
}

export function startRouter(el, ctxProvider, changeCb) {
  outlet = el;
  onChange = changeCb || onChange;
  const run = () => render(ctxProvider());
  window.addEventListener('hashchange', run);
  run();
  return () => window.removeEventListener('hashchange', run);
}
