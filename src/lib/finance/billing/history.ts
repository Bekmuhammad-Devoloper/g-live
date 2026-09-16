// Finance V2 — o'quvchi TARIXI: guruh a'zoligi (GroupStudentHistory, D4) va
// holat (StudentStatusHistory, S4). Billing shu tarixga tayanadi, `GroupStudent`
// va `Student.eduStatus` esa operatsion holat.
//
// Mexanizm — SINXRONIZATSIYA: joriy operatsion holat tarix bilan solishtiriladi,
// farq bo'lsa interval yopiladi/ochiladi. Legacy action'lardagi hook'lar
// (`syncStudentHistory`) yozuvdan darhol keyin chaqiradi (aniq vaqt bilan);
// billing esa xavfsizlik uchun har hisobdan oldin yana chaqiradi. Cutover'dan
// oldin boshlangan intervallar INFERRED (moliyaviy fakt emas — salary uchun
// ishlatilmaydi, faqat billing/ko'rish).

import type { FinanceDb } from "../db";
import { financeAudit } from "../audit";
import { FinanceError } from "../errors";
import { cutoverAtFrom } from "../cutover";
import { isWithin, monthEnd, monthStart, tashkentYearMonth, type YearMonth } from "../period";

export interface Interval<T = string> {
  key: T;
  from: Date;
  to: Date | null;
  source: string;
}

export interface SyncOptions {
  /** O'zgarish vaqti (default: hozir) */
  at?: Date;
  actorId?: string | null;
  cutoverAt?: Date;
}

/** Cutover: berilmasa `Setting finance.v2.cutoverAt` (tranzaksiya orqali) — konstanta emas, sozlama manba */
const cutoverOf = (db: FinanceDb, o: SyncOptions) => (o.cutoverAt ? Promise.resolve(o.cutoverAt) : cutoverAtFrom(db));

/** Guruh a'zoligi tarixini `GroupStudent` bilan sinxronlaydi; o'zgarish bo'lsa true */
export async function syncMembershipHistory(db: FinanceDb, studentId: string, o: SyncOptions = {}): Promise<boolean> {
  const at = o.at ?? new Date();
  const cutover = await cutoverOf(db, o);
  const [current, history] = await Promise.all([
    db.groupStudent.findMany({ where: { studentId }, select: { groupId: true, joinedAt: true, leftAt: true, isActive: true } }),
    db.groupStudentHistory.findMany({ where: { studentId }, orderBy: { effectiveFrom: "asc" }, select: { id: true, groupId: true, effectiveFrom: true, effectiveTo: true } }),
  ]);
  let changed = false;
  const sourceOf = (from: Date) => (from < cutover ? "INFERRED" : "KNOWN");
  const rowsOf = (groupId: string) => history.filter((h) => h.groupId === groupId);
  const openOf = (groupId: string) => rowsOf(groupId).find((h) => h.effectiveTo === null) ?? null;

  for (const gs of current) {
    const active = gs.isActive && !gs.leftAt;
    const open = openOf(gs.groupId);
    const rows = rowsOf(gs.groupId);
    if (active) {
      if (open) continue;
      // Yangi (yoki qayta) a'zolik: oxirgi yopilgan intervaldan keyin boshlanadi
      const lastClosed = rows.filter((h) => h.effectiveTo !== null).at(-1);
      const from = lastClosed && lastClosed.effectiveTo! > gs.joinedAt ? lastClosed.effectiveTo! : gs.joinedAt;
      await db.groupStudentHistory.create({ data: { studentId, groupId: gs.groupId, effectiveFrom: from, source: sourceOf(from), createdById: o.actorId ?? null } });
      changed = true;
      continue;
    }
    // Chiqqan a'zolik: leftAt (legacy: isActive=false va leftAt yo'q → faqat qo'shilgan oy)
    const to = gs.leftAt ?? monthEnd(tashkentYearMonth(gs.joinedAt));
    if (open) {
      await db.groupStudentHistory.update({ where: { id: open.id }, data: { effectiveTo: to < open.effectiveFrom ? at : to } });
      changed = true;
    } else if (rows.length === 0) {
      // Tarixsiz, allaqachon chiqib ketgan legacy a'zolik — yopiq interval (INFERRED)
      await db.groupStudentHistory.create({ data: { studentId, groupId: gs.groupId, effectiveFrom: gs.joinedAt, effectiveTo: to < gs.joinedAt ? gs.joinedAt : to, source: sourceOf(gs.joinedAt), createdById: o.actorId ?? null } });
      changed = true;
    }
  }
  // GroupStudent qatori o'chirilgan (removeStudent deleteMany) — ochiq interval yopiladi
  const currentGroups = new Set(current.map((g) => g.groupId));
  for (const h of history) {
    if (h.effectiveTo === null && !currentGroups.has(h.groupId)) {
      await db.groupStudentHistory.update({ where: { id: h.id }, data: { effectiveTo: at < h.effectiveFrom ? h.effectiveFrom : at } });
      changed = true;
    }
  }
  return changed;
}

