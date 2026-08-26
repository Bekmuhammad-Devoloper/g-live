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
import { computeDebt } from "@/lib/debt";
import { getSetting } from "@/lib/settings";
import { RECEIPT_MODE_KEY, parseReceiptMode, isReceiptRequired } from "@/lib/receiptMode";

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
  debt: number; // jami qarzdorlik — qo'shilgan oydan hisoblangan + qo'lda kiritilgan
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
      // Qarz — guruhga qo'shilgan oydan hisoblangan to'lov + qo'lda kiritilgani
      debt: (await computeDebt(studentId, now)).debt,
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
  // Chek majburiyligi — CEO sozlamasidan (ixtiyoriy / naqd pulsizda / har doim).
  // Interfeys ham tekshiradi, bu — chetlab o'tib bo'lmaydigan server to'sig'i.
  const receiptUrl = String(input.receiptUrl || "").trim() || null;
  const receiptMode = parseReceiptMode(await getSetting(RECEIPT_MODE_KEY));
  if (isReceiptRequired(receiptMode, input.method) && !receiptUrl) {
    return { ok: false, error: "receipt_required" };
  }

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
  const note = String(fd.get("note") || "").trim().slice(0, 2000) || null;
  const eduRaw = String(fd.get("eduStatus") || "").trim();
  const eduStatus = EDU_STATUSES.includes(eduRaw as never) ? eduRaw : undefined;

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) return { error: "invalid" };

  const updated = await prisma.student.update({
    where: { id },
    data: { fullName, phone, currentLevel, note, ...(eduStatus ? { eduStatus } : {}) },
  });

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

// ─── O'quvchini o'chirish (ikki bosqich) ───
// 1) Arxivlash — yumshoq o'chirish: o'quvchi ro'yxatdan chiqadi, lekin barcha
//    ma'lumoti (to'lov tarixi, davomat) saqlanadi va qaytarib bo'ladi.
// 2) Mutloq o'chirish — o'quvchi va unga bog'liq HAMMA yozuv butunlay yo'qoladi.

/** Yumshoq o'chirish: eduStatus = ARCHIVED. Qaytarib bo'ladi. */
export async function archiveStudent(id: string): Promise<EditState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const st = await prisma.student.findUnique({ where: { id }, select: { fullName: true, eduStatus: true } });
  if (!st) return { error: "notfound" };

  await prisma.student.update({ where: { id }, data: { eduStatus: "ARCHIVED" } });
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

/** Arxivdan qaytarish. */
export async function restoreStudent(id: string): Promise<EditState> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const st = await prisma.student.findUnique({
    where: { id },
    select: { fullName: true, enrollments: { where: { isActive: true }, select: { id: true }, take: 1 } },
  });
  if (!st) return { error: "notfound" };

  // Guruhi bo'lsa — faol, bo'lmasa kutish holatiga qaytadi
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

  revalidatePath("/students");
  return { ok: true };
}

/**
 * MUTLOQ o'chirish — orqaga qaytarib bo'lmaydi.
 * O'quvchi bilan birga davomat, topshiriq javoblari, sertifikat, imtihon
 * natijalari va TO'LOV TARIXI ham o'chadi (Payment.studentId majburiy bo'lgani
 * uchun to'lovlarni saqlab qolib bo'lmaydi). Shu sabab faqat direktor va
 * o'rinbosariga ruxsat; audit jurnalida qancha yozuv o'chgani qoladi.
 */
