import * as db from './lib/db.js';
import { TYPES, SECTION_TYPES, NAV_TYPES, getCategories, addCategory, getSettings, setSetting, COPY_CONTEXTS, POPULAR_FONTS } from './lib/constants.js';
import { fetchPreview, detectSource, faviconUrl, normalizeUrl } from './lib/meta.js';
import { icon } from './lib/icons.js';
import { initI18n, t, i18n, dateLocale, langButton } from './lib/i18n.js';
import { buildPrompt, STACKS } from './lib/prompt.js';
import { analyzeSite } from './lib/site-analyze.js';
import { scanUrlStyle } from './lib/page-scan.js';
import { gradientFromImage } from './lib/gradient-extract.js';
import {
  h, $, toast, copyText, loadFont, fontStack, contrast, textOn, normHex, paletteFromBlob,
  blobToDataURL, debounce, domain, parseTags, isTyping, dedupeColors,
} from './lib/ui.js';

const SOURCE_LABEL = { pinterest: 'Pinterest', awwwards: 'Awwwards', dribbble: 'Dribbble', behance: 'Behance', web: 'Website', upload: 'Upload' };
const state = { items: [], type: 'all', category: null, project: '', q: '', live: false, cats: [] };
const grid = $('#grid');

// ---------- media & live previews ----------
const mediaUrls = new Map();
async function mediaURL(key) {
  if (!key) return null;
  if (mediaUrls.has(key)) return mediaUrls.get(key);
  const blob = await db.getMedia(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  mediaUrls.set(key, url);
  return url;
}

const liveUrl = it => it.siteUrl || (it.source === 'web' ? it.url : null);

function mountLive(box, url, { interactive = false, vw = 1440, vh = 900 } = {}) {
  if (!url || box.querySelector('.live:not(.old)')) return;
  const frame = h('iframe', {
    src: url, sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
    referrerpolicy: 'no-referrer', tabindex: interactive ? '0' : '-1', title: 'Live preview',
    style: `width:${vw}px;height:${vh}px`,
  });
  const wrap = h('div', { class: 'live' + (interactive ? ' interactive' : '') }, frame, h('span', { class: 'spinner' }));
  frame.addEventListener('load', () => {
    wrap.classList.add('ready');
    wrap._loadedAt = Date.now();
    // On replay: only remove the old iframe once the new one is ready (no white flash).
    setTimeout(() => box.querySelectorAll('.live.old').forEach(o => { o._ro?.disconnect(); o.remove(); }), 400);
  });
  box.append(wrap);
  const fit = () => {
    if (interactive) {
      const s = Math.min(box.clientWidth / vw, (innerHeight * 0.8) / vh, 1);
      Object.assign(wrap.style, { width: vw * s + 'px', height: vh * s + 'px' });
      frame.style.transform = `scale(${s})`;
    } else {
      frame.style.transform = `scale(${box.clientWidth / vw})`;
    }
  };
  fit();
  wrap._ro = new ResizeObserver(fit);
  wrap._ro.observe(box);
}

// Animations on a site often play only once: reload the live preview on hover.
function replayLive(box) {
  const current = box.querySelector('.live:not(.old)');
  if (!current?._loadedAt || Date.now() - current._loadedAt < 3000) return;
  const url = current.querySelector('iframe').src;
  current.classList.add('old');
  mountLive(box, url);
}

// Nothing moves on its own on the board: videos, GIFs and live sites only play on hover.
function hoverPlay(el, box) {
  el.addEventListener('mouseenter', () => {
    const v = box.querySelector('video');
    if (v) { if (v.ended) v.currentTime = 0; v.play().catch(() => {}); }
    box.classList.add('playing');
  });
  el.addEventListener('mouseleave', () => {
    box.querySelector('video')?.pause();
    box.classList.remove('playing');
  });
}

// First frame of a GIF as a still image (on top of the moving GIF).
function freezeGif(img, box) {
  const still = h('canvas', { class: 'gif-still', 'aria-hidden': 'true' });
  const draw = () => {
    still.width = img.naturalWidth; still.height = img.naturalHeight;
    try { still.getContext('2d').drawImage(img, 0, 0); box.classList.add('frozen'); } catch {}
  };
  if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, { once: true });
  box.append(still);
}

function unmountLive(box) {
  box.querySelectorAll('.live').forEach(live => { live._ro?.disconnect(); live.remove(); });
}

// Iframes of other sites often may not be embedded (X-Frame-Options / CSP).
// For this board tab we strip those headers, so live previews work.
async function enableFraming() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (!tab) return;
    const headers = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'];
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tab.id],
      addRules: [{
        id: tab.id, priority: 1,
        action: { type: 'modifyHeaders', responseHeaders: headers.map(header => ({ header, operation: 'remove' })) },
        condition: { tabIds: [tab.id], resourceTypes: ['sub_frame'] },
      }],
    });
  } catch (e) { console.warn('Live previews beperkt:', e); }
}

// ---------- init ----------
await initI18n();
init();

async function init() {
  $('#searchIcon').innerHTML = icon('search', 16);
  $('#exportBtn').before(langButton());
  $('#addIcon').innerHTML = icon('plus', 16);
  $('#fontlist').replaceChildren(...POPULAR_FONTS.map(f => h('option', { value: f })));

  const view = location.hash.slice(1);
  if (TYPES.some(t => t.id === view)) state.type = view;

  const s = await getSettings();
  $('#q').addEventListener('input', debounce(e => { state.q = e.target.value.trim(); render(); }, 120));
  $('#addBtn').onclick = () => openEditor(state.type === 'all' ? 'inspo' : state.type);
  $('#exportBtn').onclick = exportAll;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = importAll;
  document.addEventListener('keydown', e => {
    if (isTyping(e) || document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'n') { e.preventDefault(); openEditor(state.type === 'all' ? 'inspo' : state.type); }
  });
  setupDrop();
  setupPaste();
  enableFraming();

  new BroadcastChannel('moodboard').onmessage = debounce(load, 120);
  chrome.storage.onChanged.addListener(c => { if (c.customCategories) load(); });
  await load();
}

// Gradients are named "Gradient #1", "#2", … by default
const GRADIENT_NAME = /^Gradient #(\d+)$/;
function nextGradientName() {
  const gradients = state.items.filter(i => i.type === 'gradient');
  const nums = gradients.map(i => +(i.name?.match(GRADIENT_NAME)?.[1] || 0));
  // the ordinal of this gradient, but never a number that already exists
  return `Gradient #${Math.max(gradients.length, ...nums) + 1}`;
}

// One-off: rename old gradients named after a file (e.g. "Schermafbeelding 2026-10-12 om …").
async function renameFileNamedGradients() {
  const bad = state.items
    .filter(i => i.type === 'gradient' && (!i.name || i.name === 'Gradient' || /^(schermafbeelding|screenshot|image|img|afbeelding|dribbble|photo|foto)\b|\.(png|jpe?g|webp|gif)$/i.test(i.name)))
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const it of bad) { it.name = nextGradientName(); await db.putItem(it); }
}

async function load() {
  // Only show kinds that still exist (Motion and Resources were removed; the data stays in the export).
  state.items = (await db.allItems()).filter(i => TYPES.some(t => t.id === i.type));
  if (!load.migrated) { load.migrated = true; await renameFileNamedGradients(); state.items = (await db.allItems()).filter(i => TYPES.some(t => t.id === i.type)); }
  state.cats = await getCategories();
  $('#projectlist').replaceChildren(...projects().map(p => h('option', { value: p })));
  renderNav();
  renderFilters();
  render();
}

const projects = () => [...new Set(state.items.map(i => i.project).filter(Boolean))].sort();

function renderNav() {
  const counts = { all: state.items.length };
  for (const it of state.items) counts[it.type] = (counts[it.type] || 0) + 1;
  $('#types').replaceChildren(...[{ id: 'all', label: 'Alles', icon: 'sparkle' }, ...TYPES].map(t => h('button', {
    class: 'type' + (state.type === t.id ? ' on' : ''),
    'aria-pressed': String(state.type === t.id),
    html: `${icon(t.icon, 16)}<span>${t.label}</span><em>${counts[t.id] || 0}</em>`,
    onclick: () => {
      state.type = t.id;
      state.category = null;
      renderNav(); renderFilters(); render();
    },
  })));
}

function renderFilters() {
  const wrap = $('#filters');
  wrap.replaceChildren();
  const CAT_LISTS = { section: SECTION_TYPES, nav: NAV_TYPES };
  const ftype = CAT_LISTS[state.type] ? state.type : (state.type === 'all' || state.type === 'inspo') ? 'inspo' : null;
  if (ftype) {
    const counts = {};
    for (const it of state.items) if (it.type === ftype) counts[it.category] = (counts[it.category] || 0) + 1;
    const known = CAT_LISTS[ftype] || state.cats;
    const used = known.filter(c => counts[c]).concat(Object.keys(counts).filter(c => c && !known.includes(c)));
    if (used.length) {
      wrap.append(h('div', { class: 'chips' },
        h('button', { class: 'chip' + (!state.category ? ' on' : ''), onclick: () => { state.category = null; renderFilters(); render(); } }, ftype === 'section' ? 'Alle secties' : ftype === 'nav' ? 'Alle navigaties' : 'Alle categorieën'),
        ...used.map(c => h('button', {
          class: 'chip' + (state.category === c ? ' on' : ''),
          onclick: () => { state.category = state.category === c ? null : c; if (state.category && state.type === 'all') state.type = ftype; renderNav(); renderFilters(); render(); },
        }, c, h('em', {}, counts[c]))),
      ));
    }
  }
  const ps = projects();
  if (ps.length) {
    const sel = h('select', { class: 'input small', onchange: e => { state.project = e.target.value; render(); } },
      h('option', { value: '' }, 'Alle projecten'), ...ps.map(p => h('option', { value: p, selected: p === state.project }, p)));
    wrap.append(h('label', { class: 'project-filter' }, 'Project', sel));
  }
}

