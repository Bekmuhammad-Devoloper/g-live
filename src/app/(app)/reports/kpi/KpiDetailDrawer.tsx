"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { LEAD_STAGE_LABELS, PAYMENT_METHOD_LABELS, formatMoney, label, type Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import LogoLoader from "../../_components/LogoLoader";
import { Avatar, CAT_ICON, CAT_LABEL, type VKpiRow } from "./KpiShared";
import { getKpiDetails, type KpiDetails } from "./actions";

export type KpiDetailTab = "leads" | "paid" | "lost" | "coll";

const PAGE = 100;
const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

interface Item {
  key: string;
  href: string;
  title: string;
  sub: string;
  right?: string;
  rightSub?: string;
  badge?: { text: string; tone: string };
}

export default function KpiDetailDrawer({ row, tab: initialTab, locale, onClose }: { row: VKpiRow; tab: KpiDetailTab; locale: Locale; onClose: () => void }) {
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<KpiDetails | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<KpiDetailTab>(initialTab);
  const [month, setMonth] = useState(initialTab !== "leads" && initialTab !== "lost");
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    setMounted(true);
    let alive = true;
    getKpiDetails(row.id)
      .then((r) => { if (!alive) return; if (r.data) setData(r.data); else setErr(true); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [row.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => setLimit(PAGE), [tab, month]);

  const view = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const inMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const pick = <T,>(arr: T[], at: (x: T) => string) => (month ? arr.filter((x) => inMonth(at(x))) : arr);
    const leads = pick(data.leads, (l) => l.createdAt);
    const direct = pick(data.direct, (d) => d.createdAt);
    const paid = pick(data.paid, (p) => p.paidAt);
    const coll = pick(data.collections, (c) => c.createdAt);
    const lost = leads.filter((l) => l.stage === "LOST");
    const paidSum = paid.reduce((n, p) => n + p.amount, 0);
    const collSum = coll.reduce((n, c) => n + c.amount, 0);
    return { leads, direct, paid, coll, lost, paidSum, collSum };
  }, [data, month]);

  if (!mounted) return null;

  const pct = data?.kpiPercent ?? row.bonus;
  const cpct = data?.collectPercent ?? row.collectPct;
  const isAdmin = (data?.role ?? row.role) === "ADMIN";
  const kpiOf = (amount: number, p: number) => Math.round((amount * p) / 100);
  const money = (n: number) => formatMoney(n, locale);
  const directLabel = L("to'g'ridan qo'shilgan o'quvchi", "добавлен напрямую", "added directly", "direkt hinzugefügt");

  const items: Item[] = !view ? [] : tab === "leads"
    ? [
        ...view.leads.map((l) => ({
          key: l.id,
          href: `/crm/${l.id}`,
          title: l.name,
          sub: `${l.phone} · ${fmtDate(l.createdAt)}`,
          badge: { text: label(LEAD_STAGE_LABELS, l.stage, locale), tone: l.stage === "WON" ? "bg-emerald-500/15 text-emerald-600" : l.stage === "LOST" ? "bg-rose-500/15 text-rose-600" : "bg-slate-500/10 text-slate-500" },
        })),
        ...view.direct.map((d) => ({
          key: `d${d.studentId}`,
          href: `/students/${d.studentId}`,
          title: d.name,
          sub: `${directLabel} · ${fmtDate(d.createdAt)}`,
          badge: { text: L("O'quvchi", "Ученик", "Student", "Schüler"), tone: "bg-sky-500/15 text-sky-600" },
        })),
      ]
    : tab === "lost"
      ? view.lost.map((l) => ({ key: l.id, href: `/crm/${l.id}`, title: l.name, sub: `${l.phone} · ${fmtDate(l.createdAt)}` }))
      : tab === "paid"
        ? view.paid.map((p) => ({
            key: p.studentId,
            href: `/students/${p.studentId}`,
            title: p.name,
            sub: `${fmtDate(p.paidAt)} · ${L("1-to'lov", "1-я оплата", "1st payment", "1. Zahlung")}${p.leadId ? "" : ` · ${directLabel}`}`,
            right: money(p.amount),
            rightSub: `KPI +${money(kpiOf(p.amount, pct))}`,
          }))
        : view.coll.map((c) => ({
            key: c.id,
            href: `/students/${c.studentId}`,
            title: c.name,
            sub: `${fmtDate(c.createdAt)} · ${label(PAYMENT_METHOD_LABELS, c.method, locale)}`,
            right: money(c.amount),
            rightSub: `KPI +${money(kpiOf(c.amount, cpct))}`,
          }));

  const tabs: { key: KpiDetailTab; text: string; short: string; count: number }[] = view
    ? [
        { key: "leads", text: L("Lidlar", "Лиды", "Leads", "Leads"), short: L("Lidlar", "Лиды", "Leads", "Leads"), count: view.leads.length + view.direct.length },
        { key: "paid", text: L("To'lov qilganlar", "Оплатившие", "Paid", "Bezahlt"), short: L("To'lov qilgan", "Оплатили", "Paid", "Bezahlt"), count: view.paid.length },
        { key: "lost", text: L("Bloklangan", "Заблокировано", "Blocked", "Blockiert"), short: L("Bloklangan", "Блок", "Blocked", "Blockiert"), count: view.lost.length },
        ...(isAdmin ? [{ key: "coll" as const, text: L("Qabul qilgan to'lovlar", "Принятые оплаты", "Accepted payments", "Angenommene Zahlungen"), short: L("Qabul qilgan", "Принято", "Accepted", "Angenommen"), count: view.coll.length }] : []),
      ]
    : [];

  const summary = !view ? null
    : tab === "paid" ? { n: view.paid.length, sum: view.paidSum, kpi: kpiOf(view.paidSum, pct), p: pct }
    : tab === "coll" ? { n: view.coll.length, sum: view.collSum, kpi: kpiOf(view.collSum, cpct), p: cpct }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <Avatar name={row.name} cat={row.cat} size={40} imageUrl={row.imageUrl} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{row.name}</div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Icon name={CAT_ICON[row.cat]} className="h-3 w-3" />
              {tr(locale, CAT_LABEL[row.cat])}
              <span>· {L("sotuv", "продажи", "sales", "Verkauf")} {pct}%{isAdmin ? ` · ${L("qabul", "приём", "accepted", "angenommen")} ${cpct}%` : ""}</span>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10" aria-label={L("Yopish", "Закрыть", "Close", "Schließen")}>
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 px-5 py-3 dark:border-white/10">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {[
              { on: true, text: L("Shu oy", "Этот месяц", "This month", "Dieser Monat") },
              { on: false, text: L("Hammasi", "Всё время", "All time", "Gesamt") },
            ].map((o) => (
              <button
                key={o.text}
                type="button"
                onClick={() => setMonth(o.on)}
                className={cn("rounded-md px-3 py-1 text-xs font-semibold transition", month === o.on ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}
              >
                {o.text}
              </button>
            ))}
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                title={t.text}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1.5 transition",
                  tab === t.key ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5",
                )}
              >
                <span className="text-base font-bold leading-none tabular-nums">{t.count}</span>
                <span className="text-center text-[10.5px] font-semibold leading-tight">{t.short}</span>
              </button>
            ))}
          </div>
          {summary && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs dark:bg-emerald-500/10">
              <span className="text-slate-600 dark:text-slate-300">
                {summary.n} {L("ta to'lov", "оплат", "payments", "Zahlungen")} · <b className="tabular-nums text-slate-800 dark:text-slate-100">{money(summary.sum)}</b>
              </span>
              <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">KPI {summary.p}% = {money(summary.kpi)}</span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {err ? (
            <p className="px-5 py-12 text-center text-sm text-rose-500">{L("Ma'lumotni yuklab bo'lmadi", "Не удалось загрузить данные", "Could not load data", "Daten konnten nicht geladen werden")}</p>
          ) : !view ? (
            <div className="grid place-items-center py-20"><LogoLoader size={64} /></div>
          ) : items.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-400">{L("Bu davrda yozuv yo'q", "За этот период записей нет", "No records for this period", "Keine Einträge in diesem Zeitraum")}</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {items.slice(0, limit).map((it) => (
                <Link key={it.key} href={it.href} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{it.title}</div>
                    <div className="truncate text-[11.5px] text-slate-400">{it.sub}</div>
                  </div>
                  {it.badge && <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold", it.badge.tone)}>{it.badge.text}</span>}
                  {it.right && (
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{it.right}</div>
                      <div className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{it.rightSub}</div>
                    </div>
                  )}
                </Link>
              ))}
              {items.length > limit && (
                <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="w-full py-3 text-center text-xs font-semibold text-brand-600 hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                  {L("Yana ko'rsatish", "Показать ещё", "Show more", "Mehr anzeigen")} ({items.length - limit})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
