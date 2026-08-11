"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { setRop } from "./actions";

export interface RopOperator { id: string; name: string; isRop: boolean }

export default function RopManager({ locale, operators, canManage }: { locale: Locale; operators: RopOperator[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!canManage) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
        <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "ROP qo'shish", ru: "Добавить РОП", en: "Add ROP" })}
      </button>
      {open && <RopModal locale={locale} operators={operators} onClose={() => setOpen(false)} onChange={() => router.refresh()} />}
    </>
  );
}

function RopModal({ locale, operators, onClose, onChange }: { locale: Locale; operators: RopOperator[]; onClose: () => void; onChange: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? operators.filter((o) => o.name.toLowerCase().includes(q)) : operators;
  }, [operators, search]);
  const ropCount = operators.filter((o) => o.isRop).length;
  if (!mounted) return null;

  const toggle = (o: RopOperator) => {
    setError(null); setBusy(o.id);
    start(async () => {
      const r = await setRop(o.id, !o.isRop);
      setBusy(null);
      if (r.ok) onChange();
      else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error" }));
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[85]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[360px] max-w-[86%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "ROP qo'shish", ru: "Добавить РОП", en: "Add ROP" })}</h3>
            <p className="text-xs text-slate-400">{tr(locale, { uz: "Operatorni savdo bo'limi rahbari (ROP) qilib belgilang", ru: "Назначьте оператора руководителем отдела продаж (РОП)", en: "Set an operator as head of sales (ROP)" })}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><Icon name="close" className="h-5 w-5" /></button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr(locale, { uz: "Operator qidirish...", ru: "Поиск оператора...", en: "Search operator..." })} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          {error && <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
        </div>

        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {shown.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">{tr(locale, { uz: "Operator topilmadi. Avval", ru: "Оператор не найден. Сначала добавьте оператора в разделе", en: "No operator found. First add an operator in the" })} <b>{tr(locale, { uz: "Operatorlar", ru: "Операторы", en: "Operators" })}</b> {tr(locale, { uz: "bo'limida operator qo'shing.", ru: ".", en: "section." })}</div>
          ) : shown.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">{o.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{o.name}</div>
                  <div className="text-[11px]">{o.isRop ? <span className="font-bold text-amber-600 dark:text-amber-400">ROP</span> : <span className="text-slate-400">{tr(locale, { uz: "Operator", ru: "Оператор", en: "Operator" })}</span>}</div>
                </div>
              </div>
              <button onClick={() => toggle(o)} disabled={pending && busy === o.id} className={cn("h-8 rounded-lg px-3 text-xs font-semibold transition disabled:opacity-60", o.isRop ? "border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" : "bg-amber-500 text-white hover:bg-amber-600")}>
                {busy === o.id ? "..." : o.isRop ? tr(locale, { uz: "Bekor qilish", ru: "Отменить", en: "Cancel" }) : tr(locale, { uz: "ROP qilish", ru: "Сделать РОП", en: "Make ROP" })}
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 dark:border-slate-800">{tr(locale, { uz: `Hozir ${ropCount} ta ROP belgilangan`, ru: `Сейчас назначено РОП: ${ropCount}`, en: `Currently ${ropCount} ROP assigned` })}</div>
      </div>
    </div>,
    document.body,
  );
}
