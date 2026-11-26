"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canSeeTeamReports, canEditFinance } from "@/lib/rbac";
import { staffBranchWhere } from "@/lib/branchScope";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/constants";
import { firstPaymentIds, firstPaymentsByManager, leadOwners, parsePercent, salesOwnerByStudent } from "@/lib/salesCommission";

export type KpiPayState = { ok?: boolean; error?: string };

export async function saveKpiPay(userId: string, fiksa: number, kpiPercent: number, collectPercent?: number): Promise<KpiPayState> {
  const s = await requireSession();
  if (!canEditFinance(s.role)) return { error: "forbidden" };
  if (!userId) return { error: "invalid" };

  const f = parseMoney(fiksa);
  const b = parsePercent(kpiPercent) ?? 0;
  const c = collectPercent === undefined ? undefined : parsePercent(collectPercent) ?? 0;
  if (f === null || b === null) return { error: "invalid" };

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, role: true, fiksa: true, kpiPercent: true, collectPercent: true } });
  if (!before) return { error: "notfound" };

  await prisma.user.update({ where: { id: userId }, data: { fiksa: f, kpiPercent: b, ...(c !== undefined && before.role === "ADMIN" ? { collectPercent: c } : {}) } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    oldValue: { fiksa: before.fiksa, kpiPercent: before.kpiPercent, collectPercent: before.collectPercent },
    newValue: { fiksa: f, kpiPercent: b, ...(c !== undefined ? { collectPercent: c } : {}) },
    reason: `KPI to'lovi yangilandi (${before.fullName})`,
  });

  revalidatePath("/reports/kpi");
  revalidatePath("/users");
  return { ok: true };
}

export interface KpiDetailLead { id: string; name: string; phone: string; stage: string; createdAt: string }
export interface KpiDetailDirect { studentId: string; name: string; createdAt: string }
export interface KpiDetailPay { studentId: string; name: string; amount: number; paidAt: string; leadId: string | null }
export interface KpiDetailColl { id: string; studentId: string; name: string; amount: number; method: string; createdAt: string }
export interface KpiDetails {
  role: string;
  kpiPercent: number;
  collectPercent: number;
  leads: KpiDetailLead[];
  direct: KpiDetailDirect[];
  paid: KpiDetailPay[];
  collections: KpiDetailColl[];
}

const CHUNK = 500;

async function inChunks<T>(ids: string[], run: (part: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(...(await run(ids.slice(i, i + CHUNK))));
  return out;
}

export async function getKpiDetails(userId: string): Promise<{ data?: KpiDetails; error?: string }> {
  const s = await requireSession();
  if (!canSeeTeamReports(s.role)) return { error: "forbidden" };
  const u = await prisma.user.findFirst({ where: { AND: [{ id: userId }, staffBranchWhere(s)] }, select: { id: true, role: true, kpiPercent: true, collectPercent: true } });
  if (!u) return { error: "notfound" };

  const [owned, owners] = await Promise.all([leadOwners(), salesOwnerByStudent()]);
  const mine = owned.filter((l) => l.ownerId === u.id);
  const leadByStudent = new Map(mine.filter((l) => l.studentId).map((l) => [l.studentId as string, l.id]));
  const directIds = [...owners].filter(([, o]) => o.ownerId === u.id && o.until).map(([sid]) => sid);
  const firsts = await firstPaymentsByManager([u.id], owners);

  const [leadRows, directRows, paidStudents, coll] = await Promise.all([
    inChunks(mine.map((l) => l.id), (part) => prisma.lead.findMany({ where: { id: { in: part } }, select: { id: true, fullName: true, phone: true, stage: true, createdAt: true } })),
    inChunks(directIds, (part) => prisma.student.findMany({ where: { id: { in: part } }, select: { id: true, fullName: true, createdAt: true } })),
    inChunks(firsts.map((f) => f.studentId), (part) => prisma.student.findMany({ where: { id: { in: part } }, select: { id: true, fullName: true } })),
    u.role === "ADMIN"
      ? prisma.payment.findMany({
          where: { authorId: u.id, status: "PAID", amount: { gt: 0 } },
          orderBy: { createdAt: "desc" },
          take: 3000,
          select: { id: true, studentId: true, amount: true, method: true, createdAt: true, student: { select: { fullName: true } } },
        })
      : Promise.resolve([]),
  ]);
  const nameOf = new Map(paidStudents.map((st) => [st.id, st.fullName]));
  const firstIds = await firstPaymentIds(coll.map((c) => c.studentId));

  return {
    data: {
      role: u.role,
      kpiPercent: u.kpiPercent,
      collectPercent: u.role === "ADMIN" ? u.collectPercent : 0,
      leads: leadRows
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, stage: l.stage, createdAt: l.createdAt.toISOString() })),
      direct: directRows
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((d) => ({ studentId: d.id, name: d.fullName, createdAt: d.createdAt.toISOString() })),
      paid: firsts
        .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
        .map((f) => ({ studentId: f.studentId, name: nameOf.get(f.studentId) ?? "—", amount: f.amount, paidAt: f.paidAt.toISOString(), leadId: leadByStudent.get(f.studentId) ?? null })),
      collections: coll.filter((c) => !firstIds.has(c.id)).map((c) => ({ id: c.id, studentId: c.studentId, name: c.student.fullName, amount: c.amount, method: c.method, createdAt: c.createdAt.toISOString() })),
    },
  };
}
