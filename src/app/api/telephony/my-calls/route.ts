import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";

const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

const MISSED: Prisma.CallWhereInput = {
  OR: [{ status: "MISSED" }, { direction: "INCOMING", status: { in: ["NO_ANSWER", "BUSY"] } }],
};

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(s.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim() || "";
  const missed = sp.get("view") === "missed";
  const search: Prisma.CallWhereInput = q ? { OR: [{ phone: { contains: q } }, { contactName: { contains: q } }] } : {};
  const branchScope: Prisma.CallWhereInput = s.branchId
    ? { OR: [{ operator: branchWhere(s) }, { operatorId: null }] }
    : {};
  const where: Prisma.CallWhereInput = missed
    ? { AND: [MISSED, branchScope, search] }
    : { AND: [{ operatorId: s.userId }, search] };

  const [calls, pending] = await Promise.all([
    prisma.call.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: missed ? 50 : 30,
      select: {
        id: true, direction: true, status: true, phone: true, contactName: true,
        duration: true, startedAt: true, callbackStatus: true, operatorName: true,
        lead: { select: { fullName: true } },
      },
    }),
    prisma.call.count({ where: { AND: [MISSED, branchScope, { callbackStatus: "PENDING" }] } }),
  ]);

  return NextResponse.json({
    ok: true,
    pending,
    calls: calls.map(({ lead, ...c }) => ({
      ...c,
      contactName: c.contactName ?? lead?.fullName ?? null,
      startedAt: c.startedAt.toISOString(),
    })),
  });
}
