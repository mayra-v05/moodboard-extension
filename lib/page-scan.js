import { cssColors, siteCssTexts } from './site-analyze.js';

// Functions that run inside a web page via chrome.scripting.executeScript.
// They must be self-contained (no references to variables outside the function).

// Collects all CSS the page uses, for a color palette of the whole website:
// readable stylesheets (incl. styles added by JavaScript), URLs of external sheets
// that the extension fetches itself, inline style attributes, and a few internal links to include
// the CSS of other pages as well.
export function pageCssSources() {
  const inline = [];
  const sheetUrls = [];
  for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets || [])]) {
    try { inline.push([...sheet.cssRules].map(r => r.cssText).join('\n')); }
    catch { if (sheet.href) sheetUrls.push(sheet.href); }
  }
  inline.push([...document.querySelectorAll('[style]')].slice(0, 1500).map(e => `x{${e.getAttribute('style')}}`).join('\n'));
  const self = location.href.split('#')[0];
  const links = [...new Set([...document.querySelectorAll('nav a[href], header a[href], footer a[href], main a[href]')]
    .map(a => a.href.split('#')[0])
    .filter(u => u.startsWith(location.origin) && u !== self && !/\.(pdf|jpe?g|png|gif|zip|svg|webp|mp4)(\?|$)/i.test(u)))].slice(0, 3);
  return { inline, sheetUrls, links };
}

