"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPhone, LEAD_STATUSES, type SalesLead, type SalesLink, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { fmtDate } from "../ui";
import { createLinkAction, setLeadStatusAction, setLinkActiveAction } from "./actions";
import LeadDrawer from "./LeadDrawer";

const ICON = {
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  check: "M5 12l5 5L20 7",
  open: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  power: "M12 3v9M6.3 7.3a8 8 0 1 0 11.4 0",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1",
  plus: "M12 5v14M5 12h14",
};

function Glyph({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ACTION = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-slate-200 transition hover:border-orange-400/50 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40";

function LinksPanel({ links, leads, origin }: { links: SalesLink[]; leads: SalesLead[]; origin: string }) {
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
  const ready = name.trim().length >= 2;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1424]">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e3262b]/20 to-[#f6b51e]/10 text-orange-300 ring-1 ring-orange-400/20">
            <Glyph d={ICON.link} className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-white">Lid tushadigan havolalar</h2>
            <p className="mt-0.5 max-w-md text-[13px] leading-relaxed text-slate-400">Har reklama uchun alohida havola yarating, qaysi biri lid olib kelayotgani ko'rinadi.</p>
          </div>
        </div>
        <form onSubmit={create} className="flex w-full gap-2 md:w-[340px]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan: Instagram"
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60"
          />
          <button
            type="submit"
            disabled={pending || !ready}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4 text-[13px] font-bold transition ${ready ? "bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] text-white hover:brightness-110" : "cursor-not-allowed bg-white/[0.06] text-slate-500"}`}
          >
            <Glyph d={ICON.plus} />
            Yaratish
          </button>
        </form>
      </div>
      {error && <p className="mx-5 mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 md:mx-6">{error}</p>}
      <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
        {links.map((l) => {
          const count = counts.get(l.code) ?? 0;
          return (
            <li key={l.code} className="flex flex-col gap-3 px-5 py-4 md:px-6 lg:flex-row lg:items-center lg:gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${l.active ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" : "bg-slate-600"}`} />
                  <span className="truncate text-sm font-semibold text-white">{l.name}</span>
                  {!l.active && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-400">o'chirilgan</span>}
                </div>
                <div className="mt-1.5 truncate font-mono text-xs text-slate-400">{urlOf(l.code)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`mr-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${count ? "bg-orange-400/15 text-orange-300" : "bg-white/[0.05] text-slate-400"}`}>{count} ta lid</span>
                <button type="button" onClick={() => copy(l.code)} disabled={!l.active} className={copied === l.code ? `${ACTION} !border-emerald-400/50 !text-emerald-300` : ACTION}>
                  <Glyph d={copied === l.code ? ICON.check : ICON.copy} className="h-3.5 w-3.5" />
                  {copied === l.code ? "Nusxalandi" : "Nusxalash"}
                </button>
                <a href={urlOf(l.code)} target="_blank" rel="noreferrer" className={`${ACTION} ${l.active ? "" : "pointer-events-none opacity-40"}`}>
                  <Glyph d={ICON.open} className="h-3.5 w-3.5" />
                  Ochish
                </a>
                <button type="button" onClick={() => toggle(l)} disabled={pending} className={`${ACTION} ${l.active ? "text-slate-400 hover:!border-red-400/50 hover:text-red-300" : ""}`}>
                  <Glyph d={ICON.power} className="h-3.5 w-3.5" />
                  {l.active ? "O'chirish" : "Yoqish"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LeadCard({ lead, onOpen, onStatus }: { lead: SalesLead; onOpen: () => void; onStatus: (s: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="group cursor-pointer rounded-xl border border-white/[0.07] bg-[#0f1729] p-3 outline-none transition hover:-translate-y-0.5 hover:border-orange-400/40 hover:shadow-lg hover:shadow-black/30 focus-visible:border-orange-400/60"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#e3262b] to-[#f6b51e] text-xs font-bold text-white">
          {lead.centerName.trim().slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-white">{lead.centerName}</div>
          <div className="truncate text-[11px] text-slate-400">{lead.contactName}</div>
        </div>
      </div>
      <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-medium tabular-nums text-orange-300 hover:underline">
        <Glyph d={ICON.phone} className="h-3 w-3 shrink-0" />
        <span className="truncate">{formatPhone(lead.phone)}</span>
      </a>
      {(lead.planName || lead.students !== null || lead.city || lead.submissions > 1) && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-medium text-slate-300">
          {lead.planName && <span className="rounded-md bg-orange-400/10 px-1.5 py-0.5 text-orange-200">{lead.planName}</span>}
          {lead.students !== null && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">{lead.students} o'quvchi</span>}
          {lead.city && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">{lead.city}</span>}
          {lead.submissions > 1 && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{lead.submissions} marta</span>}
        </div>
      )}
      <div className="mt-2.5 border-t border-white/[0.05] pt-2">
        <div className="truncate text-[10px] text-slate-500">{fmtDate(lead.createdAt)} · {lead.linkName ?? "Qo'lda"}</div>
        <select
          value={lead.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Holat"
          className="mt-1.5 h-7 w-full rounded-md border border-white/10 bg-[#0a1020] px-1.5 text-[11px] text-slate-300 outline-none transition focus:border-orange-400/60"
        >
          {LEAD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function SalesWorkspace({ leads, links, plans, origin, stats }: {
  leads: SalesLead[];
  links: SalesLink[];
  plans: SalesPlan[];
  origin: string;
  stats: React.ReactNode;
}) {
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Obuna lidlari</h1>
          <p className="mt-1 text-sm text-slate-500">O'quv markazlaridan tushgan arizalar va sotuv jarayoni</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawer("new")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-4 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition hover:brightness-110"
        >
          <Glyph d={ICON.plus} />
          Lid qo'shish
        </button>
      </div>

      {stats}

      <LinksPanel links={links} leads={leads} origin={origin} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white">Sotuv jarayoni</h2>
          <div className="relative w-full sm:w-80">
            <Glyph d={ICON.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Markaz, ism yoki telefon"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60"
            />
          </div>
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="grid min-w-[1110px] grid-cols-6 gap-2.5">
            {LEAD_STATUSES.map((s) => {
              const col = rows.filter((l) => l.status === s.key);
              return (
                <div key={s.key} className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0b1120]/70">
                  <span aria-hidden className={`h-0.5 ${s.accent}`} />
                  <header className="flex items-center gap-2 px-3 py-2.5">
                    <h3 className="truncate text-xs font-bold text-slate-200">{s.label}</h3>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${col.length ? "bg-white/[0.1] text-white" : "bg-white/[0.04] text-slate-500"}`}>{col.length}</span>
                  </header>
                  <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
                    {col.map((l) => <LeadCard key={l.id} lead={l} onOpen={() => setDrawer(l)} onStatus={(v) => setStatus(l.id, v)} />)}
                    {col.length === 0 && (
                      <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-white/[0.07] text-xs text-slate-600">Lid yo'q</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

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
