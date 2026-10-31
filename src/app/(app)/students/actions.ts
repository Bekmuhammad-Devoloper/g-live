"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { recordLevelUp } from "@/lib/levelUp";
import { requireSession } from "@/lib/auth";
import { ROLES, EDU_STATUSES, PAYMENT_METHODS } from "@/lib/constants";
import { canWrite, canRead, MODULES } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { getBrand } from "@/lib/brand";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { isPaymentMandatory, UNPAID_GRACE_DAYS } from "@/lib/paymentPolicy";
import { computeDebt } from "@/lib/debt";
import { branchWhere } from "@/lib/branchScope";
import type { GroupOpt } from "../_components/GroupMover";
import { getSetting } from "@/lib/settings";
import { RECEIPT_MODE_KEY, parseReceiptMode, isReceiptRequired } from "@/lib/receiptMode";
import { checkPromoForStudent, activePromoOptions } from "@/lib/promo";
import { leaveGroups } from "@/lib/leaveGroup";
import { syncEduStatuses } from "@/lib/eduStatus";

export type EditState = { ok?: boolean; error?: string };
export type BulkState = { ok?: boolean; error?: string; count?: number };

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];

export interface MonthPay { paid: boolean; amount: number; date: string | null }
export interface PayRow {
  id: string; amount: number; method: string; purpose: string | null; status: string; date: string;
  note: string | null;
  promoCode: string | null;
  discount: number;
  covered?: boolean;
  editable?: boolean;
}
export interface StudentPayments {
  canAdjustDebt: boolean;
  thisMonth: MonthPay;
  lastMonth: MonthPay;
  totalPaid: number;
  lastPaidDate: string | null;
  debt: number;
  credit: number;
  debtMonths: number;
  daysUnpaid: number;
  mandatoryThreshold: number;
  paymentMandatory: boolean;
  joinDate: string | null;
  lastMonthApplicable: boolean;
  recent: PayRow[];
}

export async function getStudentPayments(studentId: string): Promise<{ ok: boolean; data?: StudentPayments; error?: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never) && !canRead(s.role, MODULES.PAYMENTS) && s.role !== ROLES.ROP) return { ok: false, error: "forbidden" };
  if (!studentId) return { ok: false, error: "invalid" };

  const [payments, mandatoryInfo, firstEnrollment, student] = await Promise.all([
    prisma.payment.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, method: true, purpose: true, status: true, createdAt: true, note: true, promoCode: true, discount: true },
    }),
    isPaymentMandatory(studentId),
    prisma.groupStudent.findFirst({ where: { studentId }, orderBy: { joinedAt: "asc" }, select: { joinedAt: true } }),
    prisma.student.findUnique({ where: { id: studentId }, select: { createdAt: true } }),
  ]);

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const lastM = m === 0 ? 11 : m - 1;
  const lastY = m === 0 ? y - 1 : y;
  const paid = payments.filter((p) => p.status === "PAID");

  const monthSummary = (yy: number, mm: number): MonthPay => {
    const ps = paid.filter((p) => p.createdAt.getFullYear() === yy && p.createdAt.getMonth() === mm);
    return { paid: ps.length > 0, amount: ps.reduce((n, p) => n + p.amount, 0), date: ps.length ? ps[0].createdAt.toISOString() : null };
  };

  const thisMonth = monthSummary(y, m);

  const debtInfo = await computeDebt(studentId, now);
  const coveredIds = new Set<string>();
  let remaining = debtInfo.paid + debtInfo.discount - debtInfo.accrued;
  for (const p of [...payments].filter((x) => x.status === "PENDING").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (remaining >= p.amount) { coveredIds.add(p.id); remaining -= p.amount; }
    else break;
  }
  const paymentMandatory = mandatoryInfo.mandatory;

  const joinDate = firstEnrollment?.joinedAt ?? student?.createdAt ?? null;
  const DAY = 86_400_000;
  const lastMonthApplicable = joinDate ? (now.getTime() - joinDate.getTime()) / DAY >= 30 : true;

  return {
    ok: true,
    data: {
      thisMonth,
      lastMonth: monthSummary(lastY, lastM),
      totalPaid: paid.reduce((n, p) => n + p.amount, 0),
      lastPaidDate: paid.length ? paid[0].createdAt.toISOString() : null,
      debt: debtInfo.debt,
      credit: debtInfo.credit,
      debtMonths: debtInfo.overdueMonths,
      daysUnpaid: mandatoryInfo.daysUnpaid,
      mandatoryThreshold: UNPAID_GRACE_DAYS,
      paymentMandatory,
      joinDate: joinDate ? joinDate.toISOString() : null,
      lastMonthApplicable,
      canAdjustDebt: CAN_EDIT_PAY.includes(s.role as never) || (s.role === ROLES.ROP && await ropDebtWindowOpen(studentId)),
      recent: payments.map((p) => ({
        id: p.id, amount: p.amount, method: p.method, purpose: p.purpose, status: p.status, date: p.createdAt.toISOString(), note: p.note,
        promoCode: p.promoCode, discount: p.discount,
        editable: canEditPaymentAt(s.role, p.createdAt),
        ...(p.status === "PENDING" ? { covered: coveredIds.has(p.id) } : {}),
      })),
    },
  };
}

