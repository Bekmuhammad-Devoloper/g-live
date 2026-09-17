// Finance V2 — audit yozuvi TRANZAKSIYA ICHIDA (moliyaviy yozuv va uning
// auditi birga commit bo'ladi). Mavjud `lib/audit.ts` (global prisma) bilan bir
// xil jadval/format — AuditLog o'quvchi UI o'zgarmaydi.

import type { FinanceDb } from "./db";

export const FINANCE_AUDIT_ENTITIES = {
  payment: "Payment",
  allocation: "PaymentAllocation",
  refund: "Refund",
  charge: "StudentCharge",
  discount: "StudentDiscount",
  billingPolicy: "BillingPolicy",
  salaryPolicy: "SalaryPolicy",
  salaryRule: "SalaryRule",
  assignment: "GroupTeacherAssignment",
  earning: "TeacherEarning",
  salaryPeriod: "SalaryPeriod",
  payout: "SalaryPayout",
  account: "FinancialAccount",
  transfer: "Transfer",
  expense: "Expense",
  periodLock: "FinancePeriodLock",
  ledger: "FinancialTransaction",
  membershipHistory: "GroupStudentHistory",
  legacyReview: "LegacyPaymentReview",
} as const;

export interface FinanceAuditParams {
  actorId?: string | null;
  action: string; // CREATE | UPDATE | CANCEL | REVERSE | APPROVE | CLOSE | REOPEN | PAYOUT | POST | ...
  entityType: (typeof FINANCE_AUDIT_ENTITIES)[keyof typeof FINANCE_AUDIT_ENTITIES];
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ip?: string | null;
}

export async function financeAudit(db: FinanceDb, p: FinanceAuditParams): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: p.actorId ?? null,
      action: p.action,
      entityType: p.entityType,
      entityId: p.entityId ?? null,
      oldValue: p.oldValue !== null && p.oldValue !== undefined ? JSON.stringify(p.oldValue) : null,
      newValue: p.newValue !== null && p.newValue !== undefined ? JSON.stringify(p.newValue) : null,
      reason: p.reason ?? null,
      ip: p.ip ?? null,
    },
  });
}
