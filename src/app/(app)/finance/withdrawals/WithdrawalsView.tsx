"use client";

import { promptDialog } from "../../_components/dialogs";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { createWithdrawal, cancelWithdrawal, type WdState } from "./actions";
import MoneyInput from "../../_components/MoneyInput";
import Link from "next/link";
import { exportXlsx } from "@/lib/export";
import LineChart, { monthlySeries } from "../_components/LineChart";
import GroupBadge from "../_components/GroupBadge";
import Pagination, { PAGE_SIZE, fmtDate, fmtDateTime, localDay } from "../_components/Pagination";

export interface VWithdrawal {
  id: string;
  date: string; // ISO
  studentId: string;
  student: string;
  phone: string;
  groupId: string | null;
  group: string | null;
  course: string | null;
  amount: number;
  note: string | null;
  author: string | null;
}

interface Props {
  withdrawals: VWithdrawal[];
  courses: string[];
  students: { id: string; fullName: string }[];
  writable: boolean;
  locale: Locale;
  defaultFrom: string;
  defaultTo: string;
}

export default function WithdrawalsView({ withdrawals, courses, students, writable, locale, defaultFrom, defaultTo }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [q, setQ] = useState("");
  const [sum, setSum] = useState("");
  const [course, setCourse] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minSum = sum ? Number(sum.replace(/\D/g, "")) : 0;
    return withdrawals.filter((w) => {
      const d = localDay(w.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (needle && !w.student.toLowerCase().includes(needle) && !w.phone.toLowerCase().includes(needle)) return false;
      if (course && w.course !== course) return false;
      if (minSum && w.amount < minSum) return false;
      return true;
    });
  }, [withdrawals, from, to, q, sum, course]);

  // Filtr o'zgarsa — birinchi sahifaga qaytish
  useEffect(() => { setPage(1); }, [from, to, q, sum, course]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const total = filtered.reduce((n, w) => n + w.amount, 0);

  // Oylik yechib olishlar grafigi — oxirgi 12 oy
  const chart = useMemo(
    () => monthlySeries(withdrawals.map((w) => ({ day: localDay(w.date), amount: w.amount })), locale),
    [withdrawals, locale],
  );

  const doExport = () => {
    void exportXlsx(
      `yechib-olishlar_${from}_${to}`,
      [
        { key: "date", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" }) },
        { key: "student", label: tr(locale, { uz: "Talaba ismi", ru: "Имя ученика", en: "Student name", de: "Name des Schülers" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }) },
        { key: "amount", label: tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" }) },
        { key: "group", label: tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" }) },
        { key: "course", label: tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" }) },
        { key: "note", label: tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" }) },
        { key: "author", label: tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" }) },
        { key: "created", label: tr(locale, { uz: "Yaratilgan vaqt", ru: "Время создания", en: "Created at", de: "Erstellt am" }) },
      ],
      filtered.map((w) => ({
        date: fmtDate(w.date),
        student: w.student,
        phone: w.phone,
        amount: w.amount,
        group: w.group ?? "",
        course: w.course ?? "",
        note: w.note ?? "",
        author: w.author ?? "",
        created: fmtDateTime(w.date),
      })),
      tr(locale, { uz: "Yechib olishlar", ru: "Выводы", en: "Withdrawals", de: "Auszahlungen" }),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Yechib olish", ru: "Вывод средств", en: "Withdrawals", de: "Auszahlungen" })}</h1>
        {writable && <NewWithdrawal students={students} locale={locale} />}
      </div>

      {/* Statistika + breakdown */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="text-lg text-slate-700 dark:text-slate-200">
              {tr(locale, { uz: "Jami yechib olishlar", ru: "Всего выводов", en: "Total withdrawals", de: "Auszahlungen insgesamt" })}: <span className="font-bold text-slate-900 dark:text-slate-100">{formatMoney(total, locale)}</span>
              <div className="mt-1 text-sm text-slate-400">({fmtDate(from)} — {fmtDate(to)})</div>
            </div>
            <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Oylik yechib olishlar", ru: "Выводы по месяцам", en: "Monthly withdrawals", de: "Monatliche Auszahlungen" })}</h3>
          <LineChart labels={chart.labels} values={chart.values} formatValue={(v) => formatMoney(v, locale)} emptyText={tr(locale, { uz: "Ma'lumot yo'q", ru: "Нет данных", en: "No data", de: "Keine Daten" })} />
        </div>
      </div>

      {/* Filtrlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <FField label={tr(locale, { uz: "Sanadan boshlab", ru: "С даты", en: "From date", de: "Von Datum" })}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sana bo'yicha", ru: "По дату", en: "To date", de: "Bis Datum" })}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Ism yoki Telefon", ru: "Имя или телефон", en: "Name or phone", de: "Name oder Telefon" })}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search", de: "Suchen" })} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount", de: "Betrag" })}><input value={sum} onChange={(e) => setSum(e.target.value)} placeholder={tr(locale, { uz: "min summa", ru: "мин. сумма", en: "min amount", de: "Min. Betrag" })} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })}>
          <div className="relative">
            <select value={course} onChange={(e) => setCourse(e.target.value)}
              className={cn("h-11 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none focus:border-brand-400 dark:bg-slate-800/60", course ? "border-brand-300 text-slate-700 dark:text-slate-100" : "border-slate-300 text-slate-400 dark:border-slate-600")}>
              <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </FField>
        <div className="flex items-end">
          <button onClick={() => { setFrom(defaultFrom); setTo(defaultTo); setQ(""); setSum(""); setCourse(""); }}
            className="h-11 rounded-full bg-brand-800 px-8 text-sm font-semibold text-white transition hover:bg-brand-900">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear", de: "Zurücksetzen" })}</button>
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })}: <b className="text-slate-800 dark:text-slate-100">{filtered.length}</b> {tr(locale, { uz: "ta", ru: "шт", en: "items", de: "Stk." })}</span>
          <button type="button" onClick={doExport} disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40 dark:hover:bg-emerald-950/30">
            <Icon name="download" className="h-4 w-4" /> Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Talaba ismi", ru: "Имя ученика", en: "Student name", de: "Name des Schülers" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount", de: "Betrag" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff", de: "Mitarbeiter" })}</th>
                <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Harakatlar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pageRows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display", de: "Keine Daten zum Anzeigen" })}</td></tr>
              ) : (
                pageRows.map((w) => (
                  <tr key={w.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(w.date)}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/students/${w.studentId}`} className="text-slate-800 hover:text-brand-600 hover:underline dark:text-slate-100">{w.student}</Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">− {formatMoney(w.amount, locale)}</td>
                    <td className="max-w-[280px] px-4 py-3 text-slate-500">
                      {w.groupId && w.group && <GroupBadge id={w.groupId} name={w.group} />}
                      {w.note && <div className={w.groupId ? "mt-1" : ""}>{w.note}</div>}
                      {!w.groupId && !w.note && "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 dark:text-slate-300">{w.author ?? "—"}</div>
                      <div className="text-xs text-slate-400">{fmtDateTime(w.date)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{writable ? <CancelBtn id={w.id} locale={locale} /> : <span className="text-slate-400">—</span>}</td>
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

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function CancelBtn({ id, locale }: { id: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const onClick = async () => {
    const reason = await promptDialog({ message: tr(locale, { uz: "Bekor qilish sababi (kamida 3 belgi):", ru: "Причина отмены (минимум 3 символа):", en: "Cancellation reason (at least 3 characters):", de: "Stornierungsgrund (mind. 3 Zeichen):" }), minLength: 3, tone: "danger" });
    if (!reason || reason.trim().length < 3) return;
    start(() => cancelWithdrawal(id, reason.trim()));
  };
  return (
    <button onClick={onClick} disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30">
      <Icon name="close" className="h-3.5 w-3.5" /> {pending ? "..." : tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
    </button>
  );
}

function NewWithdrawal({ students, locale }: { students: { id: string; fullName: string }[]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WdState, FormData>(createWithdrawal, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) { formRef.current?.reset(); setOpen(false); }
  }, [state.ok]);

  const fld = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
        <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yechib olish", ru: "Вывод средств", en: "Withdraw", de: "Auszahlen" })}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          {/* Yonboshdan ochiladigan panel (ilovadagi boshqa formalar kabi) */}
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <form ref={formRef} action={action} className="animate-slide-in-right absolute right-0 top-0 flex h-full drawer-panel flex-col space-y-3 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-pop dark:border-white/10 dark:bg-[#15243d]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Yangi yechib olish", ru: "Новый вывод средств", en: "New withdrawal", de: "Neue Auszahlung" })}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" })} <span className="text-rose-500">*</span></label>
              <select name="studentId" required className={fld} defaultValue="">
                <option value="" disabled>—</option>
                {students.map((st) => <option key={st.id} value={st.id}>{st.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Summa (so'm)", ru: "Сумма (сум)", en: "Amount (soʻm)", de: "Betrag (UZS)" })} <span className="text-rose-500">*</span></label>
              <MoneyInput name="amount" required className={fld} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note", de: "Notiz" })}</label>
              <textarea name="note" rows={2} placeholder={tr(locale, { uz: "Sababi...", ru: "Причина...", en: "Reason...", de: "Grund..." })} className={fld} />
            </div>

            {state.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                {state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Kein Zugriff." }) : tr(locale, { uz: "Barcha majburiy maydonlarni to'ldiring.", ru: "Заполните все обязательные поля.", en: "Fill in all required fields.", de: "Füllen Sie alle Pflichtfelder aus." })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
