"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { exportRows } from "@/lib/export";
import { Card, Table, EmptyRow, Badge } from "../../_components/ui";
import { Icon } from "../../_components/Icon";

export interface SmsRow {
  id: string;
  date: string;
  recipient: string;
  channel: string;
  channelLabel: string;
  title: string;
  body: string;
  isRead: boolean;
}

const channelTone: Record<string, "blue" | "green" | "amber" | "purple" | "slate"> = {
  SMS: "green", TELEGRAM: "blue", PUSH: "amber", EMAIL: "purple", APP: "slate",
};

// Yuborilgan xabarlar jurnali — qidiruv, kanal filtri va CSV eksport.
export default function SmsLog({ rows, locale }: { rows: SmsRow[]; locale: Locale }) {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("");

  const channels = useMemo(
    () => Array.from(new Set(rows.map((r) => r.channel))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (channel && r.channel !== channel) return false;
      if (q && !(`${r.recipient} ${r.title} ${r.body}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, query, channel]);

  const readCount = filtered.filter((r) => r.isRead).length;

  const handleExport = () => {
    exportRows(
      "yuborilgan_xabarlar",
      [
        { key: "date", label: tr(locale, { uz: "Sana", ru: "Дата", en: "Date" }) },
        { key: "recipient", label: tr(locale, { uz: "Qabul qiluvchi", ru: "Получатель", en: "Recipient" }) },
        { key: "channelLabel", label: tr(locale, { uz: "Kanal", ru: "Канал", en: "Channel" }) },
        { key: "title", label: tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title" }) },
        { key: "body", label: tr(locale, { uz: "Matn", ru: "Текст", en: "Text" }) },
        { key: "status", label: tr(locale, { uz: "Holat", ru: "Статус", en: "Status" }) },
      ],
      filtered.map((r) => ({
        date: r.date,
        recipient: r.recipient,
        channelLabel: r.channelLabel,
        title: r.title,
        body: r.body,
        status: r.isRead ? tr(locale, { uz: "O'qilgan", ru: "Прочитано", en: "Read" }) : tr(locale, { uz: "Yangi", ru: "Новое", en: "New" }),
      }))
    );
  };

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-700">{tr(locale, { uz: "Oxirgi xabarlar", ru: "Последние сообщения", en: "Recent messages" })}</h3>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr(locale, { uz: "Qidirish...", ru: "Поиск...", en: "Search..." })}
            className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
        <div className="relative">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className={cn(
              "h-9 appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm outline-none transition focus:border-brand-400 dark:bg-slate-900",
              channel ? "border-brand-300 text-slate-700 dark:border-brand-500/40 dark:text-slate-200" : "border-slate-200 text-slate-500 dark:border-slate-700"
            )}
          >
            <option value="">{tr(locale, { uz: "Barcha kanallar", ru: "Все каналы", en: "All channels" })}</option>
            {channels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          onClick={handleExport}
          className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Icon name="download" className="h-4 w-4" /> {tr(locale, { uz: "Eksport", ru: "Экспорт", en: "Export" })}
        </button>
        <span className="ml-auto text-xs text-slate-400">{tr(locale, { uz: "O'qilgan", ru: "Прочитано", en: "Read" })}: {readCount} / {filtered.length}</span>
      </div>
      <Table
        head={
          <tr>
            <th className="px-4 py-3">{tr(locale, { uz: "Sana", ru: "Дата", en: "Date" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Qabul qiluvchi", ru: "Получатель", en: "Recipient" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Kanal", ru: "Канал", en: "Channel" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Matn", ru: "Текст", en: "Text" })}</th>
            <th className="px-4 py-3">{tr(locale, { uz: "Holat", ru: "Статус", en: "Status" })}</th>
          </tr>
        }
      >
        {filtered.length === 0 ? (
          <EmptyRow colSpan={6} text={tr(locale, { uz: "Xabar yo'q", ru: "Нет сообщений", en: "No messages" })} />
        ) : (
          filtered.map((n) => (
            <tr key={n.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-4 py-3 whitespace-nowrap text-slate-500">{n.date}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{n.recipient}</td>
              <td className="px-4 py-3"><Badge tone={channelTone[n.channel] ?? "slate"}>{n.channelLabel}</Badge></td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{n.title}</td>
              <td className="px-4 py-3 max-w-[280px] truncate text-slate-500">{n.body || "—"}</td>
              <td className="px-4 py-3">
                {n.isRead ? <Badge tone="green">{tr(locale, { uz: "O'qilgan", ru: "Прочитано", en: "Read" })}</Badge> : <Badge tone="amber">{tr(locale, { uz: "Yangi", ru: "Новое", en: "New" })}</Badge>}
              </td>
            </tr>
          ))
        )}
      </Table>
    </Card>
  );
}
