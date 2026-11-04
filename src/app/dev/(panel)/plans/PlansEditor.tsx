"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import MoneyInput from "@/app/(app)/_components/MoneyInput";
import type { SalesPlan } from "@/lib/devpanel/salesTypes";
import { savePlansAction } from "../sales/actions";

type Draft = {
  id: string;
  original: string;
  name: string;
  price: string;
  students: string;
  branches: string;
  features: string[];
  popular: boolean;
  visible: boolean;
};

const toDraft = (p: SalesPlan): Draft => ({
  id: p.id,
  original: p.name,
  name: p.name,
  price: p.price ? String(p.price) : "",
  students: p.students ? String(p.students) : "",
  branches: p.branches ? String(p.branches) : "",
  features: p.features,
  popular: p.popular,
  visible: p.visible,
});

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

const PATH = {
  check: "M5 12l5 5L20 7",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  open: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  building: "M4 21V7l8-4 8 4v14M9 21v-6h6v6",
};

function Glyph({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-1 text-left text-[13px] text-slate-300">
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-gradient-to-r from-[#ee7a24] to-[#f6b51e]" : "bg-white/[0.12]"}`}>
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[#f8fafc] shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function LimitField({ icon, label, value, onChange, max }: { icon: string; label: string; value: string; onChange: (v: string) => void; max: number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 transition focus-within:border-orange-400/60">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
        <Glyph d={icon} className="h-3.5 w-3.5" />
        {label}
      </label>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(digits(e.target.value, max))}
        placeholder="Cheksiz"
        className="mt-1 w-full bg-transparent text-[15px] font-bold tabular-nums text-white outline-none placeholder:font-semibold placeholder:text-slate-500"
      />
    </div>
  );
}

export default function PlansEditor({ plans, usage, publicUrl }: { plans: SalesPlan[]; usage: Record<string, number>; publicUrl: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(() => plans.map(toDraft));
  const [saved, setSaved] = useState<Draft[]>(rows);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const change = (next: (list: Draft[]) => Draft[]) => {
    setMessage(null);
    setRows(next);
  };
  const patch = (id: string, p: Partial<Draft>) => change((list) => list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const setPopular = (id: string, on: boolean) => change((list) => list.map((r) => ({ ...r, popular: r.id === id ? on : false })));
  const add = () => change((list) => [
    ...list,
    { id: `plan-${Date.now().toString(36)}`, original: "", name: "", price: "", students: "", branches: "", features: [""], popular: false, visible: true },
  ]);
  const remove = (id: string) => change((list) => list.filter((r) => r.id !== id));

  const save = () => {
    setMessage(null);
    start(async () => {
      const r = await savePlansAction(rows.map((d) => ({
        id: d.id,
        name: d.name,
        price: d.price ? Number(d.price) : null,
        students: d.students ? Number(d.students) : null,
        branches: d.branches ? Number(d.branches) : null,
        features: d.features,
        popular: d.popular,
        visible: d.visible,
      })));
      if (!r.ok) {
        setMessage({ ok: false, text: r.error ?? "Saqlanmadi" });
        return;
      }
      const next = rows.map((d) => ({ ...d, original: d.name.trim(), features: d.features.map((x) => x.trim()).filter(Boolean) }));
      setRows(next);
      setSaved(next);
      setMessage({ ok: true, text: "Tariflar saqlandi" });
      router.refresh();
    });
  };

  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const unpriced = rows.filter((r) => r.visible && !r.price).length;

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tariflar</h1>
          <p className="mt-1 text-sm text-slate-500">Oylik obuna narxlari. Saqlangach, ochiq ariza sahifasida darhol yangilanadi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 transition hover:border-orange-400/50">
              <Glyph d={PATH.open} />
              Ochiq sahifa
            </a>
          )}
          <button type="button" onClick={add} disabled={rows.length >= 12} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 transition hover:border-orange-400/50 disabled:cursor-not-allowed disabled:opacity-40">
            <Glyph d={PATH.plus} />
            Tarif qo'shish
          </button>
        </div>
      </div>

      {unpriced > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200">
          <Glyph d={PATH.alert} className="h-5 w-5 shrink-0 text-amber-300" />
          <span>{unpriced} ta tarifda narx kiritilmagan. Ochiq sahifada ular uchun "Narxi kelishiladi" deb ko'rsatiladi.</span>
        </div>
      )}

      <div className="grid items-start gap-5 pt-2 lg:grid-cols-3">
        {rows.map((r) => {
          const count = usage[r.original.toLowerCase()] ?? 0;
          const renamed = count > 0 && r.name.trim().toLowerCase() !== r.original.toLowerCase();
          return (
            <article key={r.id} className={`relative rounded-2xl border bg-[#0d1424] ${r.popular ? "border-orange-400/60 shadow-xl shadow-orange-900/20" : "border-white/[0.07]"} ${r.visible ? "" : "opacity-70"}`}>
              {r.popular && (
                <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-[#e3262b] to-[#f6b51e] px-3 py-1 text-[11px] font-bold text-white">Ko'p tanlanadi</span>
              )}
              <div className="p-5">
                <input
                  aria-label="Tarif nomi"
                  value={r.name}
                  onChange={(e) => patch(r.id, { name: e.target.value })}
                  placeholder="Tarif nomi"
                  className="-mx-2 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-white outline-none transition placeholder:text-slate-500 hover:border-white/10 focus:border-orange-400/60"
                />
                {renamed && <p className="mt-1 text-[11px] text-amber-300">Nomi o'zgarsa, {count} ta markaz shu tarifga bog'lanmay qoladi.</p>}

                <div className="mt-3 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.01] px-4 py-3 transition focus-within:border-orange-400/60">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Oylik narx</label>
                  <div className="mt-1 flex items-baseline gap-2">
                    <MoneyInput
                      value={r.price}
                      onChange={(v) => patch(r.id, { price: v })}
                      placeholder="Kelishiladi"
                      className="w-full min-w-0 bg-transparent text-2xl font-extrabold tabular-nums text-white outline-none placeholder:text-xl placeholder:font-bold placeholder:text-slate-500"
                    />
                    <span className="shrink-0 text-xs font-medium text-slate-400">so'm / oy</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <LimitField icon={PATH.users} label="O'quvchi" value={r.students} onChange={(v) => patch(r.id, { students: v })} max={7} />
                  <LimitField icon={PATH.building} label="Filial" value={r.branches} onChange={(v) => patch(r.id, { branches: v })} max={4} />
                </div>

                <div className="mt-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Imkoniyatlar</div>
                  <ul className="mt-2 space-y-1">
                    {r.features.map((x, i) => (
                      <li key={i} className="group flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                          <Glyph d={PATH.check} className="h-3 w-3" />
                        </span>
                        <input
                          aria-label={`Imkoniyat ${i + 1}`}
                          value={x}
                          onChange={(e) => patch(r.id, { features: r.features.map((f, j) => (j === i ? e.target.value : f)) })}
                          placeholder="Imkoniyat"
                          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-slate-200 outline-none transition placeholder:text-slate-600 hover:border-white/10 focus:border-orange-400/60"
                        />
                        <button
                          type="button"
                          aria-label="Imkoniyatni olib tashlash"
                          onClick={() => patch(r.id, { features: r.features.filter((_, j) => j !== i) })}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-red-300"
                        >
                          <Glyph d={PATH.close} className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={r.features.length >= 12}
                    onClick={() => patch(r.id, { features: [...r.features, ""] })}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-300 transition hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Glyph d={PATH.plus} className="h-3.5 w-3.5" />
                    Imkoniyat qo'shish
                  </button>
                </div>

                <div className="mt-5 space-y-1 border-t border-white/[0.06] pt-3">
                  <Switch label="Ochiq sahifada ko'rinsin" checked={r.visible} onChange={(v) => patch(r.id, { visible: v })} />
                  <Switch label={`"Ko'p tanlanadi" belgisi`} checked={r.popular} onChange={(v) => setPopular(r.id, v)} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${count ? "bg-orange-400/15 text-orange-300" : "bg-white/[0.05] text-slate-400"}`}>{count} ta markaz</span>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={count > 0}
                    title={count > 0 ? "Bu tarifda markaz bor" : undefined}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Glyph d={PATH.trash} className="h-3.5 w-3.5" />
                    O'chirish
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {(dirty || message) && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0f1729]/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur">
          <span className={`text-sm font-medium ${message ? (message.ok ? "text-emerald-300" : "text-red-300") : "text-slate-300"}`}>
            {message ? message.text : "Saqlanmagan o'zgarishlar bor"}
          </span>
          {dirty && (
            <div className="flex gap-2">
              <button type="button" onClick={() => { setRows(saved); setMessage(null); }} disabled={pending} className="h-10 rounded-xl px-4 text-sm font-medium text-slate-400 transition hover:bg-white/5">Bekor qilish</button>
              <button type="button" onClick={save} disabled={pending} className="h-10 rounded-xl bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-6 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition hover:brightness-110 disabled:opacity-60">
                {pending ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
