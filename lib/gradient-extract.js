// Recognizes a CSS gradient from a screenshot.
// Idea: a linear gradient only changes along one direction and is constant perpendicular to it.
// We try every angle (and for radial a number of center points), group the pixels along that
// direction and pick the variant where the color varies least within each group.
// If neither fits well (e.g. a "mesh"/blob gradient), we build layered radial gradients.
import { rgbToHex } from './ui.js';

const BINS = 24;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function load(blob) {
  return createImageBitmap(blob).then(bmp => {
    const W = 72, H = Math.max(8, Math.round(72 * bmp.height / bmp.width));
    const ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const px = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] < 200) continue;
      px.push({ x: x + 0.5, y: y + 0.5, c: [d[i], d[i + 1], d[i + 2]] });
    }
    return { W, H, px };
  });
}

// Group pixels by t (0..1) and return the error (sum of squared deviation) + average color per group.
function fit(px, tOf) {
  const sum = Array.from({ length: BINS }, () => [0, 0, 0, 0]);
  const ts = px.map(p => Math.min(BINS - 1, Math.max(0, Math.floor(tOf(p) * BINS))));
  px.forEach((p, i) => { const s = sum[ts[i]]; s[0] += p.c[0]; s[1] += p.c[1]; s[2] += p.c[2]; s[3]++; });
  const means = sum.map(s => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : null));
  let sse = 0;
  px.forEach((p, i) => { const m = means[ts[i]]; sse += (p.c[0] - m[0]) ** 2 + (p.c[1] - m[1]) ** 2 + (p.c[2] - m[2]) ** 2; });
  return { sse, means };
}

// CSS angle: 0deg = up, 90deg = right. t follows the CSS gradient line exactly.
function linearT(W, H, deg) {
  const a = deg * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
  const len = Math.abs(W * dx) + Math.abs(H * dy);
  return p => ((p.x - W / 2) * dx + (p.y - H / 2) * dy) / len + 0.5;
}
// radial-gradient(circle at cx cy) with default size farthest-corner
function radialT(W, H, cx, cy) {
  const R = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return p => Math.hypot(p.x - cx, p.y - cy) / R;
}

// From 24 averages to a few color stops: keep only points where a straight transition deviates too much.
function toStops(means) {
  const pts = means.map((c, i) => c && { p: (i + 0.5) / BINS, c }).filter(Boolean);
  if (!pts.length) return [];
  pts[0] = { ...pts[0], p: 0 };
  pts[pts.length - 1] = { ...pts[pts.length - 1], p: 1 };
  const keep = new Set([0, pts.length - 1]);
  const split = (i, j, tol) => {
    let worst = -1, k = -1;
    for (let m = i + 1; m < j; m++) {
      const e = dist(pts[m].c, lerp(pts[i].c, pts[j].c, (pts[m].p - pts[i].p) / (pts[j].p - pts[i].p)));
      if (e > worst) { worst = e; k = m; }
    }
    if (k > 0 && worst > tol) { keep.add(k); split(i, k, tol); split(k, j, tol); }
  };
  for (const tol of [14, 22, 32, 48]) { keep.clear(); keep.add(0).add(pts.length - 1); split(0, pts.length - 1, tol); if (keep.size <= 6) break; }
  return [...keep].sort((a, b) => a - b).map(i => ({ c: rgbToHex(...pts[i].c), p: Math.round(pts[i].p * 100) }));
}

function kmeans(px, k) {
  const cs = [px[Math.floor(px.length / 2)].c];
  while (cs.length < k) cs.push(px.reduce((best, p) => (Math.min(...cs.map(c => dist(c, p.c))) > Math.min(...cs.map(c => dist(c, best.c))) ? p : best)).c);
  let groups;
  for (let it = 0; it < 8; it++) {
    groups = cs.map(() => ({ n: 0, c: [0, 0, 0], x: 0, y: 0 }));
    for (const p of px) {
      let bi = 0, bd = Infinity;
      cs.forEach((c, i) => { const dd = dist(c, p.c); if (dd < bd) { bd = dd; bi = i; } });
      const g = groups[bi]; g.n++; g.x += p.x; g.y += p.y; p.c.forEach((v, i) => { g.c[i] += v; });
    }
    groups.forEach((g, i) => { if (g.n) cs[i] = g.c.map(v => v / g.n); });
  }
  return groups.filter(g => g.n).map(g => ({ n: g.n, c: g.c.map(v => v / g.n), x: g.x / g.n, y: g.y / g.n }));
}

export async function gradientFromImage(blob) {
  const { W, H, px } = await load(blob);
  if (px.length < 16) throw new Error('Afbeelding te klein of transparant');

  const mean = [0, 1, 2].map(i => px.reduce((s, p) => s + p.c[i], 0) / px.length);
  const total = px.reduce((s, p) => s + dist(p.c, mean) ** 2, 0) || 1;

  // solid color
  if (total / px.length < 20) {
    const c = rgbToHex(...mean);
    return { kind: 'linear', angle: 180, stops: [{ c, p: 0 }, { c, p: 100 }], score: 1 };
  }

  // linear: coarse search, then refine
  let lin = { sse: Infinity };
  const tryAngle = a => { const r = fit(px, linearT(W, H, a)); if (r.sse < lin.sse) lin = { ...r, angle: ((a % 360) + 360) % 360 }; };
  for (let a = 0; a < 360; a += 10) tryAngle(a);
  for (let a = lin.angle - 9; a <= lin.angle + 9; a += 1) tryAngle(a);

  // radial: grid of center points
  let rad = { sse: Infinity };
  for (const fx of [0, 0.25, 0.5, 0.75, 1]) for (const fy of [0, 0.25, 0.5, 0.75, 1]) {
    const r = fit(px, radialT(W, H, fx * W, fy * H));
    if (r.sse < rad.sse) rad = { ...r, cx: Math.round(fx * 100), cy: Math.round(fy * 100) };
  }

  const best = rad.sse < lin.sse * 0.8 ? 'radial' : 'linear';
  const residual = Math.min(lin.sse, rad.sse) / total;

  if (residual > 0.3) {
    // mesh: per color group a soft radial gradient where that color sits
    const groups = kmeans(px, 5).sort((a, b) => b.n - a.n);
    const [base, ...rest] = groups;
    const layers = rest.map(g => `radial-gradient(at ${Math.round(g.x / W * 100)}% ${Math.round(g.y / H * 100)}%, ${rgbToHex(...g.c)} 0px, transparent 55%)`);
    return {
      kind: 'mesh', angle: 0, score: 1 - residual,
      stops: groups.map(g => ({ c: rgbToHex(...g.c), p: null })),
      css: [...layers, rgbToHex(...base.c)].join(', '),
    };
  }

  if (best === 'radial') return { kind: 'radial', cx: rad.cx, cy: rad.cy, angle: 0, stops: toStops(rad.means), score: 1 - residual };
  return { kind: 'linear', angle: lin.angle, stops: toStops(lin.means), score: 1 - residual };
}
