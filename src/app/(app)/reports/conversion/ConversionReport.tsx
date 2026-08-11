"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";

interface ApiLead {
  id: string;
  fullName: string;
  phone: string;
  stage: string;
  managerName: string | null;
}
interface ApiResponse {
  total: number;
  counts: Record<string, number>;
  leads: ApiLead[];
  options: { sources: string[]; managers: { id: string; name: string }[] };
}

interface Props {
  defaultFrom: string; // YYYY-MM-DD
  defaultTo: string;
  locale: Locale;
}

// Voronka bosqichlari (API'dagi BUCKETS bilan bir xil kalitlar)
const FUNNEL: { key: string; label: { uz: string; ru: string; en: string }; stages: string[] | null }[] = [
  { key: "sorovlar", label: { uz: "So'rovlar", ru: "Заявки", en: "Requests" }, stages: null },
  { key: "kutish", label: { uz: "Kutish", ru: "Ожидание", en: "Waiting" }, stages: ["NEW", "IN_PROGRESS"] },
  { key: "toplam", label: { uz: "To'plam", ru: "Набор", en: "Set" }, stages: ["CONTACTED", "TEST", "OFFER"] },
  { key: "davomat", label: { uz: "Davomat", ru: "Посещаемость", en: "Attendance" }, stages: ["AWAITING_PAYMENT"] },
  { key: "tolangan", label: { uz: "To'langan", ru: "Оплачено", en: "Paid" }, stages: ["PAID", "WON"] },
];

const inBucket = (stage: string, key: string) => {
  const b = FUNNEL.find((x) => x.key === key);
  if (!b) return false;
  return b.stages ? b.stages.includes(stage) : true;
};

