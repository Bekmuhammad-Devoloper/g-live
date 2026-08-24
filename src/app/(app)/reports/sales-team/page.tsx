import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES, formatMoney, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden, StatCard } from "../../_components/ui";
import DateNav from "./DateNav";
import RopManager from "./RopManager";
import type { Prisma } from "@prisma/client";

const ROP_MANAGE = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export default async function SalesTeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  const loc0 = s.locale as Locale;
  if (!canRead(s.role, MODULES.REPORTS) && !canRead(s.role, MODULES.CRM)) {
    return <Forbidden title={tr(loc0, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(loc0, { uz: "Bu bo'lim savdo bo'limi uchun.", ru: "Этот раздел для отдела продаж.", en: "This section is for the sales department." })} />;
  }
  const sp = await searchParams;
  const now = new Date();
  const fromStr = sp.from || iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const toStr = sp.to || iso(now);
  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59");
  const loc = s.locale as Locale;

  // faol filial doirasida
  const rangeLead: Prisma.LeadWhereInput = { AND: [{ managerId: { not: null }, createdAt: { gte: from, lte: to } }, branchWhere(s)] };
  // faol filial operatorlarining qo'ng'iroqlari
  const rangeCall: Prisma.CallWhereInput = { AND: [{ operatorId: { not: null }, startedAt: { gte: from, lte: to } }, { operator: branchWhere(s) }] };

  const [ops, leads, calls] = await Promise.all([
    // faol filial doirasida
    prisma.user.findMany({ where: { AND: [{ role: ROLES.OPERATOR, isActive: true }, branchWhere(s)] }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, fiksa: true, position: true } }),
    prisma.lead.findMany({ where: rangeLead, select: { managerId: true, stage: true } }),
    prisma.call.findMany({ where: rangeCall, select: { operatorId: true, duration: true, startedAt: true, leadId: true } }),
  ]);

  interface Agg { leads: number; won: number; seconds: number; days: Set<string>; leadsCalled: Set<string>; calls: number }
  const map = new Map<string, Agg>();
  for (const o of ops) map.set(o.id, { leads: 0, won: 0, seconds: 0, days: new Set(), leadsCalled: new Set(), calls: 0 });
  const g = (id: string | null) => (id && map.get(id)) || null;

  for (const l of leads) { const a = g(l.managerId); if (a) { a.leads++; if (l.stage === "WON") a.won++; } }
  for (const c of calls) { const a = g(c.operatorId); if (a) { a.calls++; a.seconds += c.duration; a.days.add(iso(c.startedAt)); if (c.leadId) a.leadsCalled.add(c.leadId); } }

  const rows = ops.map((o) => {
    const a = map.get(o.id)!;
    const days = Math.max(1, a.days.size);
    const conv = a.leads > 0 ? Math.round((a.won / a.leads) * 100) : 0;
    const callsPerDay = a.calls / days;
    const kpi = Math.round(0.6 * conv + 0.4 * Math.min(100, callsPerDay * 12));
    return {
      id: o.id, name: o.fullName, fiksa: o.fiksa, isRop: o.position === "ROP",
      kpi, conv, leads: a.leads, won: a.won,
      totalMin: Math.round(a.seconds / 60),
      dailyMin: Math.round(a.seconds / 60 / days),
      leadsPerDay: Math.round((a.leadsCalled.size / days) * 10) / 10,
    };
  }).sort((x, y) => y.leads - x.leads || y.kpi - x.kpi);

  const team = {
    operators: rows.length,
    leads: rows.reduce((n, r) => n + r.leads, 0),
    won: rows.reduce((n, r) => n + r.won, 0),
    avgConv: rows.length ? Math.round(rows.reduce((n, r) => n + r.conv, 0) / rows.length) : 0,
  };

  const kpiTone = (v: number) => (v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444");
  const canManageRop = ROP_MANAGE.includes(s.role as never);
  const ropOps = rows.map((r) => ({ id: r.id, name: r.name, isRop: r.isRop }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(loc, { uz: "Savdo bo'limi", ru: "Отдел продаж", en: "Sales department" })}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <RopManager locale={loc} operators={ropOps} canManage={canManageRop} />
          <DateNav from={fromStr} to={toStr} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={tr(loc, { uz: "Operatorlar", ru: "Операторы", en: "Operators" })} value={team.operators} tone="brand" icon="users" />
        <StatCard label={tr(loc, { uz: "Jami leadlar", ru: "Всего лидов", en: "Total leads" })} value={team.leads} icon="download" />
        <StatCard label={tr(loc, { uz: "Muvaffaqiyatli", ru: "Успешные", en: "Successful" })} value={team.won} tone="green" icon="check" />
        <StatCard label={tr(loc, { uz: "O'rtacha konversiya", ru: "Средняя конверсия", en: "Average conversion" })} value={`${team.avgConv}%`} tone="amber" icon="chart" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="w-12 px-4 py-3">№</th><th className="px-4 py-3">{tr(loc, { uz: "Operator", ru: "Оператор", en: "Operator" })}</th><th className="px-4 py-3">{tr(loc, { uz: "Lavozim", ru: "Должность", en: "Position" })}</th>
                <th className="px-4 py-3 text-right">{tr(loc, { uz: "Fiksa", ru: "Фикса", en: "Fixed" })}</th><th className="px-4 py-3 text-center">KPI</th><th className="px-4 py-3 text-center">{tr(loc, { uz: "Konversiya", ru: "Конверсия", en: "Conversion" })}</th>
                <th className="px-4 py-3 text-center">{tr(loc, { uz: "Jami leedi", ru: "Всего лидов", en: "Total leads" })}</th><th className="px-4 py-3 text-center">{tr(loc, { uz: "Muvaffaqiyatli", ru: "Успешные", en: "Successful" })}</th>
                <th className="px-4 py-3 text-center">{tr(loc, { uz: "Umumiy daqiqa", ru: "Всего минут", en: "Total minutes" })}</th><th className="px-4 py-3 text-center">{tr(loc, { uz: "Kunlik daqiqa", ru: "Минут в день", en: "Minutes per day" })}</th><th className="px-4 py-3 text-center">{tr(loc, { uz: "Kuniga leed", ru: "Лидов в день", en: "Leads per day" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center text-slate-400">{tr(loc, { uz: "Savdo komandasi (menejer) topilmadi", ru: "Команда продаж (менеджеры) не найдена", en: "Sales team (managers) not found" })}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={r.isRop ? "rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "text-xs text-slate-500"}>{r.isRop ? "ROP" : tr(loc, { uz: "Operator", ru: "Оператор", en: "Operator" })}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatMoney(r.fiksa, loc)}</td>
                  <td className="px-4 py-3 text-center"><span className="font-bold" style={{ color: kpiTone(r.kpi) }}>{r.kpi}</span></td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">{r.conv}%</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300">{r.leads}</td>
                  <td className="px-4 py-3 text-center font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{r.won}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300">{r.totalMin}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-500">{r.dailyMin}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-500">{r.leadsPerDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-400">{tr(loc, { uz: "KPI = konversiya (60%) + qo'ng'iroq faolligi (40%). Umumiy/kunlik daqiqa va \"kuniga leed\" qo'ng'iroqlar jurnalidan (Call) hisoblanadi.", ru: "KPI = конверсия (60%) + активность звонков (40%). Всего/в день минут и \"лидов в день\" считаются из журнала звонков (Call).", en: "KPI = conversion (60%) + call activity (40%). Total/daily minutes and \"leads per day\" are calculated from the call log (Call)." })}</p>
    </div>
  );
}
