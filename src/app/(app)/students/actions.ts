"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES, EDU_STATUSES, PAYMENT_METHODS } from "@/lib/constants";
import { canWrite, canRead, MODULES } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { lessonsAttendedThisMonth, MANDATORY_LESSON_THRESHOLD } from "@/lib/paymentPolicy";

export type EditState = { ok?: boolean; error?: string };
export type BulkState = { ok?: boolean; error?: string; count?: number };

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];

// ─── O'quvchi to'lovlari (detal oynasi uchun) ───
export interface MonthPay { paid: boolean; amount: number; date: string | null }
export interface PayRow { id: string; amount: number; method: string; purpose: string | null; status: string; date: string }
export interface StudentPayments {
  thisMonth: MonthPay;
  lastMonth: MonthPay;
  totalPaid: number;
  lastPaidDate: string | null;
  debt: number; // jami qarzdorlik — PENDING to'lovlar yig'indisi
  lessonsThisMonth: number; // shu oy o'tilgan darslar soni (davomat bo'yicha)
  mandatoryThreshold: number; // shundan keyin to'lov majburiy bo'ladi
  paymentMandatory: boolean; // shu oy chegaradan ko'p dars o'tilgan, lekin to'lov qilinmagan
  joinDate: string | null; // o'quvchi kelgan (birinchi guruhga qo'shilgan) sana
  lastMonthApplicable: boolean; // false bo'lsa — hali bir oy to'lmagan, "o'tgan oy" o'rniga qo'shilgan sana ko'rsatiladi
  recent: PayRow[];
}

/** O'quvchining to'lov holati: bu oy / o'tgan oy to'lagan-to'lamagani + so'nggi to'lovlar. */
export async function getStudentPayments(studentId: string): Promise<{ ok: boolean; data?: StudentPayments; error?: string }> {
  const s = await requireSession();
  // Talaba/xodim boshqaruvidan farqli — bu faqat KO'RISH, shuning uchun moliya o'qish huquqi (masalan Hisobchi) yetarli
  if (!ALLOWED.includes(s.role as never) && !canRead(s.role, MODULES.PAYMENTS)) return { ok: false, error: "forbidden" };
  if (!studentId) return { ok: false, error: "invalid" };

  const [payments, lessonsThisMonth, firstEnrollment, student] = await Promise.all([
    prisma.payment.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: { id: true, amount: true, method: true, purpose: true, status: true, createdAt: true },
    }),
    lessonsAttendedThisMonth(studentId),
    prisma.groupStudent.findFirst({ where: { studentId }, orderBy: { joinedAt: "asc" }, select: { joinedAt: true } }),
    prisma.student.findUnique({ where: { id: studentId }, select: { createdAt: true } }),
  ]);

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const lastM = m === 0 ? 11 : m - 1;
  const lastY = m === 0 ? y - 1 : y;
  const paid = payments.filter((p) => p.status === "PAID");
  const pending = payments.filter((p) => p.status === "PENDING"); // qarz = PENDING to'lovlar yig'indisi

  const monthSummary = (yy: number, mm: number): MonthPay => {
    const ps = paid.filter((p) => p.createdAt.getFullYear() === yy && p.createdAt.getMonth() === mm);
    return { paid: ps.length > 0, amount: ps.reduce((n, p) => n + p.amount, 0), date: ps.length ? ps[0].createdAt.toISOString() : null };
  };

  const thisMonth = monthSummary(y, m);
  // Majburiy to'lov: shu oy chegaradan (3 dars) ko'p dars o'tilgan, lekin to'lov qilinmagan
  const paymentMandatory = !thisMonth.paid && lessonsThisMonth >= MANDATORY_LESSON_THRESHOLD;

  // O'quvchi kelgan sana — birinchi guruhga qo'shilgan sana, bo'lmasa ro'yxatga olingan sana
  const joinDate = firstEnrollment?.joinedAt ?? student?.createdAt ?? null;
  // Hali kamida bir oy bo'lmagan bo'lsa — "o'tgan oy" ma'lumoti tegishli emas (u paytda o'quvchi bo'lmagan)
  const DAY = 86_400_000;
  const lastMonthApplicable = joinDate ? (now.getTime() - joinDate.getTime()) / DAY >= 30 : true;

  return {
    ok: true,
    data: {
      thisMonth,
      lastMonth: monthSummary(lastY, lastM),
      totalPaid: paid.reduce((n, p) => n + p.amount, 0),
      lastPaidDate: paid.length ? paid[0].createdAt.toISOString() : null,
      debt: pending.reduce((n, p) => n + p.amount, 0),
      lessonsThisMonth,
      mandatoryThreshold: MANDATORY_LESSON_THRESHOLD,
      paymentMandatory,
      joinDate: joinDate ? joinDate.toISOString() : null,
      lastMonthApplicable,
      recent: payments.slice(0, 8).map((p) => ({ id: p.id, amount: p.amount, method: p.method, purpose: p.purpose, status: p.status, date: p.createdAt.toISOString() })),
    },
  };
}

// ─── To'lov qabul qilish + chek ───
export interface ReceiptData {
  docNumber: string;
  dateIso: string;
  amount: number;
  method: string;
  purpose: string;
  studentName: string;
  studentPhone: string | null;
  orgName: string;
  branchName: string | null;
  branchAddress: string | null;
  branchPhone: string | null;
  cashier: string;
  footer: string;
  receiptUrl: string | null; // karta to'lovida yuklangan chek fayli
}

const p2r = (n: number) => String(n).padStart(2, "0");

