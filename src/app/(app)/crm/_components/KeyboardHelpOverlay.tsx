"use client";

import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

const SHORTCUTS: [string, { uz: string; ru: string; en: string }][] = [
  ["/", { uz: "Qidiruvga o'tish", ru: "Перейти к поиску", en: "Focus search" }],
  ["v", { uz: "Kanban ↔ Jadval", ru: "Канбан ↔ Таблица", en: "Kanban ↔ Table" }],
  ["⌘K / Ctrl+K", { uz: "Buyruqlar paneli", ru: "Панель команд", en: "Command palette" }],
  ["g → y", { uz: "Filter: Yangi", ru: "Фильтр: Новые", en: "Filter: New" }],
  ["g → i", { uz: "Filter: Ishda", ru: "Фильтр: В работе", en: "Filter: In progress" }],
  ["g → t", { uz: "Filter: Test / Taklif", ru: "Фильтр: Тест / Предложение", en: "Filter: Test / Offer" }],
  ["g → q", { uz: "Filter: Qabul qilindi", ru: "Фильтр: Принят", en: "Filter: Won" }],
  ["g → r", { uz: "Filter: Yo'qotilgan", ru: "Фильтр: Потерян", en: "Filter: Lost" }],
  ["r", { uz: "Filtrlarni tozalash", ru: "Очистить фильтры", en: "Clear filters" }],
  ["n", { uz: "Yangi lid", ru: "Новый лид", en: "New lead" }],
  ["Esc", { uz: "Tanlov/oyna yopish", ru: "Закрыть выбор/окно", en: "Close selection/window" }],
  ["?", { uz: "Ushbu yordam", ru: "Эта справка", en: "This help" }],
];

export default function KeyboardHelpOverlay({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-pop dark:border-white/10 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Klaviatura yorliqlari", ru: "Горячие клавиши", en: "Keyboard shortcuts" })}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="space-y-1.5">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-300">{tr(locale, desc)}</span>
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
