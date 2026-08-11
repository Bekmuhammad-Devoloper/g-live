"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { createWithdrawal, cancelWithdrawal, type WdState } from "./actions";

export interface VWithdrawal {
  id: string;
  date: string; // ISO
  student: string;
  phone: string;
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

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export default function WithdrawalsView({ withdrawals, courses, students, writable, locale, defaultFrom, defaultTo }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [q, setQ] = useState("");
  const [sum, setSum] = useState("");
  const [course, setCourse] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minSum = sum ? Number(sum.replace(/\D/g, "")) : 0;
    return withdrawals.filter((w) => {
      const d = w.date.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (needle && !w.student.toLowerCase().includes(needle) && !w.phone.toLowerCase().includes(needle)) return false;
      if (course && w.course !== course) return false;
      if (minSum && w.amount < minSum) return false;
      return true;
    });
  }, [withdrawals, from, to, q, sum, course]);

  const total = filtered.reduce((n, w) => n + w.amount, 0);

  const byCourse = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of filtered) m.set(w.course ?? "—", (m.get(w.course ?? "—") ?? 0) + w.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const maxCourse = Math.max(1, ...byCourse.map(([, v]) => v));

  const exportCsv = () => {
    const head = [
      tr(locale, { uz: "Sana", ru: "Дата", en: "Date" }),
      tr(locale, { uz: "Talaba ismi", ru: "Имя ученика", en: "Student name" }),
      tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount" }),
      tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" }),
      tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff" }),
    ];
    const lines = filtered.map((w) => [fmtDate(w.date), w.student, String(w.amount), w.note ?? "", w.author ?? ""]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "yechib-olishlar.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Yechib olish", ru: "Вывод средств", en: "Withdrawals" })}</h1>
        {writable && <NewWithdrawal students={students} locale={locale} />}
      </div>

      {/* Statistika + breakdown */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-2xl border border-l-4 border-slate-300 border-l-brand-600 bg-white p-5 shadow-card dark:border-slate-600 dark:border-l-brand-500 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="text-lg text-slate-700 dark:text-slate-200">
              {tr(locale, { uz: "Jami yechib olishlar", ru: "Всего выводов", en: "Total withdrawals" })}: <span className="font-bold text-slate-900 dark:text-slate-100">{formatMoney(total, locale)}</span>
              <div className="mt-1 text-sm text-slate-400">({fmtDate(from)} — {fmtDate(to)})</div>
            </div>
            <Icon name="coins" className="h-7 w-7 shrink-0 text-brand-400" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
          {byCourse.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display" })}</div>
          ) : (
            <div className="space-y-2.5">
              <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Kurs bo'yicha", ru: "По курсу", en: "By course" })}</h3>
              {byCourse.map(([c, v]) => (
                <div key={c}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{c}</span>
                    <span className="text-slate-500">{formatMoney(v, locale)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / maxCourse) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtrlar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <FField label={tr(locale, { uz: "Sanadan boshlab", ru: "С даты", en: "From date" })}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sana bo'yicha", ru: "По дату", en: "To date" })}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Ism yoki Telefon", ru: "Имя или телефон", en: "Name or phone" })}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Qidiruv", ru: "Поиск", en: "Search" })} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount" })}><input value={sum} onChange={(e) => setSum(e.target.value)} placeholder={tr(locale, { uz: "min summa", ru: "мин. сумма", en: "min amount" })} className={inp} /></FField>
        <FField label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })}>
          <div className="relative">
            <select value={course} onChange={(e) => setCourse(e.target.value)}
              className={cn("h-11 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none focus:border-brand-400 dark:bg-slate-800/60", course ? "border-brand-300 text-slate-700 dark:text-slate-100" : "border-slate-300 text-slate-400 dark:border-slate-600")}>
              <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select" })}</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </FField>
        <div className="flex items-end">
          <button onClick={() => { setFrom(defaultFrom); setTo(defaultTo); setQ(""); setSum(""); setCourse(""); }}
            className="h-11 rounded-full bg-brand-800 px-8 text-sm font-semibold text-white transition hover:bg-brand-900">{tr(locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}</button>
        </div>
      </div>

      {/* Jadval */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-slate-800">
          <span className="text-sm text-slate-500">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total" })}: <b className="text-slate-800 dark:text-slate-100">{filtered.length}</b> {tr(locale, { uz: "ta", ru: "шт", en: "items" })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Talaba ismi", ru: "Имя ученика", en: "Student name" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Sum", ru: "Сумма", en: "Amount" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" })}</th>
                <th className="px-4 py-3.5">{tr(locale, { uz: "Xodim", ru: "Сотрудник", en: "Staff" })}</th>
                <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Harakatlar", ru: "Действия", en: "Actions" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400">{tr(locale, { uz: "Ko'rsatiladigan ma'lumotlar yo'q", ru: "Нет данных для отображения", en: "No data to display" })}</td></tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(w.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{w.student}</td>
                    <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">− {formatMoney(w.amount, locale)}</td>
                    <td className="px-4 py-3 text-slate-500">{w.note ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{w.author ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{writable ? <CancelBtn id={w.id} locale={locale} /> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Export FAB */}
        <button onClick={exportCsv} title={tr(locale, { uz: "CSV yuklab olish", ru: "Скачать CSV", en: "Download CSV" })}
          className="absolute bottom-4 right-4 grid h-12 w-12 place-items-center rounded-full border-2 border-emerald-500 bg-white text-emerald-600 shadow-card transition hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/30">
          <Icon name="download" className="h-5 w-5" />
        </button>
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
  const onClick = () => {
    const reason = window.prompt(tr(locale, { uz: "Bekor qilish sababi (kamida 3 belgi):", ru: "Причина отмены (минимум 3 символа):", en: "Cancellation reason (at least 3 characters):" }));
    if (!reason || reason.trim().length < 3) return;
    start(() => cancelWithdrawal(id, reason.trim()));
  };
  return (
    <button onClick={onClick} disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30">
      <Icon name="close" className="h-3.5 w-3.5" /> {pending ? "..." : tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}
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
        <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yechib olish", ru: "Вывод средств", en: "Withdraw" })}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
          <form ref={formRef} action={action} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Yangi yechib olish", ru: "Новый вывод средств", en: "New withdrawal" })}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Talaba", ru: "Ученик", en: "Student" })} <span className="text-rose-500">*</span></label>
              <select name="studentId" required className={fld} defaultValue="">
                <option value="" disabled>—</option>
                {students.map((st) => <option key={st.id} value={st.id}>{st.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Summa (so'm)", ru: "Сумма (сум)", en: "Amount (soʻm)" })} <span className="text-rose-500">*</span></label>
              <input name="amount" type="number" min="1" step="10000" required className={fld} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Izoh", ru: "Примечание", en: "Note" })}</label>
              <textarea name="note" rows={2} placeholder={tr(locale, { uz: "Sababi...", ru: "Причина...", en: "Reason..." })} className={fld} />
            </div>

            {state.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                {state.error === "forbidden" ? tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission." }) : tr(locale, { uz: "Barcha majburiy maydonlarni to'ldiring.", ru: "Заполните все обязательные поля.", en: "Fill in all required fields." })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">{tr(locale, { uz: "Bekor", ru: "Отмена", en: "Cancel" })}</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