export default function ConversionReport({ defaultFrom, defaultTo, locale }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [source, setSource] = useState("");
  const [manager, setManager] = useState("");
  const [selected, setSelected] = useState<string>("sorovlar");
  const [showPct, setShowPct] = useState(false);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filtr o'zgarsa — alohida API'dan qayta yuklaymiz
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ from, to, source, manager });
    fetch(`/api/reports/conversion?${params.toString()}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: ApiResponse) => { setData(d); setLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setError(true); setLoading(false); } });
    return () => ctrl.abort();
  }, [from, to, source, manager]);

  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;
  const leads = data?.leads ?? [];
  const options = data?.options ?? { sources: [], managers: [] };

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const detailRows = useMemo(
    () => (selected ? leads.filter((l) => inBucket(l.stage, selected)) : []),
    [leads, selected]
  );

  const handleExport = () => {
    const rows = (selected ? detailRows : leads).map((l) => ({
      fullName: l.fullName,
      phone: l.phone,
      stage: label(LEAD_STAGE_LABELS, l.stage, locale),
      managerName: l.managerName ?? "—",
    }));
    exportRows(
      `konversiya_${from}_${to}`,
      [
        { key: "fullName", label: tr(locale, { uz: "FIO", ru: "ФИО", en: "Full name" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" }) },
        { key: "stage", label: tr(locale, { uz: "Holati", ru: "Статус", en: "Status" }) },
        { key: "managerName", label: tr(locale, { uz: "Xodimni ismi", ru: "Имя сотрудника", en: "Employee name" }) },
      ],
      rows
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Konversiya hisobotlari", ru: "Отчёты по конверсии", en: "Conversion reports" })}</h1>
        {loading && <Icon name="refresh" className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Filtrlar qatori */}
      <div className="flex flex-wrap items-center gap-2.5">
        <DateBox value={from} onChange={setFrom} />
        <DateBox value={to} onChange={setTo} />
        <FilterSelect value={source} onChange={setSource} placeholder={tr(locale, { uz: "Mijoz manbalari", ru: "Источники клиентов", en: "Client sources" })}>
          {options.sources.map((sname) => <option key={sname} value={sname}>{sname}</option>)}
        </FilterSelect>
        <FilterSelect value={manager} onChange={setManager} placeholder={tr(locale, { uz: "Xodimlar tomonidan", ru: "По сотрудникам", en: "By employees" })}>
          {options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </FilterSelect>
        <div className="relative flex h-10 items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-full appearance-none rounded-lg bg-transparent pl-3 pr-8 text-sm text-slate-600 outline-none dark:text-slate-300"
          >
            <option value="">{tr(locale, { uz: "Umumiy", ru: "Общий", en: "General" })}</option>
            {FUNNEL.map((b) => <option key={b.key} value={b.key}>{tr(locale, b.label)}</option>)}
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>
        <button
          onClick={() => setShowPct((v) => !v)}
          title={showPct ? tr(locale, { uz: "Foizlarni yashirish", ru: "Скрыть проценты", en: "Hide percentages" }) : tr(locale, { uz: "Foizlarni ko'rsatish", ru: "Показать проценты", en: "Show percentages" })}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border transition",
            showPct
              ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-950/40 dark:text-brand-300"
              : "border-slate-200 text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          )}
        >
          <Icon name="settings" className="h-4 w-4" />
        </button>
        <button
          onClick={handleExport}
          disabled={loading || leads.length === 0}
          className="ml-auto flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {tr(locale, { uz: "Hisobotni yuklashda xatolik. Sahifani yangilab ko'ring.", ru: "Ошибка при загрузке отчёта. Попробуйте обновить страницу.", en: "Error loading the report. Try refreshing the page." })}
        </div>
      )}

      {/* Ikki ustun: chapda Konversiya, o'ngda Sotuv voronkasi */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Chap: Konversiya ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 text-lg font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Konversiya", ru: "Конверсия", en: "Conversion" })}</h3>

            <div className="overflow-x-auto">
              <div className="grid min-w-[520px] grid-cols-[3rem_repeat(5,minmax(4.5rem,1fr))] items-center gap-x-2 gap-y-3">
                <div />
                {FUNNEL.map((b) => {
                  const active = selected === b.key;
                  return (
                    <button
                      key={b.key}
                      onClick={() => setSelected(active ? "" : b.key)}
                      className={cn(
                        "rounded-lg px-2 py-2 text-sm font-medium transition",
                        active
                          ? "bg-brand-700 text-white shadow-sm"
                          : "border border-brand-200 text-brand-600 hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-950/40"
                      )}
                    >
                      {tr(locale, b.label)}
                    </button>
                  );
                })}

                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Jami", ru: "Всего", en: "Total" })}</div>
                {FUNNEL.map((b) => (
                  <div key={b.key} className="text-center text-lg font-bold text-slate-800 dark:text-slate-100">
                    {counts[b.key] ?? 0}
                    {showPct && <div className="text-[11px] font-medium text-brand-500">{pct(counts[b.key] ?? 0)}%</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tanlangan bosqich bo'yicha lidlar jadvali */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-slate-200/70 text-[13px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3.5">{tr(locale, { uz: "FIO", ru: "ФИО", en: "Full name" })}</th>
                    <th className="px-4 py-3.5">{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" })}</th>
                    <th className="px-4 py-3.5">{tr(locale, { uz: "Holati", ru: "Статус", en: "Status" })}</th>
                    <th className="px-4 py-3.5">{tr(locale, { uz: "Xodimni ismi", ru: "Имя сотрудника", en: "Employee name" })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {detailRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                        {loading
                          ? tr(locale, { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading..." })
                          : tr(locale, { uz: "Hisobotni ko'rish uchun yuqoridagi voronka bosqichlaridan birini tanlang.", ru: "Чтобы посмотреть отчёт, выберите один из этапов воронки выше.", en: "To view the report, select one of the funnel stages above." })}
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{l.fullName}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.phone}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{label(LEAD_STAGE_LABELS, l.stage, locale)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.managerName ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── O'ng: Sotuv voronkasi ── */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Sotuv voronkasi", ru: "Воронка продаж", en: "Sales funnel" })}</h3>
          <div>
            {FUNNEL.map((b, i) => {
              const c = counts[b.key] ?? 0;
              const p = pct(c);
              return (
                <button
                  key={b.key}
                  onClick={() => setSelected(selected === b.key ? "" : b.key)}
                  className={cn(
                    "relative block w-full border-b border-slate-100 py-4 text-left transition dark:border-slate-800",
                    i === 0 && "pt-1",
                    selected === b.key && "bg-amber-50/40 dark:bg-amber-950/10"
                  )}
                >
                  <div className="text-3xl font-bold text-amber-500">{c}</div>
                  <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{tr(locale, b.label)}</div>
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">{p}%</span>
                  <div className="absolute bottom-0 left-0 h-0.5 rounded-full bg-amber-400 transition-all" style={{ width: `${Math.max(p, 2)}%` }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Yordamchi komponentlar ─────────

function DateBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
      <Icon name="calendar" className="h-4 w-4 text-slate-400" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100"
      />
    </div>
  );
}

function FilterSelect({
  value, onChange, placeholder, children,
}: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-900",
          value ? "border-brand-300 text-slate-700 dark:border-brand-500/40 dark:text-slate-200" : "border-slate-200 text-slate-400 dark:border-slate-700"
        )}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
