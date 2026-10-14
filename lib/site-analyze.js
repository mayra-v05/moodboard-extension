// Analyzes the colors and fonts of a website based on its HTML and CSS
// (for items that were not saved from the open tab).
import { dedupeColors } from './ui.js';

const GENERIC = new Set(['inherit', 'initial', 'unset', 'revert', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', '-apple-system', 'blinkmacsystemfont', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'emoji', 'math', 'fangsong',
  'segoe ui', 'roboto', 'helvetica neue', 'arial', 'helvetica', 'noto sans', 'apple color emoji', 'segoe ui emoji',
  'segoe ui symbol', 'noto color emoji', 'sfmono-regular', 'menlo', 'monaco', 'consolas', 'liberation mono', 'courier new',
  'liberation sans', 'ubuntu', 'cantarell', 'oxygen', 'open sans fallback', 'times new roman', 'georgia', 'icons', 'swiper-icons']);

async function get(url, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'include' });
    return res.ok ? { text: await res.text(), url: res.url || url } : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

const ctx = new OffscreenCanvas(1, 1).getContext('2d');
function toHex(c) {
  ctx.fillStyle = '#000';
  ctx.fillStyle = c;
  const v = ctx.fillStyle;
  if (v.startsWith('#')) return v;
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (a < 0.6) return null;
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

const absUrl = (href, base) => { try { return new URL(href.replace(/&amp;/g, '&'), base).href; } catch { return null; } };
const stylesheetLinks = (html, base) => [...html.matchAll(/<link\b[^>]*>/gi)].map(m => m[0])
  .filter(tag => /rel=["']?[^"'>]*stylesheet/i.test(tag))
  .map(tag => tag.match(/href=["']([^"']+)["']/i)?.[1]).filter(Boolean)
  .map(href => absUrl(href, base)).filter(Boolean);
const inlineStyles = html => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1])
  .concat([...html.matchAll(/\sstyle="([^"]*)"/gi)].map(m => `x{${m[1]}}`));

// Fetches stylesheets (including one level of @import); Google Fonts CSS is skipped.
async function fetchSheets(urls) {
  const list = [...new Set(urls)].filter(u => !/fonts\.googleapis\.com/.test(u)).slice(0, 25);
  const out = [];
  for (const r of await Promise.all(list.map(u => get(u, 8000)))) {
    if (!r) continue;
    out.push(r.text);
    const imports = [...r.text.matchAll(/@import\s+(?:url\()?["']?([^"')\s;]+)/gi)].map(m => absUrl(m[1], r.url)).filter(Boolean).slice(0, 4);
    for (const imp of await Promise.all(imports.map(u => get(u, 6000)))) if (imp) out.push(imp.text);
  }
  return out;
}

const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)/gi;

/**
 * Colors from CSS text, ranked by usage.
 * - every literal color in a declaration counts 1
 * - a color defined as a design token (--name: color) counts 3, and every var(--name) counts too
 * Returns [{ hex, score, vars: ['--primary', …] }].
 */
export function cssColors(cssTexts, { max = 16, minDistance = 18 } = {}) {
  const all = cssTexts.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const score = new Map();
  const vars = new Map(); // hex -> Set of variable names
  const tokenOf = new Map(); // --name -> hex
  const bump = (hex, n) => score.set(hex, (score.get(hex) || 0) + n);

  // design tokens
  for (const m of all.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
    const found = m[2].match(COLOR_RE);
    if (!found || found.length !== 1 || /gradient/i.test(m[2])) continue;
    const hex = toHex(found[0]);
    if (!hex) continue;
    tokenOf.set(m[1], hex);
    bump(hex, 3);
    if (!vars.has(hex)) vars.set(hex, new Set());
    vars.get(hex).add(m[1]);
  }
  // literal colors in regular declarations (not in custom properties)
  for (const m of all.matchAll(/(?:^|[;{\s])(?!--)([a-z-]+)\s*:\s*([^;{}]+)/gim)) {
    for (const c of m[2].match(COLOR_RE) || []) { const hex = toHex(c); if (hex) bump(hex, 1); }
  }
  // token usage
  for (const m of all.matchAll(/var\(\s*(--[\w-]+)/g)) { const hex = tokenOf.get(m[1]); if (hex) bump(hex, 1); }

  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([hex, sc]) => ({ hex, score: sc, vars: [...(vars.get(hex) || [])].slice(0, 3) }));
  const keep = new Set(dedupeColors(ranked.map(r => r.hex), minDistance).slice(0, max));
  return ranked.filter(r => keep.has(r.hex));
}

/**
 * Collects the CSS of the whole website: what the page already has (inline/readable sheets),
 * the external stylesheets, and the CSS of a few other pages of the same site.
 */
export async function siteCssTexts({ inline = [], sheetUrls = [], links = [] }) {
  const texts = [...inline];
  const urls = [...sheetUrls];
  const pages = await Promise.all(links.slice(0, 3).map(u => get(u, 8000)));
  for (const p of pages) {
    if (!p) continue;
    texts.push(...inlineStyles(p.text));
    urls.push(...stylesheetLinks(p.text, p.url));
  }
  texts.push(...await fetchSheets(urls));
  return texts;
}

// Internal links from HTML (for analyses without an open tab)
const internalLinks = (html, base) => {
  const origin = new URL(base).origin;
  const self = base.split('#')[0];
  const urls = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)]
    .map(m => absUrl(m[1], base))
    .filter(u => u && u.startsWith(origin) && u.split('#')[0] !== self && !/\.(pdf|jpe?g|png|gif|zip|svg|webp|mp4)(\?|$)/i.test(u));
  return [...new Set(urls)].slice(0, 3);
};

export async function analyzeSite(rawUrl) {
  const page = await get(rawUrl);
  if (!page) throw new Error('Kon de website niet laden');
  const html = page.text;
  const base = page.url;
  const links = stylesheetLinks(html, base);

  const google = new Set();
  for (const l of links) {
    if (!/fonts\.googleapis\.com/.test(l)) continue;
    for (const m of l.matchAll(/family=([^&:;]+)/g)) google.add(decodeURIComponent(m[1].replace(/\+/g, ' ')));
  }

  const css = await siteCssTexts({ inline: inlineStyles(html), sheetUrls: links, links: internalLinks(html, base) });
  const all = css.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

  // custom properties for var() references
  const vars = new Map();
  for (const m of all.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  const resolve = (v, depth = 0) => v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/g, (_, name, fb) => (depth < 4 && vars.has(name) ? resolve(vars.get(name), depth + 1) : (fb || '')));

  const ranked = cssColors(css, { max: 12 });

  // fonts
  const fontCount = new Map();
  const faces = new Set();
  for (const m of all.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*([^;}]+)/gi)) faces.add(m[1].trim().replace(/["']/g, '').toLowerCase());
  for (const m of all.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const value = resolve(m[1]);
    const family = value.split(',').map(f => f.trim().replace(/["']/g, '').replace(/\s*!important$/, '')).find(f => f && !GENERIC.has(f.toLowerCase()) && !/^__|fallback/i.test(f));
    const name = family && family.replace(/^__+/, '').replace(/_[a-f0-9]{5,10}$/i, '').replace(/_/g, ' ').trim();
    if (name) fontCount.set(name, (fontCount.get(name) || 0) + 1);
  }
  for (const g of google) fontCount.set(g, (fontCount.get(g) || 0) + 5);
  const fonts = [...fontCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([family]) => ({ family, roles: [], weights: [], google: google.has(family), custom: faces.has(family.toLowerCase()) }));

  return { colors: ranked.map(r => r.hex), colorVars: Object.fromEntries(ranked.filter(r => r.vars.length).map(r => [r.hex, r.vars])), fonts, from: 'css', at: Date.now() };
}