export interface ReceiptData {
  docNumber: string;
  dateIso: string;
  amount: number;
  method: string;
  purpose: string;
  note: string | null;
  promoCode: string | null;
  discount: number;
  studentName: string;
  studentPhone: string | null;
  orgName: string;
  branchName: string | null;
  branchAddress: string | null;
  branchPhone: string | null;
  cashier: string;
  footer: string;
  receiptUrl: string | null;
}

const p2r = (n: number) => String(n).padStart(2, "0");

export async function acceptPayment(
  studentId: string,
  input: { amount: number; method: string; purpose: string; receiptUrl?: string | null; paidAt?: string | null; note?: string | null; promoCode?: string | null; promoForce?: boolean },
): Promise<{ ok: boolean; error?: string; need?: number; have?: number; receipt?: ReceiptData }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS)) return { ok: false, error: "forbidden" };

  const amount = Math.trunc(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "amount" };
  if (!PAYMENT_METHODS.includes(input.method as never)) return { ok: false, error: "method" };
  const purpose = String(input.purpose || "").trim();
  if (purpose.length < 2) return { ok: false, error: "purpose" };
  const note = String(input.note || "").trim().slice(0, 500) || null;
  const receiptUrl = String(input.receiptUrl || "").trim() || null;
  const receiptMode = parseReceiptMode(await getSetting(RECEIPT_MODE_KEY));
  if (isReceiptRequired(receiptMode, input.method) && !receiptUrl) {
    return { ok: false, error: "receipt_required" };
  }

  let paidAt = new Date();
  if (input.paidAt) { const d = new Date(input.paidAt); if (!isNaN(d.getTime())) paidAt = d; }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, phone: true, userId: true, branch: { select: { name: true, address: true, phone: true } } },
  });
  if (!student) return { ok: false, error: "notfound" };

  const promo = await checkPromoForStudent(input.promoCode, studentId, { force: !!input.promoForce });
  if (!promo.ok) return { ok: false, error: promo.error, need: promo.need, have: promo.have };
  const promoCode = promo.code || null;
  const discount = promo.discount;

  const docNumber = `CHK-${paidAt.getFullYear()}${p2r(paidAt.getMonth() + 1)}${p2r(paidAt.getDate())}-${randomUUID().slice(0, 4).toUpperCase()}`;

  const payment = await prisma.payment.create({
    data: { studentId, amount, method: input.method, purpose, note, promoCode, discount, status: "PAID", isManual: true, authorId: s.userId, docNumber, receiptUrl, createdAt: paidAt },
  });

  await writeAudit({
    actorId: s.userId, action: "CREATE", entityType: "Payment", entityId: payment.id,
    newValue: { amount, method: input.method, purpose, note, promoCode, discount, docNumber, isManual: true, ...(promoCode && input.promoForce ? { promoConditionOverridden: true } : {}) },
    reason: "To'lov qabul qilindi (chek)",
  });

  const full = await prisma.student.findUnique({ where: { id: studentId }, include: { parents: { include: { parent: true } } } });
  if (full) {
    const sum = amount.toLocaleString("ru-RU");
    const promoTxt = promoCode ? { uz: ` Promokod ${promoCode}: −${discount.toLocaleString("ru-RU")} so'm.`, ru: ` Промокод ${promoCode}: −${discount.toLocaleString("ru-RU")} сум.`, en: ` Promo ${promoCode}: −${discount.toLocaleString("ru-RU")} UZS.`, de: ` Promo ${promoCode}: −${discount.toLocaleString("ru-RU")} UZS.` } : { uz: "", ru: "", en: "", de: "" };
    const title = { uz: "To'lov qabul qilindi", ru: "Платёж принят", en: "Payment received", de: "Zahlung erhalten" };
    const body = {
      uz: `To'lov qabul qilindi: ${sum} so'm.${promoTxt.uz} Chek № ${docNumber}.`,
      ru: `Платёж принят: ${sum} сум.${promoTxt.ru} Чек № ${docNumber}.`,
      en: `Payment received: ${sum} UZS.${promoTxt.en} Receipt No. ${docNumber}.`,
      de: `Zahlung erhalten: ${sum} UZS.${promoTxt.de} Beleg Nr. ${docNumber}.`,
    };
    if (full.userId) await notify({ userId: full.userId, title, body, event: "payment_success" });
    for (const link of full.parents) if (link.parent.userId) await notify({ userId: link.parent.userId, title, body, event: "payment_success" });
  }

  const cfg = await getSettings(["receipt.orgName", "receipt.footer"]);
  const author = await prisma.user.findUnique({ where: { id: s.userId }, select: { fullName: true } });

  revalidatePath("/students");
  revalidatePath("/payments");

  return {
    ok: true,
    receipt: {
      docNumber,
      dateIso: paidAt.toISOString(),
      amount,
      method: input.method,
      purpose,
      note,
      promoCode,
      discount,
      studentName: student.fullName,
      studentPhone: student.phone,
      orgName: cfg["receipt.orgName"] || (await getBrand()).name,
      branchName: student.branch?.name ?? null,
      branchAddress: student.branch?.address ?? null,
      branchPhone: student.branch?.phone ?? null,
      cashier: author?.fullName ?? "—",
      footer: cfg["receipt.footer"] || "To'lovingiz uchun rahmat!",
      receiptUrl,
    },
  };
}

