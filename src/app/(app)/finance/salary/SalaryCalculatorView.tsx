"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { addSalaryRule, deleteSalaryRule, calculateSalaries, type RuleState, type CalcState } from "./actions";

export interface VRule {
  id: string;
  scope: string;
  amountType: string;
  amount: number;
  isDefault: boolean;
  targetName: string | null;
}

type Opt = { id: string; name?: string; fullName?: string };

type TR = { uz: string; ru: string; en: string; de?: string };
const SCOPES: { value: string; label: TR }[] = [
  { value: "TEACHER", label: { uz: "O'qituvchi bo'yicha", ru: "По преподавателю", en: "By teacher", de: "Nach Lehrer" } },
  { value: "COURSE", label: { uz: "Kurs bo'yicha", ru: "По курсу", en: "By course", de: "Nach Kurs" } },
  { value: "GROUP", label: { uz: "Guruh bo'yicha", ru: "По группе", en: "By group", de: "Nach Gruppe" } },
  { value: "STUDENT", label: { uz: "Talaba bo'yicha", ru: "По ученику", en: "By student", de: "Nach Schüler" } },
];
const scopeLabel: Record<string, TR> = {
  ALL: { uz: "Barcha o'qituvchilar", ru: "Все преподаватели", en: "All teachers", de: "Alle Lehrer" },
  TEACHER: { uz: "O'qituvchi bo'yicha", ru: "По преподавателю", en: "By teacher", de: "Nach Lehrer" },
  COURSE: { uz: "Kurs bo'yicha", ru: "По курсу", en: "By course", de: "Nach Kurs" },
  GROUP: { uz: "Guruh bo'yicha", ru: "По группе", en: "By group", de: "Nach Gruppe" },
  STUDENT: { uz: "Talaba bo'yicha", ru: "По ученику", en: "By student", de: "Nach Schüler" },
};
const targetLabel: Record<string, TR> = {
  TEACHER: { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" },
  COURSE: { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" },
  GROUP: { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" },
  STUDENT: { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" },
};
const typeLabel: Record<string, TR> = { FIXED: { uz: "O'zgarmas", ru: "Фиксированный", en: "Fixed", de: "Fest" }, PERCENT: { uz: "Foiz", ru: "Процент", en: "Percent", de: "Prozent" } };

interface Props {
  rules: VRule[];
  teachers: Opt[];
  programs: Opt[];
  groups: Opt[];
  students: Opt[];
  canManage: boolean;
  locale: Locale;
  period: string;
}

export default function SalaryCalculatorView({ rules, teachers, programs, groups, students, canManage, locale, period }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Ish haqi", ru: "Зарплата", en: "Salary", de: "Gehalt" })}</h1>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        {/* Panel sarlavhasi */}
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <button onClick={() => setCollapsed((v) => !v)} className="flex items-center gap-2.5 text-lg font-semibold text-slate-700 dark:text-slate-200">
            <Icon name="settings" className="h-5 w-5 text-slate-400" />
            {tr(locale, { uz: "Ish haqi kalkulyatorini sozlash", ru: "Настройка калькулятора зарплаты", en: "Salary calculator settings", de: "Gehaltsrechner-Einstellungen" })}
            <Icon name="chevronDown" className={cn("h-5 w-5 text-slate-400 transition", collapsed ? "" : "rotate-180")} />
          </button>
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-400 dark:border-slate-700"><Icon name="settings" className="h-4 w-4" /></span>
        </div>

        {!collapsed && (
          <div className="space-y-6 p-5">
            {/* 1-bosqich */}
            <Step n={1} text={tr(locale, { uz: "Barcha o'qituvchilar uchun standart xarajatlarni belgilash parametrlarini ko'rsating", ru: "Укажите параметры расчёта по умолчанию для всех преподавателей", en: "Specify the default calculation parameters for all teachers", de: "Geben Sie die Standard-Berechnungsparameter für alle Lehrer an" })} />
            {canManage ? <DefaultRuleForm locale={locale} /> : <ReadOnlyNote locale={locale} />}

            {/* 2-bosqich */}
            <Step n={2} text={tr(locale, { uz: "Siz har qanday o'qituvchilar / kurslar / guruhlar / talabalar uchun individual hisob-kitobni belgilashingiz mumkin.", ru: "Вы можете задать индивидуальный расчёт для любых преподавателей / курсов / групп / учеников.", en: "You can set an individual calculation for any teachers / courses / groups / students.", de: "Sie können eine individuelle Berechnung für beliebige Lehrer / Kurse / Gruppen / Schüler festlegen." })} />
            {canManage && <IndividualRuleForm teachers={teachers} programs={programs} groups={groups} students={students} locale={locale} />}

            {/* Qoidalar jadvali */}
            <RulesTable rules={rules} canManage={canManage} locale={locale} />

            {/* Hisoblash */}
            <CalcBar period={period} canManage={canManage} locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border-l-4 border-brand-500 bg-slate-50/70 p-4 dark:bg-slate-800/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-500 text-lg font-bold text-white">{n}</span>
      <p className="pt-1.5 text-[15px] font-medium text-slate-700 dark:text-slate-200">{text}</p>
    </div>
  );
}

function ReadOnlyNote({ locale }: { locale: Locale }) {
  return <p className="text-sm text-slate-400">{tr(locale, { uz: "Faqat ko'rish rejimi — qoida qo'shish uchun ruxsat yo'q.", ru: "Режим только для просмотра — нет прав на добавление правил.", en: "View-only mode — no permission to add rules.", de: "Nur-Ansicht-Modus — keine Berechtigung, Regeln hinzuzufügen." })}</p>;
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";
const typeSel = "h-11 rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-medium text-slate-600 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
const addBtn = "h-11 rounded-full border border-brand-400 px-7 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-950/30";

// 1-bosqich: standart qoida
function DefaultRuleForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState<RuleState, FormData>(addSalaryRule, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="scope" value="ALL" />
      <input type="hidden" name="isDefault" value="true" />
      <div className="min-w-[240px] flex-1">
        <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Oylik miqdori", ru: "Сумма оклада", en: "Salary amount", de: "Gehaltsbetrag" })}</label>
        <div className="flex gap-2">
          <input name="amount" type="number" min="1" required placeholder="0" className={inp} />
          <select name="amountType" defaultValue="FIXED" className={typeSel}>
            <option value="FIXED">{tr(locale, { uz: "O'zgarmas", ru: "Фиксированный", en: "Fixed", de: "Fest" })}</option>
            <option value="PERCENT">{tr(locale, { uz: "Foiz", ru: "Процент", en: "Percent", de: "Prozent" })}</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={pending} className={addBtn}>{pending ? "..." : tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })}</button>
      {state.error && <p className="w-full text-sm text-rose-500">{tr(locale, { uz: "Qiymatni to'g'ri kiriting.", ru: "Введите корректное значение.", en: "Enter a valid value.", de: "Geben Sie einen gültigen Wert ein." })}</p>}
    </form>
  );
}

// 2-bosqich: individual qoida
function IndividualRuleForm({ teachers, programs, groups, students, locale }: { teachers: Opt[]; programs: Opt[]; groups: Opt[]; students: Opt[]; locale: Locale }) {
  const [state, action, pending] = useActionState<RuleState, FormData>(addSalaryRule, {});
  const [scope, setScope] = useState("");
  const [targetId, setTargetId] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) { ref.current?.reset(); setScope(""); setTargetId(""); } }, [state.ok]);

  const targets: Opt[] = scope === "TEACHER" ? teachers : scope === "COURSE" ? programs : scope === "GROUP" ? groups : scope === "STUDENT" ? students : [];
  const nameOf = (o: Opt) => o.fullName ?? o.name ?? "";
  const targetName = targets.find((t) => t.id === targetId) ? nameOf(targets.find((t) => t.id === targetId)!) : "";

  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="targetName" value={targetName} />
      <div className="min-w-[200px]">
        <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Hisoblash usuli", ru: "Способ расчёта", en: "Calculation method", de: "Berechnungsmethode" })}</label>
        <div className="relative">
          <select name="scope" value={scope} onChange={(e) => { setScope(e.target.value); setTargetId(""); }} required
            className={cn(inp, "appearance-none pr-9", !scope && "text-slate-400")}>
            <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select option", de: "Option auswählen" })}</option>
            {SCOPES.map((sc) => <option key={sc.value} value={sc.value}>{tr(locale, sc.label)}</option>)}
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {scope && (
        <div className="min-w-[200px]">
          <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{targetLabel[scope] ? tr(locale, targetLabel[scope]) : ""}</label>
          <div className="relative">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} required
              className={cn(inp, "appearance-none pr-9", !targetId && "text-slate-400")}>
              <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
              {targets.map((t) => <option key={t.id} value={t.id}>{nameOf(t)}</option>)}
            </select>
            <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      )}

      <div className="min-w-[220px]">
        <label className="mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Oylik miqdori", ru: "Сумма оклада", en: "Salary amount", de: "Gehaltsbetrag" })}</label>
        <div className="flex gap-2">
          <input name="amount" type="number" min="1" required placeholder="0" className={inp} />
          <select name="amountType" defaultValue="FIXED" className={typeSel}>
            <option value="FIXED">{tr(locale, { uz: "O'zgarmas", ru: "Фиксированный", en: "Fixed", de: "Fest" })}</option>
            <option value="PERCENT">{tr(locale, { uz: "Foiz", ru: "Процент", en: "Percent", de: "Prozent" })}</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={pending} className={addBtn}>{pending ? "..." : tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })}</button>
      {state.error && <p className="w-full text-sm text-rose-500">{state.error === "target" ? tr(locale, { uz: "Nishonni tanlang.", ru: "Выберите цель.", en: "Select a target.", de: "Wählen Sie ein Ziel." }) : tr(locale, { uz: "Qiymatni to'g'ri kiriting.", ru: "Введите корректное значение.", en: "Enter a valid value.", de: "Geben Sie einen gültigen Wert ein." })}</p>}
    </form>
  );
}

