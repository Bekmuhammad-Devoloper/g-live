// Bo'lakli yuklash — server seanslari (lib/uploadSessions) va brauzer
// yuklovchisi (lib/chunkedUpload) BIRGA, haqiqiy fayl bilan sinov.
//
//   npx tsx --require ./scripts/_server-only-stub.cjs scripts/test-chunked-upload.mts
//
// Brauzer o'rniga soxta XMLHttpRequest/fetch: ular so'rovni to'g'ridan-to'g'ri
// server kutubxonasiga uzatadi (HTTP va seans cookie'siz), lekin mijoz
// kodining O'ZI ishlaydi — navbat, parallel oqimlar, qayta urinish, seans
// yo'qolganda qayta ochish, bekor qilish, davom etish. Nosozliklar ataylab
// kiritiladi: tarmoq xatosi, uzilgan tana, serverda seans o'chishi.
//
// Muhim savollar:
//   · 12 bo'lak 3 parallel oqimda tartibsiz kelganda fayl aynan o'zimi (sha256)
//   · uzilgan/xato bo'lak qayta ketadimi, fayl buzilmaydimi
//   · seans serverda yo'qolsa uch oqim birdan taslim bo'lmaydimi (restart poygasi)
//   · yopilib qayta ochilganda qolgan joyidan davom etadimi (barmoq izi)
//   · "Bekor" serverdagi yarim faylni o'chiradimi
//   · yakunlash idempotentmi, chegaralar va tozalash ishlaydimi

import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

const USER = "user_test_1";
const MB = 1024 * 1024;
const SIZE = 96 * MB;
const CHUNK = 8 * MB;

let bad = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) bad++;
  console.log(`${cond ? "ok  " : "XATO"} ${name}${detail ? "  " + detail : ""}`);
}
const tick = () => new Promise((r) => setTimeout(r, 1));

// ── Vaqtinchalik ish papkasi (UPLOAD_DIR/PARTS_DIR import paytida cwd dan olinadi) ──
const tmp = await mkdtemp(path.join(os.tmpdir(), "gl-upload-test-"));
process.chdir(tmp);
const S = await import("../src/lib/uploadSessions");
const C = await import("../src/lib/chunkedUpload");

// ── Sinov ma'lumoti: urug'li psevdo-tasodifiy 96 MB ──
function makeData(size: number): Buffer {
  const buf = Buffer.alloc(size);
  let s = 0x9e3779b9;
  for (let i = 0; i < size; i += 4) {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x1b873593) >>> 0;
    buf.writeUInt32LE(s, i);
  }
  return buf;
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const data = makeData(SIZE);
const srcHash = sha(data);
const makeFile = (name = "dars.mp4") => new File([data], name, { type: "video/mp4", lastModified: 1_700_000_000_000 });

// ── Soxta brauzer: localStorage ──
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

// ── Nosozlik va kuzatuv ilgaklari ──
type Fail = "error" | "truncate";
const hooks = {
  failures: new Map<number, Fail[]>(),
  putOk: 0,
  putCalls: 0,
  beforePut: null as null | ((id: string, i: number) => Promise<void>),
  deleted: [] as string[],
  inits: [] as { received: number[]; id: string }[],
};
const resetHooks = () => { hooks.failures.clear(); hooks.putOk = 0; hooks.putCalls = 0; hooks.beforePut = null; hooks.deleted = []; hooks.inits = []; };