export async function setStudentImage(studentId: string, dataUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { ok: false, error: "forbidden" };

  let value: string | null = null;
  if (dataUrl) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(dataUrl)) return { ok: false, error: "format" };
    if (dataUrl.length > 900_000) return { ok: false, error: "too_big" };
    value = dataUrl;
  }
  const st = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!st) return { ok: false, error: "notfound" };

  await prisma.student.update({ where: { id: studentId }, data: { imageUrl: value } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Student", entityId: studentId, newValue: { imageUrl: value ? "(rasm)" : null }, reason: value ? "O'quvchi rasmi yuklandi" : "O'quvchi rasmi o'chirildi" });
  revalidatePath("/students");
  return { ok: true };
}

export async function updateStudent(fd: FormData): Promise<EditState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const id = String(fd.get("id") || "").trim();
  if (!id) return { error: "invalid" };

  const fullName = String(fd.get("fullName") || "").trim();
  if (fullName.length < 3) return { error: "invalid" };

  const phone = String(fd.get("phone") || "").trim() || null;
  const currentLevel = String(fd.get("currentLevel") || "").trim() || null;
  const note = String(fd.get("note") || "").trim().slice(0, 2000) || null;
  const eduRaw = String(fd.get("eduStatus") || "").trim();
  const eduStatus = EDU_STATUSES.includes(eduRaw as never) ? eduRaw : undefined;

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) return { error: "invalid" };

  const updated = await prisma.student.update({
    where: { id },
    data: { fullName, phone, currentLevel, note, ...(eduStatus ? { eduStatus } : {}) },
  });
  if (eduStatus && eduStatus !== existing.eduStatus && (eduStatus === "ARCHIVED" || eduStatus === "EXPELLED")) {
    await leaveGroups({ studentId: id, actorId: s.userId, reason: eduStatus === "EXPELLED" ? "O'quvchi chetlatildi" : "O'quvchi arxivlandi" });
  }

  await recordLevelUp(id, existing.currentLevel, currentLevel);

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Student",
    entityId: id,
    oldValue: { fullName: existing.fullName, phone: existing.phone, currentLevel: existing.currentLevel, eduStatus: existing.eduStatus, note: existing.note },
    newValue: { fullName: updated.fullName, phone: updated.phone, currentLevel: updated.currentLevel, eduStatus: updated.eduStatus, note: updated.note },
  });

  revalidatePath("/students");
  return { ok: true };
}

