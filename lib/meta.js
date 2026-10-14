// Fetches a preview (title, image, video, gif) from a link. Works without DOMParser,
// so it can also be used in the service worker (context menu).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decode = s => (s || '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
}).trim();

function parseMeta(html) {
  const out = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    tag.replace(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, k, a, b) => { attrs[k.toLowerCase()] = a ?? b; });
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content != null && !(key in out)) out[key] = decode(attrs.content);
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  out._title = title ? decode(title[1]) : '';
  return out;
}

export function normalizeUrl(raw) {
  let s = (raw || '').trim();
  if (!s) return '';
  if (!/^[a-z][\w+.-]*:/i.test(s)) s = 'https://' + s;
  return s;
}

export function detectSource(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { return 'web'; }
  if (/(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/.test(host)) return 'pinterest';
  if (/(^|\.)awwwards\.com$/.test(host)) return 'awwwards';
  if (/(^|\.)dribbble\.com$/.test(host)) return 'dribbble';
  if (/(^|\.)behance\.net$/.test(host)) return 'behance';
  return 'web';
}

export function sameUrl(a, b) {
  try {
    const x = new URL(normalizeUrl(a)), y = new URL(normalizeUrl(b));
    const clean = u => (u.origin + u.pathname).replace(/\/$/, '') + u.search;
    return clean(x) === clean(y);
  } catch { return false; }
}

export function faviconUrl(pageUrl, size = 32) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', String(size));
  return u.href;
}

const first = (text, re) => (text.match(re) || [null])[0];

/**
 * @param {string} rawUrl
 * @param {string} [html] already available HTML (e.g. from the open tab); then nothing is fetched
 */
export async function fetchPreview(rawUrl, html) {
  const url = normalizeUrl(rawUrl);
  let finalUrl = url;

  if (html == null) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, credentials: 'include' });
      finalUrl = res.url || url;
      const type = res.headers.get('content-type') || '';
      const base = { url, finalUrl, source: detectSource(finalUrl), title: decodeURIComponent(finalUrl.split('/').pop() || ''), description: '' };
      if (type.startsWith('image/')) return { ...base, image: type.includes('gif') ? null : finalUrl, gif: type.includes('gif') ? finalUrl : null };
      if (type.startsWith('video/')) return { ...base, video: finalUrl };
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  // JSON in pages often escapes slashes; make them readable for the regexes below.
  const flat = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const m = parseMeta(html);
  const abs = u => { try { return u ? new URL(u, finalUrl).href : null; } catch { return null; } };
  const source = detectSource(finalUrl);

  const out = {
    url,
    finalUrl,
    source,
    title: m['og:title'] || m['twitter:title'] || m._title || new URL(finalUrl).hostname,
    description: m['og:description'] || m.description || '',
    image: abs(m['og:image:secure_url'] || m['og:image'] || m['og:image:url'] || m['twitter:image'] || m['twitter:image:src']),
    video: null,
    gif: null,
    siteUrl: source === 'web' ? finalUrl : null,
  };

  const ogVideo = abs(m['og:video:secure_url'] || m['og:video:url'] || m['og:video']);
  if (ogVideo && /\.(mp4|webm|mov)(\?|$)/i.test(ogVideo)) out.video = ogVideo;
  if (out.image && /\.gif(\?|$)/i.test(out.image)) { out.gif = out.image; }

  if (source === 'pinterest') {
    out.video ||= first(flat, /https:\/\/v\d*\.pinimg\.com\/videos\/[^"'\s<>\\]+?\.mp4/i);
    // Find the gif version of exactly this pin (same hash as the og:image).
    const hash = out.image?.match(/pinimg\.com\/[^/]+\/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]+)/i)?.[1];
    if (hash) {
      out.gif ||= first(flat, new RegExp(`https://i\\.pinimg\\.com/originals/${hash}\\.gif`, 'i'));
      const original = first(flat, new RegExp(`https://i\\.pinimg\\.com/originals/${hash}\\.(?:jpe?g|png|webp)`, 'i'));
      if (original) out.image = original;
    }
    if (/^(pin on|pinterest)/i.test(out.title) && out.description) out.title = out.description.slice(0, 90);
    // A pin's source link is usually a blog/web shop, not the design itself: only keep it as a link.
    const pinSource = m['pinterestapp:source'] || m['og:see_also'];
    if (pinSource && /^https?:/.test(pinSource) && !/pinterest\./.test(pinSource)) out.sourceLink = pinSource;
  }

  if (source === 'awwwards') {
    // Awwwards shows 'elements' (short videos of the site); pick one from the same submission.
    const videos = [...new Set(flat.match(/https:\/\/assets\.awwwards\.com\/[^"'\s<>\\]+?\.mp4/gi) || [])].filter(v => !/blank\.mp4/i.test(v));
    const period = out.image?.match(/\/(\d{4}\/\d{2})\//)?.[1];
    out.video ||= videos.find(v => period && v.includes(`/${period}/`)) || videos[0] || null;
    const isSitePage = /\/sites\//.test(new URL(finalUrl).pathname);
    const visit = flat.match(/href="(https?:\/\/(?![^"]*awwwards\.com)[^"]+)"[^>]*>(?:\s|<[^>]+>)*Visit/i)?.[1]
      || flat.match(/data-url="(https?:\/\/(?![^"]*awwwards\.com)[^"]+)"/i)?.[1];
    if (visit && isSitePage) out.siteUrl = decode(visit);
    out.title = out.title.replace(/\s*[-|]\s*Awwwards.*$/i, '');
  }

  if (source === 'dribbble') {
    out.video ||= first(flat, /https:\/\/cdn\.dribbble\.com\/[^"'\s<>\\]+?\.mp4/i);
    const gif = first(flat, /https:\/\/cdn\.dribbble\.com\/[^"'\s<>\\]+?\.gif/i);
    if (gif) out.gif = gif;
  }

  return out;
}