function RulesTable({ rules, canManage, locale }: { rules: VRule[]; canManage: boolean; locale: Locale }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
          <tr>
            <th className="px-4 py-3.5">{tr(locale, { uz: "Hisoblash usuli", ru: "Способ расчёта", en: "Calculation method", de: "Berechnungsmethode" })}</th>
            <th className="px-4 py-3.5">{tr(locale, { uz: "Maosh turi", ru: "Тип оклада", en: "Salary type", de: "Gehaltsart" })}</th>
            <th className="px-4 py-3.5">{tr(locale, { uz: "Miqdori", ru: "Сумма", en: "Amount", de: "Betrag" })}</th>
            <th className="px-4 py-3.5">{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })}</th>
            <th className="px-4 py-3.5">{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}</th>
            <th className="px-4 py-3.5">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })}</th>
            <th className="px-4 py-3.5 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rules.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{tr(locale, { uz: "Bo'sh", ru: "Пусто", en: "Empty", de: "Leer" })}</td></tr>
          ) : (
            rules.map((r) => (
              <tr key={r.id} className={cn("transition hover:bg-slate-50 dark:hover:bg-slate-800/40", r.isDefault && "bg-brand-50/40 dark:bg-brand-950/10")}>
                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{scopeLabel[r.scope] ? tr(locale, scopeLabel[r.scope]) : r.scope}{r.isDefault && <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">{tr(locale, { uz: "standart", ru: "по умолчанию", en: "default", de: "Standard" })}</span>}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{typeLabel[r.amountType] ? tr(locale, typeLabel[r.amountType]) : r.amountType}</td>
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{r.amountType === "PERCENT" ? `${r.amount}%` : formatMoney(r.amount, locale)}</td>
                <td className="px-4 py-3 text-slate-500">{r.scope === "COURSE" ? r.targetName : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{r.scope === "GROUP" ? r.targetName : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{r.scope === "TEACHER" ? r.targetName : r.scope === "STUDENT" ? `${tr(locale, { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" })}: ${r.targetName}` : r.scope === "ALL" ? tr(locale, { uz: "Barcha", ru: "Все", en: "All", de: "Alle" }) : "—"}</td>
                <td className="px-4 py-3 text-right">{canManage ? <DelRule id={r.id} locale={locale} /> : <span className="text-slate-400">—</span>}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DelRule({ id, locale }: { id: string; locale: Locale }) {
  const [pending, start] = useTransition();
  return (
    <button onClick={() => { if (window.confirm(tr(locale, { uz: "Qoidani o'chirasizmi?", ru: "Удалить правило?", en: "Delete the rule?", de: "Regel löschen?" }))) start(() => deleteSalaryRule(id)); }} disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30">
      <Icon name="trash" className="h-3.5 w-3.5" /> {pending ? "..." : tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
    </button>
  );
}

function CalcBar({ period, canManage, locale }: { period: string; canManage: boolean; locale: Locale }) {
  const [state, action, pending] = useActionState<CalcState, FormData>(calculateSalaries, {});
  const [p, setP] = useState(period);
  const [y, m] = p.split("-");
  return (
    <div className="space-y-3 border-t border-slate-200/70 pt-5 dark:border-slate-800">
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="month" name="period" value={p} onChange={(e) => setP(e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100" />
        {canManage && (
          <button type="submit" disabled={pending} className="h-11 rounded-lg bg-brand-800 px-7 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-50">
            {pending ? tr(locale, { uz: "Hisoblanmoqda...", ru: "Расчёт...", en: "Calculating...", de: "Wird berechnet..." }) : tr(locale, { uz: "Hisoblang", ru: "Рассчитать", en: "Calculate", de: "Berechnen" })}
          </button>
        )}
        <Link href={`/salary?year=${y}&month=${Number(m)}`}
          className="h-11 rounded-lg bg-emerald-500 px-7 text-sm font-semibold leading-[44px] text-white transition hover:bg-emerald-600">
          {tr(locale, { uz: "O'qituvchilar profilida ko'rsatish", ru: "Показать в профилях преподавателей", en: "Show in teacher profiles", de: "In Lehrerprofilen anzeigen" })}
        </Link>
      </form>
      {state.ok && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          ✓ {tr(locale, { uz: `${state.count} o'qituvchi uchun hisoblandi — jami ${formatMoney(state.total ?? 0, locale)}.`, ru: `Рассчитано для ${state.count} преподавателей — всего ${formatMoney(state.total ?? 0, locale)}.`, en: `Calculated for ${state.count} teachers — total ${formatMoney(state.total ?? 0, locale)}.`, de: `Berechnet für ${state.count} Lehrer — insgesamt ${formatMoney(state.total ?? 0, locale)}.` })}
        </p>
      )}
      {state.error && <p className="text-sm text-rose-500">{state.error === "invalid" ? tr(locale, { uz: "Davrni tanlang.", ru: "Выберите период.", en: "Select a period.", de: "Wählen Sie einen Zeitraum." }) : tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Keine Berechtigung." })}</p>}
    </div>
  );
}