export async function deleteStudentPermanently(id: string): Promise<EditState> {
  const s = await requireSession();
  // Administrator ham o'chira oladi (2026-08-26 talab)
  const CAN_PURGE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
  if (!CAN_PURGE.includes(s.role as never)) return { error: "forbidden" };

  const st = await prisma.student.findUnique({
    where: { id },
    select: { fullName: true, phone: true, userId: true, _count: { select: { payments: true, attendances: true, enrollments: true } } },
  });
  if (!st) return { error: "notfound" };

  await prisma.$transaction(async (tx) => {
    // Bog'lanishlarni uzamiz (bular kaskad bilan o'chmaydi)
    await tx.lead.updateMany({ where: { studentId: id }, data: { studentId: null } });
    await tx.task.updateMany({ where: { studentId: id }, data: { studentId: null } });
    // To'lovlar — studentId majburiy, shuning uchun o'chiriladi
    await tx.payment.deleteMany({ where: { studentId: id } });
    // Qolgani (davomat, javoblar, sertifikat, guruh a'zoligi...) kaskad bilan ketadi
    await tx.student.delete({ where: { id } });
    // O'quvchining tizimga kirish hisobi bo'lsa — u ham o'chiriladi
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

// ─── O'quvchini boshqa filialga ko'chirish (2026-08-25 talab) ───
// Guruhlar filialga tegishli bo'lgani uchun, ko'chirilganda o'quvchi eski
// filialdagi guruhlardan chiqariladi (leftAt yoziladi) — aks holda u ko'rinmaydigan
// guruhda "osilib" qolardi va to'lov hisobi ham davom etaverardi.

export interface BranchOpt { id: string; name: string }

/** Ko'chirish uchun faol filiallar ro'yxati. */
export async function studentBranchOptions(): Promise<BranchOpt[]> {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) return [];
  return prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
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

  // Yangi filialga tegishli BO'LMAGAN guruhlardagi faol a'zoliklar tugatiladi
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

  revalidatePath("/students");
  revalidatePath("/groups");
  return { ok: true, branchName: branch.name, removedGroups: stale.length };
}

// ─── Qarz qo'shish va to'lovni tahrirlash (2026-08-27 talab) ───
// "Qarzdor holatga tushurish" — qo'lda qarz yozuvi (PENDING to'lov) ochiladi.
// To'lovni tahrirlash/o'chirish — noto'g'ri kiritilgan yozuvni tuzatish uchun.

const CAN_EDIT_PAY = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.ACCOUNTANT];

/** O'quvchini qarzdor qilish — ko'rsatilgan summada qarz yozuvi ochadi. */
export async function addStudentDebt(
  studentId: string,
  input: { amount: number; purpose?: string; dateIso?: string | null },
): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.PAYMENTS) && !ALLOWED.includes(s.role as never)) return { error: "forbidden" };

  const amount = Math.trunc(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "amount" };

  const st = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, fullName: true } });
  if (!st) return { error: "notfound" };

  let createdAt = new Date();
  if (input.dateIso) { const d = new Date(input.dateIso); if (!isNaN(d.getTime())) createdAt = d; }

  const pay = await prisma.payment.create({
    data: {
      studentId,
      amount,
      method: "CASH",
      status: "PENDING", // PENDING = qarz
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
    reason: `Qarz qo'shildi: ${st.fullName}`,
  });

  revalidatePath("/students");
  revalidatePath("/finance/debtors");
  return { ok: true };
}

/** To'lov yozuvini tahrirlash (summa, usul, maqsad, holat, sana). */
export async function updatePaymentRecord(
  paymentId: string,
  input: { amount?: number; method?: string; purpose?: string; status?: string; dateIso?: string | null },
): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN_EDIT_PAY.includes(s.role as never)) return { error: "forbidden" };

  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, studentId: true, amount: true, method: true, purpose: true, status: true, createdAt: true },
  });
  if (!existing) return { error: "notfound" };

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
  if (input.status !== undefined) {
    if (!["PAID", "PENDING", "REFUNDED", "CANCELLED"].includes(input.status)) return { error: "status" };
    data.status = input.status;
  }
  if (input.dateIso) { const d = new Date(input.dateIso); if (!isNaN(d.getTime())) data.createdAt = d; }
  if (Object.keys(data).length === 0) return { ok: true };

  await prisma.payment.update({ where: { id: paymentId }, data });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "Payment",
    entityId: paymentId,
    oldValue: { amount: existing.amount, method: existing.method, purpose: existing.purpose, status: existing.status, createdAt: existing.createdAt.toISOString() },
    newValue: data,
    reason: "To'lov yozuvi tahrirlandi",
  });

  revalidatePath("/students");
  revalidatePath("/finance");
  revalidatePath("/finance/debtors");
  return { ok: true };
}

/** To'lov yozuvini o'chirish (xato kiritilgan bo'lsa). */
export async function deletePaymentRecord(paymentId: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!CAN_EDIT_PAY.includes(s.role as never)) return { error: "forbidden" };

  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, studentId: true, amount: true, method: true, status: true, purpose: true },
  });
  if (!existing) return { error: "notfound" };

  await prisma.payment.delete({ where: { id: paymentId } });
  await writeAudit({
    actorId: s.userId,
    action: "DELETE",
    entityType: "Payment",
    entityId: paymentId,
    oldValue: { ...existing },
    reason: "To'lov yozuvi o'chirildi",
  });

  revalidatePath("/students");
  revalidatePath("/finance");
  revalidatePath("/finance/debtors");
  return { ok: true };
}
