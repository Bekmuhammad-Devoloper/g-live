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

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
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
  const type = TYPES[ext] ?? "application/octet-stream";
  const base = {
    "Content-Type": type,
    // Nomi UUID — mazmuni o'zgarmaydi, uzoq keshlash xavfsiz
    "Cache-Control": "public, max-age=31536000, immutable",
    // Video pleyerga qismlab olish mumkinligini bildiradi
    "Accept-Ranges": "bytes",
  };

  // ── Qismli so'rov (Range) ──
  // Videoni oldinga surish va iOS'da umuman ochilishi shunga bog'liq:
  // pleyer "bytes=..." so'raydi, biz 206 bilan faqat o'sha bo'lakni beramiz.
  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && size > 0) {
    const hasStart = m[1] !== "";
    const hasEnd = m[2] !== "";
    let start: number;
    let end: number;

    if (hasStart) {
      start = Number(m[1]);
      end = hasEnd ? Math.min(Number(m[2]), size - 1) : size - 1;
    } else if (hasEnd) {
      // "bytes=-N" — oxirgi N bayt
      const n = Math.min(Number(m[2]), size);
      start = size - n;
      end = size - 1;
    } else {
      start = 0;
      end = size - 1;
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      return new NextResponse("range_not_satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const part = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new NextResponse(part, {
      status: 206,
      headers: {
        ...base,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, {
    headers: { ...base, "Content-Length": String(size) },
  });
}
