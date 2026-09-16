import "server-only";

// Finance V2 sahifalari uchun umumiy server yordamchilari.
import { requireSession, type SessionUser } from "@/lib/auth";
import { getFinanceFlags, type FinanceFlags } from "@/lib/finance/flags";
import { FinanceError } from "@/lib/finance/errors";
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
  // Filial cheklovi bor, lekin filial biriktirilmagan (MANAGER, branchId yo'q) — "hammasi" emas, HECH NARSA
  if (scope && !scope.branchId) throw new FinanceError("forbidden", "Filial biriktirilmagan — moliya bo'limiga kirish yo'q");
  return { session, flags, branchId: scope ? scope.branchId : null, can: (p) => hasFinancePermission(session.role, p) };
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

export const PAGE_SIZE = 50;

/** `?q=&page=` — qidiruv matni va sahifa (1 dan) */
export function listParams(sp: Record<string, string | string[] | undefined> | undefined): { q: string; page: number; skip: number; take: number } {
  const q = (typeof sp?.q === "string" ? sp.q : "").trim().slice(0, 80);
  const pageRaw = parseInt(typeof sp?.page === "string" ? sp.page : "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return { q, page, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}
