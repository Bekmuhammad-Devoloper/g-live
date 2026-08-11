"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, type Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import UserAvatar from "../../_components/UserAvatar";
import { saveRopKpi } from "./actions";
import { type RopKpiSettings } from "./schema";

export interface VRatingRow {
  id: string;
  name: string;
  total: number;
  won: number;
  rejected: number;
  conv: number;
  kpi: number;
  pay: number;
}

function tierColor(kpi: number): string {
  if (kpi >= 80) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (kpi >= 60) return "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  if (kpi >= 40) return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
}

export default function KpiSettingsView({ settings, rating, canManage, locale }: { settings: RopKpiSettings; rating: VRatingRow[]; canManage: boolean; locale: Locale }) {
  const [f, setF] = useState<RopKpiSettings>(settings);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const set = <K extends keyof RopKpiSettings>(k: K, v: RopKpiSettings[K]) => setF((s) => ({ ...s, [k]: v }));
  const num = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100";

  const save = () => {
    setErr("");
    start(async () => {
      const res = await saveRopKpi(JSON.stringify(f));
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2200); }
      else setErr(res.error === "forbidden" ? "Ruxsat yo'q" : "Qiymatlar noto'g'ri");
    });
  };

  const addMonth = () => {
    const next = f.monthlyPayments.length ? Math.max(...f.monthlyPayments.map((p) => p.month)) + 1 : 1;
    set("monthlyPayments", [...f.monthlyPayments, { month: next, amount: 0 }]);
  };
  const editMonth = (i: number, key: "month" | "amount", v: number) =>
    set("monthlyPayments", f.monthlyPayments.map((p, idx) => (idx === i ? { ...p, [key]: v } : p)));
  const removeMonth = (i: number) => set("monthlyPayments", f.monthlyPayments.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-slate-100">KPI Sozlamalari</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Operator samaradorligini baholash va to&apos;lov parametrlari</p>
        </div>
        {canManage && (
          <button onClick={save} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            <Icon name="check" className="h-4 w-4" /> {pending ? "..." : saved ? "Saqlandi ✓" : "Saqlash"}
          </button>
        )}
      </div>
      {err && <p className="text-sm text-rose-500">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Asosiy sozlamalar */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="settings" className="h-5 w-5 text-slate-400" /> Asosiy sozlamalar</h2>
          <div className="space-y-4">
            <Field label="Kunlik minimum lidlar"><input type="number" min={0} disabled={!canManage} value={f.dailyMinLeads} onChange={(e) => set("dailyMinLeads", +e.target.value)} className={num} /></Field>
            <Field label="Maqsad konversiya (%)"><input type="number" min={0} max={100} disabled={!canManage} value={f.targetConversion} onChange={(e) => set("targetConversion", +e.target.value)} className={num} /></Field>
            <Field label="Bonus chegarasi (%)"><input type="number" min={0} max={100} disabled={!canManage} value={f.bonusThreshold} onChange={(e) => set("bonusThreshold", +e.target.value)} className={num} /></Field>
            <Field label="Jarima chegarasi (%)"><input type="number" min={0} max={100} disabled={!canManage} value={f.penaltyThreshold} onChange={(e) => set("penaltyThreshold", +e.target.value)} className={num} /></Field>

            <Check label="Avtomatik taqsimlash" checked={f.autoDistribution} disabled={!canManage} onChange={(v) => set("autoDistribution", v)} />
            <Check label="Yuqori KPI → ko'proq lid" checked={f.highKpiMoreLeads} disabled={!canManage} onChange={(v) => set("highKpiMoreLeads", v)} />

            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-950/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300"><Icon name="chart" className="h-4 w-4" /> KPI hisoblash</div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">KPI = (Muvaffaqiyatli sotuvlar / Jami lidlar) × 100</p>
            </div>
          </div>
        </div>

        {/* Oylik to'lov sozlamalari */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="coins" className="h-5 w-5 text-emerald-500" /> Oylik to&apos;lov sozlamalari</h2>
          <p className="mb-4 text-sm text-brand-600 dark:text-brand-300">Umumiy (barcha operatorlar uchun)</p>
          <div className="space-y-3">
            {f.monthlyPayments.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="number" min={1} disabled={!canManage} value={p.month} onChange={(e) => editMonth(i, "month", +e.target.value)} className={cn(num, "w-20")} />
                <span className="text-sm text-slate-400">oy</span>
                <input type="number" min={0} disabled={!canManage} value={p.amount} onChange={(e) => editMonth(i, "amount", +e.target.value)} className={cn(num, "flex-1")} />
                <span className="text-sm text-slate-400">so&apos;m</span>
                {canManage && (
                  i === f.monthlyPayments.length - 1
                    ? <button onClick={addMonth} title="Qo'shish" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-300 text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"><Icon name="plus" className="h-5 w-5" /></button>
                    : <button onClick={() => removeMonth(i)} title="O'chirish" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30"><Icon name="trash" className="h-4 w-4" /></button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Har bir oy uchun alohida summa belgilang. Qo&apos;shimcha oy qo&apos;shish uchun «+» tugmasini bosing.</p>
        </div>
      </div>

      {/* Operatorlar reytingi */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="users" className="h-5 w-5 text-brand-500" /> Operatorlar reytingi <span className="text-sm font-normal text-slate-400">({rating.length} ta)</span></h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/60 text-[12px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">Operator</th>
                <th className="px-4 py-3.5">Jami</th>
                <th className="px-4 py-3.5">Muvaffaq</th>
                <th className="px-4 py-3.5">Rad etilgan</th>
                <th className="px-4 py-3.5">Konversiya</th>
                <th className="px-4 py-3.5">KPI</th>
                <th className="px-4 py-3.5">Oylik to&apos;lov</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rating.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Operatorlar yo&apos;q</td></tr>
              ) : (
                rating.map((r, i) => (
                  <tr key={r.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3"><span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>{i + 1}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={r.name} role="MANAGER" size="sm" className="!h-8 !w-8 !rounded-full" />
                        <span className="font-medium text-slate-800 dark:text-slate-100">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.total}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{r.won}</td>
                    <td className="px-4 py-3 font-semibold text-rose-500">{r.rejected}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.conv}%</td>
                    <td className="px-4 py-3"><span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-bold", tierColor(r.kpi))}>{r.kpi}%</span></td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{formatMoney(r.pay, locale)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function Check({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200", disabled ? "opacity-70" : "cursor-pointer")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
      {label}
    </label>
  );
}
