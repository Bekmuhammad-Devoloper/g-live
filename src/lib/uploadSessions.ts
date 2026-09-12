import "server-only";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, open, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import path from "node:path";
import { MAX_CHUNK_BYTES, MAX_UPLOAD_BYTES, MIN_CHUNK_BYTES, UPLOAD_SESSION_TTL_MS } from "./upload";
import { extFor, PARTS_DIR, UPLOAD_DIR } from "./uploadFs";

// Bo'lakli (resumable) yuklash seanslari — diskda.
//
// Har seans o'z papkasi: upload-parts/<userId>/<id>/
//   meta.json   — kim, nima, qancha, bo'lak hajmi, barmoq izi (fp)
//   data        — faylning o'zi; har bo'lak O'Z OFSETIGA yoziladi (r+), shu
//                 sabab bo'laklar istalgan tartibda va PARALLEL kelaverishi
//                 mumkin; oxirida hech narsa qayta ko'chirilmaydi (5 GB ni
//                 ikki marta yozmaymiz)
//   done        — bitmap: i-bayt = 1 bo'lsa i-bo'lak to'liq qabul qilingan.
//                 Bir baytli yozuvlar atomar — parallel belgilash xavfsiz.
//                 Har bo'lakda yoziladi → mtime = oxirgi faollik vaqti.
//   result.json — yakunlangach: url. Seans papkasi bir soat saqlanadi, shunda
//                 "yakunla" so'rovining javobi yo'qolsa mijoz qayta so'rab
//                 o'sha url'ni oladi (idempotent).
//
// Nima uchun diskda, xotirada emas: server qayta ishga tushsa (deploy) ham
// yarim yuklangan video yo'qolmaydi — mijoz qolgan bo'laklarni yuboradi.
//
// Foydalanuvchi bo'yicha papka: bir foydalanuvchida ko'pi bilan 3 faol seans
// (eng eskisi o'chiriladi), umumiy chegara ham bor — birov diskni yarim
// fayllar bilan to'ldirib qo'ymasin. Barmoq izi (fp) bir xil bo'lsa yangi
// seans OCHILMAYDI, mavjudi qaytadi: iPhone'da qayta tanlangan videoning
// name/lastModified'i o'zgaradi, mazmuni esa o'sha — shunda ham davom etadi.
//
// Xavfsizlik: id faqat UUID, userId faqat [A-Za-z0-9_-] (yo'lga chiqib
// bo'lmaydi), seans faqat o'z papkasidan o'qiladi, indeks va uzunlik har
// bo'lakda tekshiriladi.

export type UploadMeta = {
  id: string;
  userId: string;
  name: string;
  type: string;
  size: number;
  chunkSize: number;
  chunks: number;
  /** mijoz hisoblagan barmoq izi (bosh+oxir 256 KB sha256), bo'lmasa null */
  fp: string | null;
  createdAt: number;
};

export type UploadDone = { url: string; name: string; size: number; completedAt: number };

export const MAX_SESSIONS_PER_USER = 3;
export const MAX_SESSIONS_TOTAL = 300;
/** Yakunlangan seans papkasi shuncha saqlanadi (takroriy "yakunla" uchun) */
export const COMPLETED_KEEP_MS = 60 * 60 * 1000;
/** Faol bo'lsa ham shundan uzoq yashamaydi */
export const HARD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Yarim yaratilgan (.tmp) yoki meta'siz papka shundan eski bo'lsa tozalanadi */
const ORPHAN_GRACE_MS = 10 * 60 * 1000;

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const USER_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FP_RE = /^[0-9a-f]{16,64}$/;

const userDir = (userId: string) => path.join(PARTS_DIR, userId);
const dirOf = (userId: string, id: string) => path.join(userDir(userId), id);
const metaPath = (m: Pick<UploadMeta, "userId" | "id">) => path.join(dirOf(m.userId, m.id), "meta.json");
const dataPath = (m: Pick<UploadMeta, "userId" | "id">) => path.join(dirOf(m.userId, m.id), "data");
const donePath = (m: Pick<UploadMeta, "userId" | "id">) => path.join(dirOf(m.userId, m.id), "done");
const resultPath = (m: Pick<UploadMeta, "userId" | "id">) => path.join(dirOf(m.userId, m.id), "result.json");

