"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

export interface BranchOpt { id: string; name: string }

/**
 * Yozuvni (lid yoki o'quvchi) boshqa filialga ko'chirish (2026-08-25 talab).
 * Filiallar ro'yxati faqat blok ochilganda yuklanadi.
 */
export default function BranchMover({
  locale,
  currentBranchName,
  warning,
  loadBranches,
  onMove,
}: {
  locale: Locale;
  /** Hozirgi filial nomi (bilinmasa null) */
  currentBranchName: string | null;
  /** Ko'chirishdan oldin ko'rsatiladigan ogohlantirish (ixtiyoriy) */
  warning?: string;
  loadBranches: () => Promise<BranchOpt[]>;
  onMove: (branchId: string) => Promise<{ ok?: boolean; error?: string; branchName?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<BranchOpt[] | null>(null);
  const [picked, setPicked] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });

  useEffect(() => {
    if (!open || branches) return;
    loadBranches().then(setBranches).catch(() => setErr(L("Filiallarni yuklab bo'lmadi", "Не удалось загрузить филиалы", "Could not load branches")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const move = () => {
    if (!picked) return;
    setErr(null);
    start(async () => {
      const r = await onMove(picked);
      if (r.ok) {
        setMsg(L(`Ko'chirildi: ${r.branchName ?? ""}`, `Перемещено: ${r.branchName ?? ""}`, `Moved to ${r.branchName ?? ""}`));
        setOpen(false);
        setPicked("");
        router.refresh();
      } else {
        setErr(
          r.error === "forbidden"
            ? L("Sizda bu amal uchun ruxsat yo'q.", "У вас нет прав на это действие.", "You do not have permission for this action.")
            : L("Ko'chirib bo'lmadi.", "Не удалось переместить.", "Could not move."),
        );
      }
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <Icon name="building" className="h-3.5 w-3.5" />
        {L("Filial", "Филиал", "Branch")}
      </div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {currentBranchName ?? L("belgilanmagan", "не указан", "not set")}
      </div>

      {msg && <p className="mt-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{msg}</p>}

      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="btn-ghost mt-2 w-full justify-start !py-1.5 text-xs">
          <Icon name="refresh" className="h-3.5 w-3.5" />
          {L("Boshqa filialga ko'chirish", "Перевести в другой филиал", "Move to another branch")}
        </button>
      ) : (
        <div className="mt-2">
          {warning && (
            <p className="mb-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">{warning}</p>
          )}
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            disabled={!branches || pending}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
          >
            <option value="">{branches ? L("— filialni tanlang —", "— выберите филиал —", "— pick a branch —") : L("yuklanmoqda…", "загрузка…", "loading…")}</option>
            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {err && <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">{err}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setErr(null); setPicked(""); }}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {L("Bekor", "Отмена", "Cancel")}
            </button>
            <button
              type="button"
              onClick={move}
              disabled={pending || !picked}
              className="flex-[1.4] rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              {pending ? L("Ko'chirilmoqda…", "Перемещение…", "Moving…") : L("Ko'chirish", "Переместить", "Move")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
