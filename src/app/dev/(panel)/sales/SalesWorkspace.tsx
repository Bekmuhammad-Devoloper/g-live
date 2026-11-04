"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/app/(app)/_components/Icon";
import { formatPhone, LEAD_STATUSES, planPriceLabel, promoPeriod, sumLabel, type LeadStatus, type SalesLead, type SalesLink, type SalesPlan } from "@/lib/devpanel/salesTypes";
import { fmtDate } from "../ui";
import { createLinkAction, setLeadStatusAction, setLinkActiveAction } from "./actions";
import LeadDrawer from "./LeadDrawer";

const statusOf = (key: LeadStatus) => LEAD_STATUSES.find((s) => s.key === key) ?? LEAD_STATUSES[0];
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const FILTER = "h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-300 outline-none focus:border-brand-400";
const TOOL = "flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05]";
const LINK_ACTION = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-slate-200 transition hover:border-brand-400/60 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40";

function LinksDrawer({ links, leads, publicBase, onClose }: { links: SalesLink[]; leads: SalesLead[]; publicBase: string; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

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

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) if (l.linkCode) m.set(l.linkCode, (m.get(l.linkCode) ?? 0) + 1);
    return m;
  }, [leads]);

  const urlOf = (code: string) => `${publicBase}/apply/${code}`;
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
    <div className="fixed inset-0 z-50 !mt-0 flex justify-end bg-slate-950/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="animate-slide-in-right flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Lid tushadigan havolalar</h2>
            <p className="mt-0.5 text-xs text-slate-400">Har reklama uchun alohida havola yarating, qaysi biri lid olib kelayotgani ko'rinadi.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/10">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={create} className="flex gap-2 border-b border-white/[0.07] px-5 py-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan: Instagram"
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand-400"
          />
          <button
            type="submit"
            disabled={pending || !ready}
            className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition", ready ? "bg-brand-600 text-white hover:bg-brand-700" : "cursor-not-allowed bg-white/[0.06] text-slate-500")}
          >
            <Icon name="plus" className="h-4 w-4" />
            Yaratish
          </button>
        </form>
        {error && <p className="mx-5 mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <ul className="flex-1 divide-y divide-white/[0.05] overflow-y-auto">
          {links.map((l) => {
            const count = counts.get(l.code) ?? 0;
            return (
              <li key={l.code} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", l.active ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" : "bg-slate-600")} />
                  <span className="min-w-0 truncate text-sm font-semibold text-white">{l.name}</span>
                  {!l.active && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-400">o'chirilgan</span>}
                  <span className={cn("ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", count ? "bg-brand-500/15 text-brand-300" : "bg-white/[0.05] text-slate-400")}>{count} ta lid</span>
                </div>
                <div className="mt-1.5 truncate font-mono text-xs text-slate-400">{urlOf(l.code)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => copy(l.code)} disabled={!l.active} className={copied === l.code ? `${LINK_ACTION} !border-emerald-400/50 !text-emerald-300` : LINK_ACTION}>
                    <Icon name={copied === l.code ? "check" : "copy"} className="h-3.5 w-3.5" />
                    {copied === l.code ? "Nusxalandi" : "Nusxalash"}
                  </button>
                  <a href={urlOf(l.code)} target="_blank" rel="noreferrer" className={cn(LINK_ACTION, !l.active && "pointer-events-none opacity-40")}>
                    <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
                    Ochish
                  </a>
                  <button type="button" onClick={() => toggle(l)} disabled={pending} className={cn(LINK_ACTION, l.active && "text-slate-400 hover:!border-red-400/50 hover:text-red-300")}>
                    <Icon name={l.active ? "eyeOff" : "eye"} className="h-3.5 w-3.5" />
                    {l.active ? "O'chirish" : "Yoqish"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function LeadCard({ lead, price, onOpen, onDragStart, onDragEnd }: {
  lead: SalesLead;
  price: number | null;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const status = statusOf(lead.status);
  const days = daysSince(lead.createdAt);
  const stuck = (lead.status === "NEW" || lead.status === "CONTACTED") && days >= 3;
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="group relative cursor-pointer select-none rounded-xl border border-white/[0.07] bg-[#15243d] p-3.5 outline-none transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 focus-visible:border-brand-400"
    >
      <div className="flex items-start gap-3" title={lead.centerName}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700/40" style={{ boxShadow: `inset 0 0 0 2px ${status.color}` }}>
          <Icon name="building" className="h-5 w-5 text-slate-400" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="break-words text-[14px] font-semibold leading-tight text-slate-100">{lead.centerName}</span>
            {stuck && <span className="shrink-0 text-xs font-bold text-red-500">{days} kun</span>}
          </div>
          <div className="mt-0.5 break-words text-xs leading-tight text-slate-400">{lead.contactName}</div>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} title="Qo'ng'iroq qilish" className="flex items-center gap-2 text-sm transition hover:opacity-70">
          <Icon name="phone" className="h-3.5 w-3.5 shrink-0" style={{ color: "#10b981" }} />
          <span className="truncate font-medium text-slate-200">{formatPhone(lead.phone)}</span>
        </a>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Icon name="download" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{lead.linkName ?? "Qo'lda qo'shilgan"}</span>
        </div>
        {lead.planName && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Icon name="layers" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{lead.planName}</span>
          </div>
        )}
        {lead.city && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{lead.city}</span>
          </div>
        )}
        {(lead.students !== null || lead.submissions > 1) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {lead.students !== null && <span className="rounded bg-slate-800 px-1.5 py-0.5 font-medium text-slate-300">{lead.students} o'quvchi</span>}
            {lead.submissions > 1 && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-300">{lead.submissions} marta</span>}
          </div>
        )}
        {!!price && <div className="text-xs font-semibold text-emerald-500">{planPriceLabel(price)}</div>}
        {lead.promoCode && (
          <div className="truncate text-xs font-semibold text-orange-300">
            {lead.promoCode} · {promoPeriod(lead.promoMonths ?? 1)}: −{sumLabel(lead.promoDiscount ?? 0)}
          </div>
        )}
      </div>

      <div className="my-2.5 h-px bg-white/[0.06]" />

      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-slate-400">{fmtDate(lead.createdAt)}</span>
        <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ color: status.color, background: `${status.color}1f` }}>{status.label}</span>
      </div>
    </div>
  );
}

function Kanban({ rows, priceOf, onOpen, onAdd, onMove }: {
  rows: SalesLead[];
  priceOf: (planId: string | null) => number | null;
  onOpen: (l: SalesLead) => void;
  onAdd: (status: LeadStatus) => void;
  onMove: (id: string, status: LeadStatus) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  const dragging = dragId ? rows.find((l) => l.id === dragId) ?? null : null;

  return (
    <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4">
      {LEAD_STATUSES.map((col) => {
        const items = rows.filter((l) => l.status === col.key);
        return (
          <div
            key={col.key}
            data-column={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragging && dragging.status !== col.key) setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              const lead = id ? rows.find((l) => l.id === id) : null;
              if (lead && lead.status !== col.key) onMove(lead.id, col.key);
              setDragId(null);
              setOverCol(null);
            }}
            className={cn(
              "flex min-h-[240px] min-w-0 flex-col rounded-2xl border p-2.5 transition md:min-h-[560px]",
              overCol === col.key ? "border-white/[0.12] bg-white/[0.04]" : "border-white/[0.05] bg-white/[0.02]",
            )}
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: col.color, background: `${col.color}1f` }}>
                  <Icon name={col.icon} className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="font-hand block min-w-0 truncate text-[17px] font-bold leading-[1.35] text-slate-100">{col.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-sm font-bold" style={{ color: col.color }}>{items.length}</span>
                <button type="button" onClick={() => onAdd(col.key)} title="Qo'shish" aria-label={`${col.label}: lid qo'shish`} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200">
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mx-1 mb-3 mt-2 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${col.color}, ${col.color}22)` }} />
            <div className="flex flex-1 flex-col space-y-3">
              {items.map((l) => (
                <LeadCard
                  key={l.id}
                  lead={l}
                  price={priceOf(l.planId)}
                  onOpen={() => onOpen(l)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", l.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(l.id);
                  }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                />
              ))}
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-7 text-center">
                  <Icon name={col.icon} className="mx-auto h-5 w-5 text-slate-600" />
                  <p className="mt-2 text-xs text-slate-400">{dragging ? "Lidni shu yerga tashlang" : "Lid yo'q"}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadsTable({ rows, onOpen, onMove }: { rows: SalesLead[]; onOpen: (l: SalesLead) => void; onMove: (id: string, status: LeadStatus) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15243d]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-white/[0.03] text-left text-xs font-semibold uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Markaz</th>
              <th className="px-4 py-3">Telefon</th>
              <th className="px-4 py-3">Shahar</th>
              <th className="px-4 py-3">O'quvchi</th>
              <th className="px-4 py-3">Tarif</th>
              <th className="px-4 py-3">Manba</th>
              <th className="px-4 py-3">Sana</th>
              <th className="px-4 py-3">Holat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Lid yo'q</td></tr>}
            {rows.map((l) => (
              <tr key={l.id} onClick={() => onOpen(l)} className="cursor-pointer transition hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-100">{l.centerName}</div>
                  <div className="text-xs text-slate-400">{l.contactName}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-200 hover:underline">{formatPhone(l.phone)}</a>
                </td>
                <td className="px-4 py-3 text-slate-300">{l.city || "—"}</td>
                <td className="px-4 py-3 tabular-nums text-slate-300">{l.students ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">
                  {l.planName ?? "—"}
                  {l.promoCode && <span className="ml-2 rounded bg-orange-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-orange-300">{l.promoCode}</span>}
                </td>
                <td className="px-4 py-3 text-slate-400">{l.linkName ?? "Qo'lda"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-400">{fmtDate(l.createdAt)}</td>
                <td className="px-4 py-3">
                  <select
                    value={l.status}
                    aria-label="Holat"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onMove(l.id, e.target.value as LeadStatus)}
                    className="h-8 rounded-lg border border-white/10 bg-[#0a1020] px-2 text-xs text-slate-200 outline-none focus:border-brand-400"
                  >
                    {LEAD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition", active ? "bg-brand-600 text-white" : "text-slate-400 hover:bg-slate-700")}>
      <Icon name={icon} className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function SalesWorkspace({ leads, links, plans, publicBase, summary }: {
  leads: SalesLead[];
  links: SalesLink[];
  plans: SalesPlan[];
  publicBase: string;
  summary: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [plan, setPlan] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [activeCols, setActiveCols] = useState<Set<LeadStatus>>(new Set());
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [drawer, setDrawer] = useState<{ lead: SalesLead | null; status: LeadStatus } | null>(null);
  const [linksOpen, setLinksOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, LeadStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [, start] = useTransition();

  const matched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const list = leads
      .map((l) => (overrides[l.id] ? { ...l, status: overrides[l.id] } : l))
      .filter((l) => !needle
        || `${l.centerName} ${l.contactName} ${l.city}`.toLowerCase().includes(needle)
        || (digits.length >= 3 && l.phone.includes(digits)))
      .filter((l) => !source || (source === "manual" ? !l.linkCode : l.linkCode === source))
      .filter((l) => !plan || l.planId === plan);
    const sorted = [...list];
    if (sort === "oldest") sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sort === "name") sorted.sort((a, b) => a.centerName.localeCompare(b.centerName));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [leads, overrides, q, source, plan, sort]);

  const rows = useMemo(() => (activeCols.size ? matched.filter((l) => activeCols.has(l.status)) : matched), [matched, activeCols]);

  const counts = useMemo(() => {
    const m: Partial<Record<LeadStatus, number>> = {};
    for (const l of matched) m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, [matched]);

  const priceOf = (planId: string | null) => plans.find((p) => p.id === planId)?.price ?? null;

  const move = (id: string, status: LeadStatus) => {
    setError(null);
    setOverrides((o) => ({ ...o, [id]: status }));
    start(async () => {
      const r = await setLeadStatusAction(id, status);
      if (!r.ok) setError(r.error ?? "Holat saqlanmadi");
      setOverrides((o) => { const n = { ...o }; delete n[id]; return n; });
      router.refresh();
    });
  };
  const open = (lead: SalesLead) => setDrawer({ lead, status: lead.status });
  const add = (status: LeadStatus) => setDrawer({ lead: null, status });
  const toggleCol = (key: LeadStatus) => setActiveCols((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const hasFilters = !!q || !!source || !!plan || activeCols.size > 0;
  const clearFilters = () => { setQ(""); setSource(""); setPlan(""); setActiveCols(new Set()); };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.08] bg-[#15243d] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Icon name="download" className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100">Obuna lidlari</h1>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-500">{leads.length}</span>
              </div>
              <p className="text-xs text-slate-400">{summary}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-1.5 2xl:flex">
              {LEAD_STATUSES.map((c) => (
                <span key={c.key} title={c.label} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold" style={{ color: c.color, background: `${c.color}14` }}>
                  <Icon name={c.icon} className="h-3.5 w-3.5" /> {counts[c.key] ?? 0}
                </span>
              ))}
            </div>
            <button type="button" onClick={() => setLinksOpen(true)} className={TOOL}>
              <Icon name="link" className="h-4 w-4" />
              <span>Havolalar</span>
              <span className="rounded bg-white/[0.08] px-1.5 text-xs font-bold">{links.length}</span>
            </button>
            <button type="button" onClick={() => startRefresh(() => { router.refresh(); })} title="Yangilash" className={TOOL}>
              <Icon name="refresh" className={cn("h-4 w-4", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>
            <div className="flex rounded-lg border border-white/[0.1] p-0.5">
              <ToggleBtn active={view === "kanban"} onClick={() => setView("kanban")} icon="grid" label="Kanban" />
              <ToggleBtn active={view === "table"} onClick={() => setView("table")} icon="listView" label="Jadval" />
            </div>
            <button type="button" onClick={() => add("NEW")} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Icon name="plus" className="h-[18px] w-[18px]" />
              <span>Qo'shish</span>
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Markaz, ism, telefon bo'yicha qidirish..."
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand-400"
              />
            </div>
            <select aria-label="Manba" value={source} onChange={(e) => setSource(e.target.value)} className={FILTER}>
              <option value="">Manba: Barchasi</option>
              {links.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              <option value="manual">Qo'lda qo'shilgan</option>
            </select>
            <select aria-label="Tarif" value={plan} onChange={(e) => setPlan(e.target.value)} className={FILTER}>
              <option value="">Tarif: Barchasi</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select aria-label="Saralash" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={FILTER}>
              <option value="newest">Saralash: Eng yangi</option>
              <option value="oldest">Saralash: Eng eski</option>
              <option value="name">Saralash: Nomi (A-Z)</option>
            </select>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200">
                <Icon name="close" className="h-4 w-4" />
                Tozalash
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {LEAD_STATUSES.map((c) => {
              const active = activeCols.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCol(c.key)}
                  className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition", active ? "text-white" : "border-slate-700 text-slate-300 hover:bg-white/[0.04]")}
                  style={active ? { background: c.color, borderColor: c.color } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? "#fff" : c.color }} />
                  {c.label}
                  <span className={cn("rounded px-1 text-[10px] font-bold", active ? "bg-white/25" : "bg-slate-700")}>{counts[c.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {view === "kanban"
        ? <Kanban rows={rows} priceOf={priceOf} onOpen={open} onAdd={add} onMove={move} />
        : <LeadsTable rows={rows} onOpen={open} onMove={move} />}

      {drawer && (
        <LeadDrawer
          key={drawer.lead?.id ?? `new-${drawer.status}`}
          lead={drawer.lead}
          defaultStatus={drawer.status}
          plans={plans}
          onClose={() => setDrawer(null)}
        />
      )}
      {linksOpen && <LinksDrawer links={links} leads={leads} publicBase={publicBase} onClose={() => setLinksOpen(false)} />}
    </div>
  );
}