export async function bulkArchiveStudents(ids: string[]): Promise<BulkState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  const clean = ids.filter(Boolean);
  if (!clean.length) return { error: "empty" };

  const res = await prisma.student.updateMany({ where: { id: { in: clean } }, data: { eduStatus: "ARCHIVED" } });
  for (const id of clean) await leaveGroups({ studentId: id, actorId: s.userId, reason: "O'quvchi arxivlandi" });

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Student",
    entityId: clean.join(","),
    newValue: { eduStatus: "ARCHIVED", count: res.count },
    reason: "Ommaviy arxivlash",
  });

  revalidatePath("/students");
  return { ok: true, count: res.count };
}

export async function bulkAssignGroup(ids: string[], groupId: string): Promise<BulkState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  const clean = ids.filter(Boolean);
  if (!clean.length || !groupId) return { error: "empty" };

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true } });
  if (!group) return { error: "invalid" };

  let count = 0;
  for (const studentId of clean) {
    await prisma.groupStudent.upsert({
      where: { groupId_studentId: { groupId, studentId } },
      create: { groupId, studentId, isActive: true },
      update: { isActive: true },
    });
    count++;
  }

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "GroupStudent",
    entityId: group.id,
    newValue: { groupId, students: count },
    reason: `Ommaviy guruhga biriktirish (${group.name})`,
  });
  await syncEduStatuses();

  revalidatePath("/students");
  revalidatePath("/group-students");
  return { ok: true, count };
}

export async function bulkNotifyStudents(ids: string[], message: string): Promise<BulkState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  const clean = ids.filter(Boolean);
  const text = message.trim();
  if (!clean.length) return { error: "empty" };
  if (text.length < 2) return { error: "invalid" };

  const students = await prisma.student.findMany({
    where: { id: { in: clean } },
    include: { parents: { include: { parent: true } } },
  });

  let count = 0;
  for (const st of students) {
    if (st.userId) {
      await notify({
        userId: st.userId,
        title: { uz: "Yangi xabar", ru: "Новое сообщение", en: "New message", de: "Neue Nachricht" },
        body: text,
        event: "bulk_message",
      });
      count++;
    }
    for (const link of st.parents) {
      if (link.parent.userId) {
        await notify({
          userId: link.parent.userId,
          title: { uz: "Farzandingiz bo'yicha xabar", ru: "Сообщение о вашем ребёнке", en: "Message about your child", de: "Nachricht zu Ihrem Kind" },
          body: text,
          event: "bulk_message",
        });
      }
    }
  }

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Notification",
    entityId: clean.join(","),
    newValue: { recipients: count, message: text.slice(0, 120) },
    reason: "Ommaviy xabar yuborish",
  });

  revalidatePath("/students");
  return { ok: true, count };
}

export async function archiveStudent(id: string): Promise<EditState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const st = await prisma.student.findUnique({ where: { id }, select: { fullName: true, eduStatus: true } });
  if (!st) return { error: "notfound" };

  await prisma.student.update({ where: { id }, data: { eduStatus: "ARCHIVED" } });
  await leaveGroups({ studentId: id, actorId: s.userId, reason: "O'quvchi arxivlandi" });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Student",
    entityId: id,
    oldValue: { eduStatus: st.eduStatus },
    newValue: { eduStatus: "ARCHIVED" },
    reason: `O'quvchi arxivlandi: ${st.fullName}`,
  });

  revalidatePath("/students");
  return { ok: true };
}

export async function restoreStudent(id: string): Promise<EditState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const st = await prisma.student.findUnique({
    where: { id },
    select: { fullName: true, enrollments: { where: { isActive: true }, select: { id: true }, take: 1 } },
  });
  if (!st) return { error: "notfound" };

  const next = st.enrollments.length ? "ACTIVE" : "WAITING";
  await prisma.student.update({ where: { id }, data: { eduStatus: next } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Student",
    entityId: id,
    newValue: { eduStatus: next },
    reason: `O'quvchi arxivdan qaytarildi: ${st.fullName}`,
  });
  await syncEduStatuses();

  revalidatePath("/students");
  return { ok: true };
}