function filtered() {
  const q = state.q.toLowerCase();
  return state.items
    .filter(it => (state.type === 'all' || it.type === state.type)
      && (!state.category || it.category === state.category)
      && (!state.project || it.project === state.project)
      && (!q || JSON.stringify([it.title, it.url, it.category, it.tags, it.note, it.name, it.colors, it.heading, it.body, it.text, it.context, it.description, it.project, it.css, it.kind]).toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function render() {
  grid.querySelectorAll('.live').forEach(l => l._ro?.disconnect());
  const list = filtered();
  grid.replaceChildren(...list.map(tile));
  const empty = $('#empty');
  empty.hidden = list.length > 0;
  if (!list.length) renderEmpty(empty);
}

function renderEmpty(el) {
  const searching = state.q || state.category || state.project;
  el.replaceChildren(
    h('div', { class: 'empty-art', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
    h('h2', {}, searching ? 'Niets gevonden' : 'Je bord is nog leeg'),
    h('p', {}, searching
      ? 'Probeer een andere zoekterm of filter.'
      : state.type === 'nav'
      ? 'Open een website, klik op het extensie-icoon → Sectie → Navigatie vastleggen. Je legt het menu dicht én open vast, met video. Sneltoets: Alt+Shift+N.'
      : state.type === 'section'
      ? 'Open een website, klik op het extensie-icoon → Sectie, en kies een hero, footer of andere sectie. Sneltoets: Alt+Shift+X.'
      : 'Klik op het extensie-icoon op een Pinterest-pin of Awwwards-site, sleep een afbeelding hierheen, of plak (⌘V) een link.'),
    !searching && h('button', { class: 'btn primary', onclick: () => openEditor(state.type === 'all' ? 'inspo' : state.type) }, 'Eerste item toevoegen'),
  );
}

// ---------- tiles ----------
const iconBtn = (ic, label, fn, cls = '') => h('button', {
  class: 'icon-btn ' + cls, title: label, 'aria-label': label, html: icon(ic, 16),
  onclick: e => { e.stopPropagation(); fn(e); },
});

const tileActions = (it, extra = []) => h('div', { class: 'actions' },
  ...extra, iconBtn('edit', 'Bewerken', () => openItem(it)), iconBtn('trash', 'Verwijderen', () => remove(it), 'danger'));

const overlay = (left, actions) => h('div', { class: 'overlay' }, left || h('span'), actions);

function tile(it) {
  const make = { inspo: tileInspo, section: tileInspo, nav: tileNav, palette: tilePalette, font: tileFont, gradient: tileGradient, copy: tileCopy }[it.type];
  const el = make ? make(it) : h('article', { class: 'tile' }, 'Onbekend item');
  el.tabIndex = 0;
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === el) openItem(it); });
  return el;
}

function openItem(it) {
  if (it.type === 'inspo' || it.type === 'section') openDetail(it);
  else if (it.type === 'gradient') openGradientDetail(it);
  else if (it.type === 'nav') openNavDetail(it);
  else openEditor(it.type, it);
}

function placeholder(it) {
  const d = domain(it.url || it.siteUrl || '') || it.title || 'Preview';
  return h('div', { class: 'ph-media' }, h('span', {}, d));
}

async function fillMedia(box, it, isTile) {
  const videoSrc = it.mediaType === 'video' ? await mediaURL(it.mediaKey) : it.video;
  const poster = (await mediaURL(it.posterKey)) || it.image || null;
  const imageSrc = it.mediaType === 'image' ? await mediaURL(it.mediaKey) : (it.gif || it.image);
  let kind = 'none';

  if (videoSrc) {
    const v = h('video', { src: videoSrc, poster: poster || null, loop: true, playsInline: true, preload: isTile ? 'metadata' : 'auto' });
    v.muted = true;
    v.addEventListener('loadedmetadata', () => { if (v.videoWidth) box.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`; });
    box.append(v);
    kind = 'video';
    if (!isTile) { v.controls = true; v.play().catch(() => {}); }
  } else if (imageSrc) {
    const img = h('img', { src: imageSrc, alt: it.title || '', loading: 'lazy', decoding: 'async' });
    img.onerror = () => { img.remove(); box.classList.add('ratio'); box.prepend(placeholder(it)); };
    img.onload = () => { if (img.offsetHeight > box.clientHeight + 4) box.classList.add('tall'); };
    box.append(img);
    kind = it.mediaType !== 'image' && it.gif ? 'gif' : 'image';
    if (isTile && kind === 'gif') freezeGif(img, box);
  } else {
    box.classList.add('ratio');
    box.append(placeholder(it));
  }

  if (isTile) {
    if (kind === 'video' || kind === 'gif') box.append(h('span', { class: 'badge moving' }, h('i'), it.recording ? 'Opname' : kind === 'gif' ? 'GIF' : 'Video'));
    if (it.pendingRecording) box.append(h('span', { class: 'badge rec' }, h('i'), 'Opname bezig…'));
  }
  return kind;
}

function tileInspo(it) {
  const box = h('div', { class: 'media' });
  const live = it.type === 'section' ? null : liveUrl(it);
  const el = h('article', { class: 'tile inspo' + (it.type === 'section' ? ' section' : ''), onclick: () => openDetail(it) },
    box,
    overlay(h('span', { class: 'cat' }, it.category || 'Zonder categorie'),
      tileActions(it, [it.url && iconBtn('external', 'Open origineel', () => window.open(it.url, '_blank'))])),
    h('footer', { class: 'meta' },
      it.url && h('img', { class: 'fav', src: faviconUrl(it.url), alt: '' }),
      h('span', { class: 'title', 'data-no-i18n': true }, it.title || domain(it.url) || 'Zonder titel'),
      live && h('span', { class: 'live-dot', title: 'Live preview beschikbaar (hover)' }),
      h('span', { class: 'src' }, it.type === 'section' ? domain(it.url) : SOURCE_LABEL[it.source] || ''),
    ),
  );

  hoverPlay(el, box);
  fillMedia(box, it, true).then(kind => {
    if (!live || kind === 'video' || kind === 'gif') return;
    // The live site only loads on hover, and disappears again when the mouse leaves.
    let t;
    el.addEventListener('mouseenter', () => { t = setTimeout(() => mountLive(box, live), 250); });
    el.addEventListener('mouseleave', () => { clearTimeout(t); unmountLive(box); });
  });
  return el;
}

function tileNav(it) {
  const box = h('div', { class: 'media nav-media', style: it.width ? `--ar:${it.width} / ${it.height}` : '' });
  const el = h('article', { class: 'tile nav' + (it.mobile ? ' mobile' : ''), onclick: () => openNavDetail(it) },
    box,
    overlay(h('span', { class: 'cat' }, it.category || 'Navigatie'), tileActions(it)),
    h('footer', { class: 'meta' },
      it.url && h('img', { class: 'fav', src: faviconUrl(it.url), alt: '' }),
      h('span', { class: 'title', 'data-no-i18n': true }, it.title || domain(it.url)),
      h('span', { class: 'src' }, it.mobile ? 'Mobiel' : 'Desktop')),
  );
  Promise.all([mediaURL(it.closedKey), mediaURL(it.openKey), mediaURL(it.videoKey)]).then(([closed, open, video]) => {
    // Only a recording (no open screenshot)? Then the video plays on hover.
    const vid = !open && video && h('video', { class: 'nav-open', src: video, loop: true, playsInline: true, preload: 'metadata' });
    if (vid) {
      vid.muted = true;
      el.addEventListener('mouseenter', () => { vid.currentTime = 0; vid.play().catch(() => {}); });
      el.addEventListener('mouseleave', () => vid.pause());
    }
    box.append(
      closed ? h('img', { class: 'nav-closed', src: closed, alt: '' }) : placeholder(it),
      open && h('img', { class: 'nav-open', src: open, alt: '' }),
      vid,
      it.pendingRecording
        ? h('span', { class: 'badge rec' }, h('i'), 'Opname bezig…')
        : h('span', { class: 'badge moving nav-badge' }, h('i'), h('span', { class: 'nb-closed' }, vid ? 'Video' : 'Dicht'), h('span', { class: 'nb-open' }, vid ? 'Speelt af' : 'Open')),
    );
  });
  return el;
}

const slug = s => (s || 'palet').toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const paletteCss = it => `:root {\n${it.colors.map((c, i) => `  --${slug(it.name)}-${i + 1}: ${c};`).join('\n')}\n}`;

function tilePalette(it) {
  return h('article', { class: 'tile palette', onclick: () => openEditor('palette', it) },
    h('div', { class: 'swatches' }, ...it.colors.map(c => h('button', {
      class: 'sw', style: `background:${c};color:${textOn(c)}`, title: 'Kopieer ' + c,
      onclick: e => { e.stopPropagation(); copyText(c.toUpperCase(), 'Kleur'); },
    }, h('span', {}, c.toUpperCase())))),
    overlay(null, tileActions(it, [iconBtn('copy', 'Kopieer als CSS-variabelen', () => copyText(paletteCss(it), 'CSS'))])),
    h('footer', { class: 'meta' }, h('span', { class: 'title', 'data-no-i18n': true }, it.name || 'Palet'), h('span', { class: 'src' }, `${it.colors.length} kleuren`)),
  );
}

const fontCss = it => [
  it.heading && `/* Heading */\nfont-family: ${fontStack(it.heading)};`,
  it.body && `/* Body */\nfont-family: ${fontStack(it.body)};`,
].filter(Boolean).join('\n\n');
const googleFontsUrl = f => 'https://fonts.google.com/specimen/' + encodeURIComponent(f).replace(/%20/g, '+');

function tileFont(it) {
  loadFont(it.heading); loadFont(it.body);
  const hf = fontStack(it.heading), bf = fontStack(it.body || it.heading);
  return h('article', { class: 'tile font', onclick: () => openEditor('font', it) },
    h('div', { class: 'font-card' },
      h('div', { class: 'aa', style: `font-family:${hf}` }, 'Aa'),
      h('div', { class: 'fname', 'data-no-i18n': true, style: `font-family:${hf}` }, it.sample || it.heading),
      it.body
        ? h('p', { class: 'fbody', style: `font-family:${bf}` }, 'Goede typografie maakt inhoud leesbaar en geeft een merk een stem. Dit is ', h('strong', {}, it.body), ' als bodytekst.')
        : h('p', { class: 'glyphs', style: `font-family:${hf}` }, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &?!€'),
    ),
    overlay(null, tileActions(it, [
      iconBtn('copy', 'Kopieer CSS', () => copyText(fontCss(it), 'CSS')),
      iconBtn('external', 'Bekijk op Google Fonts', () => window.open(googleFontsUrl(it.heading), '_blank')),
    ])),
    h('footer', { class: 'meta' },
      h('span', { class: 'title' }, it.body ? `${it.heading} + ${it.body}` : it.heading),
      h('span', { class: 'src' }, it.body ? 'Combinatie' : (it.role || 'Lettertype'))),
  );
}

function tileGradient(it) {
  return h('article', { class: 'tile gradient', onclick: () => openGradientDetail(it) },
    h('div', { class: 'grad', style: `background:${it.css}` }),
    overlay(null, tileActions(it, [iconBtn('copy', 'Kopieer CSS', () => copyText(`background: ${it.css};`, 'CSS'))])),
    h('footer', { class: 'meta' }, h('span', { class: 'title', 'data-no-i18n': true }, it.name || 'Gradient'), h('code', { class: 'src mono' }, it.kind || 'css')),
  );
}

function tileCopy(it) {
  return h('article', { class: 'tile copy', onclick: () => openEditor('copy', it) },
    h('blockquote', { 'data-no-i18n': true }, it.text),
    overlay(h('span', { class: 'cat' }, it.context || 'Microcopy'), tileActions(it, [iconBtn('copy', 'Kopieer tekst', () => copyText(it.text, 'Tekst'))])),
    h('footer', { class: 'meta' },
      it.sourceUrl && h('img', { class: 'fav', src: faviconUrl(it.sourceUrl), alt: '' }),
      h('span', { class: 'title' }, domain(it.sourceUrl) || 'Microcopy'),
      h('span', { class: 'src' }, it.context || '')),
  );
}

async function remove(it) {
  if (!confirm(t('Weet je zeker dat je dit item wilt verwijderen?'))) return false;
  await db.deleteItem(it.id);
  toast('Verwijderd');
  return true;
}

// ---------- detail (inspiration) ----------
async function openDetail(it) {
  const d = $('#detail');
  const stage = h('div', { class: 'stage' });
  const live = () => it.siteUrl || (it.source === 'web' ? it.url : null);

  const views = h('div', { class: 'seg' });
  const setView = async view => {
    views.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    stage.querySelectorAll('.live').forEach(l => l._ro?.disconnect());
    stage.replaceChildren();
    const box = h('div', { class: 'media big' + (view !== 'media' ? ' live-stage' : it.type === 'section' ? ' scroll' : '') });
    stage.append(box);
    if (view === 'media') await fillMedia(box, it, false);
    else mountLive(box, live(), { interactive: true, ...(view === 'mobile' ? { vw: 390, vh: 844 } : {}) });
  };
  const drawViews = () => {
    views.replaceChildren(
      h('button', { 'data-v': 'media', html: icon('image', 15) + 'Preview', onclick: () => setView('media') }),
      live() && h('button', { 'data-v': 'desktop', html: icon('monitor', 15) + 'Live desktop', onclick: () => setView('desktop') }),
      live() && h('button', { 'data-v': 'mobile', html: icon('phone', 15) + 'Live mobiel', onclick: () => setView('mobile') }),
    );
  };

  const save = async (key, value) => { it[key] = value; await db.putItem(it); };
  const titleIn = h('input', { class: 'input title-input', value: it.title || '', onchange: e => save('title', e.target.value.trim()) });
  const catSel = h('select', {
    class: 'input',
    onchange: async e => {
      if (e.target.value === '__new') {
        const c = await addCategory(prompt(t('Naam van de nieuwe categorie')));
        state.cats = await getCategories();
        if (!c) { e.target.value = it.category; return; }
        e.target.replaceChildren(...catOptions(c, it.type === 'section' ? SECTION_TYPES : state.cats));
        return save('category', c);
      }
      save('category', e.target.value);
    },
  }, ...catOptions(it.category, it.type === 'section' ? SECTION_TYPES : state.cats));
  const projectIn = h('input', { class: 'input', list: 'projectlist', value: it.project || '', placeholder: 'bv. Nairiva', onchange: e => save('project', e.target.value.trim()) });
  const liveIn = h('input', {
    class: 'input', value: it.siteUrl || '', placeholder: 'https://… (voor live preview)',
    onchange: async e => { await save('siteUrl', e.target.value.trim() ? normalizeUrl(e.target.value) : null); drawViews(); },
  });

  const promptEl = promptBlock(it);
  const side = h('aside', { class: 'side' },
    h('div', { class: 'side-top' },
      h('span', { class: 'src-badge' }, it.url && h('img', { class: 'fav', src: faviconUrl(it.url), alt: '' }), SOURCE_LABEL[it.source] || 'Item'),
      h('button', { class: 'icon-btn', 'aria-label': 'Sluiten', html: icon('close'), onclick: () => d.close() })),
    titleIn,
    it.description && h('p', { class: 'desc', 'data-no-i18n': true }, it.description),
    field('Categorie', catSel),
    styleBlock(it, () => promptEl.refresh()),
    promptEl,
    field('Project', projectIn),
    field('Live-URL', liveIn, it.source !== 'web' ? 'Vul de echte website in om hem live te bekijken.' : null),
    h('div', { class: 'side-actions' },
      it.url && h('a', { class: 'btn', href: it.url, target: '_blank', html: icon('external', 15) + 'Origineel' }),
      it.sourceLink && h('a', { class: 'btn', href: it.sourceLink, target: '_blank', title: it.sourceLink, html: icon('link', 15) + 'Bron van pin' }),
      h('button', { class: 'btn ghost danger', html: icon('trash', 15) + 'Verwijder', onclick: async () => { if (await remove(it)) d.close(); } }),
    ),
    h('p', { class: 'muted small' }, 'Opgeslagen op ' + new Date(it.createdAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })),
  );

  d.replaceChildren(h('div', { class: 'detail' }, h('div', { class: 'stage-col' }, views, stage), side));
  drawViews();
  d.showModal();
  d.addEventListener('close', () => { stage.querySelectorAll('.live').forEach(l => l._ro?.disconnect()); stage.replaceChildren(); }, { once: true });
  d.onclick = e => { if (e.target === d) d.close(); };
  await setView('media');
}

// ---------- detail (navigation) ----------
async function openNavDetail(it) {
  const d = $('#detail');
  const [closed, open] = await Promise.all([mediaURL(it.closedKey), mediaURL(it.openKey)]);
  const video = it.videoKey ? await mediaURL(it.videoKey) : null;
  const stage = h('div', { class: 'stage nav-stage' + (it.mobile ? ' mobile' : '') });
  const both = closed && open;
  const VIEWS = [
    ...(video ? [['video', 'Video']] : []),
    ...(both ? [['slider', 'Vergelijk'], ['side', 'Naast elkaar']] : []),
    ...(closed ? [['closed', 'Dicht']] : []),
    ...(open ? [['open', 'Open']] : []),
  ];
  const views = h('div', { class: 'seg' });

  const slider = () => {
    const wrap = h('div', { class: 'nav-slider', style: '--x:50%' },
      h('img', { src: closed, alt: '', draggable: false }),
      h('div', { class: 'ns-open' }, h('img', { src: open, alt: '', draggable: false })),
      h('div', { class: 'ns-handle' }, h('span', { html: icon('chevrons', 16) })),
      h('span', { class: 'ns-label l' }, 'Dicht'), h('span', { class: 'ns-label r' }, 'Open'));
    const move = e => {
      const r = wrap.getBoundingClientRect();
      wrap.style.setProperty('--x', `${Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))}%`);
    };
    wrap.addEventListener('pointerdown', e => { wrap.setPointerCapture(e.pointerId); move(e); });
    wrap.addEventListener('pointermove', e => { if (e.buttons) move(e); });
    wrap.tabIndex = 0;
    wrap.addEventListener('keydown', e => {
      const x = parseFloat(wrap.style.getPropertyValue('--x'));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); wrap.style.setProperty('--x', `${Math.max(0, Math.min(100, x + (e.key === 'ArrowLeft' ? -5 : 5)))}%`); }
    });
    return wrap;
  };
  const fig = (src, label) => h('figure', {}, h('img', { src, alt: '' }), h('figcaption', {}, label));
  const setView = v => {
    views.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    stage.replaceChildren(
      v === 'slider' ? slider()
      : v === 'side' ? h('div', { class: 'nav-side' }, fig(closed, 'Dicht'), fig(open, 'Open'))
      : v === 'video' ? (() => { const el = h('video', { src: video, controls: true, autoplay: true, loop: true, playsInline: true }); el.muted = true; return el; })()
      : h('img', { class: 'nav-single', src: v === 'closed' ? closed : open, alt: '' }),
    );
  };
  views.replaceChildren(...VIEWS.map(([v, l]) => h('button', { 'data-v': v, onclick: () => setView(v) }, l)));

  const save = async (k, v) => { it[k] = v; await db.putItem(it); };
  const navPrompt = promptBlock(it);
  const side = h('aside', { class: 'side' },
    h('div', { class: 'side-top' },
      h('span', { class: 'src-badge' }, it.url && h('img', { class: 'fav', src: faviconUrl(it.url), alt: '' }), it.mobile ? 'Navigatie · mobiel' : 'Navigatie · desktop'),
      h('button', { class: 'icon-btn', 'aria-label': 'Sluiten', html: icon('close'), onclick: () => d.close() })),
    h('input', { class: 'input title-input', value: it.title || '', 'data-no-i18n': true, onchange: e => save('title', e.target.value.trim()) }),
    it.width && h('p', { class: 'desc' }, `${it.width} × ${it.height}px`, video ? ' · met video' : ''),
    field('Soort navigatie', h('select', { class: 'input', onchange: e => { save('category', e.target.value); navPrompt.refresh(); } }, ...catOptions(it.category, NAV_TYPES).filter(o => o.value !== '__new'))),
    navPrompt,
    field('Project', h('input', { class: 'input', list: 'projectlist', value: it.project || '', placeholder: 'bv. Nairiva', onchange: e => save('project', e.target.value.trim()) })),
    h('div', { class: 'side-actions' },
      it.url && h('a', { class: 'btn', href: it.url, target: '_blank', html: icon('external', 15) + 'Origineel' }),
      video && h('a', { class: 'btn', href: video, download: `${slug(it.title || 'navigatie')}.webm`, html: icon('download', 15) + 'Video' }),
      h('button', { class: 'btn ghost danger', html: icon('trash', 15) + 'Verwijder', onclick: async () => { if (await remove(it)) d.close(); } })),
    h('p', { class: 'muted small' }, 'Opgeslagen op ' + new Date(it.createdAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })),
  );

  d.replaceChildren(h('div', { class: 'detail' }, h('div', { class: 'stage-col' }, views, stage), side));
  d.onclick = e => { if (e.target === d) d.close(); };
  setView(both ? 'slider' : video ? 'video' : 'closed');
  d.showModal();
}

// ---------- detail (gradient) ----------
const tailwindGradient = cssValue => `bg-[${cssValue.replace(/\s*,\s*/g, ',').replace(/\s+/g, '_')}]`;

async function openGradientDetail(it) {
  const d = $('#detail');
  const stage = h('div', { class: 'stage grad-stage' });
  const shotUrl = await mediaURL(it.sourceKey);
  const VIEWS = [['fill', 'Vlak'], ['text', 'Tekst'], ['button', 'Knop'], ['card', 'Kaart'], ...(shotUrl ? [['shot', 'Screenshot']] : [])];
  const views = h('div', { class: 'seg' });
  const setView = v => {
    views.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    const bg = `background:${it.css}`;
    stage.replaceChildren(
      v === 'fill' ? h('div', { class: 'gd-fill', style: bg })
      : v === 'text' ? h('div', { class: 'gd-text', 'data-no-i18n': true, style: `${bg};-webkit-background-clip:text;background-clip:text;color:transparent` }, it.name || 'Gradient')
      : v === 'button' ? h('div', { class: 'gd-buttons' }, h('span', { class: 'gd-btn', style: bg }, 'Aan de slag'), h('span', { class: 'gd-btn ghost', style: `border-image:${it.css} 1` }, 'Meer info'))
      : v === 'card' ? h('div', { class: 'gd-card' }, h('div', { class: 'gd-card-top', style: bg }), h('strong', {}, 'Kaarttitel'), h('p', {}, 'Zo ziet de gradient eruit als header van een kaart.'))
      : h('div', { class: 'gd-compare' },
          h('figure', {}, h('img', { src: shotUrl, alt: '' }), h('figcaption', {}, 'Screenshot')),
          h('figure', {}, h('div', { style: bg }), h('figcaption', {}, 'CSS'))),
    );
  };
  views.replaceChildren(...VIEWS.map(([v, l]) => h('button', { 'data-v': v, onclick: () => setView(v) }, l)));

  const nameIn = h('input', { class: 'input title-input', value: it.name || '', 'data-no-i18n': true, onchange: async e => { it.name = e.target.value.trim() || it.name; await db.putItem(it); } });
  // Older/manually pasted gradients: read stops and angle from the CSS.
  const fromCss = [...(it.css || '').matchAll(/(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))(?:\s+(\d+(?:\.\d+)?)%)?/gi)].map(m => ({ c: m[1], p: m[2] != null ? Math.round(+m[2]) : null }));
  const stops = (it.stops?.length ? it.stops : fromCss).map(s => (typeof s === 'string' ? { c: s, p: null } : s));
  it.angle ??= +(it.css?.match(/(-?\d+(?:\.\d+)?)deg/)?.[1] ?? 180);
  it.kind ||= /^radial/.test(it.css) ? 'radial' : /^conic/.test(it.css) ? 'conic' : /radial-gradient\(at /.test(it.css) ? 'mesh' : 'linear';
  const KIND = { linear: 'Lineair', radial: 'Radiaal', conic: 'Conic', mesh: 'Mesh' };
  const detailLine = [KIND[it.kind] || it.kind, it.kind === 'linear' || it.kind === 'conic' ? `${it.angle}°` : '', it.kind === 'radial' && it.cx != null ? `${it.cx}% ${it.cy}%` : '', `${stops.length} kleuren`].filter(Boolean).join(' · ');

  const code = (label, value) => h('div', { class: 'gd-code' },
    h('div', { class: 'gd-code-head' }, h('span', {}, label), iconBtn('copy', 'Kopieer', () => copyText(value, 'CSS'))),
    h('pre', { 'data-no-i18n': true }, value));

  const side = h('aside', { class: 'side' },
    h('div', { class: 'side-top' },
      h('span', { class: 'src-badge', html: icon('gradient', 15) + ' Gradient' }),
      h('button', { class: 'icon-btn', 'aria-label': 'Sluiten', html: icon('close'), onclick: () => d.close() })),
    nameIn,
    h('p', { class: 'desc' }, detailLine),
    h('div', { class: 'ss-group' },
      h('div', { class: 'ss-label' }, h('span', {}, 'Kleurstops')),
      h('ul', { class: 'gd-stops' }, ...stops.map(s => h('li', {},
        h('button', { class: 'gd-sw', style: `background:${s.c}`, title: 'Kopieer ' + s.c, onclick: () => copyText(s.c.startsWith('#') ? s.c.toUpperCase() : s.c, 'Kleur') }),
        h('span', { class: 'mono', 'data-no-i18n': true }, s.c.startsWith('#') ? s.c.toUpperCase() : s.c),
        h('span', { class: 'muted' }, s.p != null ? `${s.p}%` : ''))))),
    code('CSS', `background: ${it.css};`),
    code('Tailwind', tailwindGradient(it.css)),
    promptBlock(it),
    it.kind !== 'mesh' && code('Gradient-tekst', `background: ${it.css};\n-webkit-background-clip: text;\nbackground-clip: text;\ncolor: transparent;`),
    h('div', { class: 'side-actions' },
      h('button', { class: 'btn', html: icon('edit', 15) + 'Bewerken', onclick: () => { d.close(); openEditor('gradient', it); } }),
      h('button', { class: 'btn', html: icon('plus', 15) + 'Opslaan als palet', onclick: async () => {
        await db.putItem({ type: 'palette', name: it.name || 'Gradient', colors: stops.map(s => s.c), project: it.project || '' });
        toast('Palet opgeslagen');
      } }),
      h('button', { class: 'btn ghost danger', html: icon('trash', 15) + 'Verwijder', onclick: async () => { if (await remove(it)) d.close(); } })),
    h('p', { class: 'muted small' }, 'Opgeslagen op ' + new Date(it.createdAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' })),
  );

  d.replaceChildren(h('div', { class: 'detail' }, h('div', { class: 'stage-col' }, views, stage), side));
  d.onclick = e => { if (e.target === d) d.close(); };
  setView('fill');
  d.showModal();
}

function catOptions(selected, list = state.cats) {
  const cats = list.includes(selected) || !selected ? list : [selected, ...list];
  return [...cats.map(c => h('option', { value: c, selected: c === selected }, c)), h('option', { value: '__new' }, '+ Nieuwe categorie…')];
}

// ---------- prompt to recreate ----------
let promptStack = 'react';
chrome.storage.local.get('promptStack').then(r => { if (r.promptStack && STACKS[r.promptStack]) promptStack = r.promptStack; });

const download = (url, name) => { const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); };
async function downloadMedia(it) {
  const base = slug(it.title || it.name || 'moodboard');
  const files = [];
  const add = async (key, suffix) => { const u = await mediaURL(key); if (u) files.push([u, `${base}${suffix}`]); };
  if (it.type === 'nav') { await add(it.closedKey, '-dicht.png'); await add(it.openKey, '-open.png'); await add(it.videoKey, '.webm'); }
  else if (it.mediaKey) await add(it.mediaKey, it.mediaType === 'video' ? '.webm' : '.png');
  else {
    const remote = it.video || it.gif || it.image;
    if (remote) {
      try { const blob = await (await fetch(remote)).blob(); files.push([URL.createObjectURL(blob), base + (remote.match(/\.(mp4|webm|gif|png|jpe?g|webp)(\?|$)/i)?.[0].replace(/\?$/, '') || '.png')]); }
      catch { window.open(remote, '_blank'); }
    }
  }
  if (!files.length) return toast('Geen beeld om te downloaden');
  files.forEach(([u, n], i) => setTimeout(() => download(u, n), i * 300));
}

function promptBlock(it) {
  const pre = h('pre', { class: 'prompt-text', 'data-no-i18n': true });
  const draw = () => { pre.textContent = buildPrompt(it, { stack: promptStack, lang: i18n.lang, catLabel: c => t(c) }); };
  const stackSel = h('select', {
    class: 'input small',
    onchange: e => { promptStack = e.target.value; chrome.storage.local.set({ promptStack }); draw(); },
  }, ...Object.entries(STACKS).map(([k, v]) => h('option', { value: k, selected: k === promptStack }, v[i18n.lang] || v.nl)));
  const wrap = h('section', { class: 'prompt-block' },
    h('div', { class: 'ss-head' },
      h('div', {}, h('h3', {}, 'Prompt om na te maken'), h('small', {}, 'Plak in Claude, v0, Lovable of Cursor')),
      iconBtn('copy', 'Kopieer prompt', () => copyText(pre.textContent, 'Prompt'))),
    h('label', { class: 'prompt-stack' }, h('span', {}, 'Stack'), stackSel),
    pre,
    h('div', { class: 'ss-actions' },
      h('button', { class: 'btn small primary', html: icon('copy', 14) + 'Kopieer prompt', onclick: () => copyText(pre.textContent, 'Prompt') }),
      it.type !== 'gradient' && h('button', { class: 'btn small ghost', html: icon('download', 14) + 'Download beeld', onclick: () => downloadMedia(it) })),
    it.type !== 'gradient' && h('small', { class: 'hint' }, 'Tip: voeg het gedownloade beeld toe aan je prompt als referentie.'));
  wrap.refresh = draw;
  draw();
  return wrap;
}

// ---------- website style (colors + fonts) ----------
const styleTarget = it => it.siteUrl || (it.source === 'web' ? it.url : null);

async function imageBlob(it) {
  if (it.mediaType === 'image') return db.getMedia(it.mediaKey);
  if (it.posterKey) return db.getMedia(it.posterKey);
  if (it.image || it.gif) return (await fetch(it.image || it.gif)).blob();
  return null;
}

async function analyzeItem(it) {
  const target = styleTarget(it);
  if (target) {
    // Like Font Ninja: actually render and measure the site (briefly in a background tab).
    try { return await scanUrlStyle(target); } catch (e) { console.warn('Scan mislukt, val terug op CSS', e); }
    try { return await analyzeSite(target); } catch (e) { console.warn(e); }
  }
  const blob = await imageBlob(it);
  if (!blob) throw new Error('Geen website of afbeelding om te analyseren');
  return { colors: await paletteFromBlob(blob, 8), fonts: [], from: 'image', at: Date.now() };
}

const SOURCE_FONT = { google: 'Google Font', webfont: 'Webfont', local: 'Lokaal geïnstalleerd', system: 'Systeemfont' };
const FROM_LABEL = { page: 'kleuren uit de CSS van de site · fonts gemeten op de pagina', css: 'uit de CSS van de site', image: 'uit de afbeelding' };

function styleBlock(it, onChange) {
  const wrap = h('section', { class: 'site-style' });

  const draw = (state, error) => {
    const st = it.style;
    const head = h('div', { class: 'ss-head' },
      h('div', {}, h('h3', {}, 'Stijl van de website'), st && h('small', {}, FROM_LABEL[st.from] || '')),
      iconBtn('refresh', 'Opnieuw analyseren', () => run(true)));
    if (state === 'loading') return wrap.replaceChildren(head, h('div', { class: 'ss-loading' }, h('span', { class: 'spinner' }), 'Website analyseren…'));
    if (error) return wrap.replaceChildren(head, h('p', { class: 'hint' }, error));
    if (!st) return wrap.replaceChildren(head);

    const colors = st.colors || [];
    const fonts = st.fonts || [];
    fonts.forEach(f => loadFont(f.family));

    const parts = [head,
      colors.length && h('div', { class: 'ss-group' },
        h('div', { class: 'ss-label' }, h('span', {}, 'Kleurenpalet'), h('em', {}, String(colors.length))),
        h('div', { class: 'ss-colors' }, ...colors.map(c => h('button', {
          class: 'ss-sw', style: `background:${c};color:${textOn(c)}`, title: 'Kopieer ' + c.toUpperCase() + (st.colorVars?.[c] ? ` · ${st.colorVars[c].join(', ')}` : ''),
          onclick: () => copyText(c.toUpperCase(), 'Kleur'),
        }, h('span', {}, c.replace('#', '').toUpperCase())))),
        h('div', { class: 'ss-actions' },
          h('button', { class: 'btn small', html: icon('plus', 14) + 'Opslaan als palet', onclick: async () => {
            await db.putItem({ type: 'palette', name: it.title?.slice(0, 40) || 'Palet', colors: colors.slice(), sourceUrl: styleTarget(it) || it.url, project: it.project || '' });
            toast('Palet opgeslagen');
          } }),
          h('button', { class: 'btn small ghost', html: icon('copy', 14) + 'CSS', onclick: () => copyText(paletteCss({ name: it.title, colors }), 'CSS') }))),
      fonts.length ? h('div', { class: 'ss-group' },
        h('div', { class: 'ss-label' }, h('span', {}, 'Lettertypes'), h('em', {}, String(fonts.length))),
        h('ul', { class: 'ss-fonts' }, ...fonts.map(f => h('li', {},
          h('div', { class: 'ss-fname', 'data-no-i18n': true, style: `font-family:${fontStack(f.family)}` }, f.family),
          h('div', { class: 'ss-fmeta', title: f.file || '' }, [SOURCE_FONT[f.source] || (f.google ? 'Google Font' : f.custom ? 'Eigen font' : ''), f.roles?.join(' · '), f.weights?.length ? f.weights.join(' / ') : '', f.sizes?.length ? f.sizes.map(x => x + 'px').join(' ') : ''].filter(Boolean).join(' — ')),
          h('div', { class: 'ss-factions' },
            iconBtn('copy', 'Kopieer CSS', () => copyText(`font-family: ${fontStack(f.family)};`, 'CSS')),
            iconBtn('plus', 'Opslaan bij Typografie', async () => {
              await db.putItem({ type: 'font', heading: f.family, body: null, role: f.roles?.join(', ') || '', weights: f.weights || [], sourceUrl: styleTarget(it) || it.url, project: it.project || '', sample: '' });
              toast('Lettertype opgeslagen');
            }))))),
        fonts.length >= 2 && h('button', { class: 'btn small', html: icon('type', 14) + `Combinatie opslaan`, onclick: async () => {
          const heading = fonts.find(f => f.roles?.includes('Heading')) || fonts[0];
          const body = fonts.find(f => f !== heading && f.roles?.includes('Body')) || fonts.find(f => f !== heading);
          await db.putItem({ type: 'font', heading: heading.family, body: body.family, sourceUrl: styleTarget(it) || it.url, project: it.project || '', sample: '', weights: [] });
          toast(`${heading.family} + ${body.family}`);
        } }))
        : st.from !== 'image' && h('p', { class: 'hint' }, 'Geen lettertypes gevonden.'),
    ];
    wrap.replaceChildren(...parts.filter(Boolean));
  };

  const run = async force => {
    const outdated = it.style?.from === 'css' && styleTarget(it); // old CSS analysis: do a real scan once
    if (it.style && !force && !outdated) return draw();
    draw('loading');
    try {
      it.style = await analyzeItem(it);
      await db.putItem(it);
      draw();
      onChange?.();
    } catch (e) { draw(null, e.message); }
  };
  run(false);
  return wrap;
}

// ---------- editor (add / edit) ----------
function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', {}, label), control, hint && h('small', { class: 'hint' }, hint));
}

function openEditor(type, item = null, prefill = {}) {
  const d = $('#modal');
  let current = type;
  let form;
  const body = h('div', { class: 'editor-body' });
  const project = h('input', { class: 'input', list: 'projectlist', value: item?.project || '', placeholder: 'Optioneel, bv. Nairiva' });

  const tabs = item ? null : h('div', { class: 'seg type-seg' }, ...TYPES.map(t => h('button', {
    'data-t': t.id, html: icon(t.icon, 15) + t.label,
    onclick: () => { current = t.id; build(); },
  })));

  const build = () => {
    tabs?.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === current));
    form = FORMS[current](item ? structuredClone(item) : null, current === type ? prefill : {});
    body.replaceChildren(form.el);
    body.querySelector('input:not([type=color]), textarea')?.focus();
  };

  const saveBtn = h('button', {
    class: 'btn primary',
    onclick: async () => {
      saveBtn.disabled = true;
      try {
        const data = await form.getData();
        await db.putItem({ ...(item || {}), ...data, type: current, project: project.value.trim() });
        d.close();
        toast(item ? 'Bijgewerkt' : 'Opgeslagen');
      } catch (e) { toast(e.message); }
      finally { saveBtn.disabled = false; }
    },
  }, item ? 'Bijwerken' : 'Opslaan');

  d.replaceChildren(h('div', { class: 'editor' },
    h('header', {},
      h('h2', {}, item ? 'Bewerken' : 'Toevoegen'),
      h('button', { class: 'icon-btn', 'aria-label': 'Sluiten', html: icon('close'), onclick: () => d.close() })),
    tabs,
    body,
    field('Project / klant', project),
    h('footer', {},
      item && h('button', { class: 'btn ghost danger', onclick: async () => { if (await remove(item)) d.close(); } }, 'Verwijderen'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn ghost', onclick: () => d.close() }, 'Annuleren'),
      saveBtn),
  ));
  d.onclick = e => { if (e.target === d) d.close(); };
  d.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveBtn.click(); };
  build();
  d.showModal();
}

function categoryPicker(onPick, selected = null, list = null) {
  const wrap = h('div', { class: 'chips' });
  const draw = () => wrap.replaceChildren(
    ...(list || state.cats).map(c => h('button', { class: 'chip' + (c === selected ? ' on' : ''), onclick: () => { selected = c; onPick(c); draw(); } }, c)),
    h('button', {
      class: 'chip add',
      onclick: async () => {
        const name = prompt(t('Naam van de nieuwe categorie'));
        const c = list ? name?.trim() : await addCategory(name);
        if (!c) return;
        if (list) { if (!list.includes(c)) list.push(c); } else state.cats = await getCategories();
        selected = c; onPick(c); draw();
      },
    }, '+ Nieuw'),
  );
  draw();
  return wrap;
}

const FORMS = {
  inspo(_item, prefill) {
    let preview = null, file = prefill.file || null, category = null, seq = 0;
    const url = h('input', { class: 'input', placeholder: 'https://pinterest.com/pin/…  of  https://www.awwwards.com/sites/…', value: prefill.url || '' });
    const fileIn = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true, onchange: () => { file = fileIn.files[0] || null; show(); } });
    const pv = h('div', { class: 'e-preview' });

    const show = (loading = false) => {
      pv.replaceChildren();
      pv.classList.toggle('loading', loading);
      if (loading) return pv.append(h('div', { class: 'ph' }, h('span', { class: 'spinner' }), 'Preview ophalen…'));
      if (file) {
        const u = URL.createObjectURL(file);
        if (file.type.startsWith('video')) { const v = h('video', { src: u, autoplay: true, loop: true, playsInline: true }); v.muted = true; pv.append(v); }
        else pv.append(h('img', { src: u, alt: '' }));
        return;
      }
      if (!preview) return pv.append(h('div', { class: 'ph' }, 'Plak een link, of sleep / upload een afbeelding of video'));
      if (preview.video) { const v = h('video', { src: preview.video, autoplay: true, loop: true, playsInline: true }); v.muted = true; pv.append(v); }
      else if (preview.gif || preview.image) pv.append(h('img', { src: preview.gif || preview.image, alt: '' }));
      else if (preview.siteUrl) { const box = h('div', { class: 'media ratio' }); pv.append(box); mountLive(box, preview.siteUrl); }
      else pv.append(h('div', { class: 'ph' }, 'Geen afbeelding gevonden'));
      pv.append(h('div', { class: 'cap' }, h('strong', {}, preview.title || domain(preview.url)), h('span', {}, SOURCE_LABEL[preview.source] || '',
        (preview.video || preview.gif) ? ' · beweegt' : '', preview.error ? ' · kon pagina niet lezen' : '')));
    };

    const load = async () => {
      const v = url.value.trim();
      const my = ++seq;
      if (!v) { preview = null; show(); return; }
      show(true);
      let p;
      try { p = await fetchPreview(v); }
      catch { const u = normalizeUrl(v); p = { url: u, title: domain(u), source: detectSource(u), siteUrl: detectSource(u) === 'web' ? u : null, error: true }; }
      if (my !== seq) return;
      preview = p;
      show();
    };
    url.addEventListener('input', debounce(load, 450));
    if (prefill.url) load(); else show();

    return {
      el: h('div', { class: 'form' },
        field('Link', url),
        h('button', { class: 'btn ghost small upload-btn', html: icon('upload', 15) + 'Of upload een afbeelding / video', onclick: () => fileIn.click() }),
        fileIn, pv,
        field('Categorie', categoryPicker(c => { category = c; })),
      ),
      async getData() {
        const v = url.value.trim();
        if (!file && !v) throw new Error('Voeg een link of bestand toe');
        if (!category) throw new Error('Kies eerst een categorie');
        if (v && !preview) preview = await fetchPreview(v).catch(() => null);
        const p = preview || {};
        const u = v ? normalizeUrl(v) : null;
        const data = {
          url: p.url || u, title: p.title || file?.name?.replace(/\.\w+$/, '') || domain(u) || '', description: p.description || '',
          source: file && !v ? 'upload' : (p.source || detectSource(u)), image: p.image || null, gif: p.gif || null, video: p.video || null,
          siteUrl: p.siteUrl || null, sourceLink: p.sourceLink || null, category,
        };
        if (file) { data.mediaKey = await db.putMedia(file); data.mediaType = file.type.startsWith('video') ? 'video' : 'image'; }
        return data;
      },
    };
  },

  section(item, prefill) {
    let file = prefill.file || null, category = item?.category || null;
    const url = h('input', { class: 'input', value: item?.url || '', placeholder: 'https://… (website van de sectie)' });
    const title = h('input', { class: 'input', value: item?.title || '', placeholder: 'bv. Linear — pricing' });
    const pv = h('div', { class: 'e-preview' }, h('div', { class: 'ph' }, 'Upload of sleep een screenshot van de sectie'));
    const fileIn = h('input', {
      type: 'file', accept: 'image/*', hidden: true,
      onchange: () => { file = fileIn.files[0] || null; if (file) pv.replaceChildren(h('img', { src: URL.createObjectURL(file), alt: '' })); },
    });
    if (file) pv.replaceChildren(h('img', { src: URL.createObjectURL(file), alt: '' }));
    if (item?.mediaKey) mediaURL(item.mediaKey).then(u => u && pv.replaceChildren(h('img', { src: u, alt: '' })));
    return {
      el: h('div', { class: 'form' },
        h('p', { class: 'hint' }, 'Tip: met de popup (tab Sectie) of Alt+Shift+X selecteer je een sectie direct op de website.'),
        pv,
        h('button', { class: 'btn ghost small upload-btn', html: icon('upload', 15) + 'Screenshot uploaden', onclick: () => fileIn.click() }), fileIn,
        field('Soort sectie', categoryPicker(c => { category = c; }, category, SECTION_TYPES.slice())),
        h('div', { class: 'row2' }, field('Naam', title), field('Website', url))),
      async getData() {
        if (!file && !item?.mediaKey) throw new Error('Upload een screenshot van de sectie');
        if (!category) throw new Error('Kies het soort sectie');
        const u = url.value.trim() ? normalizeUrl(url.value) : null;
        const data = { url: u, title: title.value.trim() || domain(u) || 'Sectie', category, source: u ? detectSource(u) : 'upload' };
        if (file) { data.mediaKey = await db.putMedia(file); data.mediaType = 'image'; }
        return data;
      },
    };
  },

  nav(item) {
    const files = { closed: null, open: null, video: null };
    let category = item?.category || null;
    const title = h('input', { class: 'input', value: item?.title || '', placeholder: 'bv. Navigatie — linear.app' });
    const url = h('input', { class: 'input', value: item?.url || '', placeholder: 'https://…' });
    const slot = (key, label, accept) => {
      const pv = h('div', { class: 'nav-slot' }, h('span', { html: icon(key === 'video' ? 'record' : 'image', 18) }), h('small', {}, label));
      const input = h('input', { type: 'file', accept, hidden: true, onchange: () => {
        const f = input.files[0]; if (!f) return;
        files[key] = f;
        const u = URL.createObjectURL(f);
        pv.replaceChildren(f.type.startsWith('video') ? h('video', { src: u, muted: true, autoplay: true, loop: true }) : h('img', { src: u, alt: '' }), h('small', {}, label));
      } });
      pv.onclick = () => input.click();
      pv.ondragover = e => e.preventDefault();
      pv.ondrop = e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) { const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; input.onchange(); } };
      return h('div', {}, pv, input);
    };
    return {
      el: h('div', { class: 'form' },
        h('p', { class: 'hint' }, 'Tip: met de popup (tab Sectie → Navigatie vastleggen) of Alt+Shift+N leg je dicht, open en een video direct op de website vast.'),
        h('div', { class: 'nav-slots' }, slot('closed', 'Dicht', 'image/*'), slot('open', 'Open', 'image/*'), slot('video', 'Video (optioneel)', 'video/*')),
        field('Soort navigatie', categoryPicker(c => { category = c; }, category, NAV_TYPES.slice())),
        h('div', { class: 'row2' }, field('Naam', title), field('Website', url))),
      async getData() {
        if (!item && (!files.closed || !files.open)) throw new Error('Voeg een screenshot van dicht én open toe');
        if (!category) throw new Error('Kies het soort navigatie');
        const u = url.value.trim() ? normalizeUrl(url.value) : null;
        const data = { title: title.value.trim() || (u ? 'Navigatie — ' + domain(u) : 'Navigatie'), url: u, source: u ? detectSource(u) : 'upload', category };
        if (files.closed) data.closedKey = await db.putMedia(files.closed);
        if (files.open) data.openKey = await db.putMedia(files.open);
        if (files.video) data.videoKey = await db.putMedia(files.video);
        return data;
      },
    };
  },

  palette(item, prefill) {
    const colors = item?.colors?.slice() || prefill.colors?.slice() || ['#050505', '#3dffb0', '#f5f5f2'];
    const name = h('input', { class: 'input', value: item?.name || prefill.name || '', placeholder: 'bv. Warm editorial' });
    const list = h('div', { class: 'swatch-edit' });
    const strip = h('div', { class: 'strip' });
    const matrix = h('div', { class: 'contrast-wrap' });
    const imgIn = h('input', {
      type: 'file', accept: 'image/*', hidden: true,
      onchange: async () => { if (!imgIn.files[0]) return; colors.push(...(await paletteFromBlob(imgIn.files[0], 6)).filter(c => !colors.includes(c))); draw(); },
    });

    const drawPreview = () => {
      strip.replaceChildren(...colors.map(c => h('span', { style: `background:${c}` })));
      matrix.replaceChildren(contrastMatrix(colors));
    };
    const draw = () => {
      list.replaceChildren(...colors.map((c, i) => {
        const text = h('input', { class: 'input mono', value: c, 'aria-label': 'Hex', onchange: e => { const v = normHex(e.target.value); if (v) { colors[i] = v; draw(); } else e.target.value = colors[i]; } });
        return h('div', { class: 'srow' },
          h('input', { type: 'color', value: c, 'aria-label': 'Kleur', oninput: e => { colors[i] = e.target.value; text.value = e.target.value; drawPreview(); } }),
          text,
          iconBtn('close', 'Verwijder kleur', () => { colors.splice(i, 1); draw(); }));
      }));
      drawPreview();
    };
    draw();

    const pipette = 'EyeDropper' in window && h('button', {
      class: 'btn small', html: icon('pipette', 15) + 'Pipet',
      onclick: async () => { try { const r = await new EyeDropper().open(); colors.push(r.sRGBHex.toLowerCase()); draw(); } catch {} },
    });

    return {
      el: h('div', { class: 'form' },
        field('Naam', name), strip,
        h('div', { class: 'row tools' },
          h('button', { class: 'btn small', html: icon('plus', 15) + 'Kleur', onclick: () => { colors.push('#888888'); draw(); } }),
          pipette,
          h('button', { class: 'btn small', html: icon('image', 15) + 'Uit afbeelding', onclick: () => imgIn.click() }), imgIn),
        list,
        h('details', { class: 'more', open: colors.length <= 6 }, h('summary', {}, 'Contrast (WCAG)'), matrix),
      ),
      getData() {
        if (!colors.length) throw new Error('Voeg minimaal één kleur toe');
        return { name: name.value.trim() || 'Palet', colors: colors.slice() };
      },
    };
  },

  font(item) {
    const heading = h('input', { class: 'input', list: 'fontlist', value: item?.heading || '', placeholder: 'bv. Fraunces' });
    const body = h('input', { class: 'input', list: 'fontlist', value: item?.body || '', placeholder: 'bv. Inter (optioneel)' });
    const sample = h('input', { class: 'input', value: item?.sample || '', placeholder: 'Voorbeeldtekst, bv. Ontwerp met intentie' });
    const pv = h('div', { class: 'font-preview' });
    const draw = () => {
      loadFont(heading.value); loadFont(body.value);
      pv.replaceChildren(
        h('div', { class: 'fp-h', style: `font-family:${fontStack(heading.value)}` }, sample.value || heading.value || 'Aa Bb Cc'),
        h('p', { style: `font-family:${fontStack(body.value || heading.value)}` }, 'Goede typografie maakt inhoud leesbaar, toegankelijk en aantrekkelijk. Zo klinkt dit lettertype als lopende tekst in een interface. 0123456789'),
      );
    };
    const redraw = debounce(draw, 250);
    [heading, body, sample].forEach(i => i.addEventListener('input', redraw));
    draw();
    return {
      el: h('div', { class: 'form' },
        h('div', { class: 'row2' }, field('Heading-lettertype', heading), field('Body-lettertype', body)),
        field('Voorbeeldtekst', sample), pv,
        h('small', { class: 'hint' }, 'Google Fonts worden automatisch geladen. Lokaal geïnstalleerde lettertypes werken ook.')),
      getData() {
        if (!heading.value.trim()) throw new Error('Vul minimaal één lettertype in');
        return { heading: heading.value.trim(), body: body.value.trim() || null, sample: sample.value.trim(), weights: item?.weights || [] };
      },
    };
  },

  gradient(item, prefill) {
    // stops: [{ c: '#hex', p: position in % or null = evenly spaced }]
    let stops = (item?.stops || ['#3dffb0', '#1ec8ff', '#7b5cff']).map(s => (typeof s === 'string' ? { c: s, p: null } : { ...s }));
    let kind = item?.kind || 'linear', angle = item?.angle ?? 135, custom = !!item?.custom;
    let cx = item?.cx ?? 30, cy = item?.cy ?? 30;
    const name = h('input', { class: 'input', value: item?.name || nextGradientName(), placeholder: 'Gradient #…', 'data-no-i18n': true });
    const css = h('textarea', { class: 'input mono', rows: '3' });
    const pv = h('div', { class: 'grad-preview' });
    const list = h('div', { class: 'stops' });
    const thumb = h('div', { class: 'grad-shot', hidden: true });
    const status = h('small', { class: 'hint grad-status' });

    const MESH_AT = [[18, 22], [82, 16], [78, 82], [16, 86], [50, 50]];
    const stopList = () => stops.map(s => (s.p == null ? s.c : `${s.c} ${s.p}%`)).join(', ');
    const build = () => {
      if (kind === 'mesh') {
        const [base, ...rest] = stops;
        return [...rest.map((s, i) => `radial-gradient(at ${MESH_AT[i % 5][0]}% ${MESH_AT[i % 5][1]}%, ${s.c} 0px, transparent 55%)`), base?.c || '#000'].join(', ');
      }
      if (kind === 'radial') return `radial-gradient(circle at ${cx}% ${cy}%, ${stopList()})`;
      if (kind === 'conic') return `conic-gradient(from ${angle}deg, ${stopList()})`;
      return `linear-gradient(${angle}deg, ${stopList()})`;
    };

    const kindSel = h('select', { class: 'input', onchange: e => { kind = e.target.value; custom = false; draw(); } },
      ...[['linear', 'Lineair'], ['radial', 'Radiaal'], ['conic', 'Conic'], ['mesh', 'Mesh']].map(([k, l]) => h('option', { value: k }, l)));
    const angleIn = h('input', { type: 'range', min: '0', max: '360', oninput: e => { angle = +e.target.value; custom = false; draw(); } });
    const angleField = field('Hoek', angleIn);

    const draw = () => {
      kindSel.value = kind;
      angleIn.value = String(angle);
      angleField.hidden = kind === 'mesh' || kind === 'radial';
      if (!custom) css.value = build();
      pv.style.background = css.value;
      list.replaceChildren(...stops.map((s, i) => h('div', { class: 'stop' },
        h('input', { type: 'color', value: s.c, oninput: e => { s.c = e.target.value; custom = false; draw(); } }),
        s.p != null && kind !== 'mesh' && h('input', {
          class: 'input mono stop-pos', type: 'number', min: '0', max: '100', value: String(s.p), 'aria-label': 'Positie %',
          onchange: e => { s.p = Math.max(0, Math.min(100, +e.target.value || 0)); custom = false; draw(); },
        }),
        stops.length > 2 && iconBtn('close', 'Verwijder', () => { stops.splice(i, 1); stops.forEach(x => { x.p = null; }); custom = false; draw(); }))),
      h('button', { class: 'btn small', html: icon('plus', 14), 'aria-label': 'Kleur toevoegen', onclick: () => { stops.push({ c: '#ffffff', p: null }); stops.forEach(x => { x.p = null; }); custom = false; draw(); } }));
    };
    if (custom) css.value = item.css;
    css.oninput = () => { custom = true; pv.style.background = css.value; };

    // --- extract from a screenshot ---
    const LABEL = { linear: 'lineair', radial: 'radiaal', mesh: 'mesh' };
    let shotFile = null;
    if (item?.sourceKey) mediaURL(item.sourceKey).then(u => { if (u && !shotFile) { thumb.hidden = false; thumb.replaceChildren(h('img', { src: u, alt: '' }), h('span', {}, 'Screenshot')); } });
    const fromImage = async file => {
      if (!file?.type?.startsWith('image')) return;
      shotFile = file;
      thumb.hidden = false;
      thumb.replaceChildren(h('img', { src: URL.createObjectURL(file), alt: '' }), h('span', {}, 'Screenshot'));
      status.textContent = '';
      status.append(h('span', { class: 'spinner' }), ' Gradient herkennen…');
      try {
        const g = await gradientFromImage(file);
        kind = g.kind;
        angle = g.angle ?? angle;
        if (g.cx != null) { cx = g.cx; cy = g.cy; }
        stops = g.stops.map(x => ({ c: x.c, p: x.p }));
        custom = false;
        draw();
        const match = Math.round(g.score * 100);
        status.textContent = `Herkend als ${LABEL[g.kind] || g.kind}${g.kind === 'linear' ? ` ${g.angle}°` : ''} met ${stops.length} kleuren · ${match}% overeenkomst`;
      } catch (e) { status.textContent = e.message; }
    };
    const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: () => fromImage(fileIn.files[0]) });
    const drop = h('div', {
      class: 'grad-drop', tabindex: '0', role: 'button',
      onclick: () => fileIn.click(),
      onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } },
      ondragover: e => { e.preventDefault(); drop.classList.add('over'); },
      ondragleave: () => drop.classList.remove('over'),
      ondrop: e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); fromImage([...e.dataTransfer.files].find(f => f.type.startsWith('image'))); },
    }, h('span', { html: icon('image', 20) }), h('strong', {}, 'Sleep een screenshot van een gradient hierheen'), h('small', {}, 'of klik om te uploaden · plakken (⌘V) kan ook'));

    draw();
    if (prefill.file) fromImage(prefill.file);

    const el = h('div', { class: 'form' },
      drop, fileIn,
      h('div', { class: 'grad-compare' }, thumb, h('div', { class: 'grad-result' }, pv, h('span', {}, 'CSS'))),
      status,
      field('Naam', name),
      h('div', { class: 'row2' }, field('Type', kindSel), angleField),
      field('Kleuren', list),
      field('CSS', css, 'Je kunt de CSS ook zelf aanpassen of plakken.'));
    el.addEventListener('paste', e => {
      const f = [...e.clipboardData.files].find(x => x.type.startsWith('image'));
      if (f) { e.preventDefault(); fromImage(f); }
    });
    return {
      el,
      async getData() {
        if (!css.value.trim()) throw new Error('Geen gradient');
        const sourceKey = shotFile ? await db.putMedia(shotFile) : item?.sourceKey || null;
        return { sourceKey, name: name.value.trim() || item?.name || nextGradientName(), css: css.value.trim().replace(/;$/, ''), stops: stops.map(x => ({ ...x })), kind, angle, cx, cy, custom };
      },
    };
  },

  copy(item, prefill) {
    const text = h('textarea', { class: 'input big-text', rows: '4', value: item?.text || prefill.text || '', placeholder: 'bv. “Oeps, deze pagina is op vakantie.”' });
    const ctx = h('select', { class: 'input' }, ...COPY_CONTEXTS.map(c => h('option', { value: c, selected: c === (item?.context || 'Call-to-action') }, c)));
    const src = h('input', { class: 'input', value: item?.sourceUrl || '', placeholder: 'https://… (optioneel)' });
    return {
      el: h('div', { class: 'form' }, field('Tekst', text), h('div', { class: 'row2' }, field('Context', ctx), field('Bron', src))),
      getData() {
        if (!text.value.trim()) throw new Error('Vul een tekst in');
        return { text: text.value.trim(), context: ctx.value, sourceUrl: src.value.trim() ? normalizeUrl(src.value) : null };
      },
    };
  },

};

function contrastMatrix(colors) {
  const cs = colors.slice(0, 7);
  if (cs.length < 2) return h('p', { class: 'hint' }, 'Voeg minstens twee kleuren toe om contrast te vergelijken.');
  const table = h('div', { class: 'contrast', style: `grid-template-columns: 18px repeat(${cs.length}, 1fr)` }, h('span'));
  cs.forEach(c => table.append(h('span', { class: 'chead', style: `background:${c}` })));
  for (const bg of cs) {
    table.append(h('span', { class: 'chead', style: `background:${bg}` }));
    for (const fg of cs) {
      if (fg === bg) { table.append(h('span', { class: 'cell same' })); continue; }
      const r = contrast(fg, bg);
      const grade = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA groot' : '✕';
      table.append(h('span', { class: 'cell' + (r < 3 ? ' fail' : ''), style: `background:${bg};color:${fg}`, title: `${fg} op ${bg}: ${r.toFixed(2)}:1` },
        h('b', {}, r.toFixed(1)), h('small', {}, grade)));
    }
  }
  return table;
}

// ---------- drag & paste ----------
function setupDrop() {
  let depth = 0;
  const dz = $('#dropzone');
  addEventListener('dragenter', e => {
    if (document.querySelector('dialog[open]') || !e.dataTransfer.types.some(t => t === 'Files' || t === 'text/uri-list')) return;
    depth++; dz.classList.add('on');
  });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; dz.classList.remove('on'); } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => {
    e.preventDefault();
    depth = 0; dz.classList.remove('on');
    if (document.querySelector('dialog[open]')) return;
    const file = [...e.dataTransfer.files].find(f => /^(image|video)\//.test(f.type));
    const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')).split('\n')[0].trim();
    if (file) openEditor(file.type.startsWith('image') && (state.type === 'section' || state.type === 'gradient') ? state.type : 'inspo', null, { file });
    else if (/^https?:\/\//i.test(url)) openEditor('inspo', null, { url });
  });
}

function setupPaste() {
  document.addEventListener('paste', e => {
    if (isTyping(e) || document.querySelector('dialog[open]')) return;
    const file = [...e.clipboardData.files].find(f => /^(image|video)\//.test(f.type));
    const text = e.clipboardData.getData('text').trim();
    if (file) openEditor(file.type.startsWith('image') && (state.type === 'section' || state.type === 'gradient') ? state.type : 'inspo', null, { file });
    else if (/^https?:\/\//i.test(text)) openEditor('inspo', null, { url: text });
    else if (normHex(text)) openEditor('palette', null, { colors: [normHex(text)] });
    else if (text) openEditor('copy', null, { text });
  });
}

// ---------- export / import ----------
async function exportAll() {
  const items = await db.allItems();
  const media = {};
  for (const it of items) {
    for (const key of [it.mediaKey, it.posterKey]) {
      if (key && !media[key]) { const b = await db.getMedia(key); if (b) media[key] = await blobToDataURL(b); }
    }
  }
  const { customCategories } = await getSettings();
  const blob = new Blob([JSON.stringify({ app: 'moodboard', version: 1, exportedAt: new Date().toISOString(), customCategories, items, media })], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `moodboard-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`${items.length} items geëxporteerd`);
}

async function importAll(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'moodboard' || !Array.isArray(data.items)) throw new Error('Dit is geen Moodboard-export');
    for (const [key, url] of Object.entries(data.media || {})) await db.putMedia(await (await fetch(url)).blob(), key);
    for (const it of data.items) await db.putItem(it);
    for (const c of data.customCategories || []) await addCategory(c);
    toast(`${data.items.length} items geïmporteerd`);
  } catch (err) { toast('Import mislukt: ' + err.message); }
}
