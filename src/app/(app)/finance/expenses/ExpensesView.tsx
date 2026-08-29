"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { createExpense, addExpenseCategory, deleteExpense, type ExState } from "./actions";

export interface VExpense {
  id: string;
  date: string; // ISO
  category: string | null;
  name: string;
  recipient: string | null;
  method: string;
  amount: number;
  author: string | null;
}

const METHODS: { value: string; label: { uz: string; ru: string; en: string; de: string } }[] = [
  { value: "CASH", label: { uz: "Naqd pul", ru: "Наличные", en: "Cash", de: "Bargeld" } },
  { value: "PAYME", label: { uz: "Payme", ru: "Payme", en: "Payme", de: "Payme" } },
  { value: "CARD", label: { uz: "Plastik karta", ru: "Пластиковая карта", en: "Bank card", de: "Bankkarte" } },
  { value: "UZUM", label: { uz: "Uzum", ru: "Uzum", en: "Uzum", de: "Uzum" } },
  { value: "CLICK", label: { uz: "Click", ru: "Click", en: "Click", de: "Click" } },
  { value: "HUMO", label: { uz: "Humo", ru: "Humo", en: "Humo", de: "Humo" } },
  { value: "BANK", label: { uz: "Bank hisobi", ru: "Банковский счёт", en: "Bank account", de: "Bankkonto" } },
];
const methodLabel = (v: string, locale: Locale) => {
  const m = METHODS.find((m) => m.value === v);
  return m ? tr(locale, m.label) : v;
};

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

