type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => ViewTransition };
type Point = { x: number; y: number };
type Idle = { timeRemaining: () => number };
type IdleWin = Window & { requestIdleCallback?: (cb: (d: Idle) => void, o?: { timeout: number }) => number };

const SPREAD_MS = 950;
const INK_MS = SPREAD_MS + 160;
const CIRCLE_MS = 700;
const FRAMES = 56;
const BUDGET = 120_000;
const SIMPLIFY_EPS = 0.5;
const Q = 4;
const TENDRILS = 14;
const DROPLETS = 46;
const MARBLE = 0.09;
const FIBRE = 0.09;
const WASH = 0.05;
const WASH_ALPHA = 0.28;
const WASH_BLUR = 6;

interface InkCtx { o: Point; vw: number; vh: number; dmax: number; ux: number; uy: number }
interface Buf { next: Int32Array; ex: Float32Array; ey: Float32Array; seen: Uint8Array }
interface InkFrames { key: string; vw: number; vh: number; solid: string[]; wash: string[] }

let cache: InkFrames | null = null;
let job: { key: string; it: Generator<void, InkFrames, void> } | null = null;
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

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
const qf = (v: number) => Math.round(v * Q);

function areaAt(tau: number): number {
  if (tau <= 0) return 0;
  if (tau < 0.12) return 0.018 * smooth(tau / 0.12);
  const u = (tau - 0.12) / 0.88;
  return Math.min(1, 0.018 + 0.982 * (1 - Math.pow(1 - u, 1.7)));
}

function inkRow(c: InkCtx, w: number, h: number, j: number, drift: number, out: Float32Array, wash: Float32Array, w2: number) {
  const { o, vw, vh, dmax, ux, uy } = c;
  const dx = drift * 0.9, dy = -drift * 0.6, dl = drift * 0.25;
  const y = ((j + 0.5) / h) * vh;
  for (let i = 0; i < w; i++) {
    const x = ((i + 0.5) / w) * vw;
    const q0 = fbm(x / 560 + 3.1 + dl, y / 560 + 7.9, 2, 21);
    const q1 = fbm(x / 560 + 11.3, y / 560 + 2.2 + dl, 2, 22);
    const d = Math.hypot(x + 170 * q0 - o.x, y + 170 * q1 - o.y) / dmax;
    const rx = x - o.x, ry = y - o.y, rho = Math.hypot(rx, ry);
    const s = clamp01((rho - 20) / 140);
    const wx = fbm(x / 260 + 1.7 + dx, y / 260 + 9.2, 2, 41);
    const wy = fbm(x / 260 + 4.4, y / 260 + 3.3 + dy, 2, 42);
    const m = fbm((x + 130 * wx) / 170 + 5.5 + dx, (y + 130 * wy) / 170 + 1.3 + dy, 3, 23);
    const fib = fbm(Math.atan2(ux * ry - uy * rx, ux * rx + uy * ry) * 80 + wx * 4, rho / 110 + dl, 2, 51) * clamp01((rho - 120) / 380);
    const v = d + s * (MARBLE * m + FIBRE * fib);
    out[j * w + i] = v;
    if ((j | i) & 1) continue;
    const wn = fbm(x / 300 + 8.8 + dx * 0.5, y / 300 + 2.4 + dy * 0.5, 2, 61);
    wash[(j >> 1) * w2 + (i >> 1)] = v - s * WASH * Math.max(0, wn - 0.1);
  }
}

const MID_X = [0.5, 1, 0.5, 0];
const MID_Y = [0, 0.5, 1, 0.5];
const CORNER_X = [0, 1, 1, 0];
const CORNER_Y = [0, 0, 1, 1];

const buffers = (cells: number): Buf => ({ next: new Int32Array(2 * cells), ex: new Float32Array(2 * cells), ey: new Float32Array(2 * cells), seen: new Uint8Array(2 * cells) });

