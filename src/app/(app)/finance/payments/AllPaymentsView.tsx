"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, label, PAYMENT_METHOD_LABELS, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportXlsx } from "@/lib/export";
import { Icon } from "../../_components/Icon";
import PromoBadge from "../../_components/PromoBadge";
import EditPaymentButton from "../../students/EditPaymentButton";
import LineChart, { monthlySeries } from "../_components/LineChart";
import GroupBadge from "../_components/GroupBadge";
import Pagination, { PAGE_SIZE, fmtDate, fmtDateTime, localDay } from "../_components/Pagination";

export interface VPayment {
  id: string;
  date: string; // ISO
  createdAt: string; // ISO — yozuv yaratilgan vaqt
  studentId: string;
  student: string;
  phone: string;
  groupId: string | null;
  group: string | null;
  course: string | null;
  teacher: string | null;
  method: string;
  amount: number;
  note: string | null;
  promoCode: string | null;
  discount: number;
  author: string | null;
  status: string; // PAID | CANCELLED
  cancelReason: string | null;
}

export interface VExpense {
  date: string; // ISO
  amount: number;
  method: string;
}

interface Props {
  payments: VPayment[];
  expenses: VExpense[];
  options: { groups: { id: string; name: string }[]; courses: string[]; teachers: string[]; methods: string[]; staff: string[] };
  locale: Locale;
  defaultFrom: string;
  defaultTo: string;
  /** To'lovni tahrirlash huquqi (rahbariyat, administrator, hisobchi) */
  canEdit?: boolean;
}

type SortKey = "date" | "student" | "amount" | "method" | "teacher" | "note" | "author";
type FilterKey = "from" | "to" | "q" | "group" | "course" | "teacher" | "method" | "sum" | "staff" | "cfrom" | "cto";

// Maxsus tanlov qiymatlari
const NO_GROUP = "__none__";
const CANCELLED = "__cancelled__";
const HIDDEN_KEY = "gl:finance-payments:hidden-filters";

