type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => ViewTransition };
type Point = { x: number; y: number };

const INK_MS = 900;
const SPREAD_MS = 760;
const CIRCLE_MS = 700;
const SLOPE = 600;
const WASH_MAX = 0.6;
const WASH_RANGE = 0.1;
const WASH_BLUR = 8;
const BUDGET = 120_000;
const KEY_T = [0, 0.05, 0.14, 0.19, 0.27, 0.32, 0.37, 0.46, 0.55, 0.64, 0.73, 0.82, 0.91, 1];
const KEY_A = [0, 0.006, 0.018, 0.2, 0.27, 0.34, 0.41, 0.54, 0.66, 0.75, 0.83, 0.89, 0.96, 1];

interface InkField { key: string; vw: number; vh: number; cell: number; start: string; end: string; steps: number[] }

let cache: InkField | null = null;
let active = 0;

function hash(ix: number, iy: number, s: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffff) / 32767.5 - 1;
}

function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
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

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function inkLayers(o: Point, vw: number, vh: number, w: number, h: number, drift: number) {
  const hard = new Float32Array(w * h);
  const wash = new Float32Array(w * h);
  const dmax = Math.max(Math.hypot(o.x, o.y), Math.hypot(vw - o.x, o.y), Math.hypot(o.x, vh - o.y), Math.hypot(vw - o.x, vh - o.y)) || 1;
  const dx = drift * 0.9, dy = -drift * 0.6, dl = drift * 0.25;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = ((i + 0.5) / w) * vw, y = ((j + 0.5) / h) * vh;
      const q0 = fbm(x / 650 + 3.1 + dl, y / 650 + 7.9, 3, 21);
      const q1 = fbm(x / 650 + 11.3, y / 650 + 2.2 + dl, 3, 22);
      const d = Math.hypot(x + 150 * q0 - o.x, y + 150 * q1 - o.y) / dmax;
      const m = fbm(x * 0.016 + 5.5 + dx, y * 0.016 + 1.3 + dy, 3, 23);
      const tx = x + 110 * fbm(x * 0.002 + 2.2 + dx, y * 0.002 + 4.4 + dy, 2, 24);
      const ty = y + 110 * fbm(x * 0.002 + 7.7 + dx, y * 0.002 + 1.1 + dy, 2, 25);
      const na = 1 - Math.abs(fbm(tx * 0.0028 + 1.9, ty * 0.0028 + 8.1, 3, 26));
      const nb = 1 - Math.abs(fbm(tx * 0.0028 + 6.3, ty * 0.0028 + 3.7, 3, 27));
      const rad = Math.hypot(x - o.x, y - o.y);
      const smoke = 0.5 + 0.5 * fbm(x / 160 + 9.1 + dx, y / 160 + 4.2 + dy, 4, 30);
      const s = clamp01((rad - 24) / 80);
      const patch = clamp01((fbm(x / 420 + 4.4 + dx * 0.5, y / 420 + 8.8, 2, 31) + 0.35) * 3);
      const mf = fbm(x / 34 + 2.7 + dx, y / 34 + 6.6 + dy, 2, 32);
      const tA = Math.pow(na, 7) * patch, tB = Math.pow(nb, 8) * (1 - patch);
      const v = d + s * (0.03 * m + 0.01 * mf - 0.14 * tA + 0.05 * tB) + (1 - s) * 0.02 * mf;
      const sm = Math.max(0, smoke - 0.55) / 0.45;
      const streak = 0.5 + 0.5 * fbm(x / 40 + 1.1 + dx, (y / 40) * 0.4 + 7.3 + dy, 2, 33);
      const n = j * w + i;
      hard[n] = v;
      wash[n] = v - s * (0.04 * sm + 0.5 * 0.11 * Math.pow(na, 4) * patch) * (0.35 + 0.65 * streak);
    }
  }
  return { hard, wash };
}

