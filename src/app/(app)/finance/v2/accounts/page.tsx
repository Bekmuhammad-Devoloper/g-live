import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/constants";
import { accountsOverview } from "@/lib/finance/accounts/balances";
import { Forbidden, PageHeader } from "../../../_components/ui";
import { fin } from "../_i18n";
import { financePage } from "../_shared";
import AccountsView from "./AccountsView";

export default async function AccountsV2Page() {
  const { session, branchId, can, flags } = await financePage();
  const L = session.locale;
  if (!can("FINANCIAL_ACCOUNT_VIEW")) return <Forbidden title={fin(L, "forbiddenTitle")} body={fin(L, "forbidden")} />;
  const [rows, branches] = await Promise.all([accountsOverview(prisma, { branchId: branchId ?? undefined, includeInactive: can("FINANCIAL_TRANSFER") }), prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const total = rows.filter((r) => r.account.isActive).reduce((a, r) => a + r.balance, 0);
  return (
    <>
      <PageHeader title={fin(L, "accounts")} subtitle={`${fin(L, "cashBalance")}: ${formatMoney(total, L)}`} />
      <AccountsView locale={L} enabled={flags.enabled} canManage={can("FINANCIAL_TRANSFER")} branches={branches} rows={rows.map((r) => ({ id: r.account.id, name: r.account.name, type: r.account.type, branch: r.account.branchId ? branchName.get(r.account.branchId) ?? "" : "GLOBAL", isActive: r.account.isActive, inflow: r.inflow, outflow: r.outflow, balance: r.balance, note: r.account.note }))} />
    </>
  );
}