export default function ExpensesView({ expenses, categories, staff, writable, locale, defaultFrom, defaultTo, today }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [recipient, setRecipient] = useState("");
  const [method, setMethod] = useState("");
  const [staffF, setStaffF] = useState("");

  const filtered = useMemo(() => {
    const n = name.trim().toLowerCase();
    const r = recipient.trim().toLowerCase();
    return expenses.filter((e) => {
      const d = e.date.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (n && !e.name.toLowerCase().includes(n)) return false;
      if (r && !(e.recipient ?? "").toLowerCase().includes(r)) return false;
      if (cat && e.category !== cat) return false;
      if (method && e.method !== method) return false;
      if (staffF && e.author !== staffF) return false;
      return true;
    });
  }, [expenses, from, to, name, recipient, cat, method, staffF]);

  const total = filtered.reduce((n, e) => n + e.amount, 0);

  // Grafik: kunlar bo'yicha yig'indi
  const chart = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) {
      const d = e.date.slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + e.amount);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);
  const maxBar = Math.max(1, ...chart.map(([, v]) => v));

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Xarajatlar", ru: "Расходы", en: "Expenses", de: "Ausgaben" })}</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
        {/* Chap: statistika + grafik */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg text-slate-700 dark:text-slate-200">
                {tr(locale, { uz: "Jami xarajatlar miqdori", ru: "Общая сумма расходов", en: "Total expenses amount", de: "Gesamtbetrag der Ausgaben" })}: <span className="font-bold text-slate-900 dark:text-slate-100">{formatMoney(total, locale)}</span>
              </div>
              <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-3 w-6 rounded bg-rose-400" />
              <span className="text-sm text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Xarajatlar", ru: "Расходы", en: "Expenses", de: "Ausgaben" })}</span>
            </div>
            {chart.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}</div>
            ) : (
              <div className="flex h-56 items-end gap-1.5 overflow-x-auto border-b border-l border-slate-200 pl-2 dark:border-slate-700">
                {chart.map(([d, v]) => (
                  <div key={d} className="group flex min-w-[26px] flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-medium text-rose-600 opacity-0 transition group-hover:opacity-100">{formatMoney(v, locale)}</span>
                    <div className="w-full rounded-t bg-rose-400 transition hover:bg-rose-500" style={{ height: `${Math.max(4, (v / maxBar) * 190)}px` }} title={`${fmtDate(d)}: ${formatMoney(v, locale)}`} />
                    <span className="whitespace-nowrap text-[9px] text-slate-400">{d.slice(8)}.{d.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* O'ng: yangi xarajat formasi */}
        {writable && <NewExpense categories={categories} today={today} locale={locale} />}
      </div>

      {/* Filtrlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <FField label={tr(locale, { uz: "Sanadan boshlab", ru: "С даты", en: "From date", de: "Ab Datum" })} req><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sana bo'yicha", ru: "По дату", en: "To date", de: "Bis Datum" })} req><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}><input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Kategoriyani tanlang", ru: "Выберите категорию", en: "Select category", de: "Kategorie auswählen" })}><Sel value={cat} onChange={setCat} options={categories.map((c) => c.name)} locale={locale} /></FField>
        <FField label={tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" })}><input value={recipient} onChange={(e) => setRecipient(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" })}><Sel value={method} onChange={setMethod} options={METHODS.map((m) => m.value)} labels={Object.fromEntries(METHODS.map((m) => [m.value, tr(locale, m.label)]))} locale={locale} /></FField>
        <div className="grid grid-cols-2 gap-2">
          <FField label={tr(locale, { uz: "Xodimni ismi", ru: "Имя сотрудника", en: "Staff name", de: "Name des Mitarbeiters" })}><Sel value={staffF} onChange={setStaffF} options={staff} locale={locale} /></FField>
          <div className="flex items-end">
            <button onClick={() => { setFrom(defaultFrom); setTo(defaultTo); setName(""); setCat(""); setRecipient(""); setMethod(""); setStaffF(""); }}
              className="h-11 w-full rounded-full bg-brand-800 px-4 text-sm font-semibold text-white transition hover:bg-brand-900">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}</button>
          </div>
        </div>
      </div>

      {/* Jadval */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-white pb-16 shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })}: <b className="text-slate-800 dark:text-slate-100">{filtered.length}</b> {tr(locale, { uz: "ta", ru: "шт", en: "items", de: "St." })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Turkum", ru: "Категория", en: "Category", de: "Kategorie" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount", de: "Betrag" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" })}</th>
                <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}</td></tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.category ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{e.name}</td>
                    <td className="px-4 py-3 text-slate-500">{e.recipient ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{methodLabel(e.method, locale)}</td>
                    <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">− {formatMoney(e.amount, locale)}</td>
                    <td className="px-4 py-3 text-slate-500">{e.author ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{writable ? <DeleteBtn id={e.id} locale={locale} /> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pastki amallar: export + kategoriya qo'shish */}
        <div className="absolute bottom-4 right-4 flex items-center gap-3">
          <ExportBtn rows={filtered} locale={locale} />
          {writable && <AddCategory locale={locale} />}
        </div>
      </div>
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

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

function DeleteBtn({ id, locale }: { id: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const onClick = () => {
    if (!window.confirm(tr(locale, { uz: "Xarajatni o'chirishni tasdiqlaysizmi?", ru: "Подтвердить удаление расхода?", en: "Confirm deleting the expense?", de: "Löschen der Ausgabe bestätigen?" }))) return;
    start(() => deleteExpense(id));
  };
  return (
    <button onClick={onClick} disabled={pending} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30">
      <Icon name="trash" className="h-3.5 w-3.5" /> {pending ? "..." : tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
    </button>
  );
}

function ExportBtn({ rows, locale }: { rows: VExpense[]; locale: Locale }) {
  const onClick = () => {
    const head = [
      tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" }),
      tr(locale, { uz: "Turkum", ru: "Категория", en: "Category", de: "Kategorie" }),
      tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" }),
      tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" }),
      tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" }),
      tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount", de: "Betrag" }),
      tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" }),
    ];
    const lines = rows.map((e) => [fmtDate(e.date), e.category ?? "", e.name, e.recipient ?? "", methodLabel(e.method, locale), String(e.amount), e.author ?? ""]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "xarajatlar.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={onClick} title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV", de: "CSV herunterladen" })}
      className="grid h-12 w-12 place-items-center rounded-full border-2 border-emerald-500 bg-white text-emerald-600 shadow-card transition hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/30">
      <Icon name="download" className="h-5 w-5" />
    </button>
  );
}

function AddCategory({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const onClick = () => {
    const name = window.prompt(tr(locale, { uz: "Yangi turkum nomi:", ru: "Название новой категории:", en: "New category name:", de: "Name der neuen Kategorie:" }));
    if (!name || name.trim().length < 2) return;
    setErr("");
    start(async () => {
      const res = await addExpenseCategory(name.trim());
      if (res.error === "duplicate") setErr(tr(locale, { uz: "Bunday turkum bor", ru: "Такая категория уже есть", en: "This category already exists", de: "Diese Kategorie existiert bereits" }));
      else router.refresh();
    });
  };
  return (
    <div className="flex flex-col items-end">
      <button onClick={onClick} disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-card transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
        <Icon name="plus" className="h-4 w-4" /> {pending ? "..." : tr(locale, { uz: "Kategoriya qo'shing", ru: "Добавить категорию", en: "Add category", de: "Kategorie hinzufügen" })}
      </button>
      {err && <span className="mt-1 text-xs text-rose-500">{err}</span>}
    </div>
  );
}

function NewExpense({ categories, today, locale }: { categories: { id: string; name: string }[]; today: string; locale: Locale }) {
  const [state, action, pending] = useActionState<ExState, FormData>(createExpense, {});
  const [method, setMethod] = useState("CASH");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (state.ok) { formRef.current?.reset(); setMethod("CASH"); } }, [state.ok]);

  const fld = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <form ref={formRef} action={action} className="h-fit rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
      <h2 className="mb-4 text-xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Yangi xarajatlar", ru: "Новый расход", en: "New expense", de: "Neue Ausgabe" })}</h2>
      <input type="hidden" name="method" value={method} />

      <div className="space-y-3.5">
        <Lbl label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} req><input name="name" required className={fld} /></Lbl>
        <Lbl label={tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })} req><input name="date" type="date" required defaultValue={today} className={fld} /></Lbl>
        <Lbl label={tr(locale, { uz: "Turkum", ru: "Категория", en: "Category", de: "Kategorie" })}>
          <div className="relative">
            <select name="categoryId" defaultValue="" className={cn(fld, "appearance-none pr-9")}>
              <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </Lbl>
        <Lbl label={tr(locale, { uz: "Oluvchi", ru: "Получатель", en: "Recipient", de: "Empfänger" })}><input name="recipient" className={fld} /></Lbl>
        <Lbl label={tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount", de: "Betrag" })} req><input name="amount" type="number" min="1" step="1000" required className={fld} /></Lbl>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "To'lov turi", ru: "Тип платежа", en: "Payment type", de: "Zahlungsart" })} <span className="text-rose-500">*</span></label>
          <div className="grid grid-cols-2 gap-y-2.5">
            {METHODS.map((m) => (
              <label key={m.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="radio" name="method-radio" checked={method === m.value} onChange={() => setMethod(m.value)}
                  className="h-4 w-4 accent-brand-600" />
                {tr(locale, m.label)}
              </label>
            ))}
          </div>
        </div>

        {state.error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Kein Zugriff." }) : tr(locale, { uz: "Majburiy maydonlarni to'ldiring.", ru: "Заполните обязательные поля.", en: "Fill in the required fields.", de: "Füllen Sie die Pflichtfelder aus." })}
          </p>
        )}

        <button type="submit" disabled={pending}
          className="mt-1 rounded-full bg-brand-500 px-9 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
          {pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
        </button>
      </div>
    </form>
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