/** Holat tarixini `Student.eduStatus` bilan sinxronlaydi; o'zgarish bo'lsa true */
export async function syncStatusHistory(db: FinanceDb, studentId: string, o: SyncOptions = {}): Promise<boolean> {
  const at = o.at ?? new Date();
  const cutover = await cutoverOf(db, o);
  const student = await db.student.findUnique({ where: { id: studentId }, select: { eduStatus: true, createdAt: true } });
  if (!student) return false;
  const last = await db.studentStatusHistory.findFirst({ where: { studentId }, orderBy: { effectiveFrom: "desc" } });
  if (!last) {
    // Birinchi yozuv: cutover'dan oldin ro'yxatga olingan — INFERRED (holat qachondan ekani noma'lum)
    const from = student.createdAt;
    await db.studentStatusHistory.create({
      data: { studentId, status: student.eduStatus, effectiveFrom: from, reason: from < cutover ? "INFERRED" : null, createdById: o.actorId ?? null },
    });
    return true;
  }
  if (last.status === student.eduStatus) return false;
  const from = at < last.effectiveFrom ? last.effectiveFrom : at;
  await db.studentStatusHistory.update({ where: { id: last.id }, data: { effectiveTo: from } });
  await db.studentStatusHistory.create({ data: { studentId, status: student.eduStatus, effectiveFrom: from, createdById: o.actorId ?? null } });
  return true;
}

/** Ikkalasi birga — legacy action'lardagi hook shu funksiyani chaqiradi (xato legacy oqimni to'xtatmaydi) */
export async function syncStudentHistory(db: FinanceDb, studentId: string, o: SyncOptions = {}): Promise<boolean> {
  const m = await syncMembershipHistory(db, studentId, o);
  const s = await syncStatusHistory(db, studentId, o);
  return m || s;
}

export async function membershipIntervals(db: FinanceDb, studentId: string): Promise<Interval[]> {
  const rows = await db.groupStudentHistory.findMany({ where: { studentId }, orderBy: { effectiveFrom: "asc" } });
  return rows.map((r) => ({ key: r.groupId, from: r.effectiveFrom, to: r.effectiveTo, source: r.source }));
}

export async function statusIntervals(db: FinanceDb, studentId: string): Promise<Interval[]> {
  const rows = await db.studentStatusHistory.findMany({ where: { studentId }, orderBy: { effectiveFrom: "asc" } });
  return rows.map((r) => ({ key: r.status, from: r.effectiveFrom, to: r.effectiveTo, source: r.reason === "INFERRED" ? "INFERRED" : "KNOWN" }));
}