export async function deleteStudentPermanently(id: string): Promise<EditState> {
  const s = await requireSession();
  const CAN_PURGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
  if (!CAN_PURGE.includes(s.role as never)) return { error: "forbidden" };

  const st = await prisma.student.findUnique({
    where: { id },
    select: { fullName: true, phone: true, userId: true, _count: { select: { payments: true, attendances: true, enrollments: true } } },
  });
  if (!st) return { error: "notfound" };

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({ where: { studentId: id }, data: { studentId: null } });
    await tx.task.updateMany({ where: { studentId: id }, data: { studentId: null } });
    await tx.payment.deleteMany({ where: { studentId: id } });
    await tx.student.delete({ where: { id } });
    if (st.userId) await tx.user.delete({ where: { id: st.userId } }).catch(() => {});
  });

  await writeAudit({
    actorId: s.userId,
    action: "DELETE",
    entityType: "Student",
    entityId: id,
    oldValue: { fullName: st.fullName, phone: st.phone, ...st._count },
    reason: `O'quvchi MUTLOQ o'chirildi: ${st.fullName}`,
  });

  revalidatePath("/students");
  revalidatePath("/finance");
  return { ok: true };
}

export interface BranchOpt { id: string; name: string }

export async function studentBranchOptions(): Promise<BranchOpt[]> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return [];
  return prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

const WD = ["", "Du", "Se", "Chor", "Pay", "Ju", "Sha", "Ya"];

export async function studentGroupOptions(): Promise<GroupOpt[]> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return [];
  const rows = await prisma.group.findMany({
    where: { AND: [{ status: { in: ["ACTIVE", "PLANNED"] } }, branchWhere(s)] },
    select: {
      id: true, name: true, levelCode: true, capacity: true, weekdays: true, startTime: true, endTime: true,
      program: { select: { name: true } }, teacher: { select: { fullName: true } },
      _count: { select: { students: { where: { isActive: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return rows.map((g) => {
    const days = g.weekdays ? g.weekdays.split(",").map((d) => WD[Number(d)] ?? "").filter(Boolean).join(", ") : "";
    const time = g.startTime ? `${g.startTime}${g.endTime ? "–" + g.endTime : ""}` : "";
    return {
      id: g.id, name: g.name, program: g.program?.name ?? null, level: g.levelCode, students: g._count.students, capacity: g.capacity,
      schedule: [days, time].filter(Boolean).join(" · ") || null, teacher: g.teacher?.fullName ?? null,
    };
  });
}

export async function moveStudentToGroup(
  studentId: string,
  fromGroupId: string | null,
  toGroupId: string,
): Promise<{ ok?: boolean; error?: string; groupName?: string }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const [student, to] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true, eduStatus: true } }),
    prisma.group.findUnique({ where: { id: toGroupId }, select: { id: true, name: true, levelCode: true, capacity: true, _count: { select: { students: { where: { isActive: true } } } } } }),
  ]);
  if (!student) return { error: "notfound" };
  if (!to) return { error: "invalid" };
  if (fromGroupId === toGroupId) return { ok: true, groupName: to.name };

  const already = await prisma.groupStudent.findUnique({ where: { groupId_studentId: { groupId: toGroupId, studentId } }, select: { isActive: true } });
  if (!already?.isActive && to._count.students >= to.capacity) return { error: "full" };

  await prisma.$transaction(async (tx) => {
    if (fromGroupId) {
      await tx.groupStudent.updateMany({ where: { groupId: fromGroupId, studentId, isActive: true }, data: { isActive: false, leftAt: new Date() } });
    }
    await tx.groupStudent.upsert({
      where: { groupId_studentId: { groupId: toGroupId, studentId } },
      create: { groupId: toGroupId, studentId, isActive: true },
      update: { isActive: true, leftAt: null, joinedAt: new Date() },
    });
    await tx.student.update({
      where: { id: studentId },
      data: { ...(to.levelCode ? { currentLevel: to.levelCode } : {}), ...(student.eduStatus === "WAITING" ? { eduStatus: "ACTIVE" } : {}) },
    });
  });

  await writeAudit({
    actorId: s.userId, action: "UPDATE", entityType: "GroupStudent", entityId: studentId,
    oldValue: { groupId: fromGroupId }, newValue: { groupId: toGroupId },
    reason: `Guruhdan guruhga o'tkazildi: ${student.fullName} → ${to.name}`,
  });
  await syncEduStatuses();

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/groups");
  if (fromGroupId) revalidatePath(`/groups/${fromGroupId}`);
  revalidatePath(`/groups/${toGroupId}`);
  return { ok: true, groupName: to.name };
}

