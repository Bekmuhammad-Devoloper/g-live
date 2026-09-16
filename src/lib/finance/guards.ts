import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

// Finance V2 — "moliyaviy tarixi bor obyekt o'chirilmaydi" (B1).
//
// ASOSIY himoya bazadagi Restrict (schema). Bu modul faqat UX uchun: o'chirish
// tugmasi bosilganda foydalanuvchiga xom Prisma P2003 o'rniga tushunarli javob
// beriladi. Guard va real delete orasida poyga (race) bo'lsa ham baza tarixni
// himoya qiladi — shu sabab action'lar P2003 ni ham shu xabarga o'giradi.

/** Action'lar qaytaradigan xato kodi — klientda xabarga o'giriladi */
export const FINANCE_HISTORY_ERROR = "has-finance-history";

export type FinanceHistoryEntity = "student" | "group" | "program" | "branch" | "user";

export interface FinanceHistory {
  total: number;
  /** jadval → qator soni (faqat 0 dan katta bo'lganlari) */
  breakdown: Record<string, number>;
}

/** Berilgan obyektga bog'langan Finance V2 qatorlari (faqat o'qish) */
export async function financeHistoryOf(entity: FinanceHistoryEntity, id: string): Promise<FinanceHistory> {
  const counts = await countsFor(entity, id);
  const breakdown = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
  return { total: Object.values(breakdown).reduce((a, b) => a + b, 0), breakdown };
}

export async function hasFinanceHistory(entity: FinanceHistoryEntity, id: string): Promise<boolean> {
  return (await financeHistoryOf(entity, id)).total > 0;
}

/** Prisma P2003 — FK Restrict (baza o'chirishga yo'l qo'ymadi) */
export function isRestrictError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003";
}

/** Foydalanuvchiga ko'rsatiladigan xabar (4 tilda) */
export function financeHistoryMessage(locale: Locale): string {
  return tr(locale, {
    uz: "Bu obyektga moliyaviy tarix bog'langan. Uni o'chirish mumkin emas. Arxivlang.",
    ru: "С этим объектом связана финансовая история. Удалить его нельзя. Заархивируйте.",
    en: "This record has financial history linked to it. It cannot be deleted. Archive it instead.",
    de: "Mit diesem Datensatz ist Finanzhistorie verknüpft. Er kann nicht gelöscht werden. Bitte archivieren.",
  });
}

async function countsFor(entity: FinanceHistoryEntity, id: string): Promise<Record<string, number>> {
  switch (entity) {
    case "student": {
      const [charges, allocations, refunds, earnings, discounts, posted] = await Promise.all([
        prisma.studentCharge.count({ where: { studentId: id } }),
        prisma.paymentAllocation.count({ where: { payment: { studentId: id } } }),
        prisma.refund.count({ where: { studentId: id } }),
        prisma.teacherEarning.count({ where: { studentId: id } }),
        prisma.studentDiscount.count({ where: { studentId: id } }),
        prisma.payment.count({ where: { studentId: id, OR: [{ postedAt: { not: null } }, { legacyRole: { not: null } }] } }), // ledger'ga yozilgan to'lov (taqsimotsiz kredit ham)
      ]);
      return { StudentCharge: charges, PaymentAllocation: allocations, Refund: refunds, TeacherEarning: earnings, StudentDiscount: discounts, Payment: posted };
    }
    case "group": {
      const [charges, assignments, earnings, discounts] = await Promise.all([
        prisma.studentCharge.count({ where: { groupId: id } }),
        prisma.groupTeacherAssignment.count({ where: { groupId: id } }),
        prisma.teacherEarning.count({ where: { groupId: id } }),
        prisma.studentDiscount.count({ where: { groupId: id } }),
      ]);
      return { StudentCharge: charges, GroupTeacherAssignment: assignments, TeacherEarning: earnings, StudentDiscount: discounts };
    }
    case "program": {
      const [charges, earnings] = await Promise.all([
        prisma.studentCharge.count({ where: { programId: id } }),
        prisma.teacherEarning.count({ where: { programId: id } }),
      ]);
      return { StudentCharge: charges, TeacherEarning: earnings };
    }
    case "branch": {
      const [accounts, ledger, charges, payments, refunds, earnings, payouts, billingPolicies, salaryPolicies, locks] = await Promise.all([
        prisma.financialAccount.count({ where: { branchId: id } }),
        prisma.financialTransaction.count({ where: { branchId: id } }),
        prisma.studentCharge.count({ where: { branchId: id } }),
        prisma.payment.count({ where: { branchId: id } }),
        prisma.refund.count({ where: { branchId: id } }),
        prisma.teacherEarning.count({ where: { branchId: id } }),
        prisma.salaryPayout.count({ where: { branchId: id } }),
        prisma.billingPolicy.count({ where: { branchId: id } }),
        prisma.salaryPolicy.count({ where: { branchId: id } }),
        prisma.financePeriodLock.count({ where: { branchId: id } }),
      ]);
      return {
        FinancialAccount: accounts, FinancialTransaction: ledger, StudentCharge: charges, Payment: payments, Refund: refunds,
        TeacherEarning: earnings, SalaryPayout: payouts, BillingPolicy: billingPolicies, SalaryPolicy: salaryPolicies, FinancePeriodLock: locks,
      };
    }
    case "user": {
      const [assignments, earnings, periods, payouts, ledger, allocations, refunds, transfers, reviewed] = await Promise.all([
        prisma.groupTeacherAssignment.count({ where: { teacherId: id } }),
        prisma.teacherEarning.count({ where: { OR: [{ teacherId: id }, { createdById: id }] } }),
        prisma.salaryPeriod.count({ where: { teacherId: id } }),
        prisma.salaryPayout.count({ where: { OR: [{ teacherId: id }, { createdById: id }] } }),
        prisma.financialTransaction.count({ where: { createdById: id } }),
        prisma.paymentAllocation.count({ where: { createdById: id } }),
        prisma.refund.count({ where: { createdById: id } }),
        prisma.transfer.count({ where: { createdById: id } }),
        prisma.teacherEarning.count({ where: { reviewedById: id } }),
      ]);
      return {
        GroupTeacherAssignment: assignments, TeacherEarning: earnings + reviewed, SalaryPeriod: periods, SalaryPayout: payouts,
        FinancialTransaction: ledger, PaymentAllocation: allocations, Refund: refunds, Transfer: transfers,
      };
    }
  }
}
