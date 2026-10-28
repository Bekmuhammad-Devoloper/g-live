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
import { extFor, UPLOAD_DIR } from "@/lib/uploadFs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  return contentType.startsWith("multipart/form-data") ? handleMultipart(req) : handleStream(req, contentType);
}

async function handleStream(req: NextRequest, contentType: string) {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "too_large", maxMb: MAX_UPLOAD_MB }, { status: 413 });
  }
  if (!req.body) return NextResponse.json({ error: "no_file" }, { status: 400 });

  let origName = "";
  try { origName = decodeURIComponent(req.headers.get("x-file-name") || ""); } catch { origName = ""; }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fname = `${randomUUID()}.${extFor(contentType, origName)}`;
  const dest = path.join(UPLOAD_DIR, fname);

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
    await unlink(dest).catch(() => {});
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

async function handleMultipart(req: NextRequest) {
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
