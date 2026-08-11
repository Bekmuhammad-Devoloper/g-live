"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import NewContractForm from "./NewContractForm";
import { deleteContractTemplate } from "./actions";

export interface VTemplate {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  createdAt: string; // formatlangan sana
  isActive: boolean;
}

const typeTone: Record<string, string> = {
  STANDARD: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ONLINE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  OFFLINE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  OFFER: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  INDIVIDUAL: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
};

export default function ContractTemplatesView({
  templates,
  canManage,
  locale,
}: {
  templates: VTemplate[];
  canManage: boolean;
  locale: Locale;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => `${t.title} ${t.typeLabel}`.toLowerCase().includes(q));
  }, [templates, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const shown = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  function onDelete(id: string) {
    if (!confirm(tr(locale, { uz: "Ushbu shartnomani o'chirmoqchimisiz?", ru: "Удалить этот договор?", en: "Delete this contract?" }))) return;
    setBusyId(id);
    startTransition(async () => {
      await deleteContractTemplate(id);
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Shartnoma yaratish", ru: "Создать договор", en: "Create contract" })}
          </button>
        )}
        <div className="relative ml-auto">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={tr(locale, { uz: "Qidirish", ru: "Поиск", en: "Search" })}
            className="h-10 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tr(locale, { uz: "Umumiy soni:", ru: "Всего:", en: "Total:" })} {filtered.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 w-12">№</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Shartnoma turi", ru: "Тип договора", en: "Contract type" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Yaratilgan sana", ru: "Дата создания", en: "Created date" })}</th>
                <th className="px-4 py-3 w-20 text-right">{canManage ? tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions" }) : ""}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="text-3xl opacity-30">📭</div>
                    <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi", ru: "Данные не найдены", en: "No data found" })}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{tr(locale, { uz: "Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.", ru: "Данные не найдены. Попробуйте изменить фильтр.", en: "No data found. Try changing the filter." })}</p>
                  </td>
                </tr>
              ) : (
                shown.map((t, i) => (
                  <tr key={t.id} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50", busyId === t.id && "opacity-50")}>
                    <td className="px-4 py-3 text-slate-400">{(curPage - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{t.title}</span>
                      {!t.isActive && <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-400/20 text-slate-500">{tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive" })}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", typeTone[t.type] ?? typeTone.STANDARD)}>{t.typeLabel}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{t.createdAt}</td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <button
                          onClick={() => onDelete(t.id)}
                          disabled={pending}
                          title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete" })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-500/10"
                        >
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon name="listView" className="h-4 w-4" />
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} {tr(locale, { uz: "qatorda", ru: "в строке", en: "per page" })}</option>)}
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-sm">
              <PageBtn disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹</PageBtn>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">{curPage} / {totalPages}</span>
              <PageBtn disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>›</PageBtn>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      {canManage && (
        <button onClick={() => setAddOpen(true)} title={tr(locale, { uz: "Yangi shartnoma", ru: "Новый договор", en: "New contract" })} className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-pop transition hover:scale-105 hover:bg-brand-700">
          <Icon name="plus" className="h-5 w-5" />
        </button>
      )}

      <NewContractForm open={addOpen} onClose={() => setAddOpen(false)} locale={locale} />
    </div>
  );
}

function PageBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">
      {children}
    </button>
  );
}
