"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import DateFilter from "./DateFilter";
import OperatorCard, { fmtTalk, kpiColor } from "./OperatorCard";
import { ArchiveModal, CredentialsModal, NotifyModal, OperatorDrawer, TaskModal } from "./OperatorModals";
import type { OpResult } from "./actions";

export interface VOperator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  sip: string | null;
  avatar: string | null;
  password: string | null; // faqat boshqaruv huquqi bo'lganda to'ldiriladi
  fiksa: number;
  kpiBonus: number;
  dayCalls: number;
  dayTalkSec: number;
  total: number;
  won: number;
  lost: number;
  conv: number;
  online: boolean;
  onCall: boolean;
  lastOnline: string; // serverda formatlangan
  lastLead: string | null;
  lastCall: string | null;
  createdAt: string; // dd.mm.yyyy
}

interface Props {
  locale: Locale;
  operators: VOperator[];
  avgKpi: number;
  totalLeads: number;
  dayCallsTotal: number;
  selectedDate: string | null;
  selectedDateLabel: string | null;
  canManage: boolean;
}

type Tab = "all" | "online" | "offline";

export default function OperatorsBoard({ locale, operators, avgKpi, totalLeads, dayCallsTotal, selectedDate, selectedDateLabel, canManage }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  // Oynalar: drawer — undefined yopiq, null yaratish, obyekt tahrirlash
  const [drawer, setDrawer] = useState<VOperator | null | undefined>(undefined);
  const [archiveOp, setArchiveOp] = useState<VOperator | null>(null);
  const [taskOp, setTaskOp] = useState<VOperator | null>(null);
  const [notifyOp, setNotifyOp] = useState<VOperator | null>(null);
  const [cred, setCred] = useState<NonNullable<OpResult["credentials"]> | null>(null);

  // Online / qo'ng'iroqda holati yangilanib tursin — har 30 soniyada qayta yuklash
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operators.filter((o) => {
      if (tab === "online" && !(o.online || o.onCall)) return false;
      if (tab === "offline" && (o.online || o.onCall)) return false;
      if (q && !`${o.name} ${o.email} ${o.phone ?? ""} ${o.sip ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [operators, search, tab]);

  const onlineCount = operators.filter((o) => o.online || o.onCall).length;

  const exportCsv = () => {
    exportRows(
      `operatorlar-${selectedDate ?? "bugun"}`,
      [
        { key: "name", label: tr(locale, { uz: "Operator", ru: "Оператор", en: "Operator", de: "Operator" }) },
        { key: "email", label: "Login" },
        { key: "phone", label: tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" }) },
        { key: "sip", label: "SIP" },
        { key: "status", label: tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" }) },
        { key: "dayCalls", label: tr(locale, { uz: "Qo'ng'iroqlar", ru: "Звонки", en: "Calls", de: "Anrufe" }) },
        { key: "talk", label: tr(locale, { uz: "Gaplashgan", ru: "Наговорено", en: "Talk time", de: "Sprechzeit" }) },
        { key: "total", label: tr(locale, { uz: "Lidlar", ru: "Лиды", en: "Leads", de: "Leads" }) },
        { key: "won", label: tr(locale, { uz: "Muvaffaqiyatli", ru: "Успешные", en: "Successful", de: "Erfolgreich" }) },
        { key: "lost", label: tr(locale, { uz: "Yo'qotilgan", ru: "Потерянные", en: "Lost", de: "Verloren" }) },
        { key: "conv", label: tr(locale, { uz: "Konversiya %", ru: "Конверсия %", en: "Conversion %", de: "Konversion %" }) },
        { key: "lastOnline", label: tr(locale, { uz: "Oxirgi online", ru: "Последний онлайн", en: "Last online", de: "Zuletzt online" }) },
      ],
      shown.map((o) => ({
        name: o.name,
        email: o.email,
        phone: o.phone ?? "",
        sip: o.sip ?? "",
        status: o.onCall ? tr(locale, { uz: "Qo'ng'iroqda", ru: "На звонке", en: "On call", de: "Im Gespräch" }) : o.online ? "Online" : "Offline",
        dayCalls: o.dayCalls,
        talk: fmtTalk(o.dayTalkSec),
        total: o.total,
        won: o.won,
        lost: o.lost,
        conv: o.conv,
        lastOnline: o.lastOnline,
      })),
    );
  };

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-soft">
            <Icon name="headphones" className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {tr(locale, { uz: "Operatorlar", ru: "Операторы", en: "Operators", de: "Operatoren" })}
            </h1>
            <p className="text-sm text-slate-400">
              {tr(locale, { uz: "Operatorlarni boshqarish va monitoring", ru: "Управление и мониторинг операторов", en: "Operator management and monitoring", de: "Verwaltung und Überwachung der Operatoren" })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilter locale={locale} value={selectedDate} label={selectedDateLabel} />
          <button
            type="button"
            onClick={() => router.refresh()}
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name="refresh" className="h-4 w-4" /> {tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name="download" className="h-4 w-4" /> CSV
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setDrawer(null)}
              className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangi operator", ru: "Новый оператор", en: "New operator", de: "Neuer Operator" })}
            </button>
          )}
        </div>
      </div>

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Tile icon="users" label={tr(locale, { uz: "Jami", ru: "Всего", en: "Total", de: "Gesamt" })} value={operators.length} tone="#3b82f6" />
        <Tile icon="globe" label="Online" value={onlineCount} tone="#10b981" />
        <Tile icon="chart" label={tr(locale, { uz: "O'rtacha KPI", ru: "Средний KPI", en: "Average KPI", de: "Durchschnittlicher KPI" })} value={`${avgKpi}%`} tone={kpiColor(avgKpi)} />
        <Tile icon="trophy" label={tr(locale, { uz: "Jami lidlar", ru: "Всего лидов", en: "Total leads", de: "Leads gesamt" })} value={totalLeads} tone="#8b5cf6" />
        <Tile
          icon="phoneCall"
          label={selectedDate
            ? tr(locale, { uz: "Qo'ng'iroqlar", ru: "Звонки", en: "Calls", de: "Anrufe" })
            : tr(locale, { uz: "Bugungi qo'ng'iroqlar", ru: "Звонки сегодня", en: "Calls today", de: "Anrufe heute" })}
          value={dayCallsTotal}
          tone="#06b6d4"
        />
      </div>

      {/* Qidiruv + holat filtri */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr(locale, { uz: "Operator qidirish...", ru: "Поиск оператора...", en: "Search operator...", de: "Operator suchen..." })}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "online", "offline"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                tab === t ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              {t === "all" ? tr(locale, { uz: "Barchasi", ru: "Все", en: "All", de: "Alle" }) : t === "online" ? "Online" : "Offline"}
            </button>
          ))}
        </div>
      </div>

      {/* Kartalar */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Icon name="headphones" className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Operator topilmadi", ru: "Оператор не найден", en: "No operator found", de: "Kein Operator gefunden" })}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((o) => (
            <OperatorCard
              key={o.id}
              locale={locale}
              op={o}
              canManage={canManage}
              onTask={() => setTaskOp(o)}
              onNotify={() => setNotifyOp(o)}
              onEdit={() => setDrawer(o)}
              onArchive={() => setArchiveOp(o)}
            />
          ))}
        </div>
      )}

      {/* Oynalar */}
      {drawer !== undefined && (
        <OperatorDrawer locale={locale} op={drawer} onClose={() => setDrawer(undefined)} onCreated={(c) => setCred(c)} />
      )}
      {archiveOp && <ArchiveModal locale={locale} op={archiveOp} onClose={() => setArchiveOp(null)} />}
      {taskOp && <TaskModal locale={locale} op={taskOp} onClose={() => setTaskOp(null)} />}
      {notifyOp && <NotifyModal locale={locale} op={notifyOp} onClose={() => setNotifyOp(null)} />}
      {cred && <CredentialsModal locale={locale} cred={cred} onClose={() => setCred(null)} />}
    </div>
  );
}

function Tile({ icon, label, value, tone }: { icon: string; label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-card transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${tone}1a`, color: tone }}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</p>
          <p className="truncate text-[10px] text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
