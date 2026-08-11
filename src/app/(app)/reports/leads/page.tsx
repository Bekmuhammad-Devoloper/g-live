import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, MODULES } from "@/lib/rbac";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, Forbidden } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import BarChart, { type BarPoint } from "../_components/BarChart";
import ExportButton from "./ExportButton";

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const p2 = (n: number) => String(n).padStart(2, "0");
const toInput = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const toDisplay = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return fallback;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function LeadsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const s = await requireSession();
  const t = getT(s.locale);
  const MONTHS_UZ = MONTHS[s.locale];
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const sp = await searchParams;
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), 0, 1); // yil boshi
  const defTo = new Date(now.getFullYear(), now.getMonth() + 1, 0); // joriy oy oxiri
  let fromDate = parseDate(sp.from, defFrom);
  let toDate = parseDate(sp.to, defTo);
  if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate]; // xato oraliqni tuzatish
  const toEnd = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: fromDate, lte: toEnd } },
    select: { createdAt: true },
  });
  const total = leads.length;

  // Oylar bo'yicha guruhlash
  const spanYears = fromDate.getFullYear() !== toDate.getFullYear();
  const buckets = new Map<string, BarPoint>();
  const order: string[] = [];
  let cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}`;
    buckets.set(key, {
      label: MONTHS_UZ[cur.getMonth()] + (spanYears ? ` '${String(cur.getFullYear()).slice(2)}` : ""),
      value: 0,
    });
    order.push(key);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  for (const l of leads) {
    const d = l.createdAt;
    const b = buckets.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (b) b.value++;
  }
  const data = order.map((k) => buckets.get(k)!);

  const inputCls = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <>
      <div className="mb-4">
        <Link href="/reports" className="text-sm text-brand-600 hover:underline">← {tr(s.locale, { uz: "Hisobotlar", ru: "Отчёты", en: "Reports" })}</Link>
      </div>
      <PageHeader title={tr(s.locale, { uz: "Lidlar hisobotlari", ru: "Отчёты по лидам", en: "Leads reports" })} />

      {/* Lidlar soni kartochkasi */}
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-l-4 border-slate-200/70 border-l-brand-500 bg-white p-5 shadow-card dark:border-slate-800 dark:border-l-brand-500 dark:bg-slate-900">
        <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {tr(s.locale, { uz: "Lidlar soni", ru: "Количество лидов", en: "Number of leads" })}: {total}{" "}
          <span className="font-normal text-slate-400">({toDisplay(fromDate)} — {toDisplay(toDate)})</span>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
          <Icon name="coins" className="h-6 w-6" />
        </div>
      </div>

      {/* Sana oralig'i + grafik */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="date" name="from" defaultValue={toInput(fromDate)} className={inputCls} />
          <input type="date" name="to" defaultValue={toInput(toDate)} className={inputCls} />
          <button type="submit" className="h-10 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            {tr(s.locale, { uz: "Hisoblang", ru: "Рассчитать", en: "Calculate" })}
          </button>
          <ExportButton filename={`lidlar_${toInput(fromDate)}_${toInput(toDate)}`} rows={data} locale={s.locale} />
        </form>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <BarChart data={data} seriesLabel={tr(s.locale, { uz: "Lidlar soni", ru: "Количество лидов", en: "Number of leads" })} />
        </div>
      </div>
    </>
  );
}