/** To'lovni qabul qiladi (status PAID) va chek ma'lumotlarini qaytaradi. */
export async function acceptPayment(
  studentId: string,
  input: { amount: number; method: string; purpose: string; receiptUrl?: string | null; paidAt?: string | null },
): Promise<{ ok: boolean; error?: string; receipt?: ReceiptData }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS)) return { ok: false, error: "forbidden" };

  const amount = Math.trunc(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "amount" };
  if (!PAYMENT_METHODS.includes(input.method as never)) return { ok: false, error: "method" };
  const purpose = String(input.purpose || "").trim();
  if (purpose.length < 2) return { ok: false, error: "purpose" };
  // Karta to'lovida chek fayli majburiy
  const receiptUrl = String(input.receiptUrl || "").trim() || null;
  if (input.method === "CARD" && !receiptUrl) return { ok: false, error: "receipt_required" };

  // To'lov vaqti (bo'sh yoki noto'g'ri bo'lsa — hozir)
  let paidAt = new Date();
  if (input.paidAt) { const d = new Date(input.paidAt); if (!isNaN(d.getTime())) paidAt = d; }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, phone: true, userId: true, branch: { select: { name: true, address: true, phone: true } } },
  });
  if (!student) return { ok: false, error: "notfound" };

  const docNumber = `CHK-${paidAt.getFullYear()}${p2r(paidAt.getMonth() + 1)}${p2r(paidAt.getDate())}-${randomUUID().slice(0, 4).toUpperCase()}`;

  const payment = await prisma.payment.create({
    data: { studentId, amount, method: input.method, purpose, status: "PAID", isManual: true, authorId: s.userId, docNumber, receiptUrl, createdAt: paidAt },
  });

  await writeAudit({
    actorId: s.userId, action: "CREATE", entityType: "Payment", entityId: payment.id,
    newValue: { amount, method: input.method, purpose, docNumber, isManual: true },
    reason: "To'lov qabul qilindi (chek)",
  });

  // O'quvchi (va ota-onasi)ga bildirishnoma
  const full = await prisma.student.findUnique({ where: { id: studentId }, include: { parents: { include: { parent: true } } } });
  if (full) {
    const body = `To'lov qabul qilindi: ${amount.toLocaleString("ru-RU")} so'm. Chek № ${docNumber}.`;
    if (full.userId) await notify({ userId: full.userId, title: "To'lov qabul qilindi", body, event: "payment_success" });
    for (const link of full.parents) if (link.parent.userId) await notify({ userId: link.parent.userId, title: "To'lov qabul qilindi", body, event: "payment_success" });
  }

  // Chek sarlavhasi — CEO sozlamalaridan (bo'lmasa standart)
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
      studentName: student.fullName,
      studentPhone: student.phone,
      orgName: cfg["receipt.orgName"] || "Germaniya Live",
      branchName: student.branch?.name ?? null,
      branchAddress: student.branch?.address ?? null,
      branchPhone: student.branch?.phone ?? null,
      cashier: author?.fullName ?? "—",
      footer: cfg["receipt.footer"] || "To'lovingiz uchun rahmat!",
      receiptUrl,
    },
  };
}

/** O'quvchi profil rasmini o'rnatish/o'chirish (data URL). null → o'chirish. */
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

/** Mavjud o'quvchini tahrirlaydi (F.I.Sh., telefon, daraja, o'quv holati). */
export async function updateStudent(fd: FormData): Promise<EditState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const id = String(fd.get("id") || "").trim();
  if (!id) return { error: "invalid" };

  const fullName = String(fd.get("fullName") || "").trim();
  if (fullName.length < 3) return { error: "invalid" };

  const phone = String(fd.get("phone") || "").trim() || null;
  const currentLevel = String(fd.get("currentLevel") || "").trim() || null;
  const eduRaw = String(fd.get("eduStatus") || "").trim();
  const eduStatus = EDU_STATUSES.includes(eduRaw as never) ? eduRaw : undefined;

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) return { error: "invalid" };

  const updated = await prisma.student.update({
    where: { id },
    data: { fullName, phone, currentLevel, ...(eduStatus ? { eduStatus } : {}) },
  });

  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Student",
    entityId: id,
    oldValue: { fullName: existing.fullName, phone: existing.phone, currentLevel: existing.currentLevel, eduStatus: existing.eduStatus },
    newValue: { fullName: updated.fullName, phone: updated.phone, currentLevel: updated.currentLevel, eduStatus: updated.eduStatus },
  });

  revalidatePath("/students");
  return { ok: true };
}

// ─── Ommaviy (bulk) amallar — tanlangan o'quvchilar ustida ───

/** Tanlangan o'quvchilarni arxivlaydi (eduStatus = ARCHIVED). */
export async function bulkArchiveStudents(ids: string[]): Promise<BulkState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };
  const clean = ids.filter(Boolean);
  if (!clean.length) return { error: "empty" };

  const res = await prisma.student.updateMany({ where: { id: { in: clean } }, data: { eduStatus: "ARCHIVED" } });

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

/** Tanlangan o'quvchilarni guruhga biriktiradi (mavjud a'zolik takrorlanmaydi). */
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

  revalidatePath("/students");
  revalidatePath("/group-students");
  return { ok: true, count };
}

/** Tanlangan o'quvchilar (va ota-onalari)ga bildirishnoma yuboradi. */
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
    if (st.userId) { await notify({ userId: st.userId, title: "Yangi xabar", body: text, event: "bulk_message" }); count++; }
    for (const link of st.parents) {
      if (link.parent.userId) await notify({ userId: link.parent.userId, title: "Farzandingiz bo'yicha xabar", body: text, event: "bulk_message" });
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
