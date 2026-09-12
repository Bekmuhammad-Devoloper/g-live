// Bo'lakli, parallel, uzilsa davom etadigan yuklash — BRAUZER tomoni.
//
// Nega: telefonda bitta uzun so'rov (5 GB gacha) tarmoq bir soniya uzilsa
// yoki ilova fonga tushsa butunlay uziladi, foiz "qotib" qoladi va hammasi
// boshidan. Bu yerda:
//   · fayl bo'laklarga bo'linadi (mobil tarmoqda 2–4 MB, kompyuterda 4–16 MB),
//     bir vaqtda PARALLEL (3 ta) ketadi — sekin tarmoqda bitta oqim kanalni
//     to'ldira olmaydi, uchtasi to'ldiradi;
//   · har bo'lak alohida so'rov: uzilsa yoki siljimasa to'xtatilib QAYTA
//     yuboriladi (kutish 1→30 s, tasodifiy qo'shimcha bilan), boshqalari davom
//     etadi; taslim bo'lish urinish soniga emas, VAQTGA bog'liq — 10 daqiqa
//     davomida bir bayt ham ketmasa;
//   · fayl barmoq izi (bosh+oxir 256 KB sha256) bo'yicha davom etadi: sahifa
//     yangilansa, ilova qayta ochilsa, iPhone'da video qayta tanlanganda
//     (nomi/lastModified'i o'zgarsa ham) server o'sha seansni topib beradi;
//   · ekran qulflanmasin deb wake lock so'raladi; sahifa fonga tushib qaytsa
//     taymerlar qayta quriladi, fondagi uzilishlar urinish sanalmaydi;
//   · internet yo'q bo'lsa qayta urinish "online" bo'lguncha kutadi.
//
// Server tomoni: /api/upload/session (lib/uploadSessions.ts).

import { chunkSizeFor } from "./upload";

export type UploadProgress = {
  /** 0..100, orqaga qaytmaydi (faqat seans boshidan boshlansa) */
  pct: number;
  loaded: number;
  total: number;
  /** silliqlangan tezlik, bayt/s (0 — hali noma'lum) */
  bytesPerSec: number;
  /** taxminiy qolgan soniya (null — noma'lum) */
  etaSec: number | null;
  /** ~5 s dan beri bir bayt ham ketmadi yoki hamma oqim kutmoqda */
  retrying: boolean;
};

export type UploadResult = { url: string; name: string; size: number };

export type UploadErrorCode = "unauthorized" | "too_large" | "aborted" | "network" | "server";

export class UploadError extends Error {
  constructor(public code: UploadErrorCode, message?: string) {
    super(message ?? code);
    this.name = "UploadError";
  }
}

type Session = { id: string; chunkSize: number; chunks: number; received: number[]; completed?: UploadResult };

const PARALLEL = 3;
const STALL_MS = 45_000;            // yuborish paytida shuncha vaqt siljimasa — bo'lak qayta
const RESPONSE_MIN_MS = 90_000;     // tana ketib bo'lgach javobni kutish (kamida)
const RESPONSE_MAX_MS = 300_000;
const XHR_HARD_TIMEOUT_MS = 15 * 60_000;
const GIVE_UP_MS = 10 * 60_000;     // butun yuklash bo'yicha shuncha vaqt hech narsa ketmasa — taslim
const MIN_ATTEMPTS = 3;             // ...lekin har bo'lakda kamida shuncha urinishdan keyin
const BACKOFF_CAP_MS = 30_000;
const API_RETRIES = 6;
const REPORT_MS = 250;              // progress'ni ko'pi bilan 4 marta/soniya
const RESUME_PREFIX = "gl-upload:";
const MB = 1024 * 1024;

/* ── Muhit (brauzer bo'lmasa — Node sinovi — hammasi ixtiyoriy) ── */
const hasWindow = () => typeof window !== "undefined" && typeof document !== "undefined";

/** Tarmoqqa qarab bo'lak hajmi: mobil/sekin — kichik (uzilsa kam yo'qoladi) */
export function pickChunkSize(size: number): number {
  if (typeof navigator === "undefined") return chunkSizeFor(size);
  const nav = navigator as Navigator & { connection?: { type?: string; effectiveType?: string; downlink?: number } };
  const conn = nav.connection;
  const mobile = nav.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad/i.test(nav.userAgent);
  const slow = !!conn && (conn.type === "cellular" || (!!conn.effectiveType && conn.effectiveType !== "4g") || (!!conn.downlink && conn.downlink < 5));
  if (slow) return 2 * MB;
  if (mobile) return 4 * MB;
  return chunkSizeFor(size);
}

