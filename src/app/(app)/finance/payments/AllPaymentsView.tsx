"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";

export interface VPayment {
  id: string;
  date: string; // ISO
  student: string;
  phone: string;
  group: string | null;
  course: string | null;
  teacher: string | null;
  method: string;
  amount: number;
  note: string | null;
  author: string | null;
  status: string;
}

interface Props {
  payments: VPayment[];
  options: { groups: string[]; courses: string[]; teachers: string[]; methods: string[]; staff: string[] };
  locale: Locale;
  defaultFrom: string;
  defaultTo: string;
}

type SortKey = "date" | "student" | "amount" | "method" | "teacher" | "note" | "author";

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export default function AllPaymentsView({ payments, options, locale, defaultFrom, defaultTo }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [method, setMethod] = useState("");
  const [sum, setSum] = useState("");
  const [staff, setStaff] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minSum = sum ? Number(sum.replace(/\D/g, "")) : 0;
    const list = payments.filter((p) => {
      const d = p.date.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (needle && !p.student.toLowerCase().includes(needle) && !p.phone.toLowerCase().includes(needle)) return false;
      if (group && p.group !== group) return false;
      if (course && p.course !== course) return false;
      if (teacher && p.teacher !== teacher) return false;
      if (method && p.method !== method) return false;
      if (staff && p.author !== staff) return false;
      if (minSum && p.amount < minSum) return false;
      return true;
    });
    list.sort((a, b) => {
      let av: string | number = "", bv: string | number = "";
      switch (sortKey) {
        case "date": av = a.date; bv = b.date; break;
        case "student": av = a.student; bv = b.student; break;
        case "amount": av = a.amount; bv = b.amount; break;
        case "method": av = a.method; bv = b.method; break;
        case "teacher": av = a.teacher ?? ""; bv = b.teacher ?? ""; break;
        case "note": av = a.note ?? ""; bv = b.note ?? ""; break;
        case "author": av = a.author ?? ""; bv = b.author ?? ""; break;
      }
      const r = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? r : -r;
    });
    return list;
  }, [payments, from, to, q, group, course, teacher, method, sum, staff, sortKey, sortDir]);

  const paid = filtered.filter((p) => p.status === "PAID");
  const total = paid.reduce((n, p) => n + p.amount, 0);

  const byMethod = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of paid) m.set(p.method, (m.get(p.method) ?? 0) + p.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [paid]);
  const maxMethod = Math.max(1, ...byMethod.map(([, v]) => v));

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Barcha to'lovlar", ru: "Все платежи", en: "All payments" })}</h1>

      {/* Statistika + breakdown */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="space-y-4">
          <StatCard title={tr(locale, { uz: "To'lovlar miqdori", ru: "Сумма платежей", en: "Payments amount" })} value={formatMoney(total, locale)} range={`${fmtDate(from)} — ${fmtDate(to)}`} />
          <StatCard title={tr(locale, { uz: "Sof foyda miqdori", ru: "Чистая прибыль", en: "Net profit amount" })} value={formatMoney(total, locale)} range={`${fmtDate(from)} — ${fmtDate(to)}`} details locale={locale} />
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-600 dark:text-slate-300">{tr(locale, { uz: "To'lov turlari bo'yicha", ru: "По типам платежей", en: "By payment type" })}</h3>
          {byMethod.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display" })}</div>
          ) : (
            <div className="space-y-2.5">
              {byMethod.map(([m, v]) => (
                <div key={m}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{m}</span>
                    <span className="text-slate-500">{formatMoney(v, locale)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / maxMethod) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtrlar */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <FField label={tr(locale, { uz: "Sanadan boshlab", ru: "С даты", en: "From date" })}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sana bo'yicha", ru: "По дату", en: "To date" })}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Ism yoki Telefon", ru: "Имя или телефон", en: "Name or phone" })}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search" })} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Guruhni tanlash", ru: "Выбор группы", en: "Select group" })}><Sel value={group} onChange={setGroup} options={options.groups} locale={locale} /></FField>
        <FField label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })}><Sel value={course} onChange={setCourse} options={options.courses} locale={locale} /></FField>
        <FField label={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" })}><Sel value={teacher} onChange={setTeacher} options={options.teachers} locale={locale} /></FField>
        <FField label={tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type" })}><Sel value={method} onChange={setMethod} options={options.methods} locale={locale} /></FField>
        <FField label={tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount" })}><input value={sum} onChange={(e) => setSum(e.target.value)} placeholder={tr(locale, { uz: "min summa", ru: "мин. сумма", en: "min amount" })} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Xodimni ismi", ru: "Имя сотрудника", en: "Staff name" })}><Sel value={staff} onChange={setStaff} options={options.staff} locale={locale} /></FField>
        <div className="flex items-end">
          <button onClick={() => { setFrom(defaultFrom); setTo(defaultTo); setQ(""); setGroup(""); setCourse(""); setTeacher(""); setMethod(""); setSum(""); setStaff(""); }}
            className="h-11 rounded-full bg-brand-800 px-8 text-sm font-semibold text-white transition hover:bg-brand-900">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}</button>
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total" })}: <b className="text-slate-800 dark:text-slate-100">{filtered.length}</b> {tr(locale, { uz: "ta", ru: "шт", en: "items" })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                {([["date",tr(locale,{uz:"Sana",ru:"Дата",en:"Date"})],["student",tr(locale,{uz:"Talaba ismi",ru:"Имя ученика",en:"Student name"})],["amount",tr(locale,{uz:"Sum",ru:"Сумма",en:"Amount"})],["method",tr(locale,{uz:"To'lov turi",ru:"Тип платежа",en:"Payment type"})],["teacher",tr(locale,{uz:"O'qituvchi",ru:"Преподаватель",en:"Teacher"})],["note",tr(locale,{uz:"Izoh",ru:"Примечание",en:"Note"})],["author",tr(locale,{uz:"Xodim",ru:"Сотрудник",en:"Staff"})]] as [SortKey,string][]).map(([k, lb]) => (
                  <th key={k} className="cursor-pointer select-none px-4 py-3.5" onClick={() => toggleSort(k)}>
                    <span className="inline-flex items-center gap-1">{lb}<span className="text-brand-500">{sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}</span></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display" })}</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className={cn("transition hover:bg-slate-50 dark:hover:bg-slate-800/40", p.status === "CANCELLED" && "opacity-50")}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(p.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{p.student}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(p.amount, locale)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.method}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.teacher ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.note ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{p.author ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

function StatCard({ title, value, range, details, locale }: { title: string; value: string; range: string; details?: boolean; locale?: Locale }) {
  return (
    <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg text-slate-600 dark:text-slate-300">{title}: <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</span></div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400"><Icon name="calendar" className="h-3.5 w-3.5" /> {range}</div>
        </div>
        <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
      </div>
      {details && <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-400 dark:border-slate-800"><Icon name="info" className="h-3.5 w-3.5" /> {tr(locale ?? "uz", { uz: "Tafsilotlar", ru: "Подробности", en: "Details" })}</div>}
    </div>
  );
}

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options, locale }: { value: string; onChange: (v: string) => void; options: string[]; locale: Locale }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={cn("h-11 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-800/60", value ? "border-brand-300 text-slate-700 dark:border-brand-500/40 dark:text-slate-100" : "border-slate-300 text-slate-400 dark:border-slate-600")}>
        <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select" })}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