function encode(hard: Float32Array, wash: Float32Array, w: number, h: number, mn: number, span: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  const img = ctx.createImageData(w, h);
  for (let n = 0; n < hard.length; n++) {
    img.data[n * 4] = Math.round(clamp01((hard[n] - mn) / span) * 255);
    img.data[n * 4 + 1] = 0;
    img.data[n * 4 + 2] = Math.round(clamp01((hard[n] - wash[n]) / span / WASH_RANGE) * 255);
    img.data[n * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function inkField(o: Point, vw: number, vh: number): InkField {
  const key = `${vw}x${vh}@${Math.round(o.x / 6)},${Math.round(o.y / 6)}`;
  if (cache?.key === key) return cache;

  const w = Math.max(96, Math.round(Math.sqrt((BUDGET * vw) / vh)));
  const h = Math.max(64, Math.round((w * vh) / vw));
  const a = inkLayers(o, vw, vh, w, h, 0);
  const b = inkLayers(o, vw, vh, w, h, 1);

  let mn = Infinity, mx = -Infinity;
  for (let n = 0; n < a.hard.length; n++) {
    const lo = Math.min(a.hard[n], b.hard[n]), hi = Math.max(a.hard[n], b.hard[n]);
    if (lo < mn) mn = lo;
    if (hi > mx) mx = hi;
  }
  const span = mx - mn || 1;

  const edge = 2 / SLOPE;
  const sample = new Float32Array(Math.ceil(a.hard.length / 3));
  const steps = KEY_T.map((tau, k) => {
    const area = KEY_A[k];
    if (area <= 0) return -edge;
    if (area >= 1) return 1 + edge;
    for (let n = 0, m = 0; n < a.hard.length; n += 3, m++) sample[m] = ((1 - tau) * a.hard[n] + tau * b.hard[n] - mn) / span;
    sample.sort();
    return sample[Math.min(sample.length - 1, Math.floor(area * sample.length))];
  });

  cache = { key, vw, vh, cell: vw / w, start: encode(a.hard, a.wash, w, h, mn, span), end: encode(b.hard, b.wash, w, h, mn, span), steps };
  return cache;
}

let maskSeq = 0;

function inkMaskUrl(o: Point): string {
  const f = inkField(o, window.innerWidth, window.innerHeight);
  const times = KEY_T.map((t) => t.toFixed(3)).join(";");
  const hardVals = f.steps.map((s) => (0.5 - SLOPE * (1 - s)).toFixed(3));
  const anim = (vals: string[]) => `<animate attributeName="intercept" dur="${SPREAD_MS}ms" fill="freeze" calcMode="linear" keyTimes="${times}" values="${vals.join(";")}"/>`;
  const img = (href: string, extra: string) => `<image width="${f.vw}" height="${f.vh}" preserveAspectRatio="none" image-rendering="optimizeQuality" href="${href}" xlink:href="${href}"${extra}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f.vw}" height="${f.vh}" viewBox="0 0 ${f.vw} ${f.vh}" preserveAspectRatio="none">` +
    `<filter id="ink" x="0" y="0" width="${f.vw}" height="${f.vh}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${(f.cell * 0.45).toFixed(2)}" edgeMode="duplicate" result="src"/>` +
    `<feColorMatrix in="src" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 0 0 0 1" result="h0"/>` +
    `<feComponentTransfer in="h0" result="h1"><feFuncA type="linear" slope="${SLOPE}" intercept="${hardVals[0]}">${anim(hardVals)}</feFuncA></feComponentTransfer>` +
    `<feGaussianBlur in="h1" stdDeviation="0.7" result="h"/>` +
    `<feColorMatrix in="src" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 0 ${WASH_RANGE} 0 1" result="w0"/>` +
    `<feComponentTransfer in="w0" result="w1"><feFuncA type="linear" slope="${SLOPE}" intercept="${hardVals[0]}">${anim(hardVals)}</feFuncA></feComponentTransfer>` +
    `<feGaussianBlur in="w1" stdDeviation="${WASH_BLUR}" result="w2"/>` +
    `<feComponentTransfer in="w2" result="w"><feFuncA type="linear" slope="${WASH_MAX}" intercept="0"/></feComponentTransfer>` +
    `<feComposite in="h" in2="w" operator="arithmetic" k1="-1" k2="1" k3="1" k4="0"/>` +
    `</filter><g filter="url(#ink)">` +
    img(f.start, "/>") +
    img(f.end, ` opacity="0"><animate attributeName="opacity" from="0" to="1" dur="${SPREAD_MS}ms" fill="freeze"/></image>`) +
    `</g><!--${++maskSeq}--></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
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
  try { inkField(origin, window.innerWidth, window.innerHeight); } catch {}
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
      if (id !== active) return;
      root.classList.remove("gl-theme-vt", "gl-ink");
      root.style.removeProperty("--gl-ink-mask");
      root.style.removeProperty("--gl-ink-ms");
    });
}
