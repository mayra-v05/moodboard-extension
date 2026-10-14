export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  if (tag === 'button') el.type = 'button';
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (typeof v !== 'string' && k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}

export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

export async function copyText(text, label = 'Gekopieerd') {
  await navigator.clipboard.writeText(text);
  const short = text.length > 42 ? text.slice(0, 42) + '…' : text;
  toast(`${label} gekopieerd: ${short}`);
}

const loadedFonts = new Set();
export function loadFont(family) {
  family = (family || '').trim();
  if (!family || loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const fam = encodeURIComponent(family).replace(/%20/g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fam}:wght@400;700&display=swap`;
  link.onerror = () => { link.onerror = null; link.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`; };
  document.head.append(link);
}

export const fontStack = f => `"${(f || '').replace(/"/g, '')}", ui-sans-serif, system-ui, sans-serif`;

// --- color ---
export function hexToRgb(hex) {
  let s = hex.replace('#', '');
  if (s.length === 3) s = [...s].map(c => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
export function normHex(s) {
  s = (s || '').trim();
  if (!s.startsWith('#')) s = '#' + s;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return null;
  if (s.length === 4) s = '#' + [...s.slice(1)].map(c => c + c).join('');
  return s.toLowerCase();
}
const luminance = hex => {
  const c = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
export const textOn = hex => (contrast(hex, '#ffffff') >= contrast(hex, '#111111') ? '#ffffff' : '#111111');

export function dedupeColors(list, minDistance = 24) {
  const out = [];
  for (const c of list) {
    const [r, g, b] = hexToRgb(c);
    if (out.every(o => { const [r2, g2, b2] = hexToRgb(o); return Math.hypot(r - r2, g - g2, b - b2) >= minDistance; })) out.push(c);
  }
  return out;
}

export async function paletteFromBlob(blob, count = 6) {
  const bmp = await createImageBitmap(blob);
  const w = 96, hgt = Math.max(1, Math.round(96 * bmp.height / bmp.width));
  const canvas = new OffscreenCanvas(w, hgt);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, hgt);
  const d = ctx.getImageData(0, 0, w, hgt).data;
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = buckets.get(key) || [0, 0, 0, 0];
    b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++;
    buckets.set(key, b);
  }
  const sorted = [...buckets.values()].sort((a, b) => b[3] - a[3]).map(b => rgbToHex(b[0] / b[3], b[1] / b[3], b[2] / b[3]));
  return dedupeColors(sorted, 42).slice(0, count);
}

// --- other ---
export const blobToDataURL = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const domain = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const parseTags = s => [...new Set((s || '').split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean))];
export const isTyping = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
