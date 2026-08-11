import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 300 * 1024 * 1024; // 300 MB
const EXT: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv", "video/ogg": "ogv",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest) {
  try {
    await requireSession(); // faqat tizimga kirganlar
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", maxMb: 300 }, { status: 413 });
  }

  // Kengaytmani MIME yoki fayl nomidan aniqlaymiz
  const nameExt = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = EXT[file.type] || (nameExt && nameExt.length <= 5 ? nameExt : "bin");

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const fname = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fname), buf);

  return NextResponse.json({ ok: true, url: `/uploads/${fname}`, name: file.name, size: file.size });
}
