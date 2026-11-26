type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => ViewTransition };
type Point = { x: number; y: number };

const INK_MS = 1700;
const CIRCLE_MS = 700;
const SLOPE = 600;
const BUDGET = 110_000;
const AREA = [0, 0.03, 0.12, 0.27, 0.43, 0.57, 0.68, 0.77, 0.85, 0.91, 0.955, 0.985, 1];

interface InkField { key: string; w: number; h: number; png: string; steps: number[] }

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

function inkField(o: Point, vw: number, vh: number): InkField {
  const key = `${vw}x${vh}@${Math.round(o.x / 6)},${Math.round(o.y / 6)}`;
  if (cache?.key === key) return cache;

  const w = Math.max(96, Math.round(Math.sqrt((BUDGET * vw) / vh)));
  const h = Math.max(64, Math.round((w * vh) / vw));
  const dmax = Math.max(Math.hypot(o.x, o.y), Math.hypot(vw - o.x, o.y), Math.hypot(o.x, vh - o.y), Math.hypot(vw - o.x, vh - o.y)) || 1;
  const t = new Float32Array(w * h);
  let mn = Infinity, mx = -Infinity;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = ((i + 0.5) / w) * vw, y = ((j + 0.5) / h) * vh;
      const q0 = fbm(x * 0.0016 + 3.1, y * 0.0016 + 7.9, 3, 11);
      const q1 = fbm(x * 0.0016 + 11.3, y * 0.0016 + 2.2, 3, 12);
      const r0 = fbm(x * 0.007 + 5.5 * q0 + 1.7, y * 0.007 + 5.5 * q1 + 9.2, 4, 13);
      const r1 = fbm(x * 0.007 + 5.5 * q0 + 8.3, y * 0.007 + 5.5 * q1 + 2.8, 4, 14);
      const wx = x + 210 * q0 + 135 * r0, wy = y + 210 * q1 + 135 * r1;
      const fine = fbm(x * 0.025 + 5.5, y * 0.025 + 1.3, 5, 15);
      const ridge = 1 - Math.abs(fbm(wx * 0.0085 + 2.3, wy * 0.0085 + 6.1, 4, 16));
      const v = Math.hypot(wx - o.x, wy - o.y) / dmax + 0.065 * fine + 0.055 * r0 + 0.17 * ridge * ridge * ridge;
      t[j * w + i] = v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  const img = ctx.createImageData(w, h);
  const span = mx - mn || 1;
  for (let n = 0; n < t.length; n++) {
    const tn = (t[n] - mn) / span;
    t[n] = tn;
    const v = Math.round(tn * 65280);
    img.data[n * 4] = v >> 8;
    img.data[n * 4 + 1] = v & 255;
    img.data[n * 4 + 2] = 0;
    img.data[n * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const sorted = t.slice().sort();
  const edge = 2 / SLOPE;
  const steps = AREA.map((a) => (a <= 0 ? -edge : a >= 1 ? 1 + edge : sorted[Math.min(sorted.length - 1, Math.floor(a * sorted.length))]));
  cache = { key, w, h, png: canvas.toDataURL("image/png"), steps };
  return cache;
}

function inkMaskUrl(o: Point): string {
  const f = inkField(o, window.innerWidth, window.innerHeight);
  const times = f.steps.map((_, i) => (i / (f.steps.length - 1)).toFixed(4)).join(";");
  const values = f.steps.map((s) => (0.5 - SLOPE * (1 - s)).toFixed(3)).join(";");
  const first = (0.5 - SLOPE * (1 - f.steps[0])).toFixed(3);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}" preserveAspectRatio="none">` +
    `<filter id="ink" x="0" y="0" width="${f.w}" height="${f.h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 -0.00390625 0 0 1"/>` +
    `<feComponentTransfer><feFuncA type="linear" slope="${SLOPE}" intercept="${first}">` +
    `<animate attributeName="intercept" dur="${Math.round(INK_MS * 0.94)}ms" fill="freeze" calcMode="linear" keyTimes="${times}" values="${values}"/>` +
    `</feFuncA></feComponentTransfer></filter>` +
    `<image width="${f.w}" height="${f.h}" preserveAspectRatio="none" href="${f.png}" xlink:href="${f.png}" filter="url(#ink)"/></svg>`;
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
  try { inkField(origin, window.innerWidth, window.innerHeight); } catch {}
}

export function switchTheme(next: boolean, origin?: Point) {
  const root = document.documentElement;
  const apply = () => {
    root.classList.toggle("dark", next);
    try { localStorage.setItem("gl-theme", next ? "dark" : "light"); } catch {}
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
