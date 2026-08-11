"use client";

import { useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";

export default function RejectReasonModal({
  locale,
  open,
  leadName,
  onClose,
  onConfirm,
  pending,
}: {
  locale: Locale;
  open: boolean;
  leadName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-500">⚠</div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Rad etish", ru: "Отклонить", en: "Reject" })}</h3>
            <p className="text-xs text-slate-400">{leadName}</p>
          </div>
        </div>
        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">{tr(locale, { uz: "Sabab", ru: "Причина", en: "Reason" })} <span className="text-red-500">*</span></label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder={tr(locale, { uz: "Nima uchun rad etilyapti?", ru: "Почему отклоняется?", en: "Why is it being rejected?" })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">{tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}</button>
          <button
            onClick={() => reason.trim().length >= 3 && onConfirm(reason.trim())}
            disabled={reason.trim().length < 3 || pending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "..." : tr(locale, { uz: "Rad etish", ru: "Отклонить", en: "Reject" })}
          </button>
        </div>
      </div>
    </div>
  );
}
