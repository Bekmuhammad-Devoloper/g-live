"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MoneyInput from "@/app/(app)/_components/MoneyInput";
import type { SalesPlan } from "@/lib/devpanel/salesTypes";
import { Card } from "../ui";
import { savePlansAction } from "../sales/actions";

type Draft = { id: string; name: string; price: string; students: string; branches: string; features: string; popular: boolean; visible: boolean };

const toDraft = (p: SalesPlan): Draft => ({
  id: p.id, name: p.name, price: p.price ? String(p.price) : "", students: p.students ? String(p.students) : "", branches: p.branches ? String(p.branches) : "",
  features: p.features.join("\n"), popular: p.popular, visible: p.visible,
});

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

export default function PlansEditor({ plans, usage }: { plans: SalesPlan[]; usage: Record<string, number> }) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(() => plans.map(toDraft));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const patch = (id: string, p: Partial<Draft>) => {
    setMessage(null);
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  };
  const setPopular = (id: string, on: boolean) => {
    setMessage(null);
    setRows((list) => list.map((r) => ({ ...r, popular: r.id === id ? on : false })));
  };
  const add = () => {
    setMessage(null);
    setRows((list) => [...list, { id: `plan-${Date.now().toString(36)}`, name: "", price: "", students: "", branches: "", features: "", popular: false, visible: true }]);
  };
  const remove = (id: string) => {
    setMessage(null);
    setRows((list) => list.filter((r) => r.id !== id));
  };
  const save = () => {
    setMessage(null);
    start(async () => {
      const r = await savePlansAction(rows.map((d) => ({
        id: d.id, name: d.name, price: d.price ? Number(d.price) : null, students: d.students ? Number(d.students) : null, branches: d.branches ? Number(d.branches) : null,
        features: d.features.split("\n"), popular: d.popular, visible: d.visible,
      })));
      setMessage(r.ok ? { ok: true, text: "Tariflar saqlandi" } : { ok: false, text: r.error ?? "Saqlanmadi" });
      if (r.ok) router.refresh();
    });
  };

  const unpriced = rows.filter((r) => r.visible && !r.price).length;
  const fld = "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-orange-400/60";
  const lbl = "mb-1 block text-xs font-semibold text-slate-400";

  return (
    <div className="space-y-5">
      {unpriced > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {unpriced} ta tarifda narx kiritilmagan. Ochiq sahifada ular uchun "Narxi kelishiladi" deb ko'rsatiladi.
        </p>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {rows.map((r) => {
          const count = usage[r.name.trim().toLowerCase()] ?? 0;
          return (
            <Card key={r.id} className={r.popular ? "!border-orange-400/50" : ""}>
              <div className="space-y-3">
                <div><label className={lbl}>Tarif nomi</label><input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} className={fld} /></div>
                <div>
                  <label className={lbl}>Oylik narx (so'm)</label>
                  <MoneyInput value={r.price} onChange={(v) => patch(r.id, { price: v })} placeholder="Kelishiladi" className={fld} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>O'quvchi chegarasi</label><input inputMode="numeric" value={r.students} onChange={(e) => patch(r.id, { students: digits(e.target.value, 7) })} placeholder="Cheksiz" className={fld} /></div>
                  <div><label className={lbl}>Filial chegarasi</label><input inputMode="numeric" value={r.branches} onChange={(e) => patch(r.id, { branches: digits(e.target.value, 4) })} placeholder="Cheksiz" className={fld} /></div>
                </div>
                <div><label className={lbl}>Imkoniyatlar (har biri yangi qatorda)</label><textarea rows={5} value={r.features} onChange={(e) => patch(r.id, { features: e.target.value })} className={`${fld} h-auto py-2`} /></div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={r.visible} onChange={(e) => patch(r.id, { visible: e.target.checked })} className="h-4 w-4 accent-orange-500" />
                  Ochiq sahifada ko'rinsin
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={r.popular} onChange={(e) => setPopular(r.id, e.target.checked)} className="h-4 w-4 accent-orange-500" />
                  "Ko'p tanlanadi" belgisi
                </label>
                <div className="flex items-center justify-between border-t border-white/[0.07] pt-3">
                  <span className="text-xs text-slate-500">{count} ta markaz</span>
                  <button type="button" onClick={() => remove(r.id)} disabled={count > 0} title={count > 0 ? "Bu tarifda markaz bor" : undefined} className="text-xs font-semibold text-red-300 hover:underline disabled:cursor-not-allowed disabled:text-slate-600 disabled:no-underline">O'chirish</button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} disabled={rows.length >= 12} className="h-10 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:border-orange-400/50 disabled:opacity-50">+ Tarif qo'shish</button>
        <button type="button" onClick={save} disabled={pending} className="h-10 rounded-lg bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-6 text-sm font-bold text-white disabled:opacity-60">{pending ? "..." : "Saqlash"}</button>
        {message && <span className={`text-sm ${message.ok ? "text-emerald-300" : "text-red-300"}`}>{message.text}</span>}
      </div>
    </div>
  );
}