/** Barmoq izi: bosh + oxir 256 KB + hajm → sha256 (iPhone'da name/lastModified o'zgaradi, mazmun yo'q) */
export async function fingerprint(file: File): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const n = Math.min(256 * 1024, file.size);
    const head = new Uint8Array(await file.slice(0, n).arrayBuffer());
    const tail = new Uint8Array(await file.slice(Math.max(0, file.size - n)).arrayBuffer());
    const sizeBytes = new TextEncoder().encode(String(file.size));
    const buf = new Uint8Array(head.length + tail.length + sizeBytes.length);
    buf.set(head, 0); buf.set(tail, head.length); buf.set(sizeBytes, head.length + tail.length);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
    return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

const resumeKey = (file: File, fp: string | null) => `${RESUME_PREFIX}${fp ?? `${file.name}:${file.size}:${file.lastModified}`}`;

function readResume(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeResume(key: string, id: string | null) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch { /* xotira yopiq (maxfiy rejim) — davom etish mumkin, resume serverdagi fp orqali */ }
}

const isAbortErr = (e: unknown, signal?: AbortSignal) =>
  !!signal?.aborted || (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") || (e instanceof Error && e.name === "AbortError");

const backoff = (attempt: number) => {
  const base = Math.min(BACKOFF_CAP_MS, 1000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.8 + Math.random() * 0.4)); // ±20% — uch oqim bir vaqtda urmasin
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadError("aborted"));
    const onAbort = () => { clearTimeout(t); reject(new UploadError("aborted")); };
    const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/** Internet yo'q bo'lsa — qaytguncha kutamiz (bekorga urinmaymiz) */
const waitOnline = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (!hasWindow() || typeof navigator === "undefined" || navigator.onLine) return resolve();
    const done = () => { window.removeEventListener("online", done); signal?.removeEventListener("abort", onAbort); resolve(); };
    const onAbort = () => { window.removeEventListener("online", done); reject(new UploadError("aborted")); };
    window.addEventListener("online", done);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

type ApiRes<T> = { status: number; json: T | null };

async function api<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<ApiRes<T>> {
  try {
    const res = await fetch(url, { ...init, signal, credentials: "same-origin" });
    const json = await res.json().catch(() => null) as T | null;
    return { status: res.status, json };
  } catch (e) {
    if (isAbortErr(e, signal)) throw new UploadError("aborted");
    throw new UploadError("network");
  }
}

/** Tarmoq xatosi va 5xx/408/429 da qayta uradi; 4xx ni darhol qaytaradi */
async function apiRetry<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<ApiRes<T>> {
  for (let n = 0; ; n++) {
    try {
      const r = await api<T>(url, init, signal);
      if (r.status < 500 && r.status !== 408 && r.status !== 429) return r;
      if (n >= API_RETRIES) return r;
    } catch (e) {
      if (!(e instanceof UploadError) || e.code === "aborted" || n >= API_RETRIES) throw e;
    }
    await waitOnline(signal);
    await sleep(backoff(n + 1), signal);
  }
}

type Init = { name: string; type: string; size: number; chunkSize: number; fp: string | null };
type CompleteJson = { ok?: boolean; url?: string; name?: string; size?: number; error?: string; missing?: number[] };

async function openSession(file: File, fp: string | null, key: string, signal?: AbortSignal): Promise<Session> {
  // Avval: brauzerda eslab qolingan seans bormi?
  const cached = readResume(key);
  if (cached) {
    const r = await apiRetry<Session & { error?: string }>(`/api/upload/session/${cached}`, { method: "GET" }, signal);
    if (r.status === 200 && r.json && r.json.chunks > 0) return { ...r.json, received: r.json.received ?? [] };
    if (r.status === 401) throw new UploadError("unauthorized");
    if (r.status === 404 || r.status === 400) writeResume(key, null); // aniq yo'q — unutamiz
    else throw new UploadError("network"); // 5xx/tarmoq — kalitni saqlab, keyinroq
  }

  const init: Init = { name: file.name, type: file.type || "application/octet-stream", size: file.size, chunkSize: pickChunkSize(file.size), fp };
  const r = await apiRetry<Session & { error?: string }>(
    "/api/upload/session",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(init) },
    signal,
  );
  if (r.status === 401) throw new UploadError("unauthorized");
  if (r.status === 413) throw new UploadError("too_large");
  if (r.status === 429) throw new UploadError("server", "too_many");
  if (r.status !== 200 || !r.json?.id) throw new UploadError(r.status >= 500 ? "network" : "server", r.json?.error);
  writeResume(key, r.json.id);
  return { ...r.json, received: r.json.received ?? [] };
}

