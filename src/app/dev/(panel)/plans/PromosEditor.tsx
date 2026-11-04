"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MoneyInput from "@/app/(app)/_components/MoneyInput";
import { normalizePromo, promoPeriod, sumLabel, type SalesPromo } from "@/lib/devpanel/salesTypes";
import { createPromoAction, deletePromoAction, setPromoActiveAction, type ActionResult } from "../sales/actions";

const field = "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-slate-500 focus:border-orange-400/60";
const label = "mb-1 block text-xs font-semibold text-slate-400";

export default function PromosEditor({ promos, uses }: { promos: SalesPromo[]; uses: Record<string, number> }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [months, setMonths] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<ActionResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) { setError(r.error ?? "Saqlanmadi"); return; }
      after?.();
      router.refresh();
    });
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => createPromoAction({ code, discount: Number(discount), months: Number(months) }),
      () => { setCode(""); setDiscount(""); setMonths("1"); },
    );
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#0d1424] p-5">
      <h2 className="text-lg font-bold text-white">Promokodlar</h2>
      <p className="mt-1 text-sm text-slate-500">Mijoz ariza sahifasida kiritadi, promokod lid kartasida ko'rinadi. Chegirma kelishuvda hisobga olinadi.</p>

      <form onSubmit={create} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_110px_auto]">
        <div>
          <label className={label}>Promokod</label>
          <input value={code} onChange={(e) => setCode(normalizePromo(e.target.value))} placeholder="YANGI100" className={field} />
        </div>
        <div>
          <label className={label}>Chegirma, so'm</label>
          <MoneyInput value={discount} onChange={setDiscount} placeholder="100 000" className={field} />
        </div>
        <div>
          <label className={label}>Necha oyga</label>
          <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, "").slice(0, 2))} className={field} />
        </div>
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-5 text-sm font-bold text-white disabled:opacity-60">Yaratish</button>
      </form>

      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="mt-4 divide-y divide-white/[0.06]">
        {promos.length === 0 && <p className="py-3 text-sm text-slate-500">Promokod yo'q</p>}
        {promos.map((p) => (
          <div key={p.code} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${p.active ? "" : "opacity-60"}`}>
            <span className="min-w-[90px] font-mono text-sm font-bold text-orange-300">{p.code}</span>
            <span className="min-w-0 flex-1 text-sm text-slate-300">{promoPeriod(p.months)} uchun {sumLabel(p.discount)} chegirma</span>
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-400">{uses[p.code] ?? 0} ta lid</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setPromoActiveAction(p.code, !p.active))}
              className={`h-8 rounded-lg px-3 text-xs font-bold transition ${p.active ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-white/[0.06] text-slate-300 hover:bg-white/10"}`}
            >
              {p.active ? "Faol" : "O'chirilgan"}
            </button>
            {confirming === p.code ? (
              <button type="button" disabled={pending} onClick={() => run(() => deletePromoAction(p.code), () => setConfirming(null))} className="h-8 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700">Rostdan o'chirilsinmi?</button>
            ) : (
              <button type="button" onClick={() => setConfirming(p.code)} className="h-8 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300">O'chirish</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
