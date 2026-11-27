type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => ViewTransition };
type Point = { x: number; y: number };

const INK_MS = 900;
const SPREAD_MS = 760;
const CIRCLE_MS = 700;
const FRAMES = 44;
const BUDGET = 90_000;
const FIBER_PERIOD = 240;
const SIMPLIFY_EPS = 0.45;

interface InkFrames { key: string; vw: number; vh: number; frames: string[] }

let cache: InkFrames | null = null;
let active = 0;

function hash(ix: number, iy: number, s: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffff) / 32767.5 - 1;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), u = fade(x - xi), v = fade(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function noisePeriodic(x: number, y: number, s: number, period: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), u = fade(x - xi), v = fade(y - yi);
  const x0 = ((xi % period) + period) % period, x1 = (x0 + 1) % period;
  const a = hash(x0, yi, s), b = hash(x1, yi, s), c = hash(x0, yi + 1, s), d = hash(x1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, octaves: number, s: number): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f, s + i * 31);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

function fbmPeriodic(x: number, y: number, octaves: number, s: number, period: number): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noisePeriodic(x * f, y * f, s + i * 31, period * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);

function areaAt(tau: number): number {
  if (tau <= 0) return 0;
  if (tau < 0.13) return 0.02 * smooth(tau / 0.13);
  const u = (tau - 0.13) / 0.87;
  return Math.min(1, 0.02 + 0.98 * (1 - Math.pow(1 - u, 1.6)));
}

function inkField(o: Point, vw: number, vh: number, w: number, h: number, drift: number): Float32Array {
  const field = new Float32Array(w * h);
  const dmax = Math.max(Math.hypot(o.x, o.y), Math.hypot(vw - o.x, o.y), Math.hypot(o.x, vh - o.y), Math.hypot(vw - o.x, vh - o.y)) || 1;
  const dx = drift * 0.9, dy = -drift * 0.6, dl = drift * 0.25;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = ((i + 0.5) / w) * vw, y = ((j + 0.5) / h) * vh;
      const q0 = fbm(x / 650 + 3.1 + dl, y / 650 + 7.9, 3, 21);
      const q1 = fbm(x / 650 + 11.3, y / 650 + 2.2 + dl, 3, 22);
      const d = Math.hypot(x + 150 * q0 - o.x, y + 150 * q1 - o.y) / dmax;
      const m = fbm(x * 0.012 + 5.5 + dx, y * 0.012 + 1.3 + dy, 3, 23);
      const tx = x + 110 * fbm(x * 0.002 + 2.2 + dx, y * 0.002 + 4.4 + dy, 2, 24);
      const ty = y + 110 * fbm(x * 0.002 + 7.7 + dx, y * 0.002 + 1.1 + dy, 2, 25);
      const na = 1 - Math.abs(fbm(tx * 0.0026 + 1.9, ty * 0.0026 + 8.1, 3, 26));
      const rx = x - o.x, ry = y - o.y, rad = Math.hypot(rx, ry);
      const ang = (Math.atan2(-rx, ry) / (2 * Math.PI) + 0.5) * FIBER_PERIOD;
      const fib = Math.pow(1 - Math.abs(fbmPeriodic(ang + drift * 0.4, rad / 55, 2, 29, FIBER_PERIOD)), 6);
      const patch = clamp01((fbm(x / 420 + 4.4 + dx * 0.5, y / 420 + 8.8, 2, 31) + 0.3) * 3);
      const mf = fbm(x / 30 + 2.7 + dx, y / 30 + 6.6 + dy, 2, 32);
      const s = clamp01((rad - 18) / 70);
      field[j * w + i] = d + s * (0.018 * m + 0.008 * mf - 0.1 * Math.pow(na, 9) * patch) - 0.012 * fib * clamp01(rad / 40);
    }
  }
  return field;
}

const MID_X = [0.5, 1, 0.5, 0];
const MID_Y = [0, 0.5, 1, 0.5];
const CORNER_X = [0, 1, 1, 0];
const CORNER_Y = [0, 0, 1, 1];