// ── Soxta XMLHttpRequest: PUT bo'lak → writeChunk ──
type Ev = { loaded: number; total: number; lengthComputable: boolean };
class FakeXHR {
  upload: { onprogress: null | ((ev: Ev) => void) } = { onprogress: null };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  onabort: null | (() => void) = null;
  ontimeout: null | (() => void) = null;
  timeout = 0;
  status = 0;
  responseText = "";
  private url = "";
  private aborted = false;
  open(_m: string, u: string) { this.url = u; }
  setRequestHeader() {}
  abort() { if (this.aborted) return; this.aborted = true; this.onabort?.(); }
  send(blob: Blob) { void this.run(blob); }
  private async run(blob: Blob) {
    const m = /\/api\/upload\/session\/([^?]+)\?i=(\d+)/.exec(this.url);
    if (!m) throw new Error("soxta XHR: noto'g'ri url " + this.url);
    const id = m[1]; const i = Number(m[2]);
    hooks.putCalls++;
    const fail = hooks.failures.get(i)?.shift();
    const total = blob.size;
    for (let k = 1; k <= 4; k++) {
      await tick();
      if (this.aborted) return;
      this.upload.onprogress?.({ loaded: Math.floor((total * k) / 4), total, lengthComputable: true });
    }
    if (fail === "error") { this.onerror?.(); return; }
    if (hooks.beforePut) await hooks.beforePut(id, i);
    const meta = await S.loadSession(id, USER);
    if (!meta) { this.status = 404; this.responseText = '{"error":"not_found"}'; this.onload?.(); return; }
    let buf = Buffer.from(await blob.arrayBuffer());
    if (fail === "truncate") buf = buf.subarray(0, buf.length - 1);
    const r = await S.writeChunk(meta, i, Readable.toWeb(Readable.from([buf])) as unknown as ReadableStream<Uint8Array>);
    if (this.aborted) return;
    if (r.ok) { this.status = 200; this.responseText = '{"ok":true}'; hooks.putOk++; }
    else { this.status = r.error === "write_failed" ? 500 : r.error === "completed" ? 409 : 400; this.responseText = JSON.stringify({ error: r.error }); }
    this.onload?.();
  }
}
(globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;

// ── Soxta fetch: seans ochish/holat/yakunlash/bekor → server kutubxonasi ──
const jsonRes = (status: number, body: unknown) => ({ status, json: async () => body });
(globalThis as unknown as { fetch: unknown }).fetch = async (url: string, init: { method?: string; body?: string; signal?: AbortSignal } = {}) => {
  if (init.signal?.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
  if (url === "/api/upload/session" && init.method === "POST") {
    const b = JSON.parse(init.body ?? "{}");
    try {
      const r = await S.openOrCreateSession({ userId: USER, name: b.name, type: b.type, size: b.size, chunkSize: b.chunkSize, fp: b.fp });
      const resp = { id: r.meta.id, chunkSize: r.meta.chunkSize, chunks: r.meta.chunks, received: r.received, ...(r.done ? { completed: { url: r.done.url, name: r.done.name, size: r.done.size } } : {}) };
      hooks.inits.push({ id: resp.id, received: resp.received });
      return jsonRes(200, resp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return jsonRes(msg === "too_many" ? 429 : 400, { error: msg });
    }
  }
  const m = /\/api\/upload\/session\/([^?]+)$/.exec(url);
  if (!m) return jsonRes(404, { error: "nf" });
  const meta = await S.loadSession(m[1], USER);
  if (!meta) return jsonRes(404, { error: "not_found" });
  if (init.method === "GET") {
    const done = await S.sessionResult(meta);
    return jsonRes(200, { id: meta.id, chunkSize: meta.chunkSize, chunks: meta.chunks, size: meta.size, received: done ? [] : await S.receivedChunks(meta), ...(done ? { completed: { url: done.url, name: done.name, size: done.size } } : {}) });
  }
  if (init.method === "POST") {
    const r = await S.completeSession(meta);
    if (r.ok) return jsonRes(200, { ok: true, url: r.url, name: r.name, size: r.size });
    if (r.error === "incomplete") return jsonRes(409, { error: "incomplete", missing: r.missing });
    return jsonRes(500, { error: r.error });
  }
  if (init.method === "DELETE") { await S.abortSession(meta); hooks.deleted.push(meta.id); return jsonRes(200, { ok: true }); }
  return jsonRes(405, {});
};

const uploadedHash = async (url: string) => sha(await readFile(path.join(tmp, "public", url.replace(/^\//, ""))));
const userDirs = async () => (await readdir(path.join(tmp, "upload-parts", USER)).catch(() => [] as string[])).filter((d) => !d.endsWith(".tmp"));

try {
  // 1. Oddiy yo'l — 12 bo'lak, 3 parallel
  {
    resetHooks();
    const t0 = Date.now();
    let last = { pct: 0 };
    const r = await C.uploadChunked(makeFile(), { parallel: 3, onProgress: (p) => { last = p; } });
    const sec = (Date.now() - t0) / 1000;
    check("1. yuklandi, url .mp4", r.url.endsWith(".mp4") && r.size === SIZE, r.url);
    check("1. fayl aynan o'zi (sha256)", (await uploadedHash(r.url)) === srcHash);
    check("1. 12 bo'lak, hammasi bir martadan", hooks.putOk === 12 && hooks.putCalls === 12, `ok=${hooks.putOk} calls=${hooks.putCalls}`);
    check("1. progress 100% ga yetdi", last.pct === 100, `pct=${last.pct}`);
    console.log(`     tezlik: ${(SIZE / MB / sec).toFixed(0)} MB/s (${sec.toFixed(1)} s)`);
    // yakunlash idempotent: seans papkasi result.json bilan qoladi, qayta yakunlash o'sha url
    const dirs = await userDirs();
    const meta = await S.loadSession(dirs[0], USER);
    const again = meta ? await S.completeSession(meta) : null;
    check("1. qayta yakunlash — o'sha url (idempotent)", !!again && again.ok && again.url === r.url);
    check("1. localStorage kaliti tozalandi", store.size === 0);
    if (meta) await S.abortSession(meta);
  }

  // 2. Nosozliklar: 2-bo'lak ikki marta tarmoq xatosi, 5-bo'lak bir marta uzilgan tana
  {
    resetHooks();
    hooks.failures.set(2, ["error", "error"]);
    hooks.failures.set(5, ["truncate"]);
    const r = await C.uploadChunked(makeFile("dars2.mp4"), { parallel: 3 });
    check("2. xatolarga qaramay yuklandi", r.size === SIZE);
    check("2. fayl aynan o'zi", (await uploadedHash(r.url)) === srcHash);
    check("2. qayta urinishlar bo'ldi (12 dan ko'p PUT)", hooks.putCalls === 15, `calls=${hooks.putCalls}`);
    for (const d of await userDirs()) { const m = await S.loadSession(d, USER); if (m) await S.abortSession(m); }
  }

  // 3. Seans serverda yo'qoldi (tozalandi) — uch oqim birdan: bittasi qayta ochadi
  {
    resetHooks();
    let killed = false;
    hooks.beforePut = async (id) => {
      if (!killed && hooks.putOk >= 4) {
        killed = true;
        const m = await S.loadSession(id, USER);
        if (m) await S.abortSession(m);
      }
    };
    const r = await C.uploadChunked(makeFile("dars3.mp4"), { parallel: 3 });
    check("3. seans yo'qolgach qayta ochildi va yuklandi", r.size === SIZE && hooks.inits.length === 2, `inits=${hooks.inits.length}`);
    check("3. fayl aynan o'zi", (await uploadedHash(r.url)) === srcHash);
    for (const d of await userDirs()) { const m = await S.loadSession(d, USER); if (m) await S.abortSession(m); }
  }

  // 4. Yopilib qayta ochish: 5 bo'lakdan keyin "unmount", keyin o'sha fayl qayta — davom
  {
    resetHooks();
    const ac = new AbortController();
    hooks.beforePut = async () => { if (hooks.putOk >= 5 && !ac.signal.aborted) ac.abort("unmount"); };
    let err: unknown = null;
    try { await C.uploadChunked(makeFile("dars4.mp4"), { parallel: 3, signal: ac.signal }); } catch (e) { err = e; }
    check("4. unmount → 'aborted' xatosi", err instanceof C.UploadError && err.code === "aborted");
    await tick();
    check("4. unmount'da seans O'CHMADI", hooks.deleted.length === 0 && (await userDirs()).length === 1);
    const before = hooks.putOk;
    hooks.beforePut = null;
    resetHooks();
    const r = await C.uploadChunked(makeFile("dars4.mp4"), { parallel: 3 });
    check("4. davom etdi — qolgan bo'laklar ozroq", hooks.putCalls < 12 && hooks.putCalls >= 12 - before - 3, `calls=${hooks.putCalls} (oldin ok=${before})`);
    check("4. fayl aynan o'zi", (await uploadedHash(r.url)) === srcHash);
    for (const d of await userDirs()) { const m = await S.loadSession(d, USER); if (m) await S.abortSession(m); }
  }

  // 4b. Barmoq izi bilan davom — localStorage BO'SH (maxfiy rejim / boshqa brauzer)
  {
    resetHooks();
    const ac = new AbortController();
    hooks.beforePut = async () => { if (hooks.putOk >= 4 && !ac.signal.aborted) ac.abort("unmount"); };
    try { await C.uploadChunked(makeFile("a.mp4"), { parallel: 3, signal: ac.signal }); } catch { /* kutilgan */ }
    store.clear();
    resetHooks();
    // iPhone kabi: nomi ham, lastModified ham boshqa — mazmuni o'sha
    const other = new File([data], "IMG_0001.MOV", { type: "video/mp4", lastModified: 1_800_000_000_000 });
    const r = await C.uploadChunked(other, { parallel: 3 });
    check("4b. localStorage'siz, boshqa nom bilan ham serverdagi seans topildi", hooks.inits.length === 1 && hooks.inits[0].received.length >= 4, `received=${hooks.inits[0]?.received.length}`);
    check("4b. fayl aynan o'zi", (await uploadedHash(r.url)) === srcHash);
    for (const d of await userDirs()) { const m = await S.loadSession(d, USER); if (m) await S.abortSession(m); }
  }

  // 5. Bekor qilish: "cancel" → serverdagi yarim fayl o'chadi
  {
    resetHooks();
    const ac = new AbortController();
    hooks.beforePut = async () => { if (hooks.putOk >= 3 && !ac.signal.aborted) ac.abort("cancel"); };
    let err: unknown = null;
    try { await C.uploadChunked(makeFile("dars5.mp4"), { parallel: 3, signal: ac.signal }); } catch (e) { err = e; }
    await new Promise((r) => setTimeout(r, 50));
    check("5. cancel → 'aborted'", err instanceof C.UploadError && err.code === "aborted");
    check("5. seans serverdan o'chirildi", hooks.deleted.length === 1 && (await userDirs()).length === 0, `deleted=${hooks.deleted.length}`);
  }

  // 6. Server kutubxonasi: tekshiruvlar
  {
    const meta = (await S.openOrCreateSession({ userId: USER, name: "x.mp4", type: "video/mp4", size: 3 * MB + 5, chunkSize: MB })).meta;
    check("6. chunks = ceil(size/chunk)", meta.chunks === 4);
    check("6. oxirgi bo'lak uzunligi", S.chunkLength(meta, 3) === 5);
    const bodyOf = (b: Buffer) => Readable.toWeb(Readable.from([b])) as unknown as ReadableStream<Uint8Array>;
    const short = await S.writeChunk(meta, 0, bodyOf(Buffer.alloc(MB - 1)));
    check("6. qisqa tana → bad_length, belgilanmaydi", !short.ok && short.error === "bad_length" && (await S.receivedChunks(meta)).length === 0);
    const long = await S.writeChunk(meta, 0, bodyOf(Buffer.alloc(MB + 1)));
    check("6. uzun tana → bad_length", !long.ok && long.error === "bad_length");
    const badIdx = await S.writeChunk(meta, 4, bodyOf(Buffer.alloc(5)));
    check("6. indeks chegaradan tashqari → bad_index", !badIdx.ok && badIdx.error === "bad_index");
    const inc = await S.completeSession(meta);
    check("6. to'liq emas → incomplete + yetishmaganlar", !inc.ok && inc.error === "incomplete" && inc.missing.length === 4);
    check("6. boshqa foydalanuvchi → null", (await S.loadSession(meta.id, "user_other")) === null);
    check("6. UUID bo'lmagan id → null", (await S.loadSession("../../etc/passwd", USER)) === null);
    await S.abortSession(meta);
    check("6. abort → papka yo'q", (await userDirs()).length === 0);
  }

  // 7. Chegara: foydalanuvchida ko'pi bilan 3 faol seans (eng eskisi o'chadi)
  {
    const ids: string[] = [];
    for (let k = 0; k < 4; k++) {
      ids.push((await S.openOrCreateSession({ userId: USER, name: `f${k}.mp4`, type: "video/mp4", size: 10 * MB, chunkSize: 2 * MB })).meta.id);
      await new Promise((r) => setTimeout(r, 5)); // createdAt farqlansin
    }
    const dirs = await userDirs();
    check("7. 4 ta ochilsa 3 ta qoladi", dirs.length === 3 && !dirs.includes(ids[0]) && dirs.includes(ids[3]), `dirs=${dirs.length}`);
    // barmoq izi bir xil → yangi ochilmaydi
    const a = await S.openOrCreateSession({ userId: USER, name: "same.mp4", type: "video/mp4", size: 10 * MB, chunkSize: 2 * MB, fp: "ab".repeat(16) });
    const b = await S.openOrCreateSession({ userId: USER, name: "same2.mp4", type: "video/mp4", size: 10 * MB, chunkSize: 2 * MB, fp: "ab".repeat(16) });
    check("7. bir xil barmoq izi → o'sha seans", a.meta.id === b.meta.id);
    for (const d of await userDirs()) { const m = await S.loadSession(d, USER); if (m) await S.abortSession(m); }
  }

  // 8. Tozalash: faollikdan 25 soat o'tgan seans o'chadi, yangi va yaqinda faol bo'lgani qoladi
  {
    const old = (await S.openOrCreateSession({ userId: USER, name: "old.mp4", type: "video/mp4", size: 4 * MB, chunkSize: 2 * MB })).meta;
    const fresh = (await S.openOrCreateSession({ userId: USER, name: "fresh.mp4", type: "video/mp4", size: 4 * MB, chunkSize: 2 * MB })).meta;
    const ago = new Date(Date.now() - 25 * 3600 * 1000);
    const dirOld = path.join(tmp, "upload-parts", USER, old.id);
    // 25 soat oldin yaratilgan va o'shandan beri bo'lak kelmagan
    const metaOld = JSON.parse(await readFile(path.join(dirOld, "meta.json"), "utf8"));
    metaOld.createdAt = ago.getTime();
    await writeFile(path.join(dirOld, "meta.json"), JSON.stringify(metaOld));
    await utimes(path.join(dirOld, "done"), ago, ago);
    // yaratilgani eski, lekin YAQINDA bo'lak kelgan seans — o'chmasin
    const active = (await S.openOrCreateSession({ userId: USER, name: "active.mp4", type: "video/mp4", size: 4 * MB, chunkSize: 2 * MB })).meta;
    const metaActive = JSON.parse(await readFile(path.join(tmp, "upload-parts", USER, active.id, "meta.json"), "utf8"));
    metaActive.createdAt = Date.now() - 30 * 3600 * 1000;
    await writeFile(path.join(tmp, "upload-parts", USER, active.id, "meta.json"), JSON.stringify(metaActive));
    await S.writeChunk(active, 0, Readable.toWeb(Readable.from([Buffer.alloc(2 * MB)])) as unknown as ReadableStream<Uint8Array>);
    const removed = await S.sweepStaleSessions(Date.now(), true);
    const dirs = await userDirs();
    check("8. eskirgan o'chdi, yangi va faol qoldi", removed === 1 && !dirs.includes(old.id) && dirs.includes(fresh.id) && dirs.includes(active.id), `removed=${removed} dirs=${dirs.length}`);
    // yakunlangan seans 1 soatdan keyin o'chadi
    const doneMeta = (await S.openOrCreateSession({ userId: USER, name: "d.mp4", type: "video/mp4", size: 5, chunkSize: MB })).meta;
    await S.writeChunk(doneMeta, 0, Readable.toWeb(Readable.from([Buffer.from("12345")])) as unknown as ReadableStream<Uint8Array>);
    const done = await S.completeSession(doneMeta);
    check("8. kichik fayl yakunlandi", done.ok);
    const rp = path.join(tmp, "upload-parts", USER, doneMeta.id, "result.json");
    const resJson = JSON.parse(await readFile(rp, "utf8")); resJson.completedAt = Date.now() - 2 * 3600 * 1000;
    await writeFile(rp, JSON.stringify(resJson));
    const removed2 = await S.sweepStaleSessions(Date.now(), true);
    check("8. yakunlangan seans 1 soatdan keyin tozalandi", removed2 === 1 && !(await userDirs()).includes(doneMeta.id), `removed=${removed2}`);
    check("8. yakuniy fayl joyida", (await stat(path.join(tmp, "public", "uploads", `${doneMeta.id}.mp4`))).size === 5);
  }
} finally {
  process.chdir(os.tmpdir());
  await rm(tmp, { recursive: true, force: true });
}

console.log(bad === 0 ? "\nOK — hammasi kutilganidek" : `\n${bad} ta holat mos kelmadi`);
process.exit(bad === 0 ? 0 : 1);
