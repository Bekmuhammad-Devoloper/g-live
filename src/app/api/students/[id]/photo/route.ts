import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { studentBranchWhere } from "@/lib/branchScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new NextResponse(null, { status: 401 });
  const { id } = await ctx.params;

  const where: Prisma.StudentWhereInput =
    s.role === ROLES.STUDENT ? { id, userId: s.userId }
    : s.role === ROLES.PARENT ? { id, parents: { some: { parent: { userId: s.userId } } } }
    : { id, ...studentBranchWhere(s) };

  const st = await prisma.student.findFirst({ where, select: { imageUrl: true } });
  const m = st?.imageUrl ? /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(st.imageUrl) : null;
  if (!m) return new NextResponse(null, { status: 404 });

  const body = Buffer.from(m[2], "base64");
  return new NextResponse(body, {
    headers: {
      "Content-Type": m[1],
      "Content-Length": String(body.length),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
