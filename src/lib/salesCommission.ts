import "server-only";
import { prisma } from "./db";
import { ROLES } from "./constants";

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

export type CommissionMap = Map<string, Map<string, MonthCommission>>;

interface SalesOwner {
  ownerId: string;
  since: Date;
  until?: Date;
}

const OWNER_ROLES: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.ADMIN];
const DAY = 86_400_000;
const CHUNK = 500;
const DIRECT_STUDENT_DAYS = 31;
const AUTO_NOTES = [/^Arxiv(ga tashlandi|dan qaytarildi)/, /^Yangiga qaytarildi/];

export const isAutoNote = (text: string | null | undefined): boolean => !!text && AUTO_NOTES.some((re) => re.test(text.trim()));

export function parsePercent(raw: unknown): number | null {
  const t = String(raw ?? "").trim().replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export const commissionOf = (base: number, percent: number) => Math.round((base * Math.max(0, percent)) / 100);

export const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

function addTo(map: CommissionMap, userId: string, d: Date, amount: number) {
  const byMonth = map.get(userId) ?? new Map<string, MonthCommission>();
  const k = monthKey(d);
  const cur = byMonth.get(k) ?? { students: 0, base: 0 };
  cur.students += 1;
  cur.base += amount;
  byMonth.set(k, cur);
  map.set(userId, byMonth);
}

export async function salesOwnerByStudent(): Promise<Map<string, SalesOwner>> {
  const staff = await prisma.user.findMany({ where: { role: { in: OWNER_ROLES } }, select: { id: true } });
  const out = new Map<string, SalesOwner>();
  if (staff.length === 0) return out;
  const staffIds = staff.map((u) => u.id);
  const staffSet = new Set(staffIds);
  const converted = { studentId: { not: null } };
  const [leads, acts, calls] = await Promise.all([
    prisma.lead.findMany({ where: converted, select: { id: true, studentId: true, managerId: true, createdAt: true } }),
    prisma.leadActivity.findMany({
      where: { authorId: { in: staffIds }, lead: converted },
      select: { leadId: true, authorId: true, createdAt: true, result: true },
    }),
    prisma.call.findMany({
      where: { operatorId: { in: staffIds }, lead: converted },
      select: { leadId: true, operatorId: true, startedAt: true },
    }),
  ]);
  const first = new Map<string, { id: string; at: Date }>();
  const consider = (leadId: string | null, userId: string | null, at: Date) => {
    if (!leadId || !userId) return;
    const cur = first.get(leadId);
    if (!cur || at < cur.at) first.set(leadId, { id: userId, at });
  };
  for (const a of acts) if (!isAutoNote(a.result)) consider(a.leadId, a.authorId, a.createdAt);
  for (const c of calls) consider(c.leadId, c.operatorId, c.startedAt);
  for (const l of leads) {
    if (!l.studentId) continue;
    const ownerId = first.get(l.id)?.id ?? (l.managerId && staffSet.has(l.managerId) ? l.managerId : null);
    if (ownerId) out.set(l.studentId, { ownerId, since: l.createdAt });
  }
  const direct = await prisma.auditLog.findMany({
    where: { entityType: "Student", action: "CREATE", actorId: { in: staffIds } },
    select: { entityId: true, actorId: true, createdAt: true },
  });
  for (const a of direct) {
    if (!a.entityId || !a.actorId || out.has(a.entityId)) continue;
    out.set(a.entityId, { ownerId: a.actorId, since: a.createdAt, until: new Date(a.createdAt.getTime() + DIRECT_STUDENT_DAYS * DAY) });
  }
  return out;
}

export async function firstPaymentsByManager(managerIds: string[]): Promise<FirstPayment[]> {
  if (managerIds.length === 0) return [];
  const wanted = new Set(managerIds);
  const mine = new Map<string, SalesOwner>();
  for (const [studentId, o] of await salesOwnerByStudent()) if (wanted.has(o.ownerId)) mine.set(studentId, o);
  if (mine.size === 0) return [];

  const ids = [...mine.keys()];
  const firstPay = new Map<string, { amount: number; createdAt: Date }>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const payments = await prisma.payment.findMany({
      where: { studentId: { in: ids.slice(i, i + CHUNK) }, status: "PAID", amount: { gt: 0 } },
      orderBy: { createdAt: "asc" },
      select: { studentId: true, amount: true, createdAt: true },
    });
    for (const p of payments) if (!firstPay.has(p.studentId)) firstPay.set(p.studentId, { amount: p.amount, createdAt: p.createdAt });
  }

  const out: FirstPayment[] = [];
  for (const [studentId, p] of firstPay) {
    const o = mine.get(studentId)!;
    if (p.createdAt.getTime() < o.since.getTime() - DAY) continue;
    if (o.until && p.createdAt.getTime() > o.until.getTime()) continue;
    out.push({ managerId: o.ownerId, studentId, amount: p.amount, paidAt: p.createdAt });
  }
  return out;
}

export async function commissionByManagerMonth(managerIds: string[]): Promise<CommissionMap> {
  const out: CommissionMap = new Map();
  for (const it of await firstPaymentsByManager(managerIds)) addTo(out, it.managerId, it.paidAt, it.amount);
  return out;
}

export async function collectionsByAuthorMonth(authorIds: string[]): Promise<CommissionMap> {
  const out: CommissionMap = new Map();
  if (authorIds.length === 0) return out;
  const payments = await prisma.payment.findMany({
    where: { authorId: { in: authorIds }, status: "PAID", amount: { gt: 0 } },
    select: { authorId: true, amount: true, createdAt: true },
  });
  for (const p of payments) if (p.authorId) addTo(out, p.authorId, p.createdAt, p.amount);
  return out;
}

export function monthCommission(map: CommissionMap, userId: string, d: Date): MonthCommission {
  return map.get(userId)?.get(monthKey(d)) ?? { students: 0, base: 0 };
}

export function totalCommission(map: CommissionMap, userId: string): MonthCommission {
  const out = { students: 0, base: 0 };
  for (const v of map.get(userId)?.values() ?? []) {
    out.students += v.students;
    out.base += v.base;
  }
  return out;
}
