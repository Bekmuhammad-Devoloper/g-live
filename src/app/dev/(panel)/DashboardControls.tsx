"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAllAction, setMainLicenseAction } from "../actions";

export function UpdateAllButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Hamma markaz bazasi joriy kodga moslanadi va markazlar qayta ishga tushiriladi (har biri bir necha soniya). Davom etilsinmi?")) return;
          setMsg(null);
          start(async () => {
            const r = await updateAllAction();
            setMsg(r.results.length === 0 ? "Markaz yo'q" : r.ok ? `${r.results.length} ta markaz yangilandi` : `Xato: ${r.results.filter((x) => !x.ok).map((x) => x.slug).join(", ")}`);
            router.refresh();
          });
        }}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-[#0d1424] dark:text-slate-200"
      >
        {pending ? "Yangilanmoqda..." : "Hammasini yangilash"}
      </button>
    </div>
  );
}

export function MainLicenseForm({ current }: { current: string | null }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-1 block text-[11px] font-semibold text-slate-500 hover:text-orange-300">O'zgartirish</button>;
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 rounded-md border border-slate-300 px-2 text-xs dark:border-white/10 dark:bg-[#0d1424]" />
      <button type="button" disabled={pending || !date} onClick={() => start(async () => { const r = await setMainLicenseAction(date); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Xato"); })} className="h-8 rounded-md bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] text-white shadow-lg shadow-orange-600/20 hover:brightness-110 px-2.5 text-xs font-semibold text-white disabled:opacity-60 ">
        {pending ? "..." : "Saqlash"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400">✕</button>
      {err && <span className="text-[11px] text-red-400">{err}</span>}
    </div>
  );
}
