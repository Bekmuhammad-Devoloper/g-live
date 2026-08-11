import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";

// Softphone "Tarix" bo'limi — joriy operatorning so'nggi qo'ng'iroqlari (qidiruv bilan).
const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";

  const calls = await prisma.call.findMany({
    where: {
      operatorId: s.userId,
      ...(q ? { OR: [{ phone: { contains: q } }, { contactName: { contains: q } }] } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 30,
    select: {
      id: true, direction: true, status: true, phone: true, contactName: true,
      duration: true, startedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    calls: calls.map((c) => ({ ...c, startedAt: c.startedAt.toISOString() })),
  });
}