"use client";

import DateInput from "@/app/(app)/_components/DateInput";
import { confirmDelete } from "../../_components/dialogs";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { createExpense, updateExpense, deleteExpense, type ExState } from "./actions";
import MoneyInput from "../../_components/MoneyInput";
import BarChart from "../_components/BarChart";
import PieChart from "../_components/PieChart";

export interface VExpense {
  id: string;
  date: string;
  categoryId: string | null;
  category: string | null;
  name: string;
  recipient: string | null;
  method: string;
  amount: number;
  author: string | null;
  note: string | null;
  createdAt: string;
}

type L = { uz: string; ru: string; en: string; de: string };

const METHODS: { value: string; label: L }[] = [
  { value: "CASH", label: { uz: "Naqd pul", ru: "Наличные", en: "Cash", de: "Bargeld" } },
  { value: "CARD", label: { uz: "Plastik karta", ru: "Пластиковая карта", en: "Bank card", de: "Bankkarte" } },
  { value: "CLICK", label: { uz: "Click", ru: "Click", en: "Click", de: "Click" } },
  { value: "BANK", label: { uz: "Bank hisobi", ru: "Банковский счёт", en: "Bank account", de: "Bankkonto" } },
  { value: "PAYME", label: { uz: "Payme", ru: "Payme", en: "Payme", de: "Payme" } },
  { value: "UZUM", label: { uz: "Uzum", ru: "Uzum", en: "Uzum", de: "Uzum" } },
  { value: "HUMO", label: { uz: "Humo", ru: "Humo", en: "Humo", de: "Humo" } },
];
const methodLabel = (v: string, locale: Locale) => {
  const m = METHODS.find((m) => m.value === v);
  return m ? tr(locale, m.label) : v;
};

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};

const PAGE_SIZE = 50;
const FILTERS_KEY = "gl.finance.expenses.filters";
type FilterKey = "name" | "cat" | "recipient" | "method" | "staff";
const FILTER_KEYS: FilterKey[] = ["name", "cat", "recipient", "method", "staff"];

interface Props {
  expenses: VExpense[];
  categories: { id: string; name: string }[];
  staff: string[];
  writable: boolean;
  locale: Locale;
  defaultFrom: string;
  defaultTo: string;
  today: string;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

function monthRange(fromYm: string, toYm: string, cap = 60): string[] {
  let [y, m] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  const out: string[] = [];
  while ((y < ty || (y === ty && m <= tm)) && out.length < cap) {
    out.push(`${y}-${p2(m)}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
};

async function downloadXlsx(filename: string, sheet: string, rows: (string | number)[][]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = rows[0]?.map((_, i) => ({ wch: Math.min(40, Math.max(10, ...rows.map((r) => String(r[i] ?? "").length + 2))) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, filename);
}

export default function ExpensesView({ expenses, categories, staff, writable, locale, defaultFrom, defaultTo, today }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [recipient, setRecipient] = useState("");
  const [method, setMethod] = useState("");
  const [staffF, setStaffF] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<VExpense | null>(null);

  const [shown, setShown] = useState<FilterKey[]>(FILTER_KEYS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setShown(FILTER_KEYS.filter((k) => arr.includes(k)));
      }
    } catch { }
  }, []);
  const toggleFilter = (k: FilterKey) => {
    const next = shown.includes(k) ? shown.filter((x) => x !== k) : FILTER_KEYS.filter((x) => x === k || shown.includes(x));
    setShown(next);
    if (!next.includes(k)) ({ name: setName, cat: setCat, recipient: setRecipient, method: setMethod, staff: setStaffF })[k]("");
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(next)); } catch { }
  };

  const baseFiltered = useMemo(() => {
    const n = name.trim().toLowerCase();
    const r = recipient.trim().toLowerCase();
    return expenses.filter((e) => {
      if (n && !e.name.toLowerCase().includes(n)) return false;
      if (r && !(e.recipient ?? "").toLowerCase().includes(r)) return false;
      if (cat && e.categoryId !== cat) return false;
      if (method && e.method !== method) return false;
      if (staffF && e.author !== staffF) return false;
      return true;
    });
  }, [expenses, name, recipient, cat, method, staffF]);

  const filtered = useMemo(() => baseFiltered.filter((e) => {
    const d = e.date.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [baseFiltered, from, to]);

  useEffect(() => { setPage(1); }, [filtered]);

  const total = filtered.reduce((n, e) => n + e.amount, 0);

  const bars = useMemo(() => {
    const isDefault = from === defaultFrom && to === defaultTo;
    const endYm = (to || defaultTo).slice(0, 7);
    const months = isDefault || !from || !to
      ? monthRange(shiftMonth(endYm, -11), endYm)
      : monthRange(from.slice(0, 7), to.slice(0, 7));
    const sums = new Map<string, number>(months.map((m) => [m, 0]));
    const src = isDefault ? baseFiltered : filtered;
    for (const e of src) {
      const k = e.date.slice(0, 7);
      if (sums.has(k)) sums.set(k, (sums.get(k) ?? 0) + e.amount);
    }
    return months.map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      const mn = MONTHS[locale][m - 1];
      return { label: `${mn} ${String(y).slice(2)}`, title: `${mn} ${y}`, value: sums.get(ym) ?? 0 };
    });
  }, [baseFiltered, filtered, from, to, defaultFrom, defaultTo, locale]);

  const pie = useMemo(() => {
    const none = tr(locale, { uz: "Kategoriyasiz", ru: "Без категории", en: "Uncategorized", de: "Ohne Kategorie" });
    const m = new Map<string, number>();
    for (const e of filtered) {
      const k = e.category ?? none;
      m.set(k, (m.get(k) ?? 0) + e.amount);
    }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [filtered, locale]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const pageRows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const money = (n: number) => formatMoney(n, locale);
  const noData = tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" });

  const filterLabels: Record<FilterKey, string> = {
    name: tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }),
    cat: tr(locale, { uz: "Kategoriya", ru: "Категория", en: "Category", de: "Kategorie" }),
    recipient: tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" }),
    method: tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" }),
    staff: tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" }),
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Xarajatlar", ru: "Расходы", en: "Expenses", de: "Ausgaben" })}</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg text-slate-700 dark:text-slate-200">
                {tr(locale, { uz: "Jami xarajatlar miqdori", ru: "Общая сумма расходов", en: "Total expenses amount", de: "Gesamtbetrag der Ausgaben" })}: <span className="font-bold text-slate-900 dark:text-slate-100">{money(total)}</span>
                {from && to && <span className="ml-1 text-sm text-slate-400">({fmtDate(from)} — {fmtDate(to)})</span>}
              </div>
              <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-3 w-6 rounded" style={{ background: "#f87979" }} />
                <span className="text-sm text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Oylar bo'yicha xarajatlar", ru: "Расходы по месяцам", en: "Expenses by month", de: "Ausgaben nach Monat" })}</span>
              </div>
              <BarChart data={bars} color="#f87979" formatValue={money} emptyText={noData} />
            </div>
            <div className="min-w-0 rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
              <div className="mb-3 text-sm text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Kategoriyalar bo'yicha", ru: "По категориям", en: "By category", de: "Nach Kategorie" })}</div>
              <PieChart data={pie} formatValue={money} emptyText={noData} size={170} />
            </div>
          </div>
        </div>

        {writable && <NewExpense categories={categories} today={today} locale={locale} />}
      </div>

      <div className="space-y-2">
        <div className="relative flex justify-end">
          <button onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <Icon name="filter" className="h-4 w-4" /> {tr(locale, { uz: "Filtrlar", ru: "Фильтры", en: "Filters", de: "Filter" })}
          </button>
          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setFiltersOpen(false)} />
              <div className="absolute right-0 top-11 z-[61] w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-pop dark:border-slate-700 dark:bg-slate-900">
                {FILTER_KEYS.map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={shown.includes(k)} onChange={() => toggleFilter(k)} className="h-4 w-4 accent-brand-600" />
                    {filterLabels[k]}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <FField label={tr(locale, { uz: "Sanadan", ru: "С даты", en: "From date", de: "Ab Datum" })} req><DateInput value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></FField>
          <FField label={tr(locale, { uz: "Sanagacha", ru: "По дату", en: "To date", de: "Bis Datum" })} req><DateInput value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></FField>
          {shown.includes("name") && <FField label={filterLabels.name}><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></FField>}
          {shown.includes("cat") && <FField label={filterLabels.cat}><Sel value={cat} onChange={setCat} options={categories.map((c) => c.id)} labels={Object.fromEntries(categories.map((c) => [c.id, c.name]))} locale={locale} /></FField>}
          {shown.includes("recipient") && <FField label={filterLabels.recipient}><input value={recipient} onChange={(e) => setRecipient(e.target.value)} className={inp} /></FField>}
          {shown.includes("method") && <FField label={filterLabels.method}><Sel value={method} onChange={setMethod} options={METHODS.map((m) => m.value)} labels={Object.fromEntries(METHODS.map((m) => [m.value, tr(locale, m.label)]))} locale={locale} /></FField>}
          {shown.includes("staff") && <FField label={filterLabels.staff}><Sel value={staffF} onChange={setStaffF} options={staff} locale={locale} /></FField>}
          <div className="flex items-end">
            <button onClick={() => { setFrom(defaultFrom); setTo(defaultTo); setName(""); setCat(""); setRecipient(""); setMethod(""); setStaffF(""); }}
              className="h-11 w-full rounded-full bg-brand-800 px-4 text-sm font-semibold text-white transition hover:bg-brand-900">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}</button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })}: <b className="text-slate-800 dark:text-slate-100">{filtered.length}</b> {tr(locale, { uz: "ta", ru: "шт", en: "items", de: "St." })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Turkum", ru: "Категория", en: "Category", de: "Kategorie" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" })}</th>
                <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">{noData}</td></tr>
              ) : (
                pageRows.map((e) => (
                  <tr key={e.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.category ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {e.name}
                      {e.note && <div className="mt-0.5 text-xs font-normal text-slate-400">{e.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{e.recipient ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{methodLabel(e.method, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">− {money(e.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 dark:text-slate-300">{e.author ?? "—"}</div>
                      <div className="whitespace-nowrap text-xs text-slate-400">{fmtDateTime(e.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {writable ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => setEditing(e)} title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                            <Icon name="pencil" className="h-3.5 w-3.5" />
                          </button>
                          <DeleteBtn id={e.id} locale={locale} />
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <Pager page={cur} pages={pages} onPage={setPage} />
          <div className="flex items-center gap-3">
            <ExportBtn rows={filtered} locale={locale} />
            <Link href="/finance/expense-categories"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-card transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Kategoriya qo'shing", ru: "Добавить категорию", en: "Add category", de: "Kategorie hinzufügen" })}
            </Link>
          </div>
        </div>
      </div>

      {editing && <EditExpense key={editing.id} expense={editing} categories={categories} locale={locale} onClose={() => setEditing(null)} />}
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";
const fld = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

function FField({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{label} {req && <span className="text-rose-500">*</span>}</label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options, labels, locale }: { value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string>; locale: Locale }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={cn("h-11 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none focus:border-brand-400 dark:bg-slate-800/60", value ? "border-brand-300 text-slate-700 dark:text-slate-100" : "border-slate-300 text-slate-400 dark:border-slate-600")}>
        <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return <span />;
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const btn = "grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm transition disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(btn, "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>‹</button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-slate-400">…</span>}
          <button onClick={() => onPage(n)}
            className={cn(btn, n === page ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")}>{n}</button>
        </span>
      ))}
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(btn, "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>›</button>
    </div>
  );
}

function DeleteBtn({ id, locale }: { id: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const onClick = async () => {
    if (!(await confirmDelete(tr(locale, { uz: "Xarajatni o'chirishni tasdiqlaysizmi?", ru: "Подтвердить удаление расхода?", en: "Confirm deleting the expense?", de: "Löschen der Ausgabe bestätigen?" })))) return;
    start(() => deleteExpense(id));
  };
  return (
    <button onClick={onClick} disabled={pending} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
      className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30">
      {pending ? "…" : <Icon name="trash" className="h-3.5 w-3.5" />}
    </button>
  );
}

function ExportBtn({ rows, locale }: { rows: VExpense[]; locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      const head = [
        tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" }),
        tr(locale, { uz: "Turkum", ru: "Категория", en: "Category", de: "Kategorie" }),
        tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }),
        tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" }),
        tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" }),
        tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" }),
        tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note", de: "Notiz" }),
        tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" }),
        tr(locale, { uz: "Yaratilgan", ru: "Создано", en: "Created", de: "Erstellt" }),
      ];
      const lines = rows.map((e) => [fmtDate(e.date), e.category ?? "", e.name, e.recipient ?? "", methodLabel(e.method, locale), e.amount, e.note ?? "", e.author ?? "", fmtDateTime(e.createdAt)]);
      await downloadXlsx("xarajatlar.xlsx", tr(locale, { uz: "Xarajatlar", ru: "Расходы", en: "Expenses", de: "Ausgaben" }), [head, ...lines]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={onClick} disabled={busy} title={tr(locale, { uz: "Excel yuklab olish", ru: "Скачать Excel", en: "Download Excel", de: "Excel herunterladen" })}
      className="grid h-11 w-11 place-items-center rounded-full border-2 border-emerald-500 bg-white text-emerald-600 shadow-card transition hover:bg-emerald-50 disabled:opacity-50 dark:bg-slate-900 dark:hover:bg-emerald-950/30">
      <Icon name="download" className="h-5 w-5" />
    </button>
  );
}

function MethodRadios({ value, onChange, locale, group }: { value: string; onChange: (v: string) => void; locale: Locale; group: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" })} <span className="text-rose-500">*</span></label>
      <div className="grid grid-cols-2 gap-y-2.5">
        {METHODS.map((m) => (
          <label key={m.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="radio" name={group} checked={value === m.value} onChange={() => onChange(m.value)} className="h-4 w-4 accent-brand-600" />
            {tr(locale, m.label)}
          </label>
        ))}
      </div>
    </div>
  );
}

function CategorySelect({ categories, defaultValue, locale, required }: { categories: { id: string; name: string }[]; defaultValue: string; locale: Locale; required?: boolean }) {
  return (
    <div className="relative">
      <select name="categoryId" defaultValue={defaultValue} required={required} className={cn(fld, "appearance-none pr-9")}>
        <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function ErrorNote({ error, locale }: { error?: string; locale: Locale }) {
  if (!error) return null;
  const text = error === "forbidden"
    ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Kein Zugriff." })
    : error === "notfound"
      ? tr(locale, { uz: "Xarajat topilmadi.", ru: "Расход не найден.", en: "Expense not found.", de: "Ausgabe nicht gefunden." })
      : tr(locale, { uz: "Majburiy maydonlarni to'ldiring.", ru: "Заполните обязательные поля.", en: "Fill in the required fields.", de: "Füllen Sie die Pflichtfelder aus." });
  return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{text}</p>;
}

function NewExpense({ categories, today, locale }: { categories: { id: string; name: string }[]; today: string; locale: Locale }) {
  const [state, action, pending] = useActionState<ExState, FormData>(createExpense, {});
  const [method, setMethod] = useState("CASH");
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (state.ok) { formRef.current?.reset(); setMethod("CASH"); setFormKey((k) => k + 1); } }, [state]);

  return (
    <form key={formKey} ref={formRef} action={action} className="h-fit rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
      <h2 className="mb-4 text-xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Yangi xarajatlar", ru: "Новый расход", en: "New expense", de: "Neue Ausgabe" })}</h2>
      <input type="hidden" name="method" value={method} />

      <div className="space-y-3.5">
        <Lbl label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} req><input name="name" required className={fld} /></Lbl>
        <Lbl label={tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })} req><DateInput name="date" required defaultValue={today} className={fld} /></Lbl>
        <Lbl label={tr(locale, { uz: "Turkum", ru: "Категория", en: "Category", de: "Kategorie" })} req><CategorySelect categories={categories} defaultValue="" locale={locale} required /></Lbl>
        <Lbl label={tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" })}><input name="recipient" className={fld} /></Lbl>
        <Lbl label={tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" })} req><MoneyInput name="amount" required className={fld} /></Lbl>
        <MethodRadios value={method} onChange={setMethod} locale={locale} group="method-radio" />

        <ErrorNote error={state.error} locale={locale} />

        <button type="submit" disabled={pending}
          className="mt-1 rounded-full bg-brand-500 px-9 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
          {pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
        </button>
      </div>
    </form>
  );
}

function EditExpense({ expense, categories, locale, onClose }: { expense: VExpense; categories: { id: string; name: string }[]; locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ExState, FormData>(updateExpense, {});
  const [method, setMethod] = useState(expense.method);

  useEffect(() => { if (state.ok) { onClose(); router.refresh(); } }, [state, onClose, router]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-12 backdrop-blur-sm" onMouseDown={onClose}>
      <form action={action} onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-pop dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Xarajatni tahrirlash", ru: "Редактировать расход", en: "Edit expense", de: "Ausgabe bearbeiten" })}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="close" className="h-4 w-4" /></button>
        </div>
        <input type="hidden" name="id" value={expense.id} />
        <input type="hidden" name="method" value={method} />

        <div className="space-y-3.5">
          <Lbl label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} req><input name="name" required defaultValue={expense.name} className={fld} /></Lbl>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Lbl label={tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })} req><DateInput name="date" required defaultValue={expense.date.slice(0, 10)} className={fld} /></Lbl>
            <Lbl label={tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" })} req><MoneyInput name="amount" required defaultValue={expense.amount} className={fld} /></Lbl>
          </div>
          <Lbl label={tr(locale, { uz: "Turkum", ru: "Категория", en: "Category", de: "Kategorie" })}><CategorySelect categories={categories} defaultValue={expense.categoryId ?? ""} locale={locale} /></Lbl>
          <Lbl label={tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" })}><input name="recipient" defaultValue={expense.recipient ?? ""} className={fld} /></Lbl>
          <Lbl label={tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note", de: "Notiz" })}>
            <textarea name="note" rows={2} defaultValue={expense.note ?? ""} className={cn(fld, "h-auto py-2")} />
          </Lbl>
          <MethodRadios value={method} onChange={setMethod} locale={locale} group="edit-method-radio" />

          <ErrorNote error={state.error} locale={locale} />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
              {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
            </button>
            <button type="submit" disabled={pending}
              className="rounded-full bg-brand-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
              {pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Lbl({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{label} {req && <span className="text-rose-500">*</span>}</label>
      {children}
    </div>
  );
}