export async function moveStudentToBranch(
  studentId: string,
  branchId: string,
): Promise<{ ok?: boolean; error?: string; branchName?: string; removedGroups?: number }> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const [student, branch] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true, branchId: true } }),
    prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (!student) return { error: "notfound" };
  if (!branch || !branch.isActive) return { error: "invalid" };
  if (student.branchId === branchId) return { ok: true, branchName: branch.name, removedGroups: 0 };

  const stale = await prisma.groupStudent.findMany({
    where: { studentId, isActive: true, group: { branchId: { not: branchId } } },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (stale.length) {
      await tx.groupStudent.updateMany({
        where: { id: { in: stale.map((x) => x.id) } },
        data: { isActive: false, leftAt: new Date() },
      });
    }
    await tx.student.update({ where: { id: studentId }, data: { branchId } });
  });

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Student",
    entityId: studentId,
    oldValue: { branchId: student.branchId },
    newValue: { branchId, closedEnrollments: stale.length },
    reason: `O'quvchi boshqa filialga ko'chirildi: ${student.fullName} → ${branch.name}`,
  });
  await syncEduStatuses();

  revalidatePath("/students");
  revalidatePath("/groups");
  return { ok: true, branchName: branch.name, removedGroups: stale.length };
}

const CAN_EDIT_PAY = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.ACCOUNTANT];
const ROP_EDIT_HOURS = 24;
const ropWindow = (from: Date) => Date.now() - from.getTime() < ROP_EDIT_HOURS * 3_600_000;
function canEditPaymentAt(role: string, createdAt: Date): boolean {
  return CAN_EDIT_PAY.includes(role as never) || (role === ROLES.ROP && ropWindow(createdAt));
}
async function ropDebtWindowOpen(studentId: string): Promise<boolean> {
  const last = await prisma.groupStudent.findFirst({ where: { studentId }, orderBy: { joinedAt: "desc" }, select: { joinedAt: true } });
  return !!last && ropWindow(last.joinedAt);
}

export async function adjustStudentDebt(
  studentId: string,
  input: { newDebt: number; reason: string },
): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN_EDIT_PAY.includes(s.role as never) && !(s.role === ROLES.ROP && await ropDebtWindowOpen(studentId))) return { error: "forbidden" };

  const target = Math.trunc(Number(input.newDebt));
  if (!Number.isFinite(target) || target < 0) return { error: "amount" };
  const reason = String(input.reason || "").trim().slice(0, 300);
  if (reason.length < 3) return { error: "reason" };

  const st = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!st) return { error: "notfound" };

  const cur = await computeDebt(studentId, new Date());
  const currentNet = cur.debt > 0 ? cur.debt : -cur.credit;
  const diff = target - currentNet;
  if (diff === 0) return { ok: true };

  const pay = await prisma.payment.create({
    data: {
      studentId,
      amount: diff,
      method: "ADJUST",
      status: "ADJUST",
      isManual: true,
      purpose: "Qarz tuzatish",
      note: reason,
      authorId: s.userId,
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "StudentDebt",
    entityId: studentId,
    oldValue: { debt: cur.debt, credit: cur.credit },
    newValue: { debt: target, adjustment: diff, paymentId: pay.id },
    reason,
  });

  revalidatePath("/students");
  revalidatePath("/finance/debtors");
  revalidatePath("/crm");
  return { ok: true };
}

export async function addStudentDebt(
  studentId: string,
  input: { amount: number; purpose?: string; dateIso?: string | null; reason?: string },
): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS) && !ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const amount = Math.trunc(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "amount" };
  const reason = String(input.reason || "").trim().slice(0, 300);
  if (reason.length < 3) return { error: "reason" };

  const st = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true } });
  if (!st) return { error: "notfound" };

  let createdAt = new Date();
  if (input.dateIso) { const d = new Date(input.dateIso); if (!isNaN(d.getTime())) createdAt = d; }

  const pay = await prisma.payment.create({
    data: {
      studentId,
      amount,
      method: "CASH",
      status: "PENDING",
      isManual: true,
      purpose: String(input.purpose || "").trim() || "Qarz",
      authorId: s.userId,
      createdAt,
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Payment",
    entityId: pay.id,
    newValue: { studentId, amount, status: "PENDING" },
    reason: reason,
  });

  revalidatePath("/students");
  revalidatePath("/finance/debtors");
  return { ok: true };
}