/** i-bo'lakning kutilgan uzunligi (oxirgisi qisqaroq bo'lishi mumkin) */
export function chunkLength(meta: Pick<UploadMeta, "size" | "chunkSize" | "chunks">, index: number): number {
  return index < meta.chunks - 1 ? meta.chunkSize : meta.size - index * meta.chunkSize;
}

async function readMeta(userId: string, id: string): Promise<UploadMeta | null> {
  try {
    const meta = JSON.parse(await readFile(path.join(dirOf(userId, id), "meta.json"), "utf8")) as UploadMeta;
    if (meta.id !== id || meta.userId !== userId) return null;
    if (!Number.isInteger(meta.chunks) || !Number.isInteger(meta.size) || !Number.isInteger(meta.chunkSize)) return null;
    return meta;
  } catch {
    return null;
  }
}

async function listUserSessions(userId: string): Promise<UploadMeta[]> {
  let ids: string[] = [];
  try { ids = await readdir(userDir(userId)); } catch { return []; }
  const out: UploadMeta[] = [];
  for (const id of ids) {
    if (!ID_RE.test(id)) continue;
    const m = await readMeta(userId, id);
    if (m) out.push(m);
  }
  return out;
}

/** Yakunlangan seansning natijasi (bo'lsa) */
export async function sessionResult(meta: UploadMeta): Promise<UploadDone | null> {
  try {
    return JSON.parse(await readFile(resultPath(meta), "utf8")) as UploadDone;
  } catch {
    return null;
  }
}

export type OpenResult = { meta: UploadMeta; received: number[]; done: UploadDone | null };

/**
 * Seans ochadi. Shu foydalanuvchida xuddi shu barmoq izli va hajmli faol
 * seans bo'lsa — YANGISINI ochmaydi, o'shani (qabul qilingan bo'laklari
 * bilan) qaytaradi. Foydalanuvchi chegarasidan oshsa eng eski seans o'chadi.
 */
export async function openOrCreateSession(input: {
  userId: string; name: string; type: string; size: number; chunkSize: number; fp?: string | null;
}): Promise<OpenResult> {
  const { userId } = input;
  if (!USER_RE.test(userId)) throw new Error("bad_user");
  const size = Math.floor(input.size);
  const chunkSize = Math.floor(input.chunkSize);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) throw new Error("bad_size");
  if (!Number.isFinite(chunkSize) || chunkSize < MIN_CHUNK_BYTES || chunkSize > MAX_CHUNK_BYTES) throw new Error("bad_chunk");
  const fp = input.fp && FP_RE.test(input.fp) ? input.fp : null;

  await mkdir(userDir(userId), { recursive: true });
  const mine = (await listUserSessions(userId)).sort((a, b) => a.createdAt - b.createdAt);

  // Bir xil fayl — mavjud seansdan davom
  if (fp) {
    for (const m of mine) {
      if (m.fp === fp && m.size === size) {
        const done = await sessionResult(m);
        return { meta: m, received: done ? [] : await receivedChunks(m), done };
      }
    }
  }

  // Chegaralar: foydalanuvchi bo'yicha (eng eskisi o'chadi) va umumiy (rad)
  const active = mine.filter((m) => m.createdAt > 0);
  while (active.length >= MAX_SESSIONS_PER_USER) {
    const oldest = active.shift()!;
    await rm(dirOf(userId, oldest.id), { recursive: true, force: true });
  }
  if ((await countAllSessions()) >= MAX_SESSIONS_TOTAL) throw new Error("too_many");

  const meta: UploadMeta = {
    id: randomUUID(),
    userId,
    name: input.name.slice(0, 200),
    type: input.type.slice(0, 100),
    size,
    chunkSize,
    chunks: Math.ceil(size / chunkSize),
    fp,
    createdAt: Date.now(),
  };

  // Avval .tmp papkada to'liq yig'iladi, keyin rename — ro'yxatga tushgan
  // papka hech qachon yarim bo'lmaydi (tozalash bilan poyga yo'q)
  const tmp = dirOf(userId, meta.id) + ".tmp";
  await mkdir(tmp, { recursive: true });
  await writeFile(path.join(tmp, "meta.json"), JSON.stringify(meta));
  await writeFile(path.join(tmp, "data"), Buffer.alloc(0));
  await writeFile(path.join(tmp, "done"), Buffer.alloc(meta.chunks));
  await rename(tmp, dirOf(userId, meta.id));
  return { meta, received: [], done: null };
}