// Fonts of the page, the way Font Ninja does it: not the first name in the CSS list,
// but the font the browser actually renders. Sources:
//  1. per text element the font-family stack, and per name a canvas measurement of whether that font is available
//  2. document.fonts: all web fonts the page actually loaded
//  3. the downloaded font files (performance resources), to resolve hidden/hashed names
// There is always at least one font: if needed the system font the body is shown in.
export async function pageFonts() {
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch {}

  const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|emoji|math|fangsong|inherit|initial|unset)$/i;
  const SYSTEM_NAME = { '-apple-system': 'San Francisco (systeem)', blinkmacsystemfont: 'San Francisco (systeem)', 'system-ui': 'Systeemfont', 'ui-sans-serif': 'Systeemfont', 'sans-serif': 'Sans-serif (standaard)', serif: 'Serif (standaard)', monospace: 'Monospace (standaard)', 'ui-monospace': 'Monospace (systeem)' };
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Next.js/Nuxt/Framer create names like "__Inter_a1b2c3", "Inter Fallback", "'Neue Montreal Placeholder'"
  const clean = name => {
    let n = name.replace(/["']/g, '').trim()
      .replace(/^__+/, '').replace(/_[a-f0-9]{5,10}$/i, '').replace(/[\s_-]*(fallback|placeholder)\b.*$/i, '')
      .replace(/_/g, ' ').replace(/\s+(variable|vf)$/i, '').replace(/\s+/g, ' ').trim();
    if (!/\s/.test(n)) n = n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); // GeistSans -> Geist Sans, PPNeue -> PP Neue
    return n;
  };
  const IGNORE = /icon|awesome|material symbols|swiper|slick|lil-gui|dashicons|glyph|revicons|eicons/i;
  const fromFile = url => {
    const file = decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || '').replace(/\.(woff2?|ttf|otf|eot)$/i, '');
    return file.replace(/[-_.]?[a-f0-9]{8,}$/i, '')
      .replace(/[-_ ](thin|hairline|extralight|ultralight|light|regular|book|normal|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|variable|vf|var|web|webfont|subset|latin|ext|roman|\d{3})+.*$/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim();
  };

  // 1. canvas test: is this font actually used (loaded web font or installed locally)?
  const ctx = document.createElement('canvas').getContext('2d');
  const SAMPLE = 'mmmmmmmmmlli1WQ@#&gjy';
  const base = {};
  for (const g of ['monospace', 'serif', 'sans-serif']) { ctx.font = `72px ${g}`; base[g] = ctx.measureText(SAMPLE).width; }
  const availCache = new Map();
  const available = fam => {
    if (availCache.has(fam)) return availCache.get(fam);
    let ok = false;
    for (const g in base) { ctx.font = `72px "${fam}", ${g}`; if (ctx.measureText(SAMPLE).width !== base[g]) { ok = true; break; } }
    availCache.set(fam, ok);
    return ok;
  };
  const rendered = stack => {
    for (const raw of stack.split(',')) {
      const f = raw.trim().replace(/["']/g, '');
      if (!f) continue;
      if (GENERIC.test(f)) return { family: SYSTEM_NAME[f.toLowerCase()] || f, raw: f, system: true };
      if (available(f)) return { family: f, raw: f };
    }
    return null;
  };

  // 2. loaded web fonts
  const webfonts = new Map(); // norm(clean) -> { family, weights:Set, styles:Set }
  try {
    for (const face of document.fonts) {
      if (face.status !== 'loaded') continue;
      const fam = clean(face.family);
      if (!fam || IGNORE.test(fam)) continue;
      const e = webfonts.get(norm(fam)) || { family: fam, weights: new Set(), styles: new Set() };
      e.weights.add(String(face.weight)); e.styles.add(face.style);
      webfonts.set(norm(fam), e);
    }
  } catch {}

  // 3. font files the page downloaded
  const files = [...new Set(performance.getEntriesByType('resource').map(r => r.name).filter(u => /\.(woff2?|ttf|otf)(\?|#|$)/i.test(u)))];
  // Map a file name to a font; with only one web font, files like Medium.woff2 belong to it too.
  const fileFor = fam => files.find(u => { const f = norm(fromFile(u)); const n = norm(fam); return f && n && (f.includes(n) || n.includes(f)); })
    || (webfonts.size === 1 && webfonts.has(norm(fam)) ? files.find(u => !/gstatic/.test(u)) : null);

  // Walk elements with text; weight = amount of text × font size
  const roleOf = el => /^H[1-3]$/.test(el.tagName) || parseFloat(getComputedStyle(el).fontSize) >= 30 ? 'Heading'
    : /^(BUTTON|A|LABEL|INPUT|SELECT|NAV|SMALL)$/.test(el.tagName) || el.closest('nav,button') ? 'UI' : 'Body';
  const map = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n = 0;
  for (let node = walker.nextNode(); node && n < 4000; node = walker.nextNode()) {
    const text = node.nodeValue.trim();
    const el = node.parentElement;
    if (!text || !el || /^(SCRIPT|STYLE|NOSCRIPT|SVG)$/.test(el.tagName)) continue;
    n++;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || !el.getClientRects().length) continue;
    const r = rendered(cs.fontFamily);
    if (!r) continue;
    const family = r.system ? r.family : clean(r.family);
    if (IGNORE.test(family)) continue;
    const key = norm(family);
    const e = map.get(key) || { family, roles: [], weights: [], sizes: [], score: 0, system: !!r.system, sample: '' };
    const role = roleOf(el);
    if (!e.roles.includes(role)) e.roles.push(role);
    if (!e.weights.includes(cs.fontWeight)) e.weights.push(cs.fontWeight);
    const size = Math.round(parseFloat(cs.fontSize));
    if (!e.sizes.includes(size)) e.sizes.push(size);
    e.score += Math.min(text.length, 200) * (size / 16) * (role === 'Heading' ? 2 : 1);
    if (!e.sample && text.length > 3) e.sample = text.slice(0, 60);
    map.set(key, e);
  }

  // Also include loaded web fonts we haven't seen on text (yet)
  for (const [key, w] of webfonts) {
    if (!map.has(key)) map.set(key, { family: w.family, roles: [], weights: [...w.weights], sizes: [], score: 1, system: false, sample: '' });
  }
  // Nothing usable found? Use names from the font files.
  if (![...map.values()].some(e => !e.system)) {
    for (const u of files) { const fam = fromFile(u); if (fam && !map.has(norm(fam))) map.set(norm(fam), { family: fam, roles: [], weights: [], sizes: [], score: 0.5, system: false, sample: '' }); }
  }
  // Always at least one result: the body font
  if (!map.size) {
    const r = rendered(getComputedStyle(document.body).fontFamily) || { family: 'Systeemfont', system: true };
    map.set('body', { family: r.system ? r.family : clean(r.family), roles: ['Body'], weights: [getComputedStyle(document.body).fontWeight], sizes: [], score: 1, system: !!r.system, sample: '' });
  }

  const googleUrls = [...document.querySelectorAll('link[href*="fonts.googleapis.com"]')].map(l => l.href)
    .concat([...document.querySelectorAll('style')].flatMap(st => st.textContent.match(/fonts\.googleapis\.com\/css2?\?[^"')\s]*/g) || []));
  const google = googleUrls.flatMap(u => [...u.matchAll(/family=([^&:;]+)/g)].map(m => norm(decodeURIComponent(m[1].replace(/\+/g, ' ')))));
  const gstatic = files.some(u => /fonts\.gstatic\.com/.test(u));

  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .map(e => {
      const key = norm(e.family);
      const file = e.system ? null : fileFor(e.family);
      const isGoogle = google.includes(key) || (gstatic && file && /fonts\.gstatic\.com/.test(file));
      return {
        family: e.family, roles: e.roles, sample: e.sample,
        weights: [...new Set(e.weights)].sort((a, b) => a - b),
        sizes: e.sizes.sort((a, b) => b - a).slice(0, 4),
        google: isGoogle,
        source: e.system ? 'system' : isGoogle ? 'google' : webfonts.has(key) || file ? 'webfont' : 'local',
        file: file && !/fonts\.gstatic\.com/.test(file) ? file : null,
      };
    });
}

// Colors (from the CSS of the whole site) + fonts (as actually rendered) as one 'style' object.
export async function tabCssColors(tabId, max = 12) {
  const [{ result: sources }] = await chrome.scripting.executeScript({ target: { tabId }, func: pageCssSources });
  return cssColors(await siteCssTexts(sources), { max });
}

export async function scanTabStyle(tabId) {
  try {
    const [ranked, [f]] = await Promise.all([
      tabCssColors(tabId),
      chrome.scripting.executeScript({ target: { tabId }, func: pageFonts }),
    ]);
    return {
      colors: ranked.map(r => r.hex),
      colorVars: Object.fromEntries(ranked.filter(r => r.vars.length).map(r => [r.hex, r.vars])),
      fonts: (f.result || []).slice(0, 6),
      from: 'page', at: Date.now(),
    };
  } catch (e) { console.warn('Stijl lezen mislukt', e); return null; }
}

// Briefly opens the site in a background tab to measure colors and fonts as actually rendered.
export async function scanUrlStyle(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await new Promise(resolve => {
      const done = () => { chrome.tabs.onUpdated.removeListener(listener); resolve(); };
      const listener = (id, info) => { if (id === tab.id && info.status === 'complete') done(); };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(done, 15000);
    });
    await new Promise(r => setTimeout(r, 1200));
    const style = await scanTabStyle(tab.id);
    if (!style) throw new Error('Kon de website niet scannen');
    return style;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}