/** Interval xizmat oyiga tegadimi (bir lahza bo'lsa ham) */
export function intervalTouchesMonth(iv: Pick<Interval, "from" | "to">, ym: YearMonth): boolean {
  const s = monthStart(ym);
  const e = monthEnd(ym);
  return iv.from < e && (iv.to === null || iv.to > s);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Interval xizmat oyini TO'LIQ qoplaydimi (S4: to'liq oy FROZEN → charge 0).
 * KUN aniqligida: holat o'zgarishi hook orqali kunning istalgan vaqtida yoziladi — oyning 1-kuni ichida
 * boshlangan va oxirgi kuni ichida tugagan interval ham "butun oy" hisoblanadi (biznes kuni granulyarligi).
 */
export function intervalCoversMonth(iv: Pick<Interval, "from" | "to">, ym: YearMonth): boolean {
  const s = monthStart(ym);
  const e = monthEnd(ym);
  return iv.from.getTime() < s.getTime() + DAY_MS && (iv.to === null || iv.to.getTime() > e.getTime() - DAY_MS);
}

/** Berilgan lahzada faol interval (holat uchun) */
export function intervalAt<T>(ivs: Interval<T>[], at: Date): Interval<T> | null {
  return ivs.find((iv) => isWithin(at, iv.from, iv.to)) ?? null;
}

/**
 * A'zolik boshlanish oyini tuzatish (buxgalter): o'quvchi aslida ertaroq o'qiy boshlagan — `GroupStudent.joinedAt`
 * va ochiq tarix intervali boshi oy boshiga ko'chiriladi (KNOWN, sabab audit'da). Faqat ORQAGA (ertaroqqa);
 * keyin `syncStudentBilling` o'tgan oylar charge'larini yaratadi (keraksizlari bekor qilinadi — auditli).
 */
export async function setMembershipStart(db: FinanceDb, i: { studentId: string; groupId: string; from: Date; actorId?: string | null; reason: string }): Promise<{ previousFrom: Date; from: Date }> {
  if (i.reason.trim().length < 3) throw new FinanceError("validation", "Sabab kamida 3 belgi");
  const gs = await db.groupStudent.findFirst({ where: { studentId: i.studentId, groupId: i.groupId }, orderBy: { joinedAt: "asc" } });
  if (!gs) throw new FinanceError("not_found", "A'zolik topilmadi");
  if (!gs.isActive || gs.leftAt) throw new FinanceError("state", "Faqat faol a'zolik boshlanishi tuzatiladi");
  const open = await db.groupStudentHistory.findFirst({ where: { studentId: i.studentId, groupId: i.groupId, effectiveTo: null }, orderBy: { effectiveFrom: "desc" } });
  const previousFrom = open?.effectiveFrom ?? gs.joinedAt;
  if (i.from >= previousFrom) throw new FinanceError("validation", "Yangi boshlanish hozirgisidan ERTAROQ bo'lishi kerak (kechroqqa ko'chirish — a'zolikni tugatib qayta qo'shing)", { previousFrom: previousFrom.toISOString() });
  await db.groupStudent.update({ where: { id: gs.id }, data: { joinedAt: i.from } });
  if (open) await db.groupStudentHistory.update({ where: { id: open.id }, data: { effectiveFrom: i.from, source: "KNOWN", note: `Boshlanish tuzatildi: ${i.reason.trim()}` } });
  else await db.groupStudentHistory.create({ data: { studentId: i.studentId, groupId: i.groupId, effectiveFrom: i.from, source: "KNOWN", createdById: i.actorId ?? null, note: i.reason.trim() } });
  await financeAudit(db, { actorId: i.actorId, action: "UPDATE", entityType: "GroupStudentHistory", entityId: open?.id ?? null, oldValue: { effectiveFrom: previousFrom.toISOString() }, newValue: { effectiveFrom: i.from.toISOString(), groupId: i.groupId, studentId: i.studentId }, reason: i.reason });
  return { previousFrom, from: i.from };
}