export async function updatePaymentRecord(
  paymentId: string,
  input: { amount?: number; method?: string; purpose?: string; status?: string; dateIso?: string | null; note?: string | null; promoCode?: string | null },
  reason = "",
): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN_EDIT_PAY.includes(s.role as never) && s.role !== ROLES.ROP) return { error: "forbidden" };
  const why = String(reason || "").trim().slice(0, 300);
  if (why.length < 3) return { error: "reason" };

  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, studentId: true, amount: true, method: true, purpose: true, status: true, createdAt: true, promoCode: true, discount: true },
  });
  if (!existing) return { error: "notfound" };
  if (!canEditPaymentAt(s.role, existing.createdAt)) return { error: "forbidden" };
  if (existing.status === "ADJUST") return { error: "forbidden" };

  const data: Record<string, unknown> = {};
  if (input.amount !== undefined) {
    const a = Math.trunc(Number(input.amount));
    if (!Number.isFinite(a) || a <= 0) return { error: "amount" };
    data.amount = a;
  }
  if (input.method !== undefined) {
    if (!PAYMENT_METHODS.includes(input.method as never)) return { error: "method" };
    data.method = input.method;
  }
  if (input.purpose !== undefined) data.purpose = String(input.purpose).trim().slice(0, 200) || null;
  if (input.note !== undefined) data.note = String(input.note ?? "").trim().slice(0, 500) || null;
  if (input.status !== undefined) {
    if (!["PAID", "PENDING", "REFUNDED", "CANCELLED"].includes(input.status)) return { error: "status" };
    data.status = input.status;
  }
  if (input.dateIso) {
    const d = new Date(input.dateIso);
    if (!isNaN(d.getTime())) data.createdAt = s.role === ROLES.ROP && d.getTime() > Date.now() ? existing.createdAt : d;
  }
  if (input.promoCode !== undefined && (input.promoCode || null) !== existing.promoCode) {
    if (!input.promoCode) { data.promoCode = null; data.discount = 0; }
    else {
      const pr = await checkPromoForStudent(input.promoCode, existing.studentId, { force: true });
      if (!pr.ok) return { error: pr.error };
      data.promoCode = pr.code; data.discount = pr.discount;
    }
  }
  if (Object.keys(data).length === 0) return { ok: true };

  await prisma.payment.update({ where: { id: paymentId }, data });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Payment",
    entityId: paymentId,
    oldValue: { amount: existing.amount, method: existing.method, purpose: existing.purpose, status: existing.status, createdAt: existing.createdAt.toISOString(), promoCode: existing.promoCode, discount: existing.discount },
    newValue: data,
    reason: why,
  });

  revalidatePath("/students");
  revalidatePath("/finance");
  revalidatePath("/finance/debtors");
  return { ok: true };
}

export async function deletePaymentRecord(paymentId: string, reason = ""): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN_EDIT_PAY.includes(s.role as never) && s.role !== ROLES.ROP) return { error: "forbidden" };
  const why = String(reason || "").trim().slice(0, 300);
  if (why.length < 3) return { error: "reason" };

  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, studentId: true, amount: true, method: true, status: true, purpose: true, createdAt: true },
  });
  if (!existing) return { error: "notfound" };
  if (!canEditPaymentAt(s.role, existing.createdAt)) return { error: "forbidden" };

  await prisma.payment.delete({ where: { id: paymentId } });
  await writeAudit({
    actorId: s.userId,
    action: "DELETE",
    entityType: "Payment",
    entityId: paymentId,
    oldValue: { ...existing },
    reason: why,
  });

  revalidatePath("/students");
  revalidatePath("/finance");
  revalidatePath("/finance/debtors");
  return { ok: true };
}

export async function listPromoOptions(): Promise<{ code: string; discount: number; minCourses: number | null; note: string | null }[]> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS)) return [];
  return activePromoOptions();
}

export async function getPaymentForEdit(paymentId: string): Promise<PayRow | null> {
  const s = await requireSession();
  if (!CAN_EDIT_PAY.includes(s.role as never) && s.role !== ROLES.ROP) return null;
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, amount: true, method: true, purpose: true, status: true, createdAt: true, note: true, promoCode: true, discount: true },
  });
  if (!p || p.status === "ADJUST" || !canEditPaymentAt(s.role, p.createdAt)) return null;
  return { id: p.id, amount: p.amount, method: p.method, purpose: p.purpose, status: p.status, date: p.createdAt.toISOString(), note: p.note, promoCode: p.promoCode, discount: p.discount };
}

export async function canEditPayments(role: string): Promise<boolean> {
  return CAN_EDIT_PAY.includes(role as never);
}