function contour(G: Float32Array, W2: number, H2: number, t: number, cw: number, ch: number, next: Int32Array, ex: Float32Array, ey: Float32Array, seen: Uint8Array): string {
  const HV = W2 * H2;
  next.fill(-1);
  seen.fill(0);
  const put = (e: number) => {
    if (e < HV) {
      const jj = (e / W2) | 0, ii = e - jj * W2, va = G[e];
      ex[e] = (ii - 0.5 + (t - va) / (G[e + 1] - va)) * cw;
      ey[e] = (jj - 0.5) * ch;
    } else {
      const e2 = e - HV, jj = (e2 / W2) | 0, ii = e2 - jj * W2, va = G[e2];
      ex[e] = (ii - 0.5) * cw;
      ey[e] = (jj - 0.5 + (t - va) / (G[e2 + W2] - va)) * ch;
    }
  };
  const link = (a: number, b: number, sa: number, sb: number, corner: number, inside: boolean) => {
    put(a);
    put(b);
    const cross = (MID_X[sb] - MID_X[sa]) * (CORNER_Y[corner] - MID_Y[sa]) - (MID_Y[sb] - MID_Y[sa]) * (CORNER_X[corner] - MID_X[sa]);
    if ((cross < 0) === inside) next[a] = b;
    else next[b] = a;
  };
  for (let jj = 0; jj < H2 - 1; jj++) {
    for (let ii = 0; ii < W2 - 1; ii++) {
      const o0 = jj * W2 + ii;
      const g0 = G[o0], g1 = G[o0 + 1], g2 = G[o0 + W2 + 1], g3 = G[o0 + W2];
      const c = (g0 < t ? 1 : 0) | (g1 < t ? 2 : 0) | (g2 < t ? 4 : 0) | (g3 < t ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const eT = o0, eB = o0 + W2, eL = HV + o0, eR = HV + o0 + 1;
      switch (c) {
        case 1: link(eL, eT, 3, 0, 0, true); break;
        case 2: link(eT, eR, 0, 1, 1, true); break;
        case 3: link(eL, eR, 3, 1, 0, true); break;
        case 4: link(eR, eB, 1, 2, 2, true); break;
        case 6: link(eT, eB, 0, 2, 1, true); break;
        case 7: link(eL, eB, 3, 2, 3, false); break;
        case 8: link(eB, eL, 2, 3, 3, true); break;
        case 9: link(eT, eB, 0, 2, 0, true); break;
        case 11: link(eR, eB, 1, 2, 2, false); break;
        case 12: link(eL, eR, 3, 1, 3, true); break;
        case 13: link(eT, eR, 0, 1, 1, false); break;
        case 14: link(eT, eL, 0, 3, 0, false); break;
        default: {
          const center = (g0 + g1 + g2 + g3) * 0.25 < t;
          if ((c === 5) === center) {
            link(eT, eR, 0, 1, 1, c === 10);
            link(eB, eL, 2, 3, 3, c === 10);
          } else {
            link(eL, eT, 3, 0, 0, c === 5);
            link(eR, eB, 1, 2, 2, c === 5);
          }
        }
      }
    }
  }

  let out = "";
  const xs: number[] = [], ys: number[] = [];
  for (let e = 0; e < next.length; e++) {
    if (next[e] < 0 || seen[e]) continue;
    xs.length = 0;
    ys.length = 0;
    let cur = e;
    while (cur >= 0 && !seen[cur]) {
      seen[cur] = 1;
      xs.push(ex[cur]);
      ys.push(ey[cur]);
      cur = next[cur];
    }
    const n = xs.length;
    if (n < 3) continue;
    let area2 = 0;
    for (let k = 0, p = n - 1; k < n; p = k++) area2 += xs[p] * ys[k] - xs[k] * ys[p];
    if (Math.abs(area2) < 14) continue;
    xs.push(xs[0]);
    ys.push(ys[0]);
    const keep = simplify(xs, ys);
    out += `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
    for (let k = 1; k < n; k++) if (keep[k]) out += `L${xs[k].toFixed(1)} ${ys[k].toFixed(1)}`;
    out += "Z";
  }
  return out || "M0 0";
}

function simplify(xs: number[], ys: number[]): Uint8Array {
  const n = xs.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [0, n - 1];
  while (stack.length) {
    const b = stack.pop() as number, a = stack.pop() as number;
    const dx = xs[b] - xs[a], dy = ys[b] - ys[a], len = Math.hypot(dx, dy);
    let best = -1, idx = -1;
    for (let k = a + 1; k < b; k++) {
      const d = len > 1e-6 ? Math.abs((xs[k] - xs[a]) * dy - (ys[k] - ys[a]) * dx) / len : Math.hypot(xs[k] - xs[a], ys[k] - ys[a]);
      if (d > best) { best = d; idx = k; }
    }
    if (idx > 0 && best > SIMPLIFY_EPS) {
      keep[idx] = 1;
      stack.push(a, idx, idx, b);
    }
  }
  return keep;
}

function inkFrames(o: Point, vw: number, vh: number): InkFrames {
  const key = `${vw}x${vh}@${Math.round(o.x / 6)},${Math.round(o.y / 6)}`;
  if (cache?.key === key) return cache;

  const w = Math.max(96, Math.round(Math.sqrt((BUDGET * vw) / vh)));
  const h = Math.max(64, Math.round((w * vh) / vw));
  const a = inkField(o, vw, vh, w, h, 0);
  const b = inkField(o, vw, vh, w, h, 1);
  let mx = -Infinity;
  for (let n = 0; n < a.length; n++) mx = Math.max(mx, a[n], b[n]);

  const W2 = w + 2, H2 = h + 2, HV = W2 * H2;
  const G = new Float32Array(HV);
  const next = new Int32Array(2 * HV), ex = new Float32Array(2 * HV), ey = new Float32Array(2 * HV), seen = new Uint8Array(2 * HV);
  const sample = new Float32Array(Math.ceil((w * h) / 3));
  const cw = vw / w, ch = vh / h, pad = mx + 0.02;
  const frames: string[] = [];
  for (let k = 0; k < FRAMES; k++) {
    if (k === 0) { frames.push("M0 0"); continue; }
    if (k === FRAMES - 1) { frames.push(`M-4 -4H${vw + 4}V${vh + 4}H-4Z`); continue; }
    const tau = k / (FRAMES - 1);
    G.fill(pad);
    let m = 0;
    for (let j = 0; j < h; j++) {
      const row = (j + 1) * W2 + 1, src = j * w;
      for (let i = 0; i < w; i++) {
        const v = a[src + i] + (b[src + i] - a[src + i]) * tau;
        G[row + i] = v;
        if ((src + i) % 3 === 0) sample[m++] = v;
      }
    }
    const sub = sample.subarray(0, m).sort();
    const qi = Math.min(m - 2, Math.floor(areaAt(tau) * m));
    const thr = (sub[qi] + sub[qi + 1]) * 0.5 + 1e-7;
    frames.push(contour(G, W2, H2, thr, cw, ch, next, ex, ey, seen));
  }
  cache = { key, vw, vh, frames };
  return cache;
}

function inkMaskUrl(o: Point): string {
  const f = inkFrames(o, window.innerWidth, window.innerHeight);
  const times = f.frames.map((_, k) => (k / f.frames.length).toFixed(4)).join(";");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f.vw}" height="${f.vh}" viewBox="0 0 ${f.vw} ${f.vh}" preserveAspectRatio="none">` +
    `<path fill="#000" shape-rendering="geometricPrecision" d="${f.frames[0]}">` +
    `<animate attributeName="d" dur="${SPREAD_MS}ms" fill="freeze" calcMode="discrete" keyTimes="${times}" values="${f.frames.join(";")}"/>` +
    `</path></svg>`;
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

function originPoint(origin?: Point): Point {
  if (origin) return origin;
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) {
    const r = el.getBoundingClientRect();
    if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: 0 };
}

function canAnimate(): boolean {
  const doc = document as ViewTransitionDoc;
  return Boolean(doc.startViewTransition) && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function prepareThemeInk(origin: Point) {
  if (!canAnimate()) return;
  try { inkFrames(origin, window.innerWidth, window.innerHeight); } catch {}
}

export function switchTheme(next: boolean, origin?: Point, onApply?: () => void) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.toggle("dark", next);
    try { localStorage.setItem("gl-theme", next ? "dark" : "light"); } catch {}
    onApply?.();
  };

  const doc = document as ViewTransitionDoc;
  if (!doc.startViewTransition || !canAnimate() || root.classList.contains("dark") === next) {
    apply();
    return;
  }

  const o = originPoint(origin);
  let mask: string | null = null;
  try { mask = inkMaskUrl(o); } catch { mask = null; }

  const id = ++active;
  root.classList.add("gl-theme-vt");
  if (mask) {
    root.style.setProperty("--gl-ink-mask", `url("${mask}")`);
    root.style.setProperty("--gl-ink-ms", `${INK_MS}ms`);
    root.classList.add("gl-ink");
  } else {
    root.classList.remove("gl-ink");
  }

  const t = doc.startViewTransition(apply);
  if (!mask) {
    const radius = Math.hypot(Math.max(o.x, window.innerWidth - o.x), Math.max(o.y, window.innerHeight - o.y));
    t.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${o.x}px ${o.y}px)`, `circle(${radius}px at ${o.x}px ${o.y}px)`] },
          { duration: CIRCLE_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  }
  t.finished
    .catch(() => {})
    .finally(() => {
      if (mask) URL.revokeObjectURL(mask);
      if (id !== active) return;
      root.classList.remove("gl-theme-vt", "gl-ink");
      root.style.removeProperty("--gl-ink-mask");
      root.style.removeProperty("--gl-ink-ms");
    });
}
