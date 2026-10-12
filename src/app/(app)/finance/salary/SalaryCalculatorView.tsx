"use client";

import DateInput from "@/app/(app)/_components/DateInput";
import { confirmDelete, alertDialog } from "../../_components/dialogs";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import MoneyInput from "../../_components/MoneyInput";
import type { SalaryCalcResult, SalarySettings, SalarySettingKey, TeacherSalaryCalc } from "@/lib/salaryCalc";
import { saveSalaryRule, deleteSalaryRule, saveSalarySettings, calculateSalaries, publishSalaries, type RuleState } from "./actions";

export interface VRule {
  id: string;
  scope: string;
  amountType: string;
  amount: number;
  isDefault: boolean;
  targetId: string | null;
  targetName: string | null;
  groupId: string | null;
  groupName: string | null;
  courseName: string | null;
  groupLabel: string | null;
  teacherName: string | null;
  studentName: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

type Opt = { id: string; name?: string; fullName?: string };
type TR = { uz: string; ru: string; en: string; de?: string };

const TYPES: { value: string; label: TR }[] = [
  { value: "fixed", label: { uz: "O'zgarmas", ru: "Фиксированный", en: "Fixed", de: "Fest" } },
  { value: "by_student_fixed", label: { uz: "Har bir talaba uchun o'zgarmas (oyiga)", ru: "Фиксированно за каждого ученика (в месяц)", en: "Fixed per student (monthly)", de: "Fest pro Schüler (monatlich)" } },
  { value: "by_student_percentage", label: { uz: "Har bir talaba uchun kurs (chegirma) narxidan foiz (oyiga)", ru: "Процент от цены курса (со скидкой) за ученика (в месяц)", en: "Percent of course (discounted) price per student (monthly)", de: "Prozent vom (rabattierten) Kurspreis pro Schüler (monatlich)" } },
  { value: "percentage_by_student_payment", label: { uz: "Talabaning to'lovidan foiz", ru: "Процент от оплаты ученика", en: "Percent of student payment", de: "Prozent der Schülerzahlung" } },
  { value: "per_lesson_fixed", label: { uz: "Har bir dars uchun o'zgarmas", ru: "Фиксированно за каждый урок", en: "Fixed per lesson", de: "Fest pro Unterricht" } },
  { value: "per_lesson_percentage", label: { uz: "Har bir dars narxidan foiz", ru: "Процент от цены урока", en: "Percent of lesson price", de: "Prozent vom Unterrichtspreis" } },
];
const typeLabel = (t: string | null, locale: Locale) => { const x = TYPES.find((y) => y.value === t); return x ? tr(locale, x.label) : "—"; };
const isPercent = (t: string | null) => !!t && t.includes("percentage");

const SCOPES: { value: string; label: TR }[] = [
  { value: "COURSE", label: { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" } },
  { value: "TEACHER", label: { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" } },
  { value: "GROUP", label: { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" } },
  { value: "STUDENT", label: { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" } },
];
const scopeLabel = (sc: string | null, locale: Locale) =>
  sc === "ALL" ? tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" }) : (() => { const x = SCOPES.find((y) => y.value === sc); return x ? tr(locale, x.label) : "—"; })();

const SETTINGS: { key: SalarySettingKey; label: TR }[] = [
  { key: "use_student_discount_price", label: { uz: "O'qituvchi maoshida o'quvchi chegirmasini hisobga olish", ru: "Учитывать скидку ученика в зарплате преподавателя", en: "Apply student discount in teacher salary", de: "Schülerrabatt im Lehrergehalt berücksichtigen" } },
  { key: "use_archived_students", label: { uz: "Arxivlangan o'quvchilarga maosh hisoblash", ru: "Начислять зарплату за архивных учеников", en: "Calculate salary for archived students", de: "Gehalt für archivierte Schüler berechnen" } },
  { key: "hide_zero_amount_students", label: { uz: "Maosh hisoblashda 0 summalarni yashirish", ru: "Скрывать нулевые суммы при расчёте", en: "Hide zero amounts in calculation", de: "Nullbeträge bei der Berechnung ausblenden" } },
  { key: "belongs_to_attendance", label: { uz: "O'qituvchi maoshini davomatga ulash", ru: "Привязать зарплату преподавателя к посещаемости", en: "Link teacher salary to attendance", de: "Lehrergehalt an Anwesenheit koppeln" } },
  { key: "get_only_teachers_attendance", label: { uz: "Faqat guruh ustozi belgilagan davomatlarga maosh hisoblash", ru: "Считать только посещаемость, отмеченную преподавателем группы", en: "Count only attendance marked by the group teacher", de: "Nur vom Gruppenlehrer erfasste Anwesenheit zählen" } },
  { key: "get_only_came_attendance", label: { uz: "Faqat o'quvchi kelgan darslarga maosh hisoblash", ru: "Начислять только за уроки, на которые ученик пришёл", en: "Pay only for lessons the student attended", de: "Nur für besuchte Unterrichtsstunden bezahlen" } },
  { key: "use_trial_students", label: { uz: "Sinov darsidagi o'quvchilar uchun maosh hisoblash", ru: "Начислять за учеников на пробном уроке", en: "Calculate salary for trial students", de: "Gehalt für Probeschüler berechnen" } },
  { key: "use_frozen_students", label: { uz: "Muzlatilgan o'quvchilarni hisobga olish", ru: "Учитывать замороженных учеников", en: "Include frozen students", de: "Pausierte Schüler einbeziehen" } },
];

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-emerald-600 dark:text-emerald-400",
  FROZEN: "text-sky-600 dark:text-sky-400",
  WAITING: "text-amber-600 dark:text-amber-400",
  ARCHIVED: "text-rose-600 dark:text-rose-400",
  EXPELLED: "text-rose-600 dark:text-rose-400",
};

const dmy = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-"); return `${d}.${m}.${y}`; };
const dmyTime = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const fmtAmount = (r: { amountType: string; amount: number }, locale: Locale) => (isPercent(r.amountType) ? `${r.amount}%` : formatMoney(r.amount, locale));

// Excel (.xlsx) fayl — bir yoki bir nechta varaq
async function downloadXlsx(filename: string, sheets: { name: string; rows: (string | number | null)[][] }[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.rows), sh.name.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

interface Props {
  rules: VRule[];
  teachers: Opt[];
  programs: Opt[];
  groups: Opt[];
  students: Opt[];
  enrollments: [string, string][];
  settings: SalarySettings;
  canManage: boolean;
  locale: Locale;
  period: string;
}

export default function SalaryCalculatorView({ rules, teachers, programs, groups, students, enrollments, settings, canManage, locale, period }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<VRule | null>(null);
  const defRule = rules.find((r) => r.isDefault) ?? null;
  const editingDefault = editing?.isDefault ? editing : null;
  const editingIndividual = editing && !editing.isDefault ? editing : null;

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Ish haqi", ru: "Зарплата", en: "Salary", de: "Gehalt" })}</h1>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <button onClick={() => setCollapsed((v) => !v)} className="flex items-center gap-2.5 text-left text-lg font-semibold text-slate-700 dark:text-slate-200">
            {tr(locale, { uz: "Ish haqi kalkulyatorini sozlash", ru: "Настройка калькулятора зарплаты", en: "Salary calculator setup", de: "Gehaltsrechner einrichten" })}
            <Icon name="chevronDown" className={cn("h-5 w-5 text-slate-400 transition", collapsed ? "" : "rotate-180")} />
          </button>
          <button onClick={() => setSettingsOpen(true)} title={tr(locale, { uz: "Sozlamalar", ru: "Настройки", en: "Settings", de: "Einstellungen" })}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <Icon name="settings" className="h-4 w-4" />
          </button>
        </div>

        {!collapsed && (
          <div className="space-y-6 p-5">
            <Step n={1} text={tr(locale, { uz: "Barcha o'qituvchilar uchun standart hisoblash parametrlarini ko'rsating", ru: "Укажите параметры расчёта по умолчанию для всех преподавателей", en: "Specify the default calculation parameters for all teachers", de: "Geben Sie die Standard-Berechnungsparameter für alle Lehrer an" })} />
            {canManage ? (
              <DefaultRuleForm key={editingDefault?.id ?? "new-default"} editing={editingDefault} hasDefault={!!defRule} onDone={() => setEditing(null)} locale={locale} />
            ) : <ReadOnlyNote locale={locale} />}

            <Step n={2} text={tr(locale, { uz: "Siz har qanday o'qituvchilar / kurslar / guruhlar / talabalar uchun individual hisob-kitobni belgilashingiz mumkin.", ru: "Вы можете задать индивидуальный расчёт для любых преподавателей / курсов / групп / учеников.", en: "You can set an individual calculation for any teachers / courses / groups / students.", de: "Sie können eine individuelle Berechnung für beliebige Lehrer / Kurse / Gruppen / Schüler festlegen." })} />
            {canManage && (
              <IndividualRuleForm key={editingIndividual?.id ?? "new-individual"} editing={editingIndividual} onDone={() => setEditing(null)}
                teachers={teachers} programs={programs} groups={groups} students={students} enrollments={enrollments} locale={locale} />
            )}

            <RulesTable rules={rules} canManage={canManage} locale={locale} editingId={editing?.id ?? null} onEdit={(r) => { setEditing(r); }} />
          </div>
        )}
      </div>

      <CalcSection period={period} canManage={canManage} locale={locale} />

      {settingsOpen && <SettingsDialog initial={settings} canManage={canManage} locale={locale} onClose={() => setSettingsOpen(false)} />}
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
const typeSel = "h-11 min-w-0 max-w-[340px] rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-medium text-slate-600 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
const addBtn = "h-11 rounded-full border border-brand-400 px-7 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-950/30";
const cancelBtn = "h-11 rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800";
const lbl = "mb-1.5 block text-sm font-medium text-slate-500 dark:text-slate-400";

function ruleError(e: string | undefined, locale: Locale): string | null {
  if (!e) return null;
  if (e === "target") return tr(locale, { uz: "Nishonni tanlang.", ru: "Выберите цель.", en: "Select a target.", de: "Wählen Sie ein Ziel." });
  if (e === "group") return tr(locale, { uz: "Talabaning guruhini tanlang.", ru: "Выберите группу ученика.", en: "Select the student's group.", de: "Wählen Sie die Gruppe des Schülers." });
  if (e === "percent") return tr(locale, { uz: "Foiz 100 dan oshmasligi kerak.", ru: "Процент не должен превышать 100.", en: "Percent must not exceed 100.", de: "Der Prozentsatz darf 100 nicht überschreiten." });
  if (e === "forbidden") return tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Keine Berechtigung." });
  return tr(locale, { uz: "Qiymatni to'g'ri kiriting.", ru: "Введите корректное значение.", en: "Enter a valid value.", de: "Geben Sie einen gültigen Wert ein." });
}

// Summa + maosh turi (foiz turlarida % maydoni)
function AmountField({ type, setType, defaultAmount, locale }: { type: string; setType: (t: string) => void; defaultAmount?: number; locale: Locale }) {
  return (
    <div className="min-w-[260px] flex-1">
      <label className={lbl}>{tr(locale, { uz: "Oylik miqdori", ru: "Сумма оклада", en: "Salary amount", de: "Gehaltsbetrag" })}</label>
      <div className="flex gap-2">
        {isPercent(type) ? (
          <div className="relative w-full">
            <input key="pct" name="amount" type="number" min={1} max={100} step={1} required defaultValue={defaultAmount ?? ""} placeholder="0" className={cn(inp, "pr-8")} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
          </div>
        ) : (
          <MoneyInput key="money" name="amount" required placeholder="0" defaultValue={defaultAmount} className={inp} />
        )}
        <select name="amountType" value={type} onChange={(e) => setType(e.target.value)} className={typeSel}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{tr(locale, t.label)}</option>)}
        </select>
      </div>
    </div>
  );
}

// 1-bosqich: filial (standart) qoidasi
function DefaultRuleForm({ editing, hasDefault, onDone, locale }: { editing: VRule | null; hasDefault: boolean; onDone: () => void; locale: Locale }) {
  const [state, action, pending] = useActionState<RuleState, FormData>(saveSalaryRule, {});
  const [type, setType] = useState(editing?.amountType ?? "fixed");
  const [formKey, setFormKey] = useState(0);
  useEffect(() => { if (state.ok) { setFormKey((k) => k + 1); setType("fixed"); onDone(); } }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form key={formKey} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="scope" value="ALL" />
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <AmountField type={type} setType={setType} defaultAmount={editing?.amount} locale={locale} />
      <button type="submit" disabled={pending} className={addBtn}>
        {pending ? "..." : editing ? tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" }) : tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })}
      </button>
      {editing && <button type="button" onClick={onDone} className={cancelBtn}>{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>}
      {!editing && hasDefault && <p className="w-full text-xs text-slate-400">{tr(locale, { uz: "Standart qoida allaqachon bor — yangisi uni almashtiradi.", ru: "Правило по умолчанию уже есть — новое заменит его.", en: "A default rule already exists — a new one replaces it.", de: "Eine Standardregel existiert bereits — eine neue ersetzt sie." })}</p>}
      {ruleError(state.error, locale) && <p className="w-full text-sm text-rose-500">{ruleError(state.error, locale)}</p>}
    </form>
  );
}

// 2-bosqich: individual qoida (kurs / o'qituvchi / guruh / talaba + guruh)
function IndividualRuleForm({ editing, onDone, teachers, programs, groups, students, enrollments, locale }: {
  editing: VRule | null; onDone: () => void; teachers: Opt[]; programs: Opt[]; groups: Opt[]; students: Opt[]; enrollments: [string, string][]; locale: Locale;
}) {
  const [state, action, pending] = useActionState<RuleState, FormData>(saveSalaryRule, {});
  const [scope, setScope] = useState(editing?.scope ?? "");
  const [targetId, setTargetId] = useState(editing?.targetId ?? "");
  const [groupId, setGroupId] = useState(editing?.groupId ?? "");
  const [type, setType] = useState(editing?.amountType ?? "fixed");
  const [q, setQ] = useState("");
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state.ok) { setFormKey((k) => k + 1); setScope(""); setTargetId(""); setGroupId(""); setType("fixed"); setQ(""); onDone(); }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (o: Opt) => o.fullName ?? o.name ?? "";
  const allTargets: Opt[] = scope === "TEACHER" ? teachers : scope === "COURSE" ? programs : scope === "GROUP" ? groups : scope === "STUDENT" ? students : [];
  const targets = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? allTargets.filter((t) => nameOf(t).toLowerCase().includes(s) || t.id === targetId) : allTargets;
    return list.slice(0, 500);
  }, [allTargets, q, targetId]); // eslint-disable-line react-hooks/exhaustive-deps
  const studentGroups = useMemo(() => {
    if (scope !== "STUDENT" || !targetId) return [];
    const ids = new Set(enrollments.filter(([s]) => s === targetId).map(([, g]) => g));
    return groups.filter((g) => ids.has(g.id));
  }, [scope, targetId, enrollments, groups]);
  const targetLbl = SCOPES.find((x) => x.value === scope);

  return (
    <form key={formKey} action={action} className="flex flex-wrap items-end gap-3">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="groupId" value={scope === "STUDENT" ? groupId : ""} />
      <div className="min-w-[180px]">
        <label className={lbl}>{tr(locale, { uz: "Hisoblash usuli", ru: "Способ расчёта", en: "Calculation method", de: "Berechnungsmethode" })}</label>
        <select name="scope" value={scope} onChange={(e) => { setScope(e.target.value); setTargetId(""); setGroupId(""); setQ(""); }} required className={cn(inp, !scope && "text-slate-400")}>
          <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
          {SCOPES.map((sc) => <option key={sc.value} value={sc.value}>{tr(locale, sc.label)}</option>)}
        </select>
      </div>

      {scope && (
        <div className="min-w-[220px]">
          <label className={lbl}>{targetLbl ? tr(locale, targetLbl.label) : ""}</label>
          {allTargets.length > 30 && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(locale, { uz: "Qidirish...", ru: "Поиск...", en: "Search...", de: "Suchen..." })} className={cn(inp, "mb-1.5 h-9")} />
          )}
          <select value={targetId} onChange={(e) => { setTargetId(e.target.value); setGroupId(""); }} required className={cn(inp, !targetId && "text-slate-400")}>
            <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
            {editing && editing.targetId && !allTargets.some((t) => t.id === editing.targetId) && <option value={editing.targetId}>{editing.targetName}</option>}
            {targets.map((t) => <option key={t.id} value={t.id}>{nameOf(t)}</option>)}
          </select>
        </div>
      )}

      {scope === "STUDENT" && targetId && (
        <div className="min-w-[200px]">
          <label className={lbl}>{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required className={cn(inp, !groupId && "text-slate-400")}>
            <option value="">{tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })}</option>
            {editing?.groupId && !studentGroups.some((g) => g.id === editing.groupId) && <option value={editing.groupId}>{editing.groupName}</option>}
            {studentGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      <AmountField type={type} setType={setType} defaultAmount={editing?.amount} locale={locale} />
      <button type="submit" disabled={pending} className={addBtn}>
        {pending ? "..." : editing ? tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" }) : tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })}
      </button>
      {editing && <button type="button" onClick={onDone} className={cancelBtn}>{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>}
      {ruleError(state.error, locale) && <p className="w-full text-sm text-rose-500">{ruleError(state.error, locale)}</p>}
    </form>
  );
}

function RulesTable({ rules, canManage, locale, editingId, onEdit }: { rules: VRule[]; canManage: boolean; locale: Locale; editingId: string | null; onEdit: (r: VRule) => void }) {
  const th = "px-3 py-3.5 whitespace-nowrap";
  const td = "px-3 py-3 text-slate-500";
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
          <tr>
            <th className={th}>{tr(locale, { uz: "Hisoblash usuli", ru: "Способ расчёта", en: "Calculation method", de: "Berechnungsmethode" })}</th>
            <th className={th}>{tr(locale, { uz: "Maosh turi", ru: "Тип оклада", en: "Salary type", de: "Gehaltsart" })}</th>
            <th className={th}>{tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" })}</th>
            <th className={th}>{tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })}</th>
            <th className={th}>{tr(locale, { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" })}</th>
            <th className={th}>{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })}</th>
            <th className={th}>{tr(locale, { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" })}</th>
            <th className={th}>{tr(locale, { uz: "Yaratgan", ru: "Создал", en: "Created by", de: "Erstellt von" })}</th>
            <th className={th}>{tr(locale, { uz: "Yangilagan", ru: "Обновил", en: "Updated by", de: "Aktualisiert von" })}</th>
            <th className={cn(th, "text-right")}>{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rules.length === 0 ? (
            <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">{tr(locale, { uz: "Bo'sh", ru: "Пусто", en: "Empty", de: "Leer" })}</td></tr>
          ) : rules.map((r) => (
            <tr key={r.id} className={cn("transition hover:bg-slate-50 dark:hover:bg-slate-800/40", r.isDefault && "bg-brand-50/40 dark:bg-brand-950/10", editingId === r.id && "ring-2 ring-inset ring-brand-300")}>
              <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">{scopeLabel(r.scope, locale)}</td>
              <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{typeLabel(r.amountType, locale)}</td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800 dark:text-slate-100">{fmtAmount(r, locale)}</td>
              <td className={td}>{r.courseName ?? "—"}</td>
              <td className={td}>{r.groupLabel ?? "—"}</td>
              <td className={td}>{r.teacherName ?? (r.isDefault ? tr(locale, { uz: "Barcha", ru: "Все", en: "All", de: "Alle" }) : "—")}</td>
              <td className={td}>{r.studentName ?? "—"}</td>
              <td className={cn(td, "text-xs")}>{r.createdBy ?? "—"}<div className="text-slate-400">{dmyTime(r.createdAt)}</div></td>
              <td className={cn(td, "text-xs")}>{r.updatedAt ? <>{r.updatedBy ?? "—"}<div className="text-slate-400">{dmyTime(r.updatedAt)}</div></> : "—"}</td>
              <td className="px-3 py-3 text-right">
                {canManage ? (
                  <div className="inline-flex gap-1.5">
                    <button onClick={() => onEdit(r)} title={tr(locale, { uz: "Tahrirlash", ru: "Редактировать", en: "Edit", de: "Bearbeiten" })}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                      <Icon name="edit" className="h-3.5 w-3.5" />
                    </button>
                    <DelRule id={r.id} locale={locale} />
                  </div>
                ) : <span className="text-slate-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DelRule({ id, locale }: { id: string; locale: Locale }) {
  const [pending, start] = useTransition();
  return (
    <button onClick={async () => { if (await confirmDelete(tr(locale, { uz: "Qoidani o'chirasizmi?", ru: "Удалить правило?", en: "Delete the rule?", de: "Regel löschen?" }))) start(() => deleteSalaryRule(id)); }} disabled={pending}
      title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}
      className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30">
      <Icon name="trash" className="h-3.5 w-3.5" />
    </button>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  // body'ga chiqariladi: sahifa konteyneridagi transform fixed joylashuvni kesib qo'ymasligi uchun
  if (typeof document === "undefined") return null;
  return createPortal(
    // O'ng tomondan chiquvchi panel (Modme uslubida)
    <div className="animate-dialog-fade fixed inset-0 z-[120] flex justify-end bg-slate-900/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cn("animate-slide-in-right flex h-full w-full flex-col bg-white shadow-2xl dark:bg-slate-900", wide ? "max-w-[min(1200px,92vw)]" : "max-w-lg")}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="close" className="h-4 w-4" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function SettingsDialog({ initial, canManage, locale, onClose }: { initial: SalarySettings; canManage: boolean; locale: Locale; onClose: () => void }) {
  const [vals, setVals] = useState<SalarySettings>(initial);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const save = () => start(async () => {
    const r = await saveSalarySettings(vals);
    if (r.ok) onClose();
    else setErr(tr(locale, { uz: "Saqlab bo'lmadi.", ru: "Не удалось сохранить.", en: "Could not save.", de: "Speichern fehlgeschlagen." }));
  });
  return (
    <Modal title={tr(locale, { uz: "Ish haqi sozlamalari", ru: "Настройки зарплаты", en: "Salary settings", de: "Gehaltseinstellungen" })} onClose={onClose}>
      <div className="flex-1 space-y-1 p-5">
        {SETTINGS.map((s) => (
          <label key={s.key} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input type="checkbox" checked={vals[s.key]} disabled={!canManage} onChange={(e) => setVals((v) => ({ ...v, [s.key]: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-brand-600" />
            <span className="text-sm text-slate-700 dark:text-slate-200">{tr(locale, s.label)}</span>
          </label>
        ))}
        {err && <p className="px-2 text-sm text-rose-500">{err}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200/70 px-5 py-4 dark:border-slate-800">
        <button onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}</button>
        {canManage && <button onClick={save} disabled={pending} className="h-10 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">{pending ? "..." : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>}
      </div>
    </Modal>
  );
}

function CalcIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2" /><path d="M8 6.5h8" /><path d="M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );
}

function CalcSection({ period, canManage, locale }: { period: string; canManage: boolean; locale: Locale }) {
  const [p, setP] = useState(period);
  const [result, setResult] = useState<SalaryCalcResult | null>(null);
  const [calcPending, startCalc] = useTransition();
  const [pubPending, startPub] = useTransition();
  const [detail, setDetail] = useState<TeacherSalaryCalc | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fresh = result && `${result.year}-${String(result.month).padStart(2, "0")}` === p;

  const calc = () => startCalc(async () => {
    setMsg(null);
    const r = await calculateSalaries(p);
    if (r.ok && r.result) setResult(r.result);
    else { setResult(null); setMsg({ ok: false, text: r.error === "invalid" ? tr(locale, { uz: "Davrni tanlang.", ru: "Выберите период.", en: "Select a period.", de: "Wählen Sie einen Zeitraum." }) : tr(locale, { uz: "Ruxsat yo'q.", ru: "Нет доступа.", en: "No permission.", de: "Keine Berechtigung." }) }); }
  });

  const publish = () => startPub(async () => {
    const r = await publishSalaries(p);
    if (r.ok) {
      const skipped = r.skipped ? tr(locale, { uz: ` (${r.skipped} ta yopilgan oy o'zgartirilmadi)`, ru: ` (${r.skipped} закрытых месяцев не изменено)`, en: ` (${r.skipped} closed months left unchanged)`, de: ` (${r.skipped} abgeschlossene Monate unverändert)` }) : "";
      await alertDialog({
        title: tr(locale, { uz: "Profillarga chiqarildi", ru: "Отправлено в профили", en: "Published to profiles", de: "In Profilen veröffentlicht" }),
        message: tr(locale, { uz: `${r.count} o'qituvchi uchun maosh yozildi — jami ${formatMoney(r.total ?? 0, locale)}.`, ru: `Зарплата записана для ${r.count} преподавателей — всего ${formatMoney(r.total ?? 0, locale)}.`, en: `Salary written for ${r.count} teachers — total ${formatMoney(r.total ?? 0, locale)}.`, de: `Gehalt für ${r.count} Lehrer gespeichert — insgesamt ${formatMoney(r.total ?? 0, locale)}.` }) + skipped,
      });
    } else setMsg({ ok: false, text: tr(locale, { uz: "Ruxsat yo'q yoki davr noto'g'ri.", ru: "Нет доступа или неверный период.", en: "No permission or invalid period.", de: "Keine Berechtigung oder ungültiger Zeitraum." }) });
  });

  const exportXlsx = async () => {
    if (!result) return;
    const head = [tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" }), tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" })];
    const summary: (string | number)[][] = [head, ...result.teachers.map((t) => [t.teacherName, t.total]), [tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" }), result.total]];
    const dHead = ([
      { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" },
      { uz: "Guruh", ru: "Группа", en: "Group", de: "Gruppe" },
      { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" },
      { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" },
      { uz: "Darslar", ru: "Уроки", en: "Lessons", de: "Stunden" },
      { uz: "Keldi", ru: "Пришёл", en: "Came", de: "Da" },
      { uz: "Kelmadi", ru: "Не пришёл", en: "Absent", de: "Fehlt" },
      { uz: "Belgilanmagan", ru: "Не отмечено", en: "Not marked", de: "Nicht erfasst" },
      { uz: "Belgilangan summa", ru: "Назначенная сумма", en: "Assigned amount", de: "Festgelegter Betrag" },
      { uz: "Hisoblangan summa", ru: "Начисленная сумма", en: "Calculated amount", de: "Berechneter Betrag" },
      { uz: "Hisoblash usuli", ru: "Способ расчёта", en: "Calculation method", de: "Berechnungsmethode" },
      { uz: "Maosh turi", ru: "Тип оклада", en: "Salary type", de: "Gehaltsart" },
    ] as TR[]).map((x) => tr(locale, x));
    const details: (string | number | null)[][] = [dHead];
    for (const t of result.teachers) for (const r of t.rows) {
      details.push([t.teacherName, r.groupName ?? "", r.programName ?? "", r.studentName ?? "", r.lessons, r.came, r.notCame, r.notMarked, r.assigned, r.amount, scopeLabel(r.ruleScope, locale), typeLabel(r.ruleType, locale)]);
    }
    await downloadXlsx(`ish-haqi-${result.year}-${String(result.month).padStart(2, "0")}.xlsx`, [
      { name: tr(locale, { uz: "Ish haqi", ru: "Зарплата", en: "Salary", de: "Gehalt" }), rows: summary },
      { name: tr(locale, { uz: "Tafsilotlar", ru: "Детали", en: "Details", de: "Details" }), rows: details },
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-white p-5 shadow-card dark:border-slate-600 dark:bg-slate-900">
        <DateInput type="month" value={p} onChange={(e) => setP(e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100" />
        <button onClick={calc} disabled={calcPending || !p} className="h-11 rounded-lg bg-brand-800 px-7 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-50">
          {calcPending ? tr(locale, { uz: "Hisoblanmoqda...", ru: "Расчёт...", en: "Calculating...", de: "Wird berechnet..." }) : tr(locale, { uz: "Hisoblang", ru: "Рассчитать", en: "Calculate", de: "Berechnen" })}
        </button>
        {canManage && (
          <button onClick={publish} disabled={!fresh || pubPending} className="h-11 rounded-lg bg-emerald-500 px-7 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
            {pubPending ? "..." : tr(locale, { uz: "O'qituvchilar profilida ko'rsatish", ru: "Показать в профилях преподавателей", en: "Show in teacher profiles", de: "In Lehrerprofilen anzeigen" })}
          </button>
        )}
        <Link href={`/salary?year=${p.split("-")[0]}&month=${Number(p.split("-")[1] || 0)}`} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
          {tr(locale, { uz: "Maosh yozuvlari", ru: "Записи зарплаты", en: "Salary records", de: "Gehaltseinträge" })} →
        </Link>
        {msg && <p className={cn("w-full text-sm", msg.ok ? "text-emerald-600" : "text-rose-500")}>{msg.text}</p>}
      </div>

      {result && (
        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
              {tr(locale, { uz: "Maosh davri", ru: "Период зарплаты", en: "Salary period", de: "Gehaltszeitraum" })}: {dmy(result.periodStart)} — {dmy(result.periodEnd)}
            </h2>
            <button onClick={exportXlsx} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
              <Icon name="download" className="h-4 w-4" /> Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-3">{tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })}</th>
                  <th className="px-5 py-3">{tr(locale, { uz: "Summa", ru: "Сумма", en: "Amount", de: "Betrag" })}</th>
                  <th className="w-16 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {result.teachers.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-12 text-center text-slate-400">{tr(locale, { uz: "Bu davr uchun hisoblanadigan maosh yo'q.", ru: "За этот период начислений нет.", en: "No salary to calculate for this period.", de: "Für diesen Zeitraum ist kein Gehalt zu berechnen." })}</td></tr>
                ) : result.teachers.map((t) => (
                  <tr key={t.teacherId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">{t.teacherName}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(t.total, locale)}</td>
                    <td className="px-5 py-2 text-right">
                      <button onClick={() => setDetail(t)} title={tr(locale, { uz: "To'lov hisob-kitobi", ru: "Расчёт оплаты", en: "Payment calculation", de: "Zahlungsberechnung" })}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                        <CalcIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50/60 font-semibold dark:border-slate-700 dark:bg-slate-800/40">
                <tr>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-900 dark:text-slate-100">{formatMoney(result.total, locale)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {detail && result && <DetailsModal t={detail} result={result} locale={locale} onClose={() => setDetail(null)} />}
    </div>
  );
}

function DetailsModal({ t, result, locale, onClose }: { t: TeacherSalaryCalc; result: SalaryCalcResult; locale: Locale; onClose: () => void }) {
  const period = `${dmy(result.periodStart)} — ${dmy(result.periodEnd)}`;
  const th = "px-3 py-3 whitespace-nowrap";
  return (
    <Modal wide title={tr(locale, { uz: "To'lov hisob-kitobi", ru: "Расчёт оплаты", en: "Payment calculation", de: "Zahlungsberechnung" })} onClose={onClose}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {tr(locale, { uz: `${t.teacherName} uchun ${period} maosh hisobi`, ru: `Расчёт зарплаты ${t.teacherName} за ${period}`, en: `Salary calculation for ${t.teacherName}, ${period}`, de: `Gehaltsberechnung für ${t.teacherName}, ${period}` })}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{tr(locale, { uz: "To'lovlar", ru: "Оплаты", en: "Payments", de: "Zahlungen" })}: {formatMoney(t.rows.reduce((a, r) => a + (r.paid ?? 0), 0), locale)}</span>
          <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-base font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{tr(locale, { uz: "Oylik", ru: "Зарплата", en: "Salary", de: "Gehalt" })}: {formatMoney(t.total, locale)}</span>
        </div>
      </div>
      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[1100px] border-collapse border border-slate-200 text-left text-sm dark:border-slate-700 [&_td]:border [&_td]:border-slate-200 [&_th]:border [&_th]:border-slate-200 dark:[&_td]:border-slate-700 dark:[&_th]:border-slate-700">
          <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            <tr>
              <th className={th}>№</th>
              <th className={th}>{tr(locale, { uz: "Guruh / Kurs", ru: "Группа / Курс", en: "Group / Course", de: "Gruppe / Kurs" })}</th>
              <th className={th}>{tr(locale, { uz: "Talaba", ru: "Ученик", en: "Student", de: "Schüler" })}</th>
              <th className={th}>{tr(locale, { uz: "Darslar ~ Keldi / Kelmadi / Belgilanmagan", ru: "Уроки ~ Пришёл / Не пришёл / Не отмечено", en: "Lessons ~ Came / Absent / Not marked", de: "Stunden ~ Da / Fehlt / Nicht erfasst" })}</th>
              <th className={th}>{tr(locale, { uz: "To'lagan summa", ru: "Оплачено", en: "Paid", de: "Bezahlt" })}</th>
              <th className={th}>{tr(locale, { uz: "Belgilangan summa", ru: "Назначенная сумма", en: "Assigned amount", de: "Festgelegter Betrag" })}</th>
              <th className={th}>{tr(locale, { uz: "Hisoblangan summa", ru: "Начисленная сумма", en: "Calculated amount", de: "Berechneter Betrag" })}</th>
              <th className={th}>{tr(locale, { uz: "Hisoblash usuli", ru: "Способ расчёта", en: "Calculation method", de: "Berechnungsmethode" })}</th>
              <th className={th}>{tr(locale, { uz: "Maosh turi", ru: "Тип оклада", en: "Salary type", de: "Gehaltsart" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {t.rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2.5">
                  {r.groupId ? <Link href={`/groups/${r.groupId}`} className="font-medium text-brand-600 hover:underline dark:text-brand-300">{r.groupName}</Link> : <span className="text-slate-400">—</span>}
                  {r.programId && <div><Link href={`/courses/${r.programId}`} className="text-xs text-slate-500 hover:underline">{r.programName}</Link></div>}
                </td>
                <td className="px-3 py-2.5">
                  {r.studentId ? <Link href={`/students/${r.studentId}`} className={cn("font-medium hover:underline", STATUS_COLOR[r.studentStatus ?? ""] ?? "text-slate-700 dark:text-slate-200")}>{r.studentName}</Link> : <span className="text-slate-400">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  {r.studentId ? <>{r.lessons} ~ <span className="text-emerald-600">{r.came}</span> / <span className="text-rose-500">{r.notCame}</span> / <span className="text-slate-400">{r.notMarked}</span></> : "—"}
                </td>
                <td className={cn("whitespace-nowrap px-3 py-2.5", r.paid ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-slate-400")}>
                  {r.paid == null ? "—" : r.paid > 0 ? formatMoney(r.paid, locale) : tr(locale, { uz: "To'lamagan", ru: "Не оплатил", en: "Not paid", de: "Nicht bezahlt" })}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  {formatMoney(r.assigned, locale)}
                  {r.ruleAmount != null && isPercent(r.ruleType) && <span className="ml-1 text-xs text-slate-400">({r.ruleAmount}%)</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{formatMoney(r.amount, locale)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.ruleScope ? scopeLabel(r.ruleScope, locale) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.ruleType ? typeLabel(r.ruleType, locale) : tr(locale, { uz: "Qoida yo'q", ru: "Нет правила", en: "No rule", de: "Keine Regel" })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
            <tr>
              <td className="px-3 py-3" colSpan={4}>{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Gesamt" })}</td>
              <td className="whitespace-nowrap px-3 py-3 text-emerald-600 dark:text-emerald-400">{formatMoney(t.rows.reduce((a, r) => a + (r.paid ?? 0), 0), locale)}</td>
              <td className="px-3 py-3" />
              <td className="whitespace-nowrap px-3 py-3">{formatMoney(t.total, locale)}</td>
              <td className="px-3 py-3" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}
