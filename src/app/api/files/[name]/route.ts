import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Yuklangan fayllarni berish.
//
// Next.js public/ papkasi ro'yxatini SERVER ISHGA TUSHGANDA o'qiydi, shu
// sabab keyin yuklangan fayl /uploads/... manzilida 404 qaytarardi (rasm
// diskda bor bo'lsa ham ko'rinmasdi). Endi /uploads/* shu yo'lga rewrite
// qilinadi va fayl har so'rovda diskdan o'qiladi.

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
  pdf: "application/pdf",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;

  // Faqat oddiy fayl nomi — papkadan chiqib ketishga yo'l yo'q
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(name) || name.includes("..")) {
    return new NextResponse("bad_name", { status: 400 });
  }

  const file = path.join(process.cwd(), "public", "uploads", name);
  let size: number;
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error("not_a_file");
    size = st.size;
  } catch {
    return new NextResponse("not_found", { status: 404 });
  }

  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(size),
      // Nomi UUID — mazmuni o'zgarmaydi, uzoq keshlash xavfsiz
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