async function countAllSessions(): Promise<number> {
  let users: string[] = [];
  try { users = await readdir(PARTS_DIR); } catch { return 0; }
  let n = 0;
  for (const u of users) {
    if (!USER_RE.test(u)) continue;
    try { n += (await readdir(userDir(u))).filter((d) => ID_RE.test(d)).length; } catch { /* yo'q bo'lib qolgan */ }
  }
  return n;
}

/** Seansni o'qiydi; yo'q, buzilgan yoki BOSHQA foydalanuvchiniki bo'lsa null */
export async function loadSession(id: string, userId: string): Promise<UploadMeta | null> {
  if (!ID_RE.test(id) || !USER_RE.test(userId)) return null;
  return readMeta(userId, id);
}

/** Qabul qilingan bo'laklarning indekslari */
export async function receivedChunks(meta: UploadMeta): Promise<number[]> {
  let bits: Buffer;
  try { bits = await readFile(donePath(meta)); } catch { return []; }
  const out: number[] = [];
  for (let i = 0; i < meta.chunks && i < bits.length; i++) if (bits[i] === 1) out.push(i);
  return out;
}

export type ChunkResult = { ok: true } | { ok: false; error: "bad_index" | "bad_length" | "completed" | "write_failed" };

/**
 * Bitta bo'lakni o'z ofsetiga yozadi. Uzunligi kutilganga teng bo'lmasa
 * (uzilgan so'rov) bo'lak qabul qilinmaydi — mijoz uni qayta yuboradi.
 * Bir bo'lak ikki marta kelsa ham zarar yo'q: aynan o'sha baytlar o'sha joyga.
 */
export async function writeChunk(meta: UploadMeta, index: number, body: ReadableStream<Uint8Array>): Promise<ChunkResult> {
  if (!Number.isInteger(index) || index < 0 || index >= meta.chunks) return { ok: false, error: "bad_index" };
  if (await sessionResult(meta)) return { ok: false, error: "completed" };
  const expected = chunkLength(meta, index);

  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      if (received > expected) return cb(new Error("bad_length"));
      cb(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as unknown as NodeReadableStream),
      limiter,
      createWriteStream(dataPath(meta), { flags: "r+", start: index * meta.chunkSize }),
    );
  } catch (e) {
    if (e instanceof Error && e.message === "bad_length") return { ok: false, error: "bad_length" };
    return { ok: false, error: "write_failed" };
  }
  if (received !== expected) return { ok: false, error: "bad_length" };

  // Belgi: i-bo'lak tayyor (bir bayt, o'z ofsetiga — parallel xavfsiz)
  try {
    const fh = await open(donePath(meta), "r+");
    try {
      await fh.write(Buffer.from([1]), 0, 1, index);
    } finally {
      await fh.close();
    }
  } catch {
    return { ok: false, error: "write_failed" }; // seans shu orada tozalangan
  }
  return { ok: true };
}

export type CompleteResult =
  | { ok: true; url: string; name: string; size: number }
  | { ok: false; error: "incomplete"; missing: number[] }
  | { ok: false; error: "size_mismatch" };

