"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPhone, LEAD_STATUSES, type SalesLead, type SalesLink, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { Card, fmtDate } from "../ui";
import { createLinkAction, setLeadStatusAction, setLinkActiveAction } from "./actions";
import LeadDrawer from "./LeadDrawer";

const BTN = "h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:border-orange-400/50 disabled:opacity-50";

function LinksCard({ links, leads, origin }: { links: SalesLink[]; leads: SalesLead[]; origin: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) if (l.linkCode) m.set(l.linkCode, (m.get(l.linkCode) ?? 0) + 1);
    return m;
  }, [leads]);

  const urlOf = (code: string) => `${origin}/dev/obuna/${code}`;
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(urlOf(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Nusxalanmadi, havolani qo'lda belgilang");
    }
  };
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createLinkAction(name);
      if (!r.ok) { setError(r.error ?? "Havola yaratilmadi"); return; }
      setName("");
      router.refresh();
    });
  };
  const toggle = (l: SalesLink) => start(async () => {
    await setLinkActiveAction(l.code, !l.active);
    router.refresh();
  });

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Lid tushadigan havolalar</h2>
          <p className="mt-0.5 text-xs text-slate-500">Har reklama uchun alohida havola yarating, qaysi biri lid olib kelayotgani ko'rinadi.</p>
        </div>
        <form onSubmit={create} className="flex w-full gap-2 sm:w-auto">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Instagram" className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-orange-400/60 sm:w-52" />
          <button type="submit" disabled={pending || name.trim().length < 2} className="h-9 shrink-0 rounded-lg bg-gradient-to-r from-[#e3262b] to-[#ee7a24] px-3 text-xs font-bold text-white disabled:opacity-50">Yaratish</button>
        </form>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <ul className="mt-4 divide-y divide-white/[0.06]">
        {links.map((l) => (
          <li key={l.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1 basis-64">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {l.name}
                {!l.active && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">o'chirilgan</span>}
              </div>
              <div className="truncate font-mono text-xs text-slate-500">{urlOf(l.code)}</div>
            </div>
            <div className="text-xs text-slate-400">{counts.get(l.code) ?? 0} ta lid</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => copy(l.code)} disabled={!l.active} className={BTN}>{copied === l.code ? "Nusxalandi" : "Nusxalash"}</button>
              <a href={urlOf(l.code)} target="_blank" rel="noreferrer" className={`${BTN} inline-flex items-center ${l.active ? "" : "pointer-events-none opacity-50"}`}>Ochish</a>
              <button type="button" onClick={() => toggle(l)} disabled={pending} className={BTN}>{l.active ? "O'chirish" : "Yoqish"}</button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LeadCard({ lead, onOpen, onStatus }: { lead: SalesLead; onOpen: () => void; onStatus: (s: string) => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }} className="cursor-pointer rounded-xl border border-white/[0.07] bg-[#0d1424] p-3 outline-none transition hover:border-orange-400/40 focus-visible:border-orange-400/60">
      <div className="truncate text-sm font-bold text-white">{lead.centerName}</div>
      <div className="mt-0.5 truncate text-xs text-slate-400">{lead.contactName}</div>
      <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="mt-1 block font-mono text-xs text-orange-300 hover:underline">{formatPhone(lead.phone)}</a>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-400">
        {lead.planName && <span className="rounded bg-white/[0.06] px-1.5 py-0.5">{lead.planName}</span>}
        {lead.students !== null && <span className="rounded bg-white/[0.06] px-1.5 py-0.5">{lead.students} o'quvchi</span>}
        {lead.city && <span className="rounded bg-white/[0.06] px-1.5 py-0.5">{lead.city}</span>}
        {lead.submissions > 1 && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{lead.submissions} marta</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-slate-500">{fmtDate(lead.createdAt)} · {lead.linkName ?? "Qo'lda"}</span>
        <select
          value={lead.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Holat"
          className="h-6 max-w-[96px] rounded border border-white/10 bg-[#0a1020] px-1 text-[10px] text-slate-300 outline-none"
        >
          {LEAD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function SalesWorkspace({ leads, links, plans, origin }: { leads: SalesLead[]; links: SalesLink[]; plans: SalesPlan[]; origin: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState<SalesLead | "new" | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return leads
      .map((l) => (overrides[l.id] ? { ...l, status: overrides[l.id] as SalesLead["status"] } : l))
      .filter((l) => !needle
        || `${l.centerName} ${l.contactName} ${l.city}`.toLowerCase().includes(needle)
        || (digits.length >= 3 && l.phone.includes(digits)));
  }, [leads, overrides, q]);

  const setStatus = (id: string, status: string) => {
    setError(null);
    setOverrides((o) => ({ ...o, [id]: status }));
    start(async () => {
      const r = await setLeadStatusAction(id, status);
      if (!r.ok) setError(r.error ?? "Holat saqlanmadi");
      setOverrides((o) => { const n = { ...o }; delete n[id]; return n; });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <LinksCard links={links} leads={leads} origin={origin} />

      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Markaz, ism yoki telefon bo'yicha qidirish" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-orange-400/60 sm:max-w-sm" />
        <button type="button" onClick={() => setDrawer("new")} className="h-10 rounded-lg bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-4 text-sm font-bold text-white">+ Lid qo'shish</button>
      </div>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-3">
          {LEAD_STATUSES.map((s) => {
            const col = rows.filter((l) => l.status === s.key);
            return (
              <section key={s.key} className="w-64 shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <header className="mb-2.5 flex items-center gap-2 px-1">
                  <span className={`h-2 w-2 rounded-full ${s.accent}`} />
                  <h3 className="text-xs font-bold text-slate-200">{s.label}</h3>
                  <span className="ml-auto text-xs tabular-nums text-slate-500">{col.length}</span>
                </header>
                <div className="space-y-2">
                  {col.map((l) => <LeadCard key={l.id} lead={l} onOpen={() => setDrawer(l)} onStatus={(v) => setStatus(l.id, v)} />)}
                  {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-600">Lid yo'q</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {drawer && (
        <LeadDrawer
          key={drawer === "new" ? "new" : drawer.id}
          lead={drawer === "new" ? null : drawer}
          plans={plans}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
