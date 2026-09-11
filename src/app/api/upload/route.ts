import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MAX_FORM_UPLOAD_BYTES, MAX_FORM_UPLOAD_MB } from "@/lib/upload";

export const runtime = "nodejs";

const EXT: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv", "video/ogg": "ogv",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf",
  // Hujjatlar — lug'at va topshiriq fayllari
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "application/rtf": "rtf",
};

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Kengaytmani MIME yoki fayl nomidan aniqlaymiz
function extFor(mime: string, name: string): string {
  const nameExt = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return EXT[mime] || (nameExt && nameExt.length <= 5 ? nameExt : "bin");
}

/**
 * Ikki rejim:
 *   • multipart/form-data — kichik fayllar (rasm, PDF). formData() butun
 *     faylni xotiraga oladi, shuning uchun MAX_FORM_UPLOAD_MB bilan cheklangan.
 *   • boshqa Content-Type — OQIM rejimi (video). So'rov tanasi to'g'ridan-to'g'ri
 *     diskka yoziladi, xotiraga tushmaydi; fayl nomi X-File-Name sarlavhasida.
 *     Chegara MAX_UPLOAD_MB (5 GB).
 */
export async function POST(req: NextRequest) {
  try {
    await requireSession(); // faqat tizimga kirganlar
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  return contentType.startsWith("multipart/form-data") ? handleMultipart(req) : handleStream(req, contentType);
}

// ── Oqim rejimi (video) ──
async function handleStream(req: NextRequest, contentType: string) {
  // Hajm oldindan ma'lum bo'lsa — bir bayt ham o'qimasdan rad etamiz
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "too_large", maxMb: MAX_UPLOAD_MB }, { status: 413 });
  }
  if (!req.body) return NextResponse.json({ error: "no_file" }, { status: 400 });

  let origName = "";
  try { origName = decodeURIComponent(req.headers.get("x-file-name") || ""); } catch { origName = ""; }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fname = `${randomUUID()}.${extFor(contentType.split(";")[0].trim(), origName)}`;
  const dest = path.join(UPLOAD_DIR, fname);

  // Content-Length yolg'on yoki yo'q bo'lishi mumkin — yozish davomida ham sanaymiz
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES) return cb(new Error("too_large"));
      cb(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(req.body as unknown as NodeReadableStream),
      limiter,
      createWriteStream(dest),
    );
  } catch (e) {
    await unlink(dest).catch(() => {}); // yarim yozilgan fayl qolmasin
    if (e instanceof Error && e.message === "too_large") {
      return NextResponse.json({ error: "too_large", maxMb: MAX_UPLOAD_MB }, { status: 413 });
    }
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  if (received === 0) {
    await unlink(dest).catch(() => {});
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, url: `/uploads/${fname}`, name: origName, size: received });
}

// ── Multipart rejimi (rasm, PDF, hujjat) ──
async function handleMultipart(req: NextRequest) {
  // formData() butun tanani xotiraga oladi — katta so'rovni o'qimasdan rad etamiz
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_FORM_UPLOAD_BYTES) {
    return NextResponse.json({ error: "too_large", maxMb: MAX_FORM_UPLOAD_MB }, { status: 413 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_FORM_UPLOAD_BYTES) {
    return NextResponse.json({ error: "too_large", maxMb: MAX_FORM_UPLOAD_MB }, { status: 413 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fname = `${randomUUID()}.${extFor(file.type, file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, fname), buf);

  return NextResponse.json({ ok: true, url: `/uploads/${fname}`, name: file.name, size: file.size });
}
