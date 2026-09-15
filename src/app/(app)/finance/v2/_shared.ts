import "server-only";

// Finance V2 sahifalari uchun umumiy server yordamchilari.
import { requireSession, type SessionUser } from "@/lib/auth";
import { getFinanceFlags, type FinanceFlags } from "@/lib/finance/flags";
import { branchScope, hasFinancePermission, type FinancePermission } from "@/lib/finance/permissions";
import { parseYearMonthKey, tashkentYearMonth, yearMonthKey, type YearMonth } from "@/lib/finance/period";

export interface FinancePageContext {
  session: SessionUser;
  flags: FinanceFlags;
  /** MANAGER uchun o'z filiali, boshqalar uchun null (hammasi) */
  branchId: string | null;
  can: (p: FinancePermission) => boolean;
}

export async function financePage(): Promise<FinancePageContext> {
  const session = await requireSession();
  const flags = await getFinanceFlags();
  const scope = branchScope(session);
  return { session, flags, branchId: scope ? scope.branchId || null : null, can: (p) => hasFinancePermission(session.role, p) };
}

/** `?ym=2026-10` — bo'lmasa joriy Tashkent oyi */
export function monthFromSearch(sp: Record<string, string | string[] | undefined> | undefined): { ym: YearMonth; key: string } {
  const raw = typeof sp?.ym === "string" ? sp.ym : "";
  let ym: YearMonth;
  try {
    ym = raw ? parseYearMonthKey(raw) : tashkentYearMonth(new Date());
  } catch {
    ym = tashkentYearMonth(new Date());
  }
  return { ym, key: yearMonthKey(ym) };
}
