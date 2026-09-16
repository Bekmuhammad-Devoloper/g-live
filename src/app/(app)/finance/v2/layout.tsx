import { ROLES } from "@/lib/constants";
import { Forbidden } from "../../_components/ui";
import { fin, V2_NAV } from "./_i18n";
import { financePage } from "./_shared";
import V2Nav from "./V2Nav";

// Finance V2 bo'limi: kirish — moliya ruxsati bo'lgan rollar (TEACHER faqat /salary o'z maoshi).
export default async function FinanceV2Layout({ children }: { children: React.ReactNode }) {
  const { session, can } = await financePage();
  const locale = session.locale;
  const isTeacher = session.role === ROLES.TEACHER;
  if (!can("FINANCE_VIEW") && !can("PAYMENT_CREATE") && !isTeacher) {
    return <Forbidden title={fin(locale, "forbiddenTitle")} body={fin(locale, "forbidden")} />;
  }
  const hidden = V2_NAV.filter((n) => {
    if (isTeacher) return n.href !== "/finance/v2/salary";
    if (n.href === "/finance/v2/salary" || n.href === "/finance/v2/salary/settings") return !can("SALARY_VIEW") || (n.href.endsWith("settings") && !can("SALARY_RULE_MANAGE"));
    if (n.href === "/finance/v2/accounts") return !can("FINANCIAL_ACCOUNT_VIEW");
    if (n.href === "/finance/v2/expenses") return !can("EXPENSE_VIEW");
    if (n.href === "/finance/v2/reports") return !can("FINANCE_REPORT_VIEW");
    if (n.href === "/finance/v2/readiness") return !can("FINANCE_PERIOD_CLOSE") && !can("SALARY_RULE_MANAGE");
    if (n.href === "/finance/v2/settings") return !can("FINANCE_PERIOD_CLOSE");
    if (n.href === "/finance/v2/refunds") return !can("PAYMENT_CANCEL");
    return !can("FINANCE_VIEW");
  }).map((n) => n.href);
  return (
    <>
      <V2Nav locale={locale} hidden={hidden} />
      {children}
    </>
  );
}
