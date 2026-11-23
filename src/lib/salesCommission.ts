import "server-only";
import { prisma } from "./db";

export interface FirstPayment {
  managerId: string;
  studentId: string;
  amount: number;
  paidAt: Date;
}

export interface MonthCommission {
  students: number;
  base: number;
}

export function parsePercent(raw: unknown): number | null {
  const t = String(raw ?? "").trim().replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export const commissionOf = (base: number, percent: number) => Math.round((base * Math.max(0, percent)) / 100);

export const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

export async function firstPaymentsByManager(managerIds: string[]): Promise<FirstPayment[]> {
  if (managerIds.length === 0) return [];
  const leads = await prisma.lead.findMany({
    where: { managerId: { in: managerIds }, studentId: { not: null } },
    select: { managerId: true, studentId: true },
  });
  const managerOf = new Map<string, string>();
  for (const l of leads) if (l.studentId && l.managerId) managerOf.set(l.studentId, l.managerId);
  if (managerOf.size === 0) return [];

  const payments = await prisma.payment.findMany({
    where: { studentId: { in: [...managerOf.keys()] }, status: "PAID", amount: { gt: 0 } },
    orderBy: { createdAt: "asc" },
    select: { studentId: true, amount: true, createdAt: true },
  });
  const seen = new Set<string>();
  const out: FirstPayment[] = [];
  for (const p of payments) {
    if (seen.has(p.studentId)) continue;
    seen.add(p.studentId);
    out.push({ managerId: managerOf.get(p.studentId)!, studentId: p.studentId, amount: p.amount, paidAt: p.createdAt });
  }
  return out;
}

export async function commissionByManagerMonth(managerIds: string[]): Promise<Map<string, Map<string, MonthCommission>>> {
  const out = new Map<string, Map<string, MonthCommission>>();
  for (const it of await firstPaymentsByManager(managerIds)) {
    const byMonth = out.get(it.managerId) ?? new Map<string, MonthCommission>();
    const k = monthKey(it.paidAt);
    const cur = byMonth.get(k) ?? { students: 0, base: 0 };
    cur.students += 1;
    cur.base += it.amount;
    byMonth.set(k, cur);
    out.set(it.managerId, byMonth);
  }
  return out;
}

export function monthCommission(map: Map<string, Map<string, MonthCommission>>, userId: string, d: Date): MonthCommission {
  return map.get(userId)?.get(monthKey(d)) ?? { students: 0, base: 0 };
}

export function totalCommission(map: Map<string, Map<string, MonthCommission>>, userId: string): MonthCommission {
  const out = { students: 0, base: 0 };
  for (const v of map.get(userId)?.values() ?? []) {
    out.students += v.students;
    out.base += v.base;
  }
  return out;
}
