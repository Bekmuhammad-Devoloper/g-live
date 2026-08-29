"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { exportRows } from "@/lib/export";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import TrendChart from "./TrendChart";
import Donut from "./Donut";

type TL = { uz: string; ru: string; en: string; de?: string };

export interface FLead {
  id: string;
  stage: string;
  source: string | null;
  course: string | null;
  createdAt: string; // ISO
  marketing: string | null; // utmSource
  managerId: string | null;
  managerName: string | null;
}

interface Props {
  locale: Locale;
  leads: FLead[];
  courses: string[];
  sources: string[];
  marketings: string[];
  managers: { id: string; name: string }[];
  defaultFrom: string; // YYYY-MM-DD
  defaultTo: string;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Hisobot turlari — bosqichlar bizning LEAD_STAGES ga moslashtirilgan.
// (Sinov darsi / filial ko'chirish bizda kuzatilmaydi → 0.)
const REPORTS: { n: number; label: TL; stages: string[] | null }[] = [
  { n: 1, label: { uz: "Barcha buyurtmalar soni", ru: "Всего заявок", en: "Total orders", de: "Gesamtzahl der Anfragen" }, stages: null },
  { n: 2, label: { uz: "Buyurtmadan ketganlar", ru: "Отказались от заявки", en: "Dropped the order", de: "Bestellung abgebrochen" }, stages: ["LOST"] },
  { n: 3, label: { uz: "Sinov darsiga yozilganlar", ru: "Записались на пробный урок", en: "Signed up for trial lesson", de: "Für Probestunde angemeldet" }, stages: ["TEST", "OFFER", "AWAITING_PAYMENT", "PAID", "WON"] },
  { n: 4, label: { uz: "Sinov darsiga kelmay ketganlar", ru: "Не пришли на пробный урок", en: "Did not attend trial lesson", de: "Nicht zur Probestunde erschienen" }, stages: [] },
  { n: 5, label: { uz: "Sinov darsiga kelganlar", ru: "Пришли на пробный урок", en: "Attended trial lesson", de: "Probestunde besucht" }, stages: ["OFFER", "AWAITING_PAYMENT", "PAID", "WON"] },
  { n: 6, label: { uz: "Sinov darsiga kelib ketganlar", ru: "Пришли на пробный урок и ушли", en: "Attended trial lesson and left", de: "Probestunde besucht und gegangen" }, stages: [] },
  { n: 7, label: { uz: "Birinchi to'lovni qilganlar", ru: "Внесли первый платёж", en: "Made first payment", de: "Erste Zahlung geleistet" }, stages: ["PAID", "WON"] },
  { n: 8, label: { uz: "Birinchi to'lovni qilib ketganlar", ru: "Внесли первый платёж и ушли", en: "Made first payment and left", de: "Erste Zahlung geleistet und gegangen" }, stages: [] },
  { n: 9, label: { uz: "Tugatganlar", ru: "Завершили", en: "Completed", de: "Abgeschlossen" }, stages: ["WON"] },
  { n: 10, label: { uz: "Boshqa filialdan ko'chirilgan", ru: "Переведены из другого филиала", en: "Transferred from another branch", de: "Von anderer Filiale übernommen" }, stages: [] },
  { n: 11, label: { uz: "Boshqa filialga ko'chirilgan", ru: "Переведены в другой филиал", en: "Transferred to another branch", de: "Zu anderer Filiale übertragen" }, stages: [] },
];

const CLOSED = ["WON", "PAID", "LOST"];

export default function FunnelDashboard({ locale, leads, courses, sources, marketings, managers, defaultFrom, defaultTo }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [course, setCourse] = useState("");
  const [source, setSource] = useState("");
  const [marketing, setMarketing] = useState("");
  const [manager, setManager] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [sideTab, setSideTab] = useState<"student" | "course">("student");
  const [leadTab, setLeadTab] = useState<"all" | "progress" | "closed">("all");

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const d = l.createdAt.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (course && (l.course ?? "") !== course) return false;
      if (source && (l.source ?? "") !== source) return false;
      if (marketing && (l.marketing ?? "") !== marketing) return false;
      if (manager && (l.managerId ?? "") !== manager) return false;
      return true;
    });
  }, [leads, from, to, course, source, marketing, manager]);

  const distinctCourses = (ls: FLead[]) => new Set(ls.map((l) => l.course).filter(Boolean)).size;

  const reportRows = REPORTS.map((r) => {
    const subset = r.stages === null ? filtered : filtered.filter((l) => r.stages!.includes(l.stage));
    return { ...r, count: subset.length, courses: distinctCourses(subset) };
  });

  // Trend — davr bo'yicha guruhlash
  const trend = useMemo(() => {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const buckets: { key: string; label: string; start: Date; end: Date }[] = [];
    const cur = new Date(start);
    let guard = 0;
    while (cur <= end && guard++ < 400) {
      const bStart = new Date(cur);
      let bEnd: Date;
      let label: string;
      if (period === "day") {
        bEnd = new Date(cur); bEnd.setDate(cur.getDate() + 1);
        label = `${p2(cur.getDate())}.${p2(cur.getMonth() + 1)}`;
        cur.setDate(cur.getDate() + 1);
      } else if (period === "week") {
        bEnd = new Date(cur); bEnd.setDate(cur.getDate() + 7);
        label = `${p2(cur.getDate())}.${p2(cur.getMonth() + 1)}`;
        cur.setDate(cur.getDate() + 7);
      } else {
        bEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        label = `${p2(cur.getMonth() + 1)}.${String(cur.getFullYear()).slice(2)}`;
        cur.setMonth(cur.getMonth() + 1, 1);
      }
      buckets.push({ key: dayKey(bStart), label, start: bStart, end: bEnd });
    }
    const inBucket = (iso: string, b: { start: Date; end: Date }) => {
      const t = new Date(iso).getTime();
      return t >= b.start.getTime() && t < b.end.getTime();
    };
    return buckets.map((b) => {
      const inB = filtered.filter((l) => inBucket(l.createdAt, b));
      return {
        label: b.label,
        total: inB.length,
        lost: inB.filter((l) => l.stage === "LOST").length,
        sales: inB.filter((l) => ["PAID", "WON"].includes(l.stage)).length,
      };
    });
  }, [filtered, from, to, period]);

  const groupBy = (key: (l: FLead) => string | null) => {
    const m = new Map<string, number>();
    for (const l of filtered) {
      const k = key(l) || tr(locale, { uz: "Noma'lum", ru: "Неизвестно", en: "Unknown", de: "Unbekannt" });
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  };
  const courseDist = groupBy((l) => l.course);
  const sourceDist = groupBy((l) => l.source);

  const progressCount = filtered.filter((l) => !CLOSED.includes(l.stage)).length;
  const closedCount = filtered.filter((l) => CLOSED.includes(l.stage)).length;
  const leadTabCount = leadTab === "all" ? filtered.length : leadTab === "progress" ? progressCount : closedCount;

  const handleExport = () => {
    exportRows(
      `voronka_${from}_${to}`,
      [
        { key: "n", label: "№" },
        { key: "label", label: tr(locale, { uz: "Hisobot turlari", ru: "Виды отчётов", en: "Report types", de: "Berichtsarten" }) },
        { key: "count", label: tr(locale, { uz: "Soni", ru: "Количество", en: "Count", de: "Anzahl" }) },
        { key: "courses", label: tr(locale, { uz: "Kurslar soni", ru: "Кол-во курсов", en: "Courses count", de: "Anzahl der Kurse" }) },
      ],
      reportRows.map((r) => ({ n: r.n, label: tr(locale, r.label), count: r.count, courses: r.courses }))
    );
  };

  return (
    <div className="space-y-4">
      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
          <Icon name="calendar" className="h-4 w-4 text-slate-400" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
          <span className="text-slate-300">–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[120px] bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
        </div>
        {marketings.length > 0
          ? <Sel value={marketing} onChange={setMarketing} placeholder={tr(locale, { uz: "Marketing", ru: "Маркетинг", en: "Marketing", de: "Marketing" })}>{marketings.map((m) => <option key={m} value={m}>{m}</option>)}</Sel>
          : <SelDisabled label={tr(locale, { uz: "Marketing", ru: "Маркетинг", en: "Marketing", de: "Marketing" })} soon={tr(locale, { uz: "Tez orada", ru: "Скоро", en: "Coming soon", de: "Demnächst" })} />}
        <Sel value={course} onChange={setCourse} placeholder={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })}>{courses.map((c) => <option key={c} value={c}>{c}</option>)}</Sel>
        <SelDisabled label={tr(locale, { uz: "Subkurs", ru: "Подкурс", en: "Subcourse", de: "Unterkurs" })} soon={tr(locale, { uz: "Tez orada", ru: "Скоро", en: "Coming soon", de: "Demnächst" })} />
        {managers.length > 0
          ? <Sel value={manager} onChange={setManager} placeholder={tr(locale, { uz: "Moderator", ru: "Модератор", en: "Moderator", de: "Moderator" })}>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Sel>
          : <SelDisabled label={tr(locale, { uz: "Moderator", ru: "Модератор", en: "Moderator", de: "Moderator" })} soon={tr(locale, { uz: "Tez orada", ru: "Скоро", en: "Coming soon", de: "Demnächst" })} />}
        <SelDisabled label={tr(locale, { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" })} soon={tr(locale, { uz: "Tez orada", ru: "Скоро", en: "Coming soon", de: "Demnächst" })} />
        <Sel value={source} onChange={setSource} placeholder={tr(locale, { uz: "Manba", ru: "Источник", en: "Source", de: "Quelle" })}>{sources.map((c) => <option key={c} value={c}>{c}</option>)}</Sel>
        <button
          onClick={handleExport}
          className="ml-auto flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export", de: "Export" })}
        </button>
      </div>

      {/* 1-qator: hisobot jadvali | O'quvchi/Kurs paneli */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/70 text-[13px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-3 w-10">№</th>
                    <th className="px-3 py-3">{tr(locale, { uz: "Hisobot turlari", ru: "Виды отчётов", en: "Report types", de: "Berichtsarten" })}</th>
                    <th className="px-3 py-3 text-center">{tr(locale, { uz: "Soni", ru: "Количество", en: "Count", de: "Anzahl" })}</th>
                    <th className="px-3 py-3 text-center">{tr(locale, { uz: "Kurslar soni", ru: "Кол-во курсов", en: "Courses count", de: "Anzahl der Kurse" })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportRows.map((r) => (
                    <tr key={r.n} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 text-slate-400">{r.n}</td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{tr(locale, r.label)}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-800 dark:text-slate-100">{r.count}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500 dark:text-slate-400">{r.courses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Sel value={period} onChange={(v) => setPeriod(v as typeof period)} placeholder="" wide>
            <option value="day">{tr(locale, { uz: "Kun", ru: "День", en: "Day", de: "Tag" })}</option>
            <option value="week">{tr(locale, { uz: "Hafta", ru: "Неделя", en: "Week", de: "Woche" })}</option>
            <option value="month">{tr(locale, { uz: "Oy", ru: "Месяц", en: "Month", de: "Monat" })}</option>
          </Sel>
        </div>

        <Card>
          <div className="mb-3 flex gap-1.5">
            {([["student", tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" }), "user"], ["course", tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" }), "book"]] as const).map(([k, lb, ic]) => (
              <button key={k} onClick={() => setSideTab(k)}
                className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition",
                  sideTab === k ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300")}>
                <Icon name={ic} className="h-4 w-4" /> {lb}
              </button>
            ))}
          </div>
          {(sideTab === "course" ? courseDist : reportRows.filter((r) => r.count > 0).map((r) => ({ label: r.label, value: r.count }))).length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">{tr(locale, { uz: "Ma'lumot mavjud emas", ru: "Данные отсутствуют", en: "No data available", de: "Keine Daten verfügbar" })}</div>
          ) : (
            <div className="space-y-1.5">
              {(sideTab === "course" ? courseDist : reportRows.filter((r) => r.count > 0).map((r) => ({ label: r.label, value: r.count }))).map((it) => (
                <div key={typeof it.label === "string" ? it.label : it.label.uz} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-slate-50/60 dark:odd:bg-slate-800/30">
                  <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{typeof it.label === "string" ? it.label : tr(locale, it.label)}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{it.value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 2-qator: Lidlar tahlili | Kurslar taqsimoti */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-center text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Lidlar tahlili", ru: "Анализ лидов", en: "Lead analysis", de: "Lead-Analyse" })} ({period === "day" ? tr(locale, { uz: "Kun", ru: "День", en: "Day", de: "Tag" }) : period === "week" ? tr(locale, { uz: "Hafta", ru: "Неделя", en: "Week", de: "Woche" }) : tr(locale, { uz: "Oy", ru: "Месяц", en: "Month", de: "Monat" })})</h3>
          <TrendChart
            labels={trend.map((t) => t.label)}
            yLabel={tr(locale, { uz: "Lidlar soni", ru: "Кол-во лидов", en: "Number of leads", de: "Anzahl der Leads" })}
            series={[
              { name: tr(locale, { uz: "Umumiy lidlar", ru: "Всего лидов", en: "Total leads", de: "Leads insgesamt" }), color: "#4148ef", values: trend.map((t) => t.total) },
              { name: tr(locale, { uz: "Yo'qotilgan lidlar", ru: "Потерянные лиды", en: "Lost leads", de: "Verlorene Leads" }), color: "#16a34a", values: trend.map((t) => t.lost) },
              { name: tr(locale, { uz: "Sotuvlar soni", ru: "Кол-во продаж", en: "Number of sales", de: "Anzahl der Verkäufe" }), color: "#f59e0b", values: trend.map((t) => t.sales) },
            ]}
          />
        </Card>
        <Card>
          <h3 className="mb-4 text-center text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Kurslar kesimida buyurtmalar taqsimoti", ru: "Распределение заявок по курсам", en: "Order distribution by course", de: "Bestellverteilung nach Kurs" })}</h3>
          <Donut locale={locale} items={courseDist} />
        </Card>
      </div>

      {/* 3-qator: lid holati tablari | Manba taqsimoti */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {([["all", tr(locale, { uz: "Hammasi", ru: "Все", en: "All", de: "Alle" })], ["progress", tr(locale, { uz: "Hozir ishlanayotgan lidlar", ru: "Лиды в работе", en: "Leads in progress", de: "Leads in Bearbeitung" })], ["closed", tr(locale, { uz: "Yopilganlar", ru: "Закрытые", en: "Closed", de: "Geschlossen" })]] as const).map(([k, lb]) => (
              <button key={k} onClick={() => setLeadTab(k)}
                className={cn("rounded-lg px-4 py-2 text-sm font-medium transition",
                  leadTab === k ? "bg-brand-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
                {lb}
              </button>
            ))}
          </div>
          <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">{leadTabCount} {tr(locale, { uz: "ta", ru: "шт.", en: "", de: "" })}</div>
          <div className="mt-1 text-sm text-slate-400">{tr(locale, { uz: "Lidlar soni", ru: "Кол-во лидов", en: "Number of leads", de: "Anzahl der Leads" })}</div>
        </Card>
        <Card>
          <h3 className="mb-4 text-center text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "So'rovnomalar kesimida buyurtmalar taqsimoti", ru: "Распределение заявок по источникам", en: "Order distribution by source", de: "Bestellverteilung nach Quelle" })}</h3>
          <Donut locale={locale} items={sourceDist} />
        </Card>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">{children}</div>;
}

function Sel({ value, onChange, placeholder, children, wide }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("relative", wide && "w-56")}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={cn("h-10 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-900",
          value ? "border-brand-300 text-slate-700 dark:border-brand-500/40 dark:text-slate-200" : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400")}>
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function SelDisabled({ label, soon }: { label: string; soon: string }) {
  return (
    <div className="flex h-10 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900/40" title={soon}>
      {label} <Icon name="chevronDown" className="h-3.5 w-3.5" />
    </div>
  );
}
