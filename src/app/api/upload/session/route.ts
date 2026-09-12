import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { chunkSizeFor, MAX_CHUNK_BYTES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MIN_CHUNK_BYTES } from "@/lib/upload";
import { openOrCreateSession, sweepStaleSessions } from "@/lib/uploadSessions";

export const runtime = "nodejs";

// Bo'lakli yuklashni boshlash: mijoz fayl haqida aytadi, biz seans ochamiz
// (yoki xuddi shu fayl uchun mavjudini qaytaramiz). Keyin bo'laklar
// /api/upload/session/<id>?i=N ga PUT bilan keladi.
//
//   POST { name, type, size, chunkSize?, fp? }
//     → { id, chunkSize, chunks, received: number[], completed?: { url } }

/** Tana chegarasi: bu JSON bir necha yuz bayt — nginx 5g ruxsat bersa ham
 *  xotiraga chegarasiz o'qimaymiz (req.json() butun tanani yig'ib olardi) */
const MAX_JSON_BYTES = 4 * 1024;

async function readJsonCapped(req: NextRequest): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES || !req.body) return null;
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await readJsonCapped(req)) as { name?: unknown; type?: unknown; size?: unknown; chunkSize?: unknown; fp?: unknown } | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid" }, { status: 400 });

  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "too_large", maxMb: MAX_UPLOAD_MB }, { status: 413 });

  // Mijoz taklif qilgan bo'lak hajmi (tarmog'iga qarab) chegarada bo'lsa
  // qabul, aks holda hajmga qarab o'zimiz tanlaymiz
  const wanted = Number(body.chunkSize);
  const chunkSize = Number.isFinite(wanted) && wanted >= MIN_CHUNK_BYTES && wanted <= MAX_CHUNK_BYTES ? Math.floor(wanted) : chunkSizeFor(size);

  await sweepStaleSessions().catch(() => {});

  try {
    const r = await openOrCreateSession({
      userId: s.userId,
      name: typeof body.name === "string" ? body.name : "",
      type: typeof body.type === "string" ? body.type : "application/octet-stream",
      size,
      chunkSize,
      fp: typeof body.fp === "string" ? body.fp : null,
    });
    return NextResponse.json({
      id: r.meta.id,
      chunkSize: r.meta.chunkSize,
      chunks: r.meta.chunks,
      received: r.received,
      ...(r.done ? { completed: { url: r.done.url, name: r.done.name, size: r.done.size } } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "too_many") return NextResponse.json({ error: "too_many" }, { status: 429 });
    if (msg === "bad_size" || msg === "bad_chunk" || msg === "bad_user") return NextResponse.json({ error: "invalid" }, { status: 400 });
    console.error("[upload/session] open:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
