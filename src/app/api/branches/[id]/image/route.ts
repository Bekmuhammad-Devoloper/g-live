import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { staticBranchImage } from "@/lib/branchImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Filial rasmi — ochiq ariza sahifasi (/apply) filial tanlanganda orqa fon qiladi.
// 1) Branch.imageUrl (galereyadan yuklangan data URL) — HTML ichiga qo'ymasdan
//    shu yerdan oddiy rasm sifatida beriladi;
// 2) yuklanmagan bo'lsa — public/branches/<slug>.jpg tayyor fayl (src/lib/branchImage.ts).
// Login talab qilinmaydi — filial surati.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await prisma.branch.findUnique({ where: { id }, select: { name: true, imageUrl: true, isActive: true } });
  if (!b?.isActive) return new NextResponse(null, { status: 404 });

  const headers = { "Cache-Control": "public, max-age=3600" };

  const m = b.imageUrl ? /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(b.imageUrl) : null;
  if (m) {
    const body = Buffer.from(m[2], "base64");
    return new NextResponse(body, { headers: { ...headers, "Content-Type": m[1], "Content-Length": String(body.length) } });
  }

  const file = staticBranchImage(b.name);
  if (!file) return new NextResponse(null, { status: 404 });
  const body = await readFile(file);
  return new NextResponse(body, { headers: { ...headers, "Content-Type": "image/jpeg", "Content-Length": String(body.length) } });
}
