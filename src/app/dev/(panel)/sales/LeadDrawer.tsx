"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPhone, LEAD_STATUSES, promoPeriod, sumLabel, type LeadStatus, type SalesLead, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { createLeadAction, deleteLeadAction, updateLeadAction } from "./actions";

export default function LeadDrawer({ lead, defaultStatus, plans, onClose }: { lead: SalesLead | null; defaultStatus: LeadStatus; plans: SalesPlan[]; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    centerName: lead?.centerName ?? "",
    contactName: lead?.contactName ?? "",
    phone: lead ? formatPhone(lead.phone) : "",
    city: lead?.city ?? "",
    students: lead?.students != null ? String(lead.students) : "",
    planId: lead?.planId ?? "",
    message: lead?.message ?? "",
    note: lead?.note ?? "",
    status: lead?.status ?? defaultStatus,
  });
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const finish = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) { setError(r.error ?? "Saqlanmadi"); return; }
    router.refresh();
    onClose();
  };
  const save = () => {
    setError(null);
    start(async () => finish(lead ? await updateLeadAction(lead.id, f) : await createLeadAction(f)));
  };
  const remove = () => {
    if (!lead) return;
    setError(null);
    start(async () => finish(await deleteLeadAction(lead.id)));
  };

  const fld = "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-orange-400/60";
  const lbl = "mb-1 block text-xs font-semibold text-slate-400";

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex justify-end bg-slate-950/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-slide-in-right flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-base font-bold text-white">{lead ? lead.centerName : "Yangi lid"}</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {lead && (
            <div className="flex flex-wrap gap-2">
              <a href={`tel:${lead.phone}`} className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">Qo'ng'iroq qilish</a>
              {lead.centerSlug ? (
                <Link href={`/dev/centers/${lead.centerSlug}`} className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-200 hover:border-orange-400/50">Markazni ochish</Link>
              ) : (
                <Link href={`/dev/centers/new?lead=${lead.id}`} className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-[#e3262b] to-[#ee7a24] px-3 text-xs font-bold text-white">Markaz yaratish</Link>
              )}
            </div>
          )}
          <div>
            <label className={lbl}>Holat</label>
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className={fld}>
              {LEAD_STATUSES.map((s) => <option key={s.key} value={s.key} className="bg-[#0d1424]">{s.label}</option>)}
            </select>
          </div>
          <div><label className={lbl}>O'quv markazi nomi *</label><input value={f.centerName} onChange={(e) => set("centerName", e.target.value)} className={fld} /></div>
          <div><label className={lbl}>Bog'lanish uchun ism *</label><input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} className={fld} /></div>
          <div><label className={lbl}>Telefon *</label><input type="tel" value={f.phone} placeholder="+998 90 123 45 67" onChange={(e) => set("phone", e.target.value)} className={fld} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Shahar</label><input value={f.city} onChange={(e) => set("city", e.target.value)} className={fld} /></div>
            <div><label className={lbl}>O'quvchilar soni</label><input inputMode="numeric" value={f.students} onChange={(e) => set("students", e.target.value.replace(/\D/g, "").slice(0, 6))} className={fld} /></div>
          </div>
          <div>
            <label className={lbl}>Tarif</label>
            <select value={f.planId} onChange={(e) => set("planId", e.target.value)} className={fld}>
              <option value="" className="bg-[#0d1424]">Tanlanmagan</option>
              {plans.map((p) => <option key={p.id} value={p.id} className="bg-[#0d1424]">{p.name}</option>)}
            </select>
          </div>
          {lead?.promoCode && (
            <div className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-sm text-orange-200">
              <span className="font-bold">{lead.promoCode}</span> · {promoPeriod(lead.promoMonths ?? 1)} uchun {sumLabel(lead.promoDiscount ?? 0)} chegirma
            </div>
          )}
          <div><label className={lbl}>Mijoz izohi</label><textarea rows={3} value={f.message} onChange={(e) => set("message", e.target.value)} className={`${fld} h-auto py-2`} /></div>
          <div><label className={lbl}>Sotuv eslatmasi</label><textarea rows={4} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Nima kelishildi, qachon qayta bog'lanish kerak" className={`${fld} h-auto py-2`} /></div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-4">
          {lead && (confirming ? (
            <button type="button" onClick={remove} disabled={pending} className="h-10 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700">Rostdan o'chirilsinmi?</button>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="h-10 rounded-lg px-3 text-xs font-semibold text-red-300 hover:bg-red-500/10">O'chirish</button>
          ))}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-medium text-slate-400 hover:bg-white/5">Bekor</button>
            <button type="button" onClick={save} disabled={pending} className="h-10 rounded-lg bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-5 text-sm font-bold text-white disabled:opacity-60">{pending ? "..." : "Saqlash"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
