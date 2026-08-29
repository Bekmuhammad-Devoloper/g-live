"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatMoney, label, EDU_STATUS_LABELS, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";

export interface VDebtor {
  studentId: string;
  student: string;
  phone: string;
  group: string | null;
  course: string | null;
  debt: number;
  due: string | null; // ISO
  status: string;
  hasTask: boolean;
}

const FAOL = ["ACTIVE", "WAITING", "FROZEN"];
const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export default function DebtorsView({ debtors, groups, locale }: { debtors: VDebtor[]; groups: string[]; locale: Locale }) {
  const [q, setQ] = useState("");
  const [holati, setHolati] = useState("FAOL");
  const [group, setGroup] = useState("");
  const [debtMin, setDebtMin] = useState("");
  const [debtMax, setDebtMax] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vazifa, setVazifa] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = debtMin ? Number(debtMin.replace(/\D/g, "")) : 0;
    const max = debtMax ? Number(debtMax.replace(/\D/g, "")) : Infinity;
    return debtors.filter((d) => {
      if (needle && !d.student.toLowerCase().includes(needle) && !d.phone.toLowerCase().includes(needle)) return false;
      if (holati === "FAOL" && !FAOL.includes(d.status)) return false;
      if (holati === "ARXIV" && FAOL.includes(d.status)) return false;
      if (group && d.group !== group) return false;
      if (d.debt < min || d.debt > max) return false;
      if (from && (d.due ?? "").slice(0, 10) < from) return false;
      if (to && (d.due ?? "9999").slice(0, 10) > to) return false;
      if (vazifa === "bor" && !d.hasTask) return false;
      if (vazifa === "yoq" && d.hasTask) return false;
      return true;
    });
  }, [debtors, q, holati, group, debtMin, debtMax, from, to, vazifa]);

  const total = filtered.reduce((n, d) => n + d.debt, 0);

  const exportCsv = () => {
    const head = [
      tr(locale, { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" }),
      tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }),
      tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" }),
      tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" }),
      tr(locale, { uz: "Qarz miqdori", ru: "Сумма долга", en: "Debt amount", de: "Schuldenbetrag" }),
      tr(locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" }),
    ];
    const lines = filtered.map((d) => [d.student, d.phone, d.group ?? "", d.course ?? "", String(d.debt), label(EDU_STATUS_LABELS, d.status, locale)]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "qarzdorlar.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setQ(""); setHolati("FAOL"); setGroup(""); setDebtMin(""); setDebtMax(""); setFrom(""); setTo(""); setVazifa(""); };

  return (
    <div className="space-y-5">
      <h1 className="flex items-baseline gap-3 text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {tr(locale, { uz: "Qarzdorlar", ru: "Должники", en: "Debtors", de: "Schuldner" })}
        <span className="text-sm font-normal text-slate-400">{tr(locale, { uz: "Miqdor", ru: "Количество", en: "Count", de: "Anzahl" })} — {filtered.length}</span>
      </h1>

      {/* Statistika */}
      <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xl text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}: <span className="font-bold text-slate-900 dark:text-slate-100">{formatMoney(total, locale)}</span></div>
          <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
        </div>
      </div>

      {/* Filtrlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FField label={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search", de: "Suchen" })}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Ism yoki telefon", ru: "Имя или телефон", en: "Name or phone", de: "Name oder Telefon" })} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Talaba holati", ru: "Статус ученика", en: "Student status", de: "Schülerstatus" })}>
          <Sel value={holati} onChange={setHolati} allowEmpty={false} locale={locale}
            options={[["FAOL", tr(locale, { uz: "Faol", ru: "Активные", en: "Active", de: "Aktiv" })], ["ARXIV", tr(locale, { uz: "Arxivlangan", ru: "Архивные", en: "Archived", de: "Archiviert" })], ["ALL", tr(locale, { uz: "Barchasi", ru: "Все", en: "All", de: "Alle" })]]} />
        </FField>
        <FField label={tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}><Sel value={group} onChange={setGroup} options={groups.map((g) => [g, g])} locale={locale} /></FField>
        <FField label={tr(locale, { uz: "Qarz miqdori (oldin)", ru: "Сумма долга (от)", en: "Debt amount (from)", de: "Schuldenbetrag (von)" })}><input value={debtMin} onChange={(e) => setDebtMin(e.target.value)} placeholder="min" className={inp} /></FField>
        <FField label={tr(locale, { uz: "Qarz miqdori (gacha)", ru: "Сумма долга (до)", en: "Debt amount (to)", de: "Schuldenbetrag (bis)" })}><input value={debtMax} onChange={(e) => setDebtMax(e.target.value)} placeholder="max" className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sanadan boshlab", ru: "С даты", en: "From date", de: "Ab Datum" })}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sana bo'yicha", ru: "По дату", en: "To date", de: "Bis Datum" })}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Vazifa", ru: "Задача", en: "Task", de: "Aufgabe" })}><Sel value={vazifa} onChange={setVazifa} options={[["bor", tr(locale, { uz: "Vazifasi bor", ru: "С задачей", en: "Has task", de: "Mit Aufgabe" })], ["yoq", tr(locale, { uz: "Vazifasi yo'q", ru: "Без задачи", en: "No task", de: "Ohne Aufgabe" })]]} locale={locale} /></FField>
        <div className="flex items-end">
          <button onClick={reset} className="h-11 rounded-full bg-brand-800 px-8 text-sm font-semibold text-white transition hover:bg-brand-900">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}</button>
        </div>
      </div>

      {/* Natija */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 px-5 py-5 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          {tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-white pb-16 shadow-card dark:border-slate-600 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3.5">{tr(locale, { uz: "Talaba ismi", ru: "Имя ученика", en: "Student name", de: "Name des Schülers" })}</th>
                  <th className="px-4 py-3.5">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</th>
                  <th className="px-4 py-3.5">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}</th>
                  <th className="px-4 py-3.5">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })}</th>
                  <th className="px-4 py-3.5">{tr(locale, { uz: "Qarz miqdori", ru: "Сумма долга", en: "Debt amount", de: "Schuldenbetrag" })}</th>
                  <th className="px-4 py-3.5">{tr(locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" })}</th>
                  <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((d) => (
                  <tr key={d.studentId} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {d.student}
                      {d.hasTask && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{tr(locale, { uz: "vazifa", ru: "задача", en: "task", de: "Aufgabe" })}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{d.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.group ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{d.course ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">{formatMoney(d.debt, locale)}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", FAOL.includes(d.status) ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>{label(EDU_STATUS_LABELS, d.status, locale)}</span></td>
                    <td className="px-4 py-3 text-right">
                      <Link href="/payments" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700">
                        <Icon name="coins" className="h-3.5 w-3.5" /> {tr(locale, { uz: "To'lov", ru: "Платёж", en: "Payment", de: "Zahlung" })}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={exportCsv} title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}
            className="absolute bottom-4 right-4 grid h-12 w-12 place-items-center rounded-full border-2 border-emerald-500 bg-white text-emerald-600 shadow-card transition hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/30">
            <Icon name="download" className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

function FField({ label: lb, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{lb}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options, allowEmpty = true, locale }: { value: string; onChange: (v: string) => void; options: [string, string][]; allowEmpty?: boolean; locale: Locale }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={cn("h-11 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none focus:border-brand-400 dark:bg-slate-800/60", value ? "border-brand-300 text-slate-700 dark:text-slate-100" : "border-slate-300 text-slate-400 dark:border-slate-600")}>
        {allowEmpty && <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
