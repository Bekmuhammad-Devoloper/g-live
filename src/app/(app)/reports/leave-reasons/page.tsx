import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LeaveFilters from "./LeaveFilters";
import LeaveExport from "./LeaveExport";
import type { Prisma } from "@prisma/client";

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const LEFT_STATUS = ["EXPELLED", "TRANSFERRED"];

type Tr = { uz: string; ru: string; en: string };
const TABS: { key: string; tab: Tr; title: Tr }[] = [
  { key: "umumiy", tab: { uz: "Umumiy ketganlar", ru: "Всего ушедшие", en: "All leavers" }, title: { uz: "Umumiy ketgan o'quvchilar", ru: "Все ушедшие ученики", en: "All students who left" } },
  { key: "buyurtma", tab: { uz: "Buyurtmadan ketganlar", ru: "Ушедшие из заявки", en: "Left from lead" }, title: { uz: "Buyurtmadan ketgan o'quvchilar", ru: "Ученики, ушедшие из заявки", en: "Students who left from lead" } },
  { key: "tolov_yoq", tab: { uz: "To'lov qilmasdan ketganlar", ru: "Ушли без оплаты", en: "Left without payment" }, title: { uz: "To'lov qilmasdan ketgan o'quvchilar", ru: "Ученики, ушедшие без оплаты", en: "Students who left without payment" } },
  { key: "tolov_bor", tab: { uz: "To'lov qilib ketganlar", ru: "Ушли после оплаты", en: "Left after payment" }, title: { uz: "To'lov qilib ketgan o'quvchilar", ru: "Ученики, ушедшие после оплаты", en: "Students who left after payment" } },
];

export default async function LeaveReasonsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section." })} />;
  }
  const sp = await searchParams;
  const tab = TABS.find((x) => x.key === sp.tab)?.key ?? "umumiy";
  const now = new Date();
  const fromStr = sp.from || iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const toStr = sp.to || iso(now);
  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59");
  const reason = sp.reason || "";

  // Sababi ro'yxati — yo'qotilgan lidlarning sabablari
  const distinctReasons = await prisma.lead.findMany({
    where: { AND: [{ stage: "LOST", lossReason: { not: null } }, branchWhere(s)] }, // faol filial doirasida
    select: { lossReason: true }, distinct: ["lossReason"],
  });
  const reasons = distinctReasons.map((x) => x.lossReason!).filter(Boolean);

  let count = 0;
  let rows: { name: string; count: number }[] = [];

  if (tab === "buyurtma") {
    // Buyurtmadan ketganlar = yo'qotilgan lidlar (lossReason bo'yicha)
    const leads = await prisma.lead.findMany({
      // faol filial doirasida
      where: { AND: [{ stage: "LOST", updatedAt: { gte: from, lte: to }, ...(reason ? { lossReason: reason } : {}) }, branchWhere(s)] },
      select: { lossReason: true },
    });
    count = leads.length;
    const m = new Map<string, number>();
    for (const l of leads) { const k = l.lossReason || tr(s.locale, { uz: "Belgilanmagan", ru: "Не указано", en: "Unspecified" }); m.set(k, (m.get(k) ?? 0) + 1); }
    rows = [...m.entries()].map(([name, c]) => ({ name, count: c })).sort((a, b) => b.count - a.count);
  } else {
    const where: Prisma.StudentWhereInput = { eduStatus: { in: LEFT_STATUS }, updatedAt: { gte: from, lte: to } };
    if (tab === "tolov_yoq") where.payments = { none: { status: "PAID" } };
    if (tab === "tolov_bor") where.payments = { some: { status: "PAID" } };
    count = await prisma.student.count({ where: { AND: [where, branchWhere(s)] } }); // faol filial doirasida
    rows = count > 0 ? [{ name: tr(s.locale, { uz: "Belgilanmagan", ru: "Не указано", en: "Unspecified" }), count }] : [];
  }

  const active = TABS.find((x) => x.key === tab)!;
  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "umumiy") p.set("tab", key);
    if (sp.from) p.set("from", sp.from);
    if (sp.to) p.set("to", sp.to);
    const q = p.toString();
    return q ? `/reports/leave-reasons?${q}` : "/reports/leave-reasons";
  };

  return (
    <div className="space-y-5">
      {/* Tablar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tb) => (
          <Link key={tb.key} href={tabHref(tb.key)}
            className={cn("rounded-lg px-4 py-2.5 text-sm font-semibold transition",
              tab === tb.key ? "bg-brand-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300")}>
            {tr(s.locale, tb.tab)}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Chap: sarlavha + son */}
        <div className="lg:w-80">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, active.title)}</h1>
            <span className="grid h-9 min-w-9 place-items-center rounded-full bg-brand-600 px-2 text-base font-bold text-white">{count}</span>
          </div>
        </div>

        {/* O'ng: filtr + jadval */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <LeaveFilters from={fromStr} to={toStr} reason={reason} reasons={reasons} locale={s.locale} />
            <LeaveExport rows={rows} filename={`ketganlar-${tab}`} locale={s.locale} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="w-16 px-5 py-3">№</th>
                  <th className="px-5 py-3">{tr(s.locale, { uz: "Sabab nomi", ru: "Причина", en: "Reason" })}</th>
                  <th className="px-5 py-3 text-right">{tr(s.locale, { uz: "Ketgan o'quvchi soni", ru: "Число ушедших учеников", en: "Number of students who left" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr><td colSpan={3} className="py-14 text-center text-slate-400">{tr(s.locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