export default function AllPaymentsView({ payments, expenses, options, locale, defaultFrom, defaultTo, canEdit = false }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [course, setCourse] = useState("");
  const [teacher, setTeacher] = useState("");
  const [method, setMethod] = useState("");
  const [sum, setSum] = useState("");
  const [staff, setStaff] = useState("");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [hidden, setHidden] = useState<FilterKey[]>([]);
  const [filterMenu, setFilterMenu] = useState(false);

  // Yashirilgan filtrlar shu brauzerda eslab qolinadi
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(JSON.parse(raw) as FilterKey[]);
    } catch { /* localStorage mavjud emas */ }
  }, []);
  const toggleHidden = (k: FilterKey) => {
    setHidden((h) => {
      const next = h.includes(k) ? h.filter((x) => x !== k) : [...h, k];
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch { /* e'tiborsiz */ }
      return next;
    });
  };

  const noGroup = group === NO_GROUP;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minSum = sum ? Number(sum.replace(/\D/g, "")) : 0;
    const list = payments.filter((p) => {
      if (method === CANCELLED ? p.status !== "CANCELLED" : p.status !== "PAID") return false;
      const d = localDay(p.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      const c = localDay(p.createdAt);
      if (cFrom && c < cFrom) return false;
      if (cTo && c > cTo) return false;
      if (needle && !p.student.toLowerCase().includes(needle) && !p.phone.toLowerCase().includes(needle)) return false;
      if (noGroup) { if (p.groupId) return false; }
      else {
        if (group && p.groupId !== group) return false;
        if (course && p.course !== course) return false;
        if (teacher && p.teacher !== teacher) return false;
      }
      if (method && method !== CANCELLED && p.method !== method) return false;
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
  }, [payments, from, to, cFrom, cTo, q, group, noGroup, course, teacher, method, sum, staff, sortKey, sortDir]);

  // Filtr o'zgarsa — birinchi sahifaga qaytish
  useEffect(() => { setPage(1); }, [from, to, cFrom, cTo, q, group, course, teacher, method, sum, staff]);

  const paid = filtered.filter((p) => p.status === "PAID");
  const total = paid.reduce((n, p) => n + p.amount, 0);

  // Sof foyda: shu davrdagi tushum − shu davrdagi xarajatlar (to'lov turi tanlangan bo'lsa — shu tur bo'yicha)
  const realMethod = method && method !== CANCELLED ? method : "";
  const periodExpenses = useMemo(
    () => expenses.filter((e) => {
      const d = localDay(e.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (realMethod && e.method !== realMethod) return false;
      return true;
    }),
    [expenses, from, to, realMethod],
  );
  const expenseTotal = periodExpenses.reduce((n, e) => n + e.amount, 0);
  const netProfit = total - expenseTotal;
  const profitBlocked = !!(q.trim() || group || course || teacher || sum);

  const byMethod = useMemo(() => {
    const m = new Map<string, { inc: number; exp: number }>();
    for (const p of paid) { const r = m.get(p.method) ?? { inc: 0, exp: 0 }; r.inc += p.amount; m.set(p.method, r); }
    for (const e of periodExpenses) { const r = m.get(e.method) ?? { inc: 0, exp: 0 }; r.exp += e.amount; m.set(e.method, r); }
    return [...m.entries()].sort((a, b) => (b[1].inc - b[1].exp) - (a[1].inc - a[1].exp));
  }, [paid, periodExpenses]);

  // Oylik tushum grafigi — oxirgi 12 oy (filial doirasidagi barcha PAID to'lovlar)
  const chart = useMemo(
    () => monthlySeries(payments.filter((p) => p.status === "PAID").map((p) => ({ day: localDay(p.date), amount: p.amount })), locale),
    [payments, locale],
  );

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const clearAll = () => {
    setFrom(defaultFrom); setTo(defaultTo); setQ(""); setGroup(""); setCourse(""); setTeacher("");
    setMethod(""); setSum(""); setStaff(""); setCFrom(""); setCTo("");
  };

  const L = {
    date: tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" }),
    student: tr(locale, { uz: "Talaba ismi", ru: "Имя ученика", en: "Student name", de: "Name des Schülers" }),
    amount: tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" }),
    method: tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" }),
    teacher: tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" }),
    note: tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" }),
    author: tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" }),
    group: tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" }),
    course: tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" }),
    created: tr(locale, { uz: "Yaratilgan vaqt", ru: "Время создания", en: "Created at", de: "Erstellt am" }),
    noData: tr(locale, { uz: "Ma'lumot yo'q", ru: "Нет данных", en: "No data", de: "Keine Daten" }),
  };

  const doExport = () => {
    void exportXlsx(
      `tolovlar_${from}_${to}`,
      [
        { key: "date", label: L.date },
        { key: "student", label: L.student },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }) },
        { key: "amount", label: L.amount },
        { key: "method", label: L.method },
        { key: "group", label: L.group },
        { key: "course", label: L.course },
        { key: "teacher", label: L.teacher },
        { key: "note", label: L.note },
        { key: "author", label: L.author },
        { key: "created", label: L.created },
      ],
      filtered.map((p) => ({
        date: fmtDate(p.date),
        student: p.student,
        phone: p.phone,
        amount: p.amount,
        method: label(PAYMENT_METHOD_LABELS, p.method, locale),
        group: p.group ?? "",
        course: p.course ?? "",
        teacher: p.teacher ?? "",
        note: [p.note, p.promoCode ? `${p.promoCode} (−${p.discount})` : "", p.status === "CANCELLED" ? p.cancelReason ?? "" : ""].filter(Boolean).join(" · "),
        author: p.author ?? "",
        created: fmtDateTime(p.createdAt),
      })),
      tr(locale, { uz: "To'lovlar", ru: "Платежи", en: "Payments", de: "Zahlungen" }),
    );
  };

  const range = `${fmtDate(from)} — ${fmtDate(to)}`;

  const filters: { key: FilterKey; label: string; node: React.ReactNode }[] = [
    { key: "from", label: tr(locale, { uz: "Sanadan", ru: "С даты", en: "From date", de: "Ab Datum" }), node: <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /> },
    { key: "to", label: tr(locale, { uz: "Sanagacha", ru: "По дату", en: "To date", de: "Bis Datum" }), node: <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /> },
    { key: "q", label: tr(locale, { uz: "Ism yoki telefon", ru: "Имя или телефон", en: "Name or phone", de: "Name oder Telefon" }), node: <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search", de: "Suche" })} className={inp} /> },
    {
      key: "group", label: L.group,
      node: <Sel value={group} onChange={(v) => { setGroup(v); if (v === NO_GROUP) { setCourse(""); setTeacher(""); } }} locale={locale}
        options={[{ value: NO_GROUP, label: tr(locale, { uz: "Guruhsiz", ru: "Без группы", en: "No group", de: "Ohne Gruppe" }) }, ...options.groups.map((g) => ({ value: g.id, label: g.name }))]} />,
    },
    { key: "course", label: L.course, node: <Sel value={course} onChange={setCourse} disabled={noGroup} locale={locale} options={options.courses.map((c) => ({ value: c, label: c }))} /> },
    { key: "teacher", label: L.teacher, node: <Sel value={teacher} onChange={setTeacher} disabled={noGroup} locale={locale} options={options.teachers.map((c) => ({ value: c, label: c }))} /> },
    {
      key: "method", label: L.method,
      node: <Sel value={method} onChange={setMethod} locale={locale}
        options={[...options.methods.map((m) => ({ value: m, label: label(PAYMENT_METHOD_LABELS, m, locale) })), { value: CANCELLED, label: tr(locale, { uz: "O'chirilganlar", ru: "Удалённые", en: "Deleted", de: "Gelöschte" }) }]} />,
    },
    { key: "sum", label: L.amount, node: <input value={sum} inputMode="numeric" onChange={(e) => setSum(e.target.value)} placeholder={tr(locale, { uz: "min summa", ru: "мин. сумма", en: "min amount", de: "Mindestbetrag" })} className={inp} /> },
    { key: "staff", label: L.author, node: <Sel value={staff} onChange={setStaff} locale={locale} options={options.staff.map((c) => ({ value: c, label: c }))} /> },
    { key: "cfrom", label: tr(locale, { uz: "Yaratilgan sanadan", ru: "Создано с", en: "Created from", de: "Erstellt ab" }), node: <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className={inp} /> },
    { key: "cto", label: tr(locale, { uz: "Yaratilgan sanagacha", ru: "Создано по", en: "Created to", de: "Erstellt bis" }), node: <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} className={inp} /> },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Barcha to'lovlar", ru: "Все платежи", en: "All payments", de: "Alle Zahlungen" })}</h1>

      {/* Statistika + oylik grafik */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_1fr]">
        <div className="space-y-4">
          <StatCard title={tr(locale, { uz: "To'lovlar miqdori", ru: "Сумма платежей", en: "Payments amount", de: "Zahlungsbetrag" })} value={formatMoney(total, locale)} range={range} />
          <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
            {profitBlocked ? (
              <div className="flex items-start gap-2.5 text-sm text-amber-700 dark:text-amber-300">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{tr(locale, {
                  uz: "Sof foyda guruh, kurs yoki o'qituvchiga bog'liq bo'lmagan xarajatlarga bog'liq. Ko'rish uchun ism, guruh, kurs, o'qituvchi va summa filtrlarini olib tashlang.",
                  ru: "Чистая прибыль зависит от расходов, не связанных с группой, курсом или преподавателем. Чтобы увидеть её, уберите фильтры имени, группы, курса, преподавателя и суммы.",
                  en: "Net profit depends on expenses that are not tied to a group, course or teacher. Remove the name, group, course, teacher and amount filters to see it.",
                  de: "Der Nettogewinn hängt von Ausgaben ab, die keiner Gruppe, keinem Kurs oder Lehrer zugeordnet sind. Entfernen Sie die Filter für Name, Gruppe, Kurs, Lehrer und Betrag, um ihn zu sehen.",
                })}</span>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg text-slate-600 dark:text-slate-300">
                      {tr(locale, { uz: "Sof foyda miqdori", ru: "Чистая прибыль", en: "Net profit", de: "Nettogewinn" })}:{" "}
                      <span className={cn("text-2xl font-bold", netProfit < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100")}>{netProfit < 0 ? "− " : ""}{formatMoney(Math.abs(netProfit), locale)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400"><Icon name="calendar" className="h-3.5 w-3.5" /> {range}</div>
                  </div>
                  <Icon name="trendUp" className="h-7 w-7 shrink-0 text-brand-400" />
                </div>
                <button type="button" onClick={() => setShowDetails((v) => !v)}
                  className="mt-3 flex w-full items-center gap-1.5 border-t border-slate-100 pt-2.5 text-xs font-medium text-slate-500 hover:text-brand-600 dark:border-slate-800 dark:text-slate-400">
                  <Icon name="info" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Tafsilotlar", ru: "Подробности", en: "Details", de: "Details" })}
                  <Icon name="chevronDown" className={cn("ml-auto h-4 w-4 transition", showDetails && "rotate-180")} />
                </button>
                {showDetails && (
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500"><span>{tr(locale, { uz: "Tushum", ru: "Доход", en: "Income", de: "Einnahmen" })}</span><span className="font-medium text-slate-700 dark:text-slate-200">{formatMoney(total, locale)}</span></div>
                    <div className="flex justify-between text-slate-500"><span>{tr(locale, { uz: "Xarajatlar", ru: "Расходы", en: "Expenses", de: "Ausgaben" })}</span><span className="font-medium text-rose-600 dark:text-rose-400">− {formatMoney(expenseTotal, locale)}</span></div>
                    {byMethod.length > 0 && <div className="border-t border-slate-100 pt-1.5 dark:border-slate-800" />}
                    {byMethod.map(([m, v]) => {
                      const net = v.inc - v.exp;
                      return (
                        <div key={m} className="flex justify-between gap-3">
                          <span className="text-slate-600 dark:text-slate-300">{label(PAYMENT_METHOD_LABELS, m, locale)}</span>
                          <span className={cn("font-semibold", net < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100")} title={`+${formatMoney(v.inc, locale)} / −${formatMoney(v.exp, locale)}`}>
                            {net < 0 ? "− " : ""}{formatMoney(Math.abs(net), locale)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Oylik tushum", ru: "Доход по месяцам", en: "Monthly revenue", de: "Monatliche Einnahmen" })}</h3>
          <LineChart labels={chart.labels} values={chart.values} formatValue={(v) => formatMoney(v, locale)} emptyText={L.noData} />
        </div>
      </div>

      {/* Filtrlar */}
      <div className="space-y-3">
        <div className="relative flex justify-end">
          <button type="button" onClick={() => setFilterMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon name="filter" className="h-4 w-4" /> {tr(locale, { uz: "Filtrlar", ru: "Фильтры", en: "Filters", de: "Filter" })}
          </button>
          {filterMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setFilterMenu(false)} />
              <div className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-pop dark:border-slate-700 dark:bg-slate-800">
                {filters.map((f) => (
                  <label key={f.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50">
                    <input type="checkbox" checked={!hidden.includes(f.key)} onChange={() => toggleHidden(f.key)} className="h-4 w-4 accent-brand-600" />
                    {f.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {filters.filter((f) => !hidden.includes(f.key)).map((f) => <FField key={f.key} label={f.label}>{f.node}</FField>)}
          <div className="flex items-end">
            <button onClick={clearAll} className="h-11 rounded-full bg-brand-800 px-8 text-sm font-semibold text-white transition hover:bg-brand-900">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}</button>
          </div>
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })}: <b className="text-slate-800 dark:text-slate-100">{filtered.length}</b> {tr(locale, { uz: "ta", ru: "шт", en: "items", de: "St." })}</span>
          <button type="button" onClick={doExport} disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 dark:hover:bg-emerald-950/30">
            <Icon name="download" className="h-4 w-4" /> Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                {([["date", L.date], ["student", L.student], ["amount", L.amount], ["method", L.method], ["teacher", L.teacher], ["note", L.note], ["author", L.author]] as [SortKey, string][]).map(([k, lb]) => (
                  <th key={k} className="cursor-pointer select-none px-4 py-3.5" onClick={() => toggleSort(k)}>
                    <span className="inline-flex items-center gap-1">{lb}<span className="text-brand-500">{sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}</span></span>
                  </th>
                ))}
                {canEdit && <th className="w-10 px-2 py-3.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.length === 0 ? (
                <tr><td colSpan={canEdit ? 8 : 7} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}</td></tr>
              ) : (
                pageRows.map((p) => (
                  <tr key={p.id} className={cn("transition hover:bg-slate-50 dark:hover:bg-slate-800/40", p.status === "CANCELLED" && "opacity-60")}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(p.date)}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/students/${p.studentId}`} className="text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100">{p.student}</Link>
                    </td>
                    <td className={cn("whitespace-nowrap px-4 py-3 font-semibold text-slate-800 dark:text-slate-100", p.status === "CANCELLED" && "line-through")}>{formatMoney(p.amount, locale)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{label(PAYMENT_METHOD_LABELS, p.method, locale)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.teacher ?? "—"}</td>
                    <td className="max-w-[280px] px-4 py-3 text-slate-500">
                      {p.groupId && p.group && <GroupBadge id={p.groupId} name={p.group} />}
                      {p.note && <div className={p.groupId ? "mt-1" : ""}>{p.note}</div>}
                      {p.promoCode && <div className="mt-1"><PromoBadge code={p.promoCode} discount={p.discount} locale={locale} /></div>}
                      {p.status === "CANCELLED" && p.cancelReason && <div className="mt-1 text-xs text-rose-500">{p.cancelReason}</div>}
                      {!p.groupId && !p.note && !p.promoCode && !(p.status === "CANCELLED" && p.cancelReason) && "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 dark:text-slate-300">{p.author ?? "—"}</div>
                      <div className="text-xs text-slate-400">{fmtDateTime(p.createdAt)}</div>
                    </td>
                    {canEdit && <td className="px-2 py-3 text-right"><EditPaymentButton paymentId={p.id} locale={locale} /></td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} locale={locale} />
      </div>
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

function StatCard({ title, value, range }: { title: string; value: string; range: string }) {
  return (
    <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg text-slate-600 dark:text-slate-300">{title}: <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</span></div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400"><Icon name="calendar" className="h-3.5 w-3.5" /> {range}</div>
        </div>
        <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
      </div>
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

function Sel({ value, onChange, options, locale, disabled }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; locale: Locale; disabled?: boolean }) {
  return (
    <div className="relative">
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className={cn("h-11 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none transition focus:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800/60", value ? "border-brand-300 text-slate-700 dark:border-brand-500/40 dark:text-slate-100" : "border-slate-300 text-slate-400 dark:border-slate-600")}>
        <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
