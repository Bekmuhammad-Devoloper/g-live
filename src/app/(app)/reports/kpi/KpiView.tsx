"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import KpiChart from "./KpiChart";
import KpiTable from "./KpiTable";
import {
  avg1,
  Avatar,
  CAT_LABEL,
  firstName,
  kpiColor,
  MEDAL,
  PanelHead,
  TABS,
  TONE,
  type Cat,
  type VKpiRow,
} from "./KpiShared";

export type { Cat, VKpiRow } from "./KpiShared";

export default function KpiView({ rows, locale, canEdit = false }: { rows: VKpiRow[]; locale: Locale; canEdit?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Cat>("operator");

  // Toifalar bo'yicha ajratish va KPI% bo'yicha saralash (eng yuqori — birinchi).
  const byCat = useMemo(() => {
    const sort = (a: VKpiRow, b: VKpiRow) => b.kpiPct - a.kpiPct || b.won - a.won;
    return {
      operator: rows.filter((r) => r.cat === "operator").sort(sort),
      rop: rows.filter((r) => r.cat === "rop").sort(sort),
      admin: rows.filter((r) => r.cat === "admin").sort(sort),
    } as Record<Cat, VKpiRow[]>;
  }, [rows]);

  const ops = byCat.operator;
  const group = byCat[tab];

  // Yuqoridagi ko'rsatkichlar — eski loyihadagidek doim operatorlar bo'yicha.
  const avgKpi = avg1(ops.map((o) => o.kpiPct));
  const avgConv = avg1(ops.map((o) => o.conv));
  const totalLeads = ops.reduce((n, o) => n + o.total, 0);
  const highPerformers = ops.filter((o) => o.kpiPct >= 80).length;
  const best = ops[0];

  const t = {
    title: tr(locale, { uz: "KPI & Reyting", ru: "KPI и Рейтинг", en: "KPI & Rating" }),
    operator: tr(locale, { uz: "operator", ru: "оператор", en: "operator" }),
    admin: tr(locale, { uz: "admin", ru: "админ", en: "admin" }),
    avgKpi: tr(locale, { uz: "O'rtacha KPI", ru: "Средний KPI", en: "Average KPI" }),
    refresh: tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh" }),
    bestOperator: tr(locale, { uz: "Eng yaxshi operator", ru: "Лучший оператор", en: "Best operator" }),
    operators: tr(locale, { uz: "Operatorlar", ru: "Операторы", en: "Operators" }),
    avgConv: tr(locale, { uz: "O'rtacha konversiya", ru: "Средняя конверсия", en: "Average conversion" }),
    noData: tr(locale, { uz: "Ma'lumot yo'q", ru: "Нет данных", en: "No data" }),
    topSub: tr(locale, { uz: "Eng yuqori KPI ko'rsatkichlari", ru: "Самые высокие показатели KPI", en: "Highest KPI performers" }),
    compare: tr(locale, { uz: "KPI taqqoslash", ru: "Сравнение KPI", en: "KPI comparison" }),
    employees: tr(locale, { uz: "xodim", ru: "сотрудников", en: "employees" }),
    lead: tr(locale, { uz: "lid", ru: "лид", en: "leads" }),
  };

  const catLabel = tr(locale, CAT_LABEL[tab]);

  return (
    <div className="space-y-4">
      {/* ── Sarlavha kartasi ── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-soft ring-2 ring-amber-500/10">
              <Icon name="chart" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                {byCat.operator.length} {t.operator} &middot; {byCat.rop.length} ROP &middot; {byCat.admin.length} {t.admin} &middot; {t.avgKpi}:{" "}
                <span className="font-semibold text-brand-500">{avgKpi}%</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            title={t.refresh}
            aria-label={t.refresh}
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Icon name="refresh" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── 4 ta ko'rsatkich ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="chart"
          grad="from-emerald-500 to-green-600"
          label={t.avgKpi}
          value={`${avgKpi}%`}
          sub={tr(locale, {
            uz: `${highPerformers} ta yuqori darajali`,
            ru: `${highPerformers} высокого уровня`,
            en: `${highPerformers} high performers`,
          })}
        />
        <Stat
          icon="award"
          grad="from-yellow-500 to-amber-600"
          label={t.bestOperator}
          value={best ? firstName(best.name) : "—"}
          sub={best ? `${best.kpiPct}% KPI` : t.noData}
        />
        <Stat
          icon="users"
          grad="from-blue-500 to-sky-600"
          label={t.operators}
          value={String(ops.length)}
          sub={tr(locale, { uz: `${byCat.rop.length} ta ROP`, ru: `РОП: ${byCat.rop.length}`, en: `${byCat.rop.length} ROP` })}
        />
        <Stat
          icon="eye"
          grad="from-purple-500 to-violet-600"
          label={t.avgConv}
          value={`${avgConv}%`}
          sub={tr(locale, { uz: `${totalLeads} ta lid`, ru: `${totalLeads} лидов`, en: `${totalLeads} leads` })}
        />
      </div>

      {/* ── Rol tablari ── */}
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200/70 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/60">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition",
              tab === x.key ? TONE[x.key].active : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <Icon name={x.icon} className="h-4 w-4" />
            {tr(locale, x.label)} ({byCat[x.key].length})
          </button>
        ))}
      </div>

      {/* ── Top 3 + KPI taqqoslash ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Top 3 */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <PanelHead
            icon="award"
            iconClass="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
            title={`Top 3 ${catLabel}`}
            sub={t.topSub}
          />
          {group.length === 0 ? (
            <div className="py-12 text-center">
              <Icon name="award" className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-400">{t.noData}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {group.slice(0, 3).map((o, i) => {
                const m = MEDAL[i];
                return (
                  <div
                    key={o.id}
                    className={cn(
                      "flex items-center gap-3.5 rounded-xl border p-3.5 transition",
                      i === 0
                        ? "border-yellow-500/20 bg-yellow-500/[0.04]"
                        : "border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-white/[0.02]",
                    )}
                  >
                    <div className="relative shrink-0">
                      <span className={cn("block rounded-full ring-2", m.ring)}>
                        <Avatar name={o.name} cat={o.cat} size={44} imageUrl={o.imageUrl} />
                      </span>
                      <span
                        className={cn(
                          "absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br text-white shadow-md",
                          m.grad,
                          m.shadow,
                        )}
                      >
                        <Icon name={m.icon} className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{o.name}</p>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Icon name="eye" className="h-3 w-3" /> {o.total} {t.lead}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Icon name="check" className="h-3 w-3" /> {o.won}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-black leading-none" style={{ color: kpiColor(o.kpiPct) }}>
                        {o.kpiPct}%
                      </p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">KPI</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KPI taqqoslash grafigi */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card lg:col-span-3 dark:border-slate-800 dark:bg-slate-900">
          <PanelHead
            icon="chart"
            iconClass="bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
            title={`${catLabel} ${t.compare}`}
            sub={`Top ${Math.min(10, group.length)} ${t.employees}`}
          />
          <KpiChart rows={group.slice(0, 10)} locale={locale} />
        </div>
      </div>

      {/* ── To'liq jadval ── */}
      <KpiTable rows={group} tab={tab} locale={locale} canEdit={canEdit} />
    </div>
  );
}

/** Yuqoridagi 4 ta ko'rsatkich kartasi (eski loyihadagi gradient ikonkali karta). */
function Stat({ icon, grad, label, value, sub }: { icon: string; grad: string; label: string; value: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className={cn("pointer-events-none absolute -right-2 -top-2 h-12 w-12 rounded-full bg-gradient-to-br opacity-[0.08]", grad)} />
      <div className="relative mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm", grad)}>
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="truncate text-2xl font-black leading-none text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}
