"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Icon } from "../../_components/Icon";
import CallsTable from "./CallsTable";
import MissedList from "./MissedList";
import { DIR, STATUS, sq } from "./meta";
import type { CallStats, VCall, VOperator } from "./types";
import { useCdrSync } from "./useCdrSync";

interface Props {
  calls: VCall[];
  stats: CallStats;
  operators: VOperator[];
  locale: Locale;
  canMark: boolean;
  initialTab: "all" | "missed";
}

const PAGE_SIZE = 20;

export default function CallsView({ calls, stats, operators, locale, canMark, initialTab }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "missed">(initialTab);
  const [q, setQ] = useState("");
  const [operator, setOperator] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [time, setTime] = useState("");
  const [callback, setCallback] = useState("");
  const [page, setPage] = useState(1);
  const { sync, syncing, note } = useCdrSync(locale);

  // "Barcha qo'ng'iroqlar" tabidagi filtrlar
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return calls.filter((c) => {
      if (needle && !(c.contactName ?? "").toLowerCase().includes(needle) && !c.phone.toLowerCase().includes(needle) && !c.phoneLabel.toLowerCase().includes(needle)) return false;
      if (operator && c.operatorKey !== operator) return false;
      if (status && c.status !== status) return false;
      if (type && c.direction !== type) return false;
      if (time === "today" && c.daysAgo !== 0) return false;
      if (time === "yesterday" && c.daysAgo !== 1) return false;
      if (time === "week" && c.daysAgo >= 7) return false;
      if (time === "month" && c.daysAgo >= 30) return false;
      return true;
    });
  }, [calls, q, operator, status, type, time]);

  // "Qabul qilinmagan" tabi — o'tkazib yuborilgan qo'ng'iroqlar + qayta bog'lanish filtri
  const missed = useMemo(() => {
    // MISSED dan tashqari, javobsiz KIRUVCHI qo'ng'iroqlar ham "qabul qilinmagan" hisoblanadi
    const all = calls.filter((c) => c.status === "MISSED" || (c.direction === "INCOMING" && c.status === "NO_ANSWER"));
    return callback ? all.filter((c) => c.callbackStatus === callback) : all;
  }, [calls, callback]);

  useEffect(() => setPage(1), [tab, q, operator, status, type, time]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  const exportCalls = () => {
    const data = tab === "missed" ? missed : filtered;
    exportRows(
      `qongiroqlar-${new Date().toISOString().slice(0, 10)}`,
      [
        { key: "when", label: tr(locale, { uz: "Vaqt", ru: "Время", en: "Time", de: "Zeit" }) },
        { key: "direction", label: tr(locale, { uz: "Tur", ru: "Тип", en: "Type", de: "Typ" }) },
        { key: "status", label: tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" }) },
        { key: "operator", label: tr(locale, { uz: "Operator", ru: "Оператор", en: "Operator", de: "Operator" }) },
        { key: "contact", label: tr(locale, { uz: "Abonent", ru: "Абонент", en: "Contact", de: "Kontakt" }) },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }) },
        { key: "duration", label: tr(locale, { uz: "Davomiylik", ru: "Длительность", en: "Duration", de: "Dauer" }) },
        { key: "recording", label: tr(locale, { uz: "Audio yozuv", ru: "Аудиозапись", en: "Recording", de: "Aufnahme" }) },
        { key: "comment", label: tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment", de: "Kommentar" }) },
      ],
      data.map((c) => ({
        when: `${c.dayLabel} ${c.timeLabel}`,
        direction: tr(locale, (DIR[c.direction] ?? DIR.INCOMING).label),
        status: tr(locale, (STATUS[c.status] ?? STATUS.NO_ANSWER).label),
        operator: c.operatorName ?? "",
        contact: c.contactName ?? "",
        phone: c.phoneLabel,
        duration: c.durationLabel,
        recording: c.recordingSrc ?? "",
        comment: c.comment ?? "",
      })),
    );
  };

  const answeredPct = stats.total ? `${Math.round((stats.answered / stats.total) * 100)}%` : undefined;
  const tiles = [
    { label: tr(locale, { uz: "Jami qo'ng'iroqlar", ru: "Всего звонков", en: "Total calls", de: "Anrufe gesamt" }), icon: "phone", tone: "blue", value: String(stats.total) },
    { label: tr(locale, { uz: "Javob berilgan", ru: "Отвеченные", en: "Answered", de: "Angenommen" }), icon: "phoneCall", tone: "emerald", value: String(stats.answered), sub: answeredPct },
    { label: tr(locale, { uz: "O'tkazib yuborilgan", ru: "Пропущенные", en: "Missed", de: "Verpasst" }), icon: "phoneMissed", tone: "red", value: String(stats.missed), sub: stats.missedPending ? `${stats.missedPending} ${tr(locale, { uz: "kutmoqda", ru: "в ожидании", en: "pending", de: "ausstehend" })}` : undefined },
    { label: tr(locale, { uz: "Kiruvchi", ru: "Входящие", en: "Incoming", de: "Eingehend" }), icon: "arrowDownLeft", tone: "indigo", value: String(stats.incoming) },
    { label: tr(locale, { uz: "Chiquvchi", ru: "Исходящие", en: "Outgoing", de: "Ausgehend" }), icon: "arrowUpRight", tone: "violet", value: String(stats.outgoing) },
    { label: tr(locale, { uz: "O'rtacha davomiylik", ru: "Средняя длительность", en: "Average duration", de: "Durchschnittliche Dauer" }), icon: "clock", tone: "purple", value: stats.avgDurationLabel },
  ];

  const tabs = [
    { key: "all" as const, label: tr(locale, { uz: "Barcha qo'ng'iroqlar", ru: "Все звонки", en: "All calls", de: "Alle Anrufe" }), count: filtered.length, icon: "phone" },
    { key: "missed" as const, label: tr(locale, { uz: "Qabul qilinmagan", ru: "Пропущенные", en: "Missed", de: "Verpasst" }), count: missed.length, icon: "phoneMissed" },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Icon name="headphones" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {tr(locale, { uz: "Qo'ng'iroqlar markazi", ru: "Центр звонков", en: "Call center", de: "Anrufzentrale" })}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {tr(locale, { uz: "Barcha qo'ng'iroqlarni kuzating va boshqaring", ru: "Отслеживайте и управляйте всеми звонками", en: "Track and manage all calls", de: "Alle Anrufe verfolgen und verwalten" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCalls}
            disabled={(tab === "missed" ? missed.length : filtered.length) === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Icon name="download" className="h-4 w-4" />
            {tr(locale, { uz: "Eksport (CSV)", ru: "Экспорт (CSV)", en: "Export (CSV)", de: "Export (CSV)" })}
          </button>
          <button
            onClick={sync}
            disabled={syncing}
            title={tr(locale, { uz: "Asterisk'dan yangi qo'ng'iroqlarni yuklash", ru: "Загрузить новые звонки из Asterisk", en: "Load new calls from Asterisk", de: "Neue Anrufe von Asterisk laden" })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Icon name="refresh" className={cn("h-4 w-4", syncing && "animate-spin")} />
            {syncing
              ? tr(locale, { uz: "Yangilanmoqda...", ru: "Обновление...", en: "Refreshing...", de: "Wird aktualisiert..." })
              : tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })}
          </button>
          {note && (
            <span className={cn("self-center text-sm font-medium", note.error ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
              {note.text}
            </span>
          )}
        </div>
      </div>

      {/* 6 ta KPI plitka */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-4">
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm", sq[t.tone])}>
                <Icon name={t.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t.value}</p>
                  {t.sub && <span className="text-xs font-medium text-slate-400">{t.sub}</span>}
                </div>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{t.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tablar + filtrlar + jadval — bitta kartada (eski loyihadagidek) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex border-b border-slate-100 px-2 pt-2 dark:border-slate-800">
          {tabs.map((t) => {
            const active = tab === t.key;
            const red = t.key === "missed";
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-t-xl px-5 py-3 text-sm font-semibold transition",
                  active
                    ? red
                      ? "border-b-2 border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                      : "border-b-2 border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200",
                )}
              >
                <Icon name={t.icon} className="h-4 w-4" />
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-bold",
                    active
                      ? red
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {tab === "all" ? (
          <div className="p-5">
            {/* Filtrlar qatori */}
            <div className="mb-5 flex flex-wrap gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={tr(locale, { uz: "Ism yoki telefon raqam bo'yicha qidirish...", ru: "Поиск по имени или телефону...", en: "Search by name or phone...", de: "Suche nach Name oder Telefonnummer..." })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <Sel value={operator} onChange={setOperator} placeholder={tr(locale, { uz: "Barcha operatorlar", ru: "Все операторы", en: "All operators", de: "Alle Operatoren" })}>
                {operators.map((o) => (
                  <option key={o.key} value={o.key}>{o.name}</option>
                ))}
              </Sel>
              <Sel value={status} onChange={setStatus} placeholder={tr(locale, { uz: "Barcha statuslar", ru: "Все статусы", en: "All statuses", de: "Alle Status" })}>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{tr(locale, v.label)}</option>
                ))}
              </Sel>
              <Sel value={type} onChange={setType} placeholder={tr(locale, { uz: "Barcha turlar", ru: "Все типы", en: "All types", de: "Alle Typen" })}>
                {Object.entries(DIR).map(([k, v]) => (
                  <option key={k} value={k}>{tr(locale, v.label)}</option>
                ))}
              </Sel>
              <Sel value={time} onChange={setTime} placeholder={tr(locale, { uz: "Barcha vaqt", ru: "Всё время", en: "All time", de: "Gesamte Zeit" })}>
                <option value="today">{tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" })}</option>
                <option value="yesterday">{tr(locale, { uz: "Kecha", ru: "Вчера", en: "Yesterday", de: "Gestern" })}</option>
                <option value="week">{tr(locale, { uz: "Oxirgi 7 kun", ru: "Последние 7 дней", en: "Last 7 days", de: "Letzte 7 Tage" })}</option>
                <option value="month">{tr(locale, { uz: "Oxirgi 30 kun", ru: "Последние 30 дней", en: "Last 30 days", de: "Letzte 30 Tage" })}</option>
              </Sel>
            </div>

            <CallsTable
              rows={rows}
              locale={locale}
              total={filtered.length}
              start={start}
              pageSize={PAGE_SIZE}
              page={safePage}
              pageCount={pageCount}
              onPage={setPage}
              loadedNote={stats.total > stats.loaded ? tr(locale, { uz: `oxirgi ${stats.loaded} ta qo'ng'iroq`, ru: `последние ${stats.loaded} звонков`, en: `latest ${stats.loaded} calls`, de: `letzte ${stats.loaded} Anrufe` }) : null}
            />
          </div>
        ) : (
          <MissedList calls={missed} locale={locale} canMark={canMark} callback={callback} onCallback={setCallback} />
        )}
      </div>
    </div>
  );
}

function Sel({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "cursor-pointer appearance-none rounded-xl border bg-slate-50 py-2.5 pl-4 pr-10 text-sm outline-none transition dark:bg-slate-800",
          value
            ? "border-brand-300 text-slate-900 dark:border-brand-500/40 dark:text-white"
            : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600",
        )}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