function contour(G: Float32Array, W2: number, H2: number, t: number, cw: number, ch: number, off: number, eps: number, buf: Buf): string {
  const HV = W2 * H2;
  const { next, ex, ey, seen } = buf;
  next.fill(-1);
  seen.fill(0);
  const put = (e: number) => {
    if (e < HV) {
      const jj = (e / W2) | 0, ii = e - jj * W2, va = G[e];
      ex[e] = (ii - off + (t - va) / (G[e + 1] - va)) * cw;
      ey[e] = (jj - off) * ch;
    } else {
      const e2 = e - HV, jj = (e2 / W2) | 0, ii = e2 - jj * W2, va = G[e2];
      ex[e] = (ii - off) * cw;
      ey[e] = (jj - off + (t - va) / (G[e2 + W2] - va)) * ch;
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
    out += pathOf(xs, ys, simplify(xs, ys, eps), 0, n - 1, true);
  }
  return out || "M0 0";
}

function pathOf(xs: number[], ys: number[], keep: Uint8Array | null, k0: number, k1: number, close: boolean): string {
  let px = qf(xs[k0]), py = qf(ys[k0]);
  let s = `M${px} ${py}l`;
  let first = true;
  for (let k = k0 + 1; k <= k1; k++) {
    if (keep && !keep[k]) continue;
    const qx = qf(xs[k]), qy = qf(ys[k]);
    const dx = qx - px, dy = qy - py;
    if (!dx && !dy) continue;
    s += (first || dx < 0 ? "" : " ") + dx + (dy < 0 ? "" : " ") + dy;
    first = false;
    px = qx;
    py = qy;
  }
  return first ? "" : close ? s + "z" : s;
}

function simplify(xs: number[], ys: number[], eps: number): Uint8Array {
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
    if (idx > 0 && best > eps) {
      keep[idx] = 1;
      stack.push(a, idx, idx, b);
    }
  }
  return keep;
}

function carve(c: InkCtx, w: number, h: number, a: Float32Array, b: Float32Array) {
  const { o, vw, vh, dmax } = c;
  const cw = vw / w, ch = vh / h;
  const at = (x: number, y: number) => {
    const gx = Math.min(w - 1.001, Math.max(0, x / cw - 0.5)), gy = Math.min(h - 1.001, Math.max(0, y / ch - 0.5));
    const i = gx | 0, j = gy | 0, u = gx - i, v = gy - j, n = j * w + i;
    const f = (F: Float32Array) => F[n] + (F[n + 1] - F[n]) * u + (F[n + w] - F[n]) * v + (F[n] - F[n + 1] - F[n + w] + F[n + w + 1]) * u * v;
    return (f(a) + f(b)) * 0.5;
  };
  const stamp = (x: number, y: number, base: number, r: number, depth: number) => {
    const i0 = Math.max(0, Math.floor((x - 2 * r) / cw)), i1 = Math.min(w - 1, Math.ceil((x + 2 * r) / cw));
    const j0 = Math.max(0, Math.floor((y - 2 * r) / ch)), j1 = Math.min(h - 1, Math.ceil((y + 2 * r) / ch));
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) * ch - y;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * cw - x;
        const q = (dx * dx + dy * dy) / (r * r);
        if (q > 4) continue;
        const v = base + depth * q, n = j * w + i;
        if (v < a[n]) a[n] = v;
        if (v < b[n]) b[n] = v;
      }
    }
  };
  const rnd = random((Math.round(o.x) * 73856093) ^ (Math.round(o.y) * 19349663) ^ (vw * 83492791));
  const toCenter = Math.atan2(vh / 2 - o.y, vw / 2 - o.x);
  let half = 0.3;
  for (const [cx, cy] of [[0, 0], [vw, 0], [0, vh], [vw, vh]]) {
    const d = Math.atan2(cy - o.y, cx - o.x) - toCenter;
    half = Math.max(half, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
  }
  const spawn = (lo: number, hi: number): Point | null => {
    for (let tries = 0; tries < 16; tries++) {
      const ang = toCenter + (rnd() * 2 - 1) * half, r = dmax * (lo + rnd() * (hi - lo));
      const x = o.x + Math.cos(ang) * r, y = o.y + Math.sin(ang) * r;
      if (x > 8 && y > 8 && x < vw - 8 && y < vh - 8) return { x, y };
    }
    return null;
  };

  for (let ti = 0; ti < TENDRILS; ti++) {
    const p0 = spawn(0.06, 0.85);
    if (!p0) continue;
    let { x, y } = p0;
    let dir = Math.atan2(y - o.y, x - o.x) + (rnd() * 2 - 1) * 0.9;
    const bend = (rnd() * 2 - 1) * 0.01;
    const L = 70 + rnd() * 300, r = 2.2 + rnd() * 2.2;
    const lead0 = 0.004 + rnd() * 0.012, leadK = 0.02 + rnd() * 0.05;
    const xs: number[] = [], ys: number[] = [], us: number[] = [];
    let floor = -Infinity;
    for (let s = 0; s <= L; s += 2) {
      floor = Math.max(floor, at(x, y) - lead0 - leadK * (s / L));
      xs.push(x);
      ys.push(y);
      us.push(floor);
      dir += bend * 2 + fbm(x / 170 + ti * 5.1, y / 170 + 2.7, 2, 77) * 0.03;
      x += Math.cos(dir) * 2;
      y += Math.sin(dir) * 2;
      if (x < -10 || y < -10 || x > vw + 10 || y > vh + 10) break;
    }
    for (let k = 0; k < xs.length; k++) stamp(xs[k], ys[k], us[k], r * (1 - (0.6 * k) / xs.length), 0.03);
  }

  for (let di = 0; di < DROPLETS; di++) {
    const p = spawn(0.05, 0.9);
    if (!p) continue;
    const r = 2.4 + Math.pow(rnd(), 2) * 4;
    stamp(p.x, p.y, at(p.x, p.y) - 0.01 - rnd() * 0.05, r, 0.02);
  }
}

