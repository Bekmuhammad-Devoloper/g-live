// Finance V2 — granular ruxsatlar (RBAC FINAL, reja §16). Har V2 server action
// SHU YERDAN o'tadi; interfeysda yashirish yetarli emas.

import { ROLES } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";
import { FinanceError } from "./errors";

export const FINANCE_PERMISSIONS = [
  "FINANCE_VIEW",
  "FINANCE_REPORT_VIEW",
  "PAYMENT_CREATE",
  "PAYMENT_CANCEL",
  "PAYMENT_CORRECT",
  "EXPENSE_VIEW",
  "EXPENSE_CREATE",
  "EXPENSE_CORRECT",
  "SALARY_VIEW",
  "SALARY_RULE_MANAGE",
  "SALARY_APPROVE",
  "SALARY_PAY",
  "FINANCIAL_ACCOUNT_VIEW",
  "FINANCIAL_TRANSFER",
  "FINANCE_PERIOD_CLOSE",
  "FINANCE_PERIOD_REOPEN",
] as const;
export type FinancePermission = (typeof FINANCE_PERMISSIONS)[number];

const ALL = new Set<FinancePermission>(FINANCE_PERMISSIONS);
const without = (...drop: FinancePermission[]) => new Set([...ALL].filter((p) => !drop.includes(p)));

/** Rol → ruxsatlar (FINAL matritsa). TEACHER: SALARY_VIEW faqat o'ziniki (isOwnTeacher bilan). */
const MATRIX: Record<string, Set<FinancePermission>> = {
  [ROLES.DIRECTOR]: ALL,
  [ROLES.DEPUTY_DIRECTOR]: without("FINANCE_PERIOD_REOPEN"),
  [ROLES.ACCOUNTANT]: without("SALARY_RULE_MANAGE", "SALARY_APPROVE", "FINANCE_PERIOD_REOPEN"),
  [ROLES.MANAGER]: new Set<FinancePermission>(["FINANCE_VIEW", "FINANCE_REPORT_VIEW", "PAYMENT_CREATE", "EXPENSE_VIEW", "EXPENSE_CREATE", "FINANCIAL_ACCOUNT_VIEW"]),
  [ROLES.ADMIN]: new Set<FinancePermission>(["PAYMENT_CREATE"]),
  [ROLES.TEACHER]: new Set<FinancePermission>(["SALARY_VIEW"]),
};

/** MANAGER faqat o'z filiali (server-side branch validation) */
const BRANCH_SCOPED = new Set<string>([ROLES.MANAGER]);

export function hasFinancePermission(role: string, perm: FinancePermission): boolean {
  return MATRIX[role]?.has(perm) ?? false;
}

export function financePermissionsOf(role: string): FinancePermission[] {
  return [...(MATRIX[role] ?? [])];
}

/** Ruxsat bo'lmasa FinanceError("forbidden") */
export function requireFinancePermission(session: Pick<SessionUser, "role">, perm: FinancePermission): void {
  if (!hasFinancePermission(session.role, perm)) {
    throw new FinanceError("forbidden", `Ruxsat yo'q: ${perm}`, { role: session.role, perm });
  }
}

/** Filial cheklovi: MANAGER → o'z filiali (null = bloklanadi); qolganlar → cheklovsiz (null) */
export function branchScope(session: Pick<SessionUser, "role" | "branchId">): { branchId: string } | null {
  if (!BRANCH_SCOPED.has(session.role)) return null;
  return { branchId: session.branchId ?? "" };
}

/** Obyekt filiali sessiya cheklovidan tashqarida bo'lsa — forbidden */
export function assertBranchAccess(session: Pick<SessionUser, "role" | "branchId">, entityBranchId: string | null | undefined): void {
  const scope = branchScope(session);
  if (!scope) return;
  if (!scope.branchId || entityBranchId !== scope.branchId) {
    throw new FinanceError("forbidden", "Bu filial ma'lumotlariga ruxsat yo'q", { branchId: entityBranchId ?? null });
  }
}

/** TEACHER faqat o'z maoshini ko'radi; boshqa rollar SALARY_VIEW bilan hammani */
export function assertSalaryView(session: Pick<SessionUser, "role" | "userId">, teacherId: string): void {
  if (session.role === ROLES.TEACHER) {
    if (session.userId !== teacherId) throw new FinanceError("forbidden", "Faqat o'z maoshingizni ko'ra olasiz");
    return;
  }
  requireFinancePermission(session, "SALARY_VIEW");
}
