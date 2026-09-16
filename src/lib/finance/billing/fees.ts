// Finance V2 — oylik narx manbai (source of truth), ustuvorlik bo'yicha:
//   1. O'quvchi bilan KELISHILGAN narx (StudentDiscount.type = AGREED_PRICE, so'm/oy; guruhga yoki barcha guruhlarga)
//   2. Group.monthlyFee                (guruh narxi)
//   3. Program.monthlyFee              (kurs narxi)
//   4. Setting finance.defaultMonthlyFee.<branchId>   (filial standarti)
//   5. Setting finance.defaultMonthlyFee              (global standart)
// Topilmasa → narx YO'Q: charge yaratilmaydi, 0 deb taxmin qilinmaydi (MONTHLY_FEE_NOT_CONFIGURED).
// Mavjud modelga yangi narx jadvali qo'shilmaydi — StudentDiscount (kelishilgan narx) va Setting ishlatiladi.

import type { FinanceDb } from "../db";
import { FinanceError } from "../errors";
import { isWithin, monthStart, type YearMonth } from "../period";

export const DEFAULT_FEE_SETTING_KEY = "finance.defaultMonthlyFee";
export const branchDefaultFeeKey = (branchId: string) => `${DEFAULT_FEE_SETTING_KEY}.${branchId}`;
export const AGREED_PRICE_TYPE = "AGREED_PRICE";

export type FeeSourceKind = "agreed" | "group" | "program" | "branchDefault" | "default";

export interface FeeResolution {
  /** yakuniy oylik narx (kelishilgan bo'lsa — kelishilgan) */
  amount: number;
  source: FeeSourceKind;
  /** ro'yxat narxi (guruh/kurs/standart) — kelishilgan narxdan farq "chegirma" sifatida yoziladi; bo'lmasa null */
  listAmount: number | null;
  listSource: Exclude<FeeSourceKind, "agreed"> | null;
  agreedPriceId: string | null;
}

export interface FeeContext {
  studentId: string;
  groupId: string;
  branchId: string | null;
  serviceMonth: YearMonth;
}

function parseFee(raw: string | null | undefined): number | null {
  const n = parseInt(String(raw ?? "").replace(/\s/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ro'yxat narxi (kelishilgan narxsiz): guruh → kurs → filial standarti → global standart */
export async function resolveListFee(db: FinanceDb, groupId: string, branchId: string | null): Promise<{ amount: number; source: Exclude<FeeSourceKind, "agreed"> } | null> {
  const g = await db.group.findUnique({ where: { id: groupId }, select: { monthlyFee: true, branchId: true, program: { select: { monthlyFee: true } } } });
  if (!g) return null;
  if (g.monthlyFee && g.monthlyFee > 0) return { amount: g.monthlyFee, source: "group" };
  if (g.program?.monthlyFee && g.program.monthlyFee > 0) return { amount: g.program.monthlyFee, source: "program" };
  const bid = g.branchId ?? branchId;
  if (bid) {
    const b = await db.setting.findUnique({ where: { key: branchDefaultFeeKey(bid) } });
    const n = parseFee(b?.value);
    if (n) return { amount: n, source: "branchDefault" };
  }
  const d = await db.setting.findUnique({ where: { key: DEFAULT_FEE_SETTING_KEY } });
  const n = parseFee(d?.value);
  return n ? { amount: n, source: "default" } : null;
}

/** To'liq narx: kelishilgan narx (xizmat oyi boshida faol) ustun; keyin ro'yxat narxi. Topilmasa null. */
export async function resolveFee(db: FinanceDb, ctx: FeeContext): Promise<FeeResolution | null> {
  const at = monthStart(ctx.serviceMonth);
  const agreedRows = await db.studentDiscount.findMany({
    where: { studentId: ctx.studentId, type: AGREED_PRICE_TYPE, OR: [{ groupId: null }, { groupId: ctx.groupId }] }, // tarixan: interval bo'yicha (isActive emas)
  });
  // Guruhga xos kelishuv umumiy kelishuvdan ustun; teng bo'lsa — eng so'nggi boshlangan
  const agreed = agreedRows
    .filter((d) => isWithin(at, d.effectiveFrom, d.effectiveTo) && d.value > 0)
    .sort((a, b) => Number(!!b.groupId) - Number(!!a.groupId) || b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || a.id.localeCompare(b.id))[0];
  const list = await resolveListFee(db, ctx.groupId, ctx.branchId);
  if (agreed) return { amount: agreed.value, source: "agreed", listAmount: list?.amount ?? null, listSource: list?.source ?? null, agreedPriceId: agreed.id };
  if (list) return { amount: list.amount, source: list.source, listAmount: list.amount, listSource: list.source, agreedPriceId: null };
  return null;
}

export interface UnpricedItem {
  studentId: string;
  groupId: string;
  month: string;
}

/** Domen xatosi — narx sozlanmagan (0 deb taxmin qilinmaydi) */
export function feeNotConfiguredError(items: UnpricedItem[], labels: { group?: string; program?: string } = {}): FinanceError {
  const where = [labels.group && `guruh "${labels.group}"`, labels.program && `kurs "${labels.program}"`].filter(Boolean).join(", ");
  return new FinanceError("fee_not_configured", `Oylik narx sozlanmagan${where ? ` (${where})` : ""} — guruh yoki kurs narxini, filial/global standart narxni yoki o'quvchi bilan kelishilgan narxni kiriting`, { code: "MONTHLY_FEE_NOT_CONFIGURED", items });
}
