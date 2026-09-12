import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { abortSession, chunkLength, completeSession, loadSession, receivedChunks, sessionResult, writeChunk } from "@/lib/uploadSessions";

export const runtime = "nodejs";

// Bo'lakli yuklash seansi:
//   GET      → holat: qaysi bo'laklar qabul qilingan (davom etish uchun);
//              yakunlangan bo'lsa completed.url
//   PUT ?i=N → N-bo'lak (tana — baytlarning o'zi)
//   POST     → yakunlash: hamma bo'lak bo'lsa fayl tayyor, url qaytadi
//              (takroriy chaqiruv ham o'sha url — javob yo'qolsa xavfsiz)
//   DELETE   → bekor qilish, yarim fayl o'chadi

type Ctx = { params: Promise<{ id: string }> };

async function auth() {
  try {
    return await requireSession();
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const s = await auth();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const meta = await loadSession(id, s.userId);
  if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const done = await sessionResult(meta);
  return NextResponse.json({
    id: meta.id,
    chunkSize: meta.chunkSize,
    chunks: meta.chunks,
    size: meta.size,
    received: done ? [] : await receivedChunks(meta),
    ...(done ? { completed: { url: done.url, name: done.name, size: done.size } } : {}),
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const s = await auth();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const meta = await loadSession(id, s.userId);
  if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const index = Number(req.nextUrl.searchParams.get("i"));
  if (!Number.isInteger(index) || index < 0 || index >= meta.chunks) return NextResponse.json({ error: "bad_index" }, { status: 400 });

  // Hajm oldindan ma'lum bo'lsa — bir bayt ham o'qimasdan rad etamiz
  const declared = req.headers.get("content-length");
  if (declared !== null && Number(declared) !== chunkLength(meta, index)) {
    return NextResponse.json({ error: "bad_length" }, { status: 400 });
  }
  if (!req.body) return NextResponse.json({ error: "bad_length" }, { status: 400 });

  const r = await writeChunk(meta, index, req.body);
  if (!r.ok) {
    const status = r.error === "write_failed" ? 500 : r.error === "completed" ? 409 : 400;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json({ ok: true, i: index });
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const s = await auth();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const meta = await loadSession(id, s.userId);
  if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const r = await completeSession(meta);
    if (!r.ok) {
      if (r.error === "incomplete") return NextResponse.json({ error: "incomplete", missing: r.missing }, { status: 409 });
      return NextResponse.json({ error: r.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, url: r.url, name: r.name, size: r.size });
  } catch (e) {
    console.error("[upload/session] complete:", e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const s = await auth();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const meta = await loadSession(id, s.userId);
  if (meta) await abortSession(meta);
  return NextResponse.json({ ok: true });
}