/**
 * Hamma bo'lak kelgan bo'lsa faylni yakuniy nomiga ko'chiradi (rename —
 * nusxasiz). IDEMPOTENT: allaqachon yakunlangan seansga o'sha url qaytadi.
 */
export async function completeSession(meta: UploadMeta): Promise<CompleteResult> {
  const prev = await sessionResult(meta);
  if (prev) return { ok: true, url: prev.url, name: prev.name, size: prev.size };

  const got = new Set(await receivedChunks(meta));
  const missing: number[] = [];
  for (let i = 0; i < meta.chunks; i++) if (!got.has(i)) missing.push(i);
  if (missing.length) return { ok: false, error: "incomplete", missing };

  const st = await stat(dataPath(meta));
  if (st.size !== meta.size) return { ok: false, error: "size_mismatch" };

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fname = `${meta.id}.${extFor(meta.type, meta.name)}`;
  const dest = path.join(UPLOAD_DIR, fname);
  try {
    await rename(dataPath(meta), dest);
  } catch (e) {
    // Boshqa diskda bo'lsa (EXDEV) — nusxa, keyin asl o'chadi
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    await copyFile(dataPath(meta), dest);
    await unlink(dataPath(meta));
  }
  const done: UploadDone = { url: `/uploads/${fname}`, name: meta.name, size: meta.size, completedAt: Date.now() };
  await writeFile(resultPath(meta), JSON.stringify(done));
  await rm(donePath(meta), { force: true });
  return { ok: true, url: done.url, name: done.name, size: done.size };
}

export async function abortSession(meta: UploadMeta): Promise<void> {
  await rm(dirOf(meta.userId, meta.id), { recursive: true, force: true });
}

// Eskirgan seanslarni tozalash — soatiga ko'pi bilan bir marta, yangi seans
// ochilganda. Muddat OXIRGI FAOLLIKDAN (done faylining mtime) hisoblanadi:
// telefonda tunda to'xtab ertasiga davom etgan yuklash o'chirilmasin.
let lastSweep = 0;
export async function sweepStaleSessions(now = Date.now(), force = false): Promise<number> {
  if (!force && now - lastSweep < 60 * 60 * 1000) return 0;
  lastSweep = now;
  let removed = 0;
  let users: string[] = [];
  try { users = await readdir(PARTS_DIR); } catch { return 0; }

  for (const u of users) {
    if (!USER_RE.test(u)) continue;
    let entries: string[] = [];
    try { entries = await readdir(userDir(u)); } catch { continue; }
    for (const name of entries) {
      const dir = path.join(userDir(u), name);
      const dirAge = async () => now - (await stat(dir)).mtimeMs;
      try {
        if (name.endsWith(".tmp") || !ID_RE.test(name)) {
          // yarim yaratilgan — faqat eski bo'lsa
          if ((await dirAge()) > ORPHAN_GRACE_MS) { await rm(dir, { recursive: true, force: true }); removed++; }
          continue;
        }
        const meta = await readMeta(u, name);
        if (!meta) {
          if ((await dirAge()) > ORPHAN_GRACE_MS) { await rm(dir, { recursive: true, force: true }); removed++; }
          continue;
        }
        const done = await sessionResult(meta);
        if (done) {
          if (now - done.completedAt > COMPLETED_KEEP_MS) { await rm(dir, { recursive: true, force: true }); removed++; }
          continue;
        }
        const lastActive = await stat(donePath(meta)).then((s) => s.mtimeMs).catch(() => meta.createdAt);
        const idle = now - Math.max(lastActive, meta.createdAt);
        if (idle > UPLOAD_SESSION_TTL_MS || now - meta.createdAt > HARD_TTL_MS) {
          await rm(dir, { recursive: true, force: true });
          removed++;
        }
      } catch {
        // o'qib bo'lmadi — keyingi safar
      }
    }
    // bo'shab qolgan foydalanuvchi papkasi
    try { if ((await readdir(userDir(u))).length === 0) await rm(userDir(u), { recursive: true, force: true }); } catch { /* bo'sh emas */ }
  }
  return removed;
}