function select(arr: Float32Array, n: number, k: number): number {
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const pivot = arr[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (arr[i] < pivot) i++;
      while (arr[j] > pivot) j--;
      if (i <= j) {
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return arr[k];
}

function* buildInk(o: Point, vw: number, vh: number, key: string): Generator<void, InkFrames, void> {
  const tx = vw / 2 - o.x, ty = vh / 2 - o.y, tl = Math.hypot(tx, ty);
  const c: InkCtx = {
    o, vw, vh,
    dmax: Math.max(Math.hypot(o.x, o.y), Math.hypot(vw - o.x, o.y), Math.hypot(o.x, vh - o.y), Math.hypot(vw - o.x, vh - o.y)) || 1,
    ux: tl > 1 ? tx / tl : 0,
    uy: tl > 1 ? ty / tl : 1,
  };
  const w = Math.max(96, Math.round(Math.sqrt((BUDGET * vw) / vh)));
  const h = Math.max(64, Math.round((w * vh) / vw));
  const w2 = (w + 1) >> 1, h2 = (h + 1) >> 1;
  const N = w * h, N2 = w2 * h2;
  const a = new Float32Array(N), b = new Float32Array(N), wa = new Float32Array(N2), wb = new Float32Array(N2);
  for (let j = 0; j < h; j++) {
    inkRow(c, w, h, j, 0, a, wa, w2);
    inkRow(c, w, h, j, 1, b, wb, w2);
    if ((j & 3) === 3) yield;
  }
  carve(c, w, h, a, b);
  yield;
  let mx = -Infinity;
  for (let n = 0; n < N; n++) {
    if (a[n] > mx) mx = a[n];
    if (b[n] > mx) mx = b[n];
    b[n] -= a[n];
  }
  for (let n = 0; n < N2; n++) wb[n] -= wa[n];

  const pad = mx + 0.02;
  const W2 = w + 2, H2 = h + 2, V2 = w2 + 2, U2 = h2 + 2;
  const G = new Float32Array(W2 * H2).fill(pad), GW = new Float32Array(V2 * U2).fill(pad);
  const fine = buffers(W2 * H2), coarse = buffers(V2 * U2);
  const sample = new Float32Array(Math.ceil(N / 7) + 1);
  const cw = vw / w, ch = vh / h;
  const solid: string[] = [], wash: string[] = [];
  for (let k = 0; k < FRAMES; k++) {
    if (k === 0) { solid.push("M0 0"); wash.push("M0 0"); continue; }
    if (k === FRAMES - 1) { solid.push(`M${-60 * Q} ${-60 * Q}H${(vw + 60) * Q}V${(vh + 60) * Q}H${-60 * Q}z`); wash.push("M0 0"); continue; }
    const tau = k / (FRAMES - 1);
    let m = 0, cnt = 0;
    for (let j = 0; j < h; j++) {
      const row = (j + 1) * W2 + 1, src = j * w;
      for (let i = 0; i < w; i++) {
        const v = a[src + i] + b[src + i] * tau;
        G[row + i] = v;
        if (++cnt === 7) {
          cnt = 0;
          sample[m++] = v;
        }
      }
    }
    for (let j = 0; j < h2; j++) {
      const row = (j + 1) * V2 + 1, src = j * w2;
      for (let i = 0; i < w2; i++) GW[row + i] = wa[src + i] + wb[src + i] * tau;
    }
    const qi = Math.min(m - 2, Math.floor(areaAt(tau) * m));
    const lo = select(sample, m, qi);
    let hi = Infinity;
    for (let n = qi + 1; n < m; n++) if (sample[n] < hi) hi = sample[n];
    const t = (lo + hi) * 0.5 + 1e-7;
    solid.push(contour(G, W2, H2, t, cw, ch, 0.5, SIMPLIFY_EPS, fine));
    yield;
    wash.push(contour(GW, V2, U2, t, cw * 2, ch * 2, 0.75, 1.1, coarse));
    yield;
  }
  return { key, vw, vh, solid, wash };
}

const keyOf = (o: Point, vw: number, vh: number) => `${vw}x${vh}@${Math.round(o.x / 6)},${Math.round(o.y / 6)}`;

function inkFrames(o: Point, vw: number, vh: number): InkFrames {
  const key = keyOf(o, vw, vh);
  if (cache?.key === key) return cache;
  const it = job?.key === key ? job.it : buildInk(o, vw, vh, key);
  job = null;
  let r = it.next();
  while (!r.done) r = it.next();
  cache = r.value;
  return cache;
}

function pump() {
  const run = (d: Idle) => {
    const j = job;
    if (!j) return;
    do {
      const r = j.it.next();
      if (r.done) {
        if (job === j) {
          cache = r.value;
          job = null;
        }
        return;
      }
    } while (d.timeRemaining() > 3);
    pump();
  };
  const w = window as IdleWin;
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2000 });
  else window.setTimeout(() => run({ timeRemaining: () => 10 }), 40);
}

