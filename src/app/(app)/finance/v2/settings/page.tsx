import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { getSetting } from "@/lib/settings";
import { ACCOUNT_MAP_SETTING_KEY } from "@/lib/finance/accounts/accounts";
import { DEFAULT_FEE_SETTING_KEY, branchDefaultFeeKey } from "@/lib/finance/billing/fees";
import { tashkentYearMonth, yearMonthKey } from "@/lib/finance/period";
import { PAYMENT_METHOD_TO_ACCOUNT_TYPE } from "@/lib/finance/constants";
import { Forbidden, PageHeader } from "../../../_components/ui";
import { fin } from "../_i18n";
import { financePage, monthFromSearch } from "../_shared";
import SettingsView from "./SettingsView";

export default async function FinanceSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { session, can, flags } = await financePage();
  const L = session.locale;
  if (!can("FINANCE_PERIOD_CLOSE")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const { key } = monthFromSearch(await searchParams);
  const [locks, branches, map, feeRows] = await Promise.all([
    prisma.financePeriodLock.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 24, include: { lockedBy: { select: { fullName: true } } } }),
    prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSetting(ACCOUNT_MAP_SETTING_KEY),
    prisma.setting.findMany({ where: { key: { startsWith: DEFAULT_FEE_SETTING_KEY } } }),
  ]);
  const feeOf = (key: string) => { const n = parseInt(feeRows.find((r) => r.key === key)?.value ?? "", 10); return Number.isFinite(n) && n > 0 ? n : null; };
  const defaultFees = { global: feeOf(DEFAULT_FEE_SETTING_KEY), byBranch: Object.fromEntries(branches.map((b) => [b.id, feeOf(branchDefaultFeeKey(b.id))])) as Record<string, number | null> };
  return (
    <>
      <PageHeader title={fin(L, "settings")} subtitle={`Finance V2: ${flags.enabled ? fin(L, "enabled") : fin(L, "disabledShort")} · cutover ${flags.cutoverAt.toISOString().slice(0, 10)}`} />
      <SettingsView locale={L} enabled={flags.enabled} isDirector={session.role === ROLES.DIRECTOR} canReopen={can("FINANCE_PERIOD_REOPEN")} canRules={can("SALARY_RULE_MANAGE")} cutoverMonth={yearMonthKey(tashkentYearMonth(flags.cutoverAt))} defaultFees={defaultFees} month={key} branches={branches} accountMap={map ?? JSON.stringify(PAYMENT_METHOD_TO_ACCOUNT_TYPE, null, 2)}
        locks={locks.map((l) => ({ id: l.id, period: `${l.year}-${String(l.month).padStart(2, "0")}`, branchId: l.branchId, isLocked: l.isLocked, reason: l.reason, by: l.lockedBy?.fullName ?? "", reopenReason: l.reopenReason }))} />
    </>
  );
}