/* ── Ko'rinish: fonga tushish/qaytish va ekran qulfi ── */
type Visibility = { hiddenEpoch: number; rearm: Set<() => void>; onVisible: Set<() => void> };

function watchVisibility(v: Visibility): () => void {
  if (!hasWindow()) return () => {};
  const handler = () => {
    if (document.visibilityState === "hidden") { v.hiddenEpoch++; return; }
    for (const f of v.rearm) f();
    for (const f of v.onVisible) f();
  };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

/** Ekran o'chmasin: yuklash davomida wake lock (iOS 16.4+, Android). Yo'q bo'lsa — jim. */
async function holdWakeLock(v: Visibility): Promise<() => void> {
  if (!hasWindow()) return () => {};
  type WL = { release(): Promise<void> };
  const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WL> } };
  if (!nav.wakeLock) return () => {};
  let lock: WL | null = null;
  const acquire = async () => { try { lock = await nav.wakeLock!.request("screen"); } catch { lock = null; } };
  await acquire();
  // Fonga tushganda avtomatik bo'shaydi — qaytganda qayta so'raymiz
  const re = () => { void acquire(); };
  v.onVisible.add(re);
  return () => { v.onVisible.delete(re); void lock?.release().catch(() => {}); };
}

type PutOutcome =
  | { kind: "ok" }
  | { kind: "retry"; progressed: boolean }
  | { kind: "gone" }
  | { kind: "completed" }
  | { kind: "unauthorized" }
  | { kind: "fatal"; detail: string }
  | { kind: "aborted" };

/**
 * Bitta bo'lakni XHR bilan yuboradi (fetch'da yuklash progressi yo'q).
 * Ikki bosqichli to'xtab qolish nazorati: yuborish paytida 45 s siljimasa;
 * tana ketib bo'lgach — javob uchun tezlikka qarab 90–300 s.
 */
