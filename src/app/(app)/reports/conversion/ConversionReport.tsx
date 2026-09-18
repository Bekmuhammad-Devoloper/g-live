"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";
import { FUNNEL_STEPS, reached, type StepKey } from "./funnel";

interface ApiLead {
  id: string;
  fullName: string;
  phone: string;
  stage: string;
  source: string | null;
  createdAt: string;
  studentId: string | null;
  archived: boolean;
  employeeId: string | null;
  employeeName: string | null;
}
interface ApiEmployee {
  id: string; // "none" — biriktirilmagan
  name: string | null;
  role: string | null;
  total: number;
  sorovlar: number;
  ishlov: number;
  test: number;
  taklif: number;
  tolov: number;
  qabul: number;
  yoqotilgan: number;
  activities: number;
  conversion: number;
}
interface ApiResponse {
  total: number;
  counts: Record<string, number>;
  conversion: number;
  employees: ApiEmployee[];
  leads: ApiLead[];
  options: { sources: string[]; managers: { id: string; name: string }[]; hasUnassigned: boolean };
}

interface Props {
  defaultFrom: string; // YYYY-MM-DD
  defaultTo: string;
  locale: Locale;
}

type Sel = StepKey | "yoqotilgan" | "";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};
const pct1 = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export default function ConversionReport({ defaultFrom, defaultTo, locale }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [source, setSource] = useState("");
  const [manager, setManager] = useState("");
  const [selected, setSelected] = useState<Sel>("");
  const [showHow, setShowHow] = useState(false);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  // Filtr o'zgarsa — alohida API'dan qayta yuklaymiz
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ from, to, source, manager });
    fetch(`/api/reports/conversion?${params.toString()}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setError(true); setLoading(false); } });
    return () => ctrl.abort();
  }, [from, to, source, manager]);

  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;
  const leads = data?.leads ?? [];
  const employees = data?.employees ?? [];
  const options = data?.options ?? { sources: [], managers: [], hasUnassigned: false };

  const detailRows = useMemo(() => (selected ? leads.filter((l) => reached(l, selected)) : leads), [leads, selected]);

  const stepLabel = (key: string) => {
    if (key === "yoqotilgan") return T("Yo'qotilgan", "Потеряны", "Lost", "Verloren");
    const s = FUNNEL_STEPS.find((x) => x.key === key);
    return s ? tr(locale, s.label) : key;
  };

  const handleExport = () => {
    const rows = detailRows.map((l) => ({
      fullName: l.fullName,
      phone: l.phone,
      stage: label(LEAD_STAGE_LABELS, l.stage, locale),
      source: l.source ?? "—",
      createdAt: fmtDate(l.createdAt),
      employeeName: l.employeeName ?? T("Biriktirilmagan", "Не назначен", "Unassigned", "Nicht zugewiesen"),
    }));
    exportRows(
      `konversiya_${from}_${to}${selected ? "_" + selected : ""}`,
      [
        { key: "fullName", label: T("FIO", "ФИО", "Full name", "Name") },
        { key: "phone", label: T("Telefon", "Телефон", "Phone", "Telefon") },
        { key: "stage", label: T("Holati", "Статус", "Status", "Status") },
        { key: "source", label: T("Manba", "Источник", "Source", "Quelle") },
        { key: "createdAt", label: T("Sana", "Дата", "Date", "Datum") },
        { key: "employeeName", label: T("Xodim", "Сотрудник", "Employee", "Mitarbeiter") },
      ],
      rows,
    );
  };

  const exportEmployees = () => {
    exportRows(
      `konversiya_xodimlar_${from}_${to}`,
      [
        { key: "name", label: T("Xodim", "Сотрудник", "Employee", "Mitarbeiter") },
        { key: "total", label: T("So'rovlar", "Заявки", "Requests", "Anfragen") },
        { key: "ishlov", label: stepLabel("ishlov") },
        { key: "test", label: stepLabel("test") },
        { key: "taklif", label: stepLabel("taklif") },
        { key: "tolov", label: stepLabel("tolov") },
        { key: "qabul", label: stepLabel("qabul") },
        { key: "yoqotilgan", label: stepLabel("yoqotilgan") },
        { key: "activities", label: T("Harakatlar", "Действия", "Activities", "Aktionen") },
        { key: "conversion", label: T("Konversiya %", "Конверсия %", "Conversion %", "Konversion %") },
      ],
      employees.map((e) => ({ ...e, name: e.name ?? T("Biriktirilmagan", "Не назначен", "Unassigned", "Nicht zugewiesen") })),
    );
  };

  const conv = data?.conversion ?? 0;
  const lost = counts.yoqotilgan ?? 0;
  const inWork = total - (counts.qabul ?? 0) - lost;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{T("Konversiya hisobotlari", "Отчёты по конверсии", "Conversion reports", "Konversionsberichte")}</h1>
        {loading && <Icon name="refresh" className="h-4 w-4 animate-spin text-slate-400" />}
        <button
          type="button"
          onClick={() => setShowHow((v) => !v)}
          className={cn("ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition", showHow ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-950/40 dark:text-brand-300" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}
        >
          <Icon name="info" className="h-3.5 w-3.5" /> {T("Qanday hisoblanadi?", "Как считается?", "How is it calculated?", "Wie wird gerechnet?")}
        </button>
      </div>

      {showHow && (
        <div className="rounded-2xl border border-brand-200/70 bg-brand-50/60 px-5 py-4 text-[13px] leading-relaxed text-slate-700 dark:border-brand-500/30 dark:bg-brand-950/20 dark:text-slate-200">
          <ul className="list-disc space-y-1 pl-5">
            <li><b>{T("So'rovlar", "Заявки", "Requests", "Anfragen")}</b> — {T("tanlangan davrda yaratilgan barcha lidlar (arxivlanganlar ham).", "все лиды, созданные за выбранный период (включая архивные).", "all leads created in the selected period (including archived).", "alle im Zeitraum erstellten Leads (inkl. archivierte).")}</li>
            <li><b>{T("Voronka yig'ma", "Воронка накопительная", "Funnel is cumulative", "Trichter ist kumulativ")}</b> — {T("bosqichga «yetgan» lid — hozir shu yoki undan keyingi bosqichda turgan lid. Qabul qilingan lid hamma bosqichdan o'tgan hisoblanadi.", "лид «дошёл» до этапа, если сейчас находится на нём или дальше. Принятый лид прошёл все этапы.", "a lead “reached” a step if it is currently at that step or beyond. An enrolled lead passed every step.", "ein Lead hat eine Stufe „erreicht“, wenn er dort oder weiter steht. Ein aufgenommener Lead hat alle Stufen durchlaufen.")}</li>
            <li><b>{T("Konversiya", "Конверсия", "Conversion", "Konversion")}</b> = {T("Qabul qilinganlar ÷ So'rovlar × 100. Qabul qilingan — «Qabul qilindi/To'landi» bosqichi yoki o'quvchi yozuvi bor lid.", "Принятые ÷ Заявки × 100. Принятый — этап «Принят/Оплачено» или есть карточка ученика.", "Enrolled ÷ Requests × 100. Enrolled = stage “Won/Paid” or has a student record.", "Aufgenommen ÷ Anfragen × 100. Aufgenommen = Stufe „Aufgenommen/Bezahlt“ oder mit Schülerdatensatz.")}</li>
            <li><b>{T("Xodim", "Сотрудник", "Employee", "Mitarbeiter")}</b> — {T("lidga biriktirilgan menejer; biriktirilmagan bo'lsa — lid bilan oxirgi ishlagan (qo'ng'iroq/eslatma qoldirgan) xodim; hech kim bo'lmasa — «Biriktirilmagan».", "назначенный менеджер; если нет — сотрудник, последним работавший с лидом (звонок/заметка); иначе — «Не назначен».", "the assigned manager; otherwise the employee who last worked the lead (call/note); otherwise “Unassigned”.", "der zugewiesene Manager; sonst der Mitarbeiter, der den Lead zuletzt bearbeitet hat; sonst „Nicht zugewiesen“.")}</li>
            <li><b>{T("Yo'qotilgan", "Потеряны", "Lost", "Verloren")}</b> — {T("«Yo'qotildi» bosqichidagi lidlar; ular faqat So'rovlarda sanaladi.", "лиды на этапе «Потерян»; учитываются только в Заявках.", "leads at “Lost”; counted only in Requests.", "Leads in „Verloren“; nur in Anfragen gezählt.")}</li>
          </ul>
        </div>
      )}

      {/* Filtrlar qatori */}
      <div className="flex flex-wrap items-center gap-2.5">
        <DateBox value={from} onChange={setFrom} />
        <DateBox value={to} onChange={setTo} />
        <FilterSelect value={source} onChange={setSource} placeholder={T("Mijoz manbalari", "Источники клиентов", "Client sources", "Kundenquellen")}>
          {options.sources.map((sname) => <option key={sname} value={sname}>{sname}</option>)}
        </FilterSelect>
        <FilterSelect value={manager} onChange={setManager} placeholder={T("Xodimlar tomonidan", "По сотрудникам", "By employees", "Nach Mitarbeitern")}>
          {options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          {options.hasUnassigned && <option value="none">{T("— Biriktirilmagan", "— Не назначен", "— Unassigned", "— Nicht zugewiesen")}</option>}
        </FilterSelect>
        <FilterSelect value={selected} onChange={(v) => setSelected(v as Sel)} placeholder={T("Bosqich: hammasi", "Этап: все", "Step: all", "Stufe: alle")}>
          {FUNNEL_STEPS.map((b) => <option key={b.key} value={b.key}>{tr(locale, b.label)}</option>)}
          <option value="yoqotilgan">{stepLabel("yoqotilgan")}</option>
        </FilterSelect>
        <button
          onClick={handleExport}
          disabled={loading || detailRows.length === 0}
          className="ml-auto flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="download" className="h-4 w-4" /> {T("Eksport", "Экспорт", "Export", "Export")}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {T("Hisobotni yuklashda xatolik. Sahifani yangilab ko'ring.", "Ошибка при загрузке отчёта. Попробуйте обновить страницу.", "Error loading the report. Try refreshing the page.", "Fehler beim Laden des Berichts. Seite aktualisieren.")}
        </div>
      )}

      {/* KPI plitkalar */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon="users" color="#4f46e5" value={String(total)} title={T("So'rovlar", "Заявки", "Requests", "Anfragen")} sub={T("davrda yaratilgan lidlar", "лидов создано за период", "leads created in period", "im Zeitraum erstellte Leads")} onClick={() => setSelected(selected === "sorovlar" ? "" : "sorovlar")} active={selected === "sorovlar"} />
        <Kpi icon="graduation" color="#10b981" value={String(counts.qabul ?? 0)} title={T("Qabul qilindi", "Приняты", "Enrolled", "Aufgenommen")} sub={T("o'quvchiga aylandi", "стали учениками", "became students", "wurden Schüler")} onClick={() => setSelected(selected === "qabul" ? "" : "qabul")} active={selected === "qabul"} />
        <Kpi icon="trendUp" color="#f59e0b" value={`${conv}%`} title={T("Konversiya", "Конверсия", "Conversion", "Konversion")} sub={T("qabul ÷ so'rovlar", "принятые ÷ заявки", "enrolled ÷ requests", "aufgenommen ÷ Anfragen")} />
        <Kpi icon="personX" color="#ef4444" value={String(lost)} title={T("Yo'qotilgan", "Потеряны", "Lost", "Verloren")} sub={`${pct1(lost, total)}% · ${T("ishlovda", "в работе", "in progress", "in Arbeit")}: ${Math.max(0, inWork)}`} onClick={() => setSelected(selected === "yoqotilgan" ? "" : "yoqotilgan")} active={selected === "yoqotilgan"} />
      </div>

      {/* Voronka — yig'ma, har bosqichda: soni, jamidan %, oldingi bosqichdan o'tish % */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{T("Sotuv voronkasi", "Воронка продаж", "Sales funnel", "Verkaufstrichter")}</h3>
          <span className="text-[11px] text-slate-400">{T("bosqichni bosing — pastda ro'yxati", "нажмите этап — список ниже", "click a step — list below", "Stufe anklicken — Liste unten")}</span>
        </div>
        <div className="space-y-2">
          {FUNNEL_STEPS.map((b, i) => {
            const c = counts[b.key] ?? 0;
            const prev = i === 0 ? c : counts[FUNNEL_STEPS[i - 1].key] ?? 0;
            const ofTotal = pct1(c, total);
            const ofPrev = i === 0 ? 100 : pct1(c, prev);
            const active = selected === b.key;
            const last = i === FUNNEL_STEPS.length - 1;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setSelected(active ? "" : b.key)}
                className={cn("group grid w-full grid-cols-[1.4rem_minmax(8rem,12rem)_1fr_auto] items-center gap-3 rounded-xl px-2 py-1.5 text-left transition", active ? "bg-brand-50 dark:bg-brand-950/30" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]")}
              >
                <span className="text-[11px] font-bold text-slate-400">{i + 1}</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, b.label)}</span>
                <span className="relative h-7 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/[0.06]">
                  <span
                    className={cn("absolute inset-y-0 left-0 rounded-lg transition-all", last ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-brand-400 to-brand-600")}
                    style={{ width: `${Math.max(ofTotal, c > 0 ? 1.5 : 0)}%` }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-bold text-slate-700 mix-blend-multiply dark:text-white dark:mix-blend-normal">{ofTotal}%</span>
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="w-12 text-right text-lg font-bold text-slate-800 dark:text-slate-100">{c}</span>
                  <span className={cn("w-24 text-right text-[11px] font-semibold", i === 0 ? "text-transparent" : ofPrev >= 50 ? "text-emerald-600" : ofPrev >= 25 ? "text-amber-600" : "text-rose-600")} title={T("Oldingi bosqichdan o'tganlar", "Прошли с предыдущего этапа", "Passed from previous step", "Von der vorigen Stufe")}>
                    {i === 0 ? "" : `↳ ${ofPrev}%`}
                  </span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelected(selected === "yoqotilgan" ? "" : "yoqotilgan")}
            className={cn("group grid w-full grid-cols-[1.4rem_minmax(8rem,12rem)_1fr_auto] items-center gap-3 rounded-xl border-t border-dashed border-slate-200 px-2 pb-1.5 pt-3 text-left transition dark:border-slate-700", selected === "yoqotilgan" ? "bg-rose-50 dark:bg-rose-950/20" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]")}
          >
            <span className="text-[11px] font-bold text-rose-400">×</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{stepLabel("yoqotilgan")}</span>
            <span className="relative h-7 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/[0.06]">
              <span className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-rose-400 to-rose-600" style={{ width: `${Math.max(pct1(lost, total), lost > 0 ? 1.5 : 0)}%` }} />
              <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-bold text-slate-700 mix-blend-multiply dark:text-white dark:mix-blend-normal">{pct1(lost, total)}%</span>
            </span>
            <span className="flex items-center gap-3 tabular-nums"><span className="w-12 text-right text-lg font-bold text-rose-600">{lost}</span><span className="w-24" /></span>
          </button>
        </div>
      </div>

      {/* Har xodim bo'yicha alohida */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{T("Xodimlar bo'yicha", "По сотрудникам", "By employee", "Nach Mitarbeitern")}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">{T("qatorni bosing — faqat shu xodim", "нажмите строку — только этот сотрудник", "click a row — only this employee", "Zeile anklicken — nur dieser Mitarbeiter")}</span>
            <button type="button" onClick={exportEmployees} disabled={employees.length === 0} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Icon name="download" className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">{T("Xodim", "Сотрудник", "Employee", "Mitarbeiter")}</th>
                <th className="px-3 py-3 text-right">{T("So'rovlar", "Заявки", "Requests", "Anfragen")}</th>
                <th className="px-3 py-3 text-right">{stepLabel("ishlov")}</th>
                <th className="px-3 py-3 text-right">{stepLabel("test")}</th>
                <th className="px-3 py-3 text-right">{stepLabel("taklif")}</th>
                <th className="px-3 py-3 text-right">{stepLabel("tolov")}</th>
                <th className="px-3 py-3 text-right text-emerald-700 dark:text-emerald-400">{stepLabel("qabul")}</th>
                <th className="px-3 py-3 text-right text-rose-600">{stepLabel("yoqotilgan")}</th>
                <th className="px-3 py-3 text-right">{T("Harakatlar", "Действия", "Activities", "Aktionen")}</th>
                <th className="px-4 py-3 text-right">{T("Konversiya", "Конверсия", "Conversion", "Konversion")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {employees.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">{loading ? T("Yuklanmoqda...", "Загрузка...", "Loading...", "Wird geladen...") : T("Davrda lid yo'q", "Нет лидов за период", "No leads in period", "Keine Leads im Zeitraum")}</td></tr>
              ) : (
                employees.map((e) => {
                  const active = manager === e.id;
                  const unassigned = e.id === "none";
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setManager(active ? "" : e.id)}
                      className={cn("cursor-pointer transition", active ? "bg-brand-50/70 dark:bg-brand-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50")}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold", unassigned ? "bg-slate-100 text-slate-400 dark:bg-slate-800" : "bg-brand-500/15 text-brand-700 dark:text-brand-300")}>
                            {unassigned ? "?" : (e.name ?? "—").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className={cn("truncate font-semibold", unassigned ? "text-slate-500" : "text-slate-800 dark:text-slate-100")}>{unassigned ? T("Biriktirilmagan", "Не назначен", "Unassigned", "Nicht zugewiesen") : e.name}</div>
                            {e.role && <div className="text-[11px] text-slate-400">{roleLabel(e.role, locale)}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{e.total}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.ishlov}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.test}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.taklif}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.tolov}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{e.qabul}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-rose-600">{e.yoqotilgan}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.activities}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                            <span className={cn("block h-full rounded-full", e.conversion >= 20 ? "bg-emerald-500" : e.conversion >= 10 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${Math.min(100, e.conversion)}%` }} />
                          </span>
                          <span className={cn("w-12 text-right text-sm font-bold tabular-nums", e.conversion >= 20 ? "text-emerald-700 dark:text-emerald-400" : e.conversion >= 10 ? "text-amber-600" : "text-rose-600")}>{e.conversion}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {employees.length > 1 && (
              <tfoot className="border-t border-slate-200 bg-slate-50/60 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800/40">
                <tr>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{T("Jami", "Итого", "Total", "Gesamt")}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{employees.reduce((a, e) => a + e.total, 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{employees.reduce((a, e) => a + e.ishlov, 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{employees.reduce((a, e) => a + e.test, 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{employees.reduce((a, e) => a + e.taklif, 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{employees.reduce((a, e) => a + e.tolov, 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{employees.reduce((a, e) => a + e.qabul, 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-rose-600">{employees.reduce((a, e) => a + e.yoqotilgan, 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{employees.reduce((a, e) => a + e.activities, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pct1(employees.reduce((a, e) => a + e.qabul, 0), employees.reduce((a, e) => a + e.total, 0))}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Lidlar ro'yxati — tanlangan bosqich / xodim bo'yicha */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{T("Lidlar", "Лиды", "Leads", "Leads")}</h3>
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{detailRows.length}</span>
          {selected && <Chip onClear={() => setSelected("")}>{stepLabel(selected)}</Chip>}
          {manager && <Chip onClear={() => setManager("")}>{manager === "none" ? T("Biriktirilmagan", "Не назначен", "Unassigned", "Nicht zugewiesen") : options.managers.find((m) => m.id === manager)?.name ?? manager}</Chip>}
          {source && <Chip onClear={() => setSource("")}>{source}</Chip>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200/70 text-[13px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">{T("FIO", "ФИО", "Full name", "Name")}</th>
                <th className="px-4 py-3">{T("Telefon", "Телефон", "Phone", "Telefon")}</th>
                <th className="px-4 py-3">{T("Holati", "Статус", "Status", "Status")}</th>
                <th className="px-4 py-3">{T("Manba", "Источник", "Source", "Quelle")}</th>
                <th className="px-4 py-3">{T("Sana", "Дата", "Date", "Datum")}</th>
                <th className="px-4 py-3">{T("Xodim", "Сотрудник", "Employee", "Mitarbeiter")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {detailRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                    {loading ? T("Yuklanmoqda...", "Загрузка...", "Loading...", "Wird geladen...") : T("Bu filtrda lid yo'q", "Нет лидов по этому фильтру", "No leads for this filter", "Keine Leads für diesen Filter")}
                  </td>
                </tr>
              ) : (
                detailRows.slice(0, 300).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      <Link href={`/crm/${l.id}`} className="hover:text-brand-600">{l.fullName}</Link>
                      {l.archived && <span className="ml-1.5 rounded bg-slate-100 px-1 text-[10px] text-slate-400 dark:bg-slate-800">{T("arxiv", "архив", "archived", "Archiv")}</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{l.phone}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", l.stage === "WON" || l.stage === "PAID" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : l.stage === "LOST" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}>
                        {label(LEAD_STAGE_LABELS, l.stage, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.source ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.employeeName ?? <span className="text-slate-400">{T("Biriktirilmagan", "Не назначен", "Unassigned", "Nicht zugewiesen")}</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {detailRows.length > 300 && (
            <div className="border-t border-slate-100 px-4 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800">
              {T(`Birinchi 300 tasi ko'rsatildi (jami ${detailRows.length}) — hammasi eksportda`, `Показаны первые 300 (всего ${detailRows.length}) — все в экспорте`, `First 300 shown (of ${detailRows.length}) — all in export`, `Erste 300 angezeigt (von ${detailRows.length}) — alle im Export`)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────── Yordamchi komponentlar ─────────

function roleLabel(role: string, locale: Locale) {
  const m: Record<string, { uz: string; ru: string; en: string; de: string }> = {
    DIRECTOR: { uz: "Direktor", ru: "Директор", en: "Director", de: "Direktor" },
    DEPUTY_DIRECTOR: { uz: "Dir. o'rinbosari", ru: "Зам. директора", en: "Deputy director", de: "Stellv. Direktor" },
    ROP: { uz: "ROP", ru: "РОП", en: "Head of sales", de: "Vertriebsleiter" },
    MANAGER: { uz: "Menejer", ru: "Менеджер", en: "Manager", de: "Manager" },
    OPERATOR: { uz: "Operator", ru: "Оператор", en: "Operator", de: "Operator" },
    ADMIN: { uz: "Administrator", ru: "Администратор", en: "Administrator", de: "Administrator" },
    TEACHER: { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" },
  };
  return m[role] ? tr(locale, m[role]) : role;
}

function Kpi({ icon, color, value, title, sub, onClick, active }: { icon: string; color: string; value: string; title: string; sub: string; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("flex items-center gap-3.5 rounded-2xl border bg-white p-4 text-left shadow-card transition dark:bg-slate-900", active ? "border-brand-300 ring-2 ring-brand-500/20 dark:border-brand-500/50" : "border-slate-200/70 dark:border-slate-800", onClick && "hover:-translate-y-0.5 hover:shadow-lg")}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: color, boxShadow: `0 8px 16px -8px ${color}` }}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold leading-none tabular-nums text-slate-900 dark:text-slate-100">{value}</span>
        <span className="mt-1 block text-[13px] font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        <span className="block truncate text-[11px] text-slate-400">{sub}</span>
      </span>
    </Tag>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
      {children}
      <button type="button" onClick={onClear} className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/50"><Icon name="close" className="h-3 w-3" /></button>
    </span>
  );
}

function DateBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
      <Icon name="calendar" className="h-4 w-4 text-slate-400" />
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-900",
          value ? "border-brand-300 text-slate-700 dark:border-brand-500/40 dark:text-slate-200" : "border-slate-200 text-slate-400 dark:border-slate-700",
        )}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
