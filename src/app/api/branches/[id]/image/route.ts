import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Filial rasmi — Branch.imageUrl data URL sifatida saqlanadi (galereyadan
// yuklangan). Ochiq ariza sahifasi (/apply) filial tanlanganda rasmni orqa fon
// qiladi; data URL'ni HTML ichiga qo'ymasdan (har filial uchun yuz KB) shu
// yo'ldan oddiy rasm sifatida beramiz. Login talab qilinmaydi — filial surati.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await prisma.branch.findUnique({ where: { id }, select: { imageUrl: true, isActive: true } });
  const m = b?.isActive && b.imageUrl ? /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(b.imageUrl) : null;
  if (!m) return new NextResponse(null, { status: 404 });

  const body = Buffer.from(m[2], "base64");
  return new NextResponse(body, {
    headers: {
      "Content-Type": m[1],
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