function richInk(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) >= 4 && (nav.deviceMemory ?? 8) >= 4;
}

function inkMaskUrl(o: Point): string {
  const f = inkFrames(o, window.innerWidth, window.innerHeight);
  const times = f.solid.map((_, k) => (k / f.solid.length).toFixed(4)).join(";");
  const animD = (frames: string[]) => `<animate attributeName="d" dur="${SPREAD_MS}ms" fill="freeze" calcMode="discrete" keyTimes="${times}" values="${frames.join(";")}"/>`;
  const rich = richInk();
  const filter = rich
    ? `<filter id="ink" x="-60" y="-60" width="${f.vw + 120}" height="${f.vh + 120}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="9" result="n"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      `<feGaussianBlur in="d" stdDeviation="1"/>` +
      `</filter>`
    : "";
  const washFilter = `<filter id="wash" x="${-60 * Q}" y="${-60 * Q}" width="${(f.vw + 120) * Q}" height="${(f.vh + 120) * Q}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${WASH_BLUR * Q}"/></filter>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f.vw}" height="${f.vh}" viewBox="0 0 ${f.vw} ${f.vh}" preserveAspectRatio="none">` +
    filter +
    washFilter +
    `<g${rich ? ' filter="url(#ink)"' : ""}><g transform="scale(${1 / Q})">` +
    `<path fill="#000" fill-opacity="${WASH_ALPHA}" filter="url(#wash)" d="M0 0">${animD(f.wash)}</path>` +
    `<path fill="#000" d="M0 0">${animD(f.solid)}</path>` +
    `</g></g></svg>`;
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
  const vw = window.innerWidth, vh = window.innerHeight, key = keyOf(origin, vw, vh);
  if (cache?.key === key || job?.key === key) return;
  job = { key, it: buildInk(origin, vw, vh, key) };
  pump();
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