function putChunk(
  id: string, index: number, blob: Blob,
  onLoaded: (bytes: number) => void,
  rateHint: number,
  v: Visibility,
  signal?: AbortSignal,
): Promise<PutOutcome> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    let progressed = false;
    let settled = false;

    const responseWait = Math.max(RESPONSE_MIN_MS, Math.min(RESPONSE_MAX_MS, (4 * blob.size / Math.max(rateHint, 20_000)) * 1000));
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => xhr.abort(), sent ? responseWait : STALL_MS);
    };
    const finish = (r: PutOutcome) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      v.rearm.delete(arm);
      signal?.removeEventListener("abort", onAbort);
      resolve(r);
    };
    const onAbort = () => { xhr.abort(); finish({ kind: "aborted" }); };
    signal?.addEventListener("abort", onAbort, { once: true });
    v.rearm.add(arm); // fon'dan qaytganda taymer qaytadan

    xhr.open("PUT", `/api/upload/session/${id}?i=${index}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.timeout = XHR_HARD_TIMEOUT_MS;
    xhr.upload.onprogress = (ev) => {
      if (ev.loaded > 0) progressed = true;
      onLoaded(ev.loaded);
      if (ev.lengthComputable && ev.loaded >= ev.total) sent = true;
      arm();
    };
    xhr.onload = () => {
      const st = xhr.status;
      if (st === 200) return finish({ kind: "ok" });
      if (st === 401) return finish({ kind: "unauthorized" });
      if (st === 404) return finish({ kind: "gone" });
      if (st === 409) return finish({ kind: "completed" });
      if (st === 400 && /bad_length/.test(xhr.responseText)) return finish({ kind: "retry", progressed }); // uzilgan tana
      if (st >= 400 && st < 500 && st !== 408 && st !== 425 && st !== 429) return finish({ kind: "fatal", detail: `${st} ${xhr.responseText.slice(0, 120)}` });
      finish({ kind: "retry", progressed }); // 5xx, 408, 429, nginx 502/504
    };
    xhr.onerror = () => finish(signal?.aborted ? { kind: "aborted" } : { kind: "retry", progressed });
    xhr.onabort = () => finish(signal?.aborted ? { kind: "aborted" } : { kind: "retry", progressed }); // to'xtab qoldi → qayta
    xhr.ontimeout = () => finish({ kind: "retry", progressed });
    arm();
    xhr.send(blob);
  });
}

export async function uploadChunked(
  file: File,
  opts: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal; parallel?: number } = {},
): Promise<UploadResult> {
  const { signal } = opts;
  if (signal?.aborted) throw new UploadError("aborted");
  const parallel = Math.max(1, Math.min(6, opts.parallel ?? PARALLEL));

  const vis: Visibility = { hiddenEpoch: 0, rearm: new Set(), onVisible: new Set() };
  const unwatch = watchVisibility(vis);
  const releaseLock = await holdWakeLock(vis);

  const fp = await fingerprint(file);
  const key = resumeKey(file, fp);

  // Bekor qilinganda: foydalanuvchi "Bekor" dedi → serverdagi yarim fayl ham
  // o'chadi; komponent shunchaki yopildi (unmount) → hammasi qoladi, keyin davom
  const cleanupAbort = (sessionId: string | null) => {
    const reason = (signal as AbortSignal & { reason?: unknown } | undefined)?.reason;
    if (reason === "cancel" && sessionId) {
      writeResume(key, null);
      fetch(`/api/upload/session/${sessionId}`, { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => {});
    }
  };

  let session: Session | null = null;
  try {
    session = await openSession(file, fp, key, signal);
    if (session.completed) { writeResume(key, null); return session.completed; }

    // ── Progress hisobi ──
    const inflight = new Map<number, number>();
    let doneBytes = 0;
    let backingOff = 0;
    let shownLoaded = 0;
    let rate = 0;
    let lastSampleAt = Date.now();
    let lastSampleBytes = 0;
    let lastProgressAt = Date.now();
    let lastReportAt = 0;
    const startedAt = Date.now();
    let serverCompleted = false;
    vis.onVisible.add(() => { lastProgressAt = Date.now(); }); // fonda o'tgan vaqt sabr hisobiga kirmaydi

    const chunkLen = (i: number) => (i < session!.chunks - 1 ? session!.chunkSize : file.size - i * session!.chunkSize);

    const report = (force = false) => {
      const now = Date.now();
      const loaded = Math.min(file.size, doneBytes + [...inflight.values()].reduce((a, b) => a + b, 0));
      if (loaded > shownLoaded) { shownLoaded = loaded; lastProgressAt = now; }
      if (!force && now - lastReportAt < REPORT_MS) return;
      lastReportAt = now;
      if (now - lastSampleAt >= 1000) {
        const inst = Math.max(0, (shownLoaded - lastSampleBytes) / ((now - lastSampleAt) / 1000));
        rate = rate === 0 ? inst : rate * 0.8 + inst * 0.2;
        lastSampleAt = now; lastSampleBytes = shownLoaded;
      }
      const stalled = now - lastProgressAt > 5000;
      opts.onProgress?.({
        pct: Math.floor((shownLoaded / file.size) * 100),
        loaded: shownLoaded,
        total: file.size,
        bytesPerSec: rate,
        etaSec: rate > 0 && now - startedAt >= 10_000 ? Math.ceil((file.size - shownLoaded) / rate) : null,
        retrying: stalled || backingOff >= parallel,
      });
    };

    // ── Bo'laklar navbati ──
    const queue: number[] = [];
    const enqueueMissing = () => {
      const got = new Set(session!.received);
      queue.length = 0;
      doneBytes = 0;
      for (let i = 0; i < session!.chunks; i++) {
        if (got.has(i)) doneBytes += chunkLen(i);
        else queue.push(i);
      }
      shownLoaded = doneBytes; // seans o'zgarganda foiz shu yerdan
    };
    enqueueMissing();
    report(true);

    const fail: { err: UploadError | null } = { err: null };
    let restart: Promise<void> | null = null;
    let restarted = false;

    const worker = async () => {
      while (queue.length && !fail.err && !serverCompleted) {
        if (signal?.aborted) { fail.err = new UploadError("aborted"); return; }
        const i = queue.shift()!;
        let attempt = 0;
        for (;;) {
          const sid = session!.id;
          const epoch = vis.hiddenEpoch;
          const start = i * session!.chunkSize;
          const blob = file.slice(start, start + chunkLen(i));
          inflight.set(i, 0);
          const r = await putChunk(sid, i, blob, (b) => { inflight.set(i, b); report(); }, rate, vis, signal);
          inflight.delete(i);

          if (session!.id !== sid) break; // boshqa oqim seansni yangiladi — navbat qayta tuzilgan
          if (r.kind === "ok") { doneBytes += blob.size; report(); break; }
          if (r.kind === "aborted") { fail.err = new UploadError("aborted"); return; }
          if (r.kind === "unauthorized") { fail.err = new UploadError("unauthorized"); return; }
          if (r.kind === "fatal") { fail.err = new UploadError("server", r.detail); return; }
          if (r.kind === "completed") { serverCompleted = true; queue.length = 0; return; }
          if (r.kind === "gone") {
            // Seans serverda yo'q (tozalangan). Bir marta, BITTA oqim qayta ochadi,
            // qolganlari kutadi — hammasi birdan "yo'q" deb taslim bo'lmasin
            if (!restart) {
              if (restarted) { fail.err = new UploadError("server", "session_lost"); return; }
              restarted = true;
              restart = (async () => {
                writeResume(key, null);
                session = await openSession(file, fp, key, signal);
                if (session.completed) { serverCompleted = true; queue.length = 0; return; }
                enqueueMissing();
                report(true);
              })().finally(() => { restart = null; });
            }
            try { await restart; } catch (e) { fail.err = e instanceof UploadError ? e : new UploadError("server"); return; }
            break; // bu bo'lak (kerak bo'lsa) yangi navbatda
          }

          // Qayta urinish. Fonda uzilgani yoki bir qism ketgani urinish sanalmaydi
          const hiddenMeanwhile = epoch !== vis.hiddenEpoch;
          if (!hiddenMeanwhile && !r.progressed) attempt++;
          if (attempt >= MIN_ATTEMPTS && Date.now() - lastProgressAt > GIVE_UP_MS) { fail.err = new UploadError("network"); return; }
          backingOff++; report(true);
          try {
            await waitOnline(signal);
            await sleep(hiddenMeanwhile ? 500 : backoff(Math.max(1, attempt)), signal);
          } catch (e) {
            backingOff--;
            fail.err = e instanceof UploadError ? e : new UploadError("aborted");
            return;
          }
          backingOff--; report(true);
        }
      }
    };

    // Yakunlash: hamma bo'lak kelgan bo'lsa url; "to'liq emas" bo'lsa yetishmaganlarini yana
    for (let round = 0; round < 4; round++) {
      await Promise.all(Array.from({ length: parallel }, () => worker()));
      if (fail.err) throw fail.err;

      const sid: string = session.id;
      const r: ApiRes<CompleteJson> = await apiRetry<CompleteJson>(`/api/upload/session/${sid}`, { method: "POST" }, signal);
      if (r.status === 200 && r.json?.url) {
        writeResume(key, null);
        shownLoaded = file.size; report(true);
        return { url: r.json.url, name: r.json.name ?? file.name, size: r.json.size ?? file.size };
      }
      if (r.status === 401) throw new UploadError("unauthorized");
      if (r.status === 409 && r.json?.missing?.length) {
        const missing: Set<number> = new Set(r.json.missing);
        const cur: Session = session;
        session = { ...cur, received: Array.from({ length: cur.chunks }, (_, i) => i).filter((i) => !missing.has(i)) };
        enqueueMissing();
        serverCompleted = false;
        continue;
      }
      if (r.status === 404) { writeResume(key, null); throw new UploadError("server", "session_lost"); }
      throw new UploadError(r.status >= 500 ? "network" : "server", r.json?.error);
    }
    throw new UploadError("server", "incomplete");
  } catch (e) {
    const err = e instanceof UploadError ? e : isAbortErr(e, signal) ? new UploadError("aborted") : new UploadError("server", String(e));
    if (err.code === "aborted") cleanupAbort(session?.id ?? null);
    throw err;
  } finally {
    releaseLock();
    unwatch();
  }
}

/** 12.3 MB/s, 850 KB/s */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= MB) return `${(bytesPerSec / MB).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${Math.round(bytesPerSec / 1024)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

/** 1 GB 240 MB → "240 MB / 1.0 GB" kabi ko'rsatish uchun */
export function formatBytes(n: number): string {
  if (n >= 1024 * MB) return `${(n / (1024 * MB)).toFixed(1)} GB`;
  if (n >= MB) return `${Math.round(n / MB)} MB`;
  return `${Math.round(n / 1024)} KB`;
}
