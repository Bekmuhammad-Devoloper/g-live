"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { exportRows } from "@/lib/export";
import { Icon } from "@/app/(app)/_components/Icon";
import { PLATFORMS, platform } from "@/app/(app)/links/platforms";
import { BUSINESS_TYPES, businessLabel, LINK_KINDS, kindLabel, type LinkKind } from "@/lib/devpanel/salesTypes";
import { fmtDate } from "../ui";
import { createLinksAction, deleteLinkAction, salesLinkQrAction, setLinkActiveAction, type CreatedSalesLink } from "../sales/actions";

export interface LinkRow {
  code: string;
  name: string;
  kind: LinkKind;
  platform: string;
  businessType: string | null;
  active: boolean;
  views: number;
  submissions: number;
  won: number;
  cvr: number | null;
  createdAt: string;
  lastViewedAt: string | null;
  lastLeadAt: string | null;
  builtin: boolean;
}

const nf = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const dateOf = (iso: string | null) => (iso && new Date(iso).getTime() > 0 ? fmtDate(iso) : "—");
const cvrLabel = (cvr: number | null) => (cvr === null ? "—" : `${cvr}%`);
const FIELD_BASE = "h-10 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/60";
const FIELD = `${FIELD_BASE} w-full`;
const OUTLINE = "inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-semibold text-slate-200 transition hover:border-orange-400/50";
const ROW_ICON = "grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition";

function Tile({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[#0d1424] p-4">
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      </div>
      <Icon name={icon} className={cn("h-8 w-8 opacity-30", tone)} />
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateModal({ publicBase, onClose, onCreated, copy, copied }: {
  publicBase: string;
  onClose: () => void;
  onCreated: () => void;
  copy: (code: string) => void;
  copied: string | null;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LinkKind>("automation");
  const [businessType, setBusinessType] = useState("");
  const [picked, setPicked] = useState<string[]>(["telegram"]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedSalesLink[] | null>(null);
  const [pending, start] = useTransition();

  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createLinksAction({ name, kind, businessType, platforms: picked });
      if (!r.ok) { setError(r.error ?? "Havola yaratilmadi"); return; }
      setCreated(r.links ?? []);
      onCreated();
    });
  };

  if (created) {
    return (
      <ModalShell title="Havolalar yaratildi" onClose={onClose}>
        <ul className="divide-y divide-white/[0.06] px-5 py-2">
          {created.map((l) => (
            <li key={l.code} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{l.name}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{publicBase}/apply/{l.code}</p>
              </div>
              <button type="button" onClick={() => copy(l.code)} className={cn(OUTLINE, "h-9 shrink-0 text-xs", copied === l.code && "!border-emerald-400/50 !text-emerald-300")}>
                <Icon name={copied === l.code ? "check" : "copy"} className="h-3.5 w-3.5" />
                {copied === l.code ? "Nusxalandi" : "Nusxalash"}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-white/[0.07] px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700">Tayyor</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Yangi havola" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-4 px-5 py-4">
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-400">Yo&apos;nalish</span>
            <div className="grid grid-cols-2 gap-2">
              {LINK_KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  aria-pressed={kind === k.key}
                  onClick={() => setKind(k.key)}
                  className={cn("h-10 rounded-lg border text-sm font-semibold transition", kind === k.key ? "border-orange-400/70 bg-orange-400/15 text-orange-200" : "border-white/10 text-slate-400 hover:text-slate-200")}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          {kind === "automation" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-400">Biznes turi (ixtiyoriy)</span>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={FIELD}>
                <option value="" className="bg-[#0d1424]">Mijoz o&apos;zi tanlaydi</option>
                {BUSINESS_TYPES.map((b) => <option key={b.key} value={b.key} className="bg-[#0d1424]">{b.label}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-400">Havola nomi (ixtiyoriy)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Masalan: Apteka reklamasi" className={FIELD} />
          </label>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-400">Platformalar <span className="text-red-400">*</span></span>
            <p className="mb-2 text-xs text-slate-500">Har bir platformaga alohida havola yaratiladi, qaysi kanal ko&apos;proq ariza berayotgani ko&apos;rinadi.</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const on = picked.includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.key)}
                    className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition", on ? "border-current" : "border-white/10 text-slate-400 hover:text-slate-200")}
                    style={on ? { background: `${p.color}1a`, color: p.color } : undefined}
                  >
                    <Icon name={p.icon} className="h-3.5 w-3.5" style={on ? undefined : { color: p.color }} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-medium text-slate-400 hover:bg-white/5">Bekor</button>
          <button type="submit" disabled={pending || picked.length === 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-5 text-sm font-bold text-white disabled:opacity-60">
            <Icon name="plus" className="h-4 w-4" />
            {pending ? "Yaratilmoqda..." : "Yaratish"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function QrModal({ row, onClose }: { row: LinkRow; onClose: () => void }) {
  const [data, setData] = useState<{ url: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    salesLinkQrAction(row.code).then((r) => {
      if ("qr" in r) setData(r);
      else setError(r.error);
    });
  }, [row.code]);

  return (
    <ModalShell title={`QR kod: ${row.name}`} onClose={onClose}>
      <div className="px-5 py-5 text-center">
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        {!data && !error && <p className="py-16 text-sm text-slate-400">Yuklanmoqda...</p>}
        {data && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.qr} alt={`QR: ${row.code}`} className="mx-auto h-56 w-56 rounded-lg" />
            <p className="mt-3 break-all font-mono text-xs text-slate-400">{data.url}</p>
            <a href={data.qr} download={`qr-${row.code}.png`} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              <Icon name="download" className="h-4 w-4" />
              PNG yuklab olish
            </a>
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function LinksView({ rows, publicBase }: { rows: LinkRow[]; publicBase: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"" | LinkKind>("");
  const [plat, setPlat] = useState<string | null>(null);
  const [sort, setSort] = useState<"submissions" | "cvr" | "views" | "newest">("submissions");
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState<LinkRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const urlOf = (code: string) => `${publicBase}/apply/${code}`;
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(urlOf(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      setError("Nusxalanmadi, havolani qo'lda belgilang");
    }
  };

  const inKind = useMemo(() => rows.filter((r) => !kind || r.kind === kind), [rows, kind]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = inKind
      .filter((r) => !plat || r.platform === plat)
      .filter((r) => !q || `${r.name} ${r.code} ${businessLabel(r.businessType)}`.toLowerCase().includes(q));
    const sorted = [...list];
    if (sort === "newest") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === "views") sorted.sort((a, b) => b.views - a.views);
    else if (sort === "cvr") sorted.sort((a, b) => (b.cvr ?? -1) - (a.cvr ?? -1));
    else sorted.sort((a, b) => b.submissions - a.submissions || b.views - a.views);
    return sorted;
  }, [inKind, plat, search, sort]);

  const totals = useMemo(() => ({
    links: inKind.length,
    active: inKind.filter((r) => r.active).length,
    views: inKind.reduce((n, r) => n + r.views, 0),
    submissions: inKind.reduce((n, r) => n + r.submissions, 0),
    won: inKind.reduce((n, r) => n + r.won, 0),
  }), [inKind]);

  const platformStats = useMemo(() => PLATFORMS
    .map((p) => {
      const list = inKind.filter((r) => r.platform === p.key);
      const submissions = list.reduce((n, r) => n + r.submissions, 0);
      return {
        ...p,
        links: list.length,
        views: list.reduce((n, r) => n + r.views, 0),
        submissions,
        share: totals.submissions ? Math.round((submissions / totals.submissions) * 100) : 0,
      };
    })
    .filter((p) => p.links > 0), [inKind, totals.submissions]);

  const toggle = (r: LinkRow) => {
    setError(null);
    start(async () => {
      const res = await setLinkActiveAction(r.code, !r.active);
      if (!res.ok) setError(res.error ?? "Saqlanmadi");
      router.refresh();
    });
  };
  const remove = (r: LinkRow) => {
    setError(null);
    start(async () => {
      const res = await deleteLinkAction(r.code);
      if (!res.ok) setError(res.error ?? "O'chirilmadi");
      setConfirming(null);
      router.refresh();
    });
  };
  const exportFile = () => exportRows("havolalar", [
    { key: "name", label: "Havola" },
    { key: "kind", label: "Yo'nalish" },
    { key: "platform", label: "Platforma" },
    { key: "business", label: "Biznes turi" },
    { key: "url", label: "Manzil" },
    { key: "views", label: "Ko'rishlar" },
    { key: "submissions", label: "Arizalar" },
    { key: "cvr", label: "Konversiya" },
    { key: "won", label: "Sotildi" },
    { key: "status", label: "Holat" },
    { key: "created", label: "Yaratilgan" },
    { key: "lastLead", label: "Oxirgi ariza" },
  ], shown.map((r) => ({
    name: r.name,
    kind: kindLabel(r.kind),
    platform: platform(r.platform).label,
    business: businessLabel(r.businessType),
    url: urlOf(r.code),
    views: r.views,
    submissions: r.submissions,
    cvr: cvrLabel(r.cvr),
    won: r.won,
    status: r.active ? "Faol" : "O'chirilgan",
    created: dateOf(r.createdAt),
    lastLead: dateOf(r.lastLeadAt),
  })));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Havolalar</h1>
          <p className="mt-1 text-sm text-slate-500">Har reklama uchun alohida havola yarating va qaysi biri qanday ishlayotganini ko&apos;ring.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportFile} className={OUTLINE}>
            <Icon name="download" className="h-4 w-4" />
            Eksport
          </button>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] px-4 text-sm font-bold text-white">
            <Icon name="plus" className="h-4 w-4" />
            Yangi havola
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile icon="link" tone="text-blue-400" label="Jami havolalar" value={nf(totals.links)} />
        <Tile icon="check" tone="text-emerald-400" label="Faol" value={nf(totals.active)} />
        <Tile icon="eye" tone="text-purple-400" label="Ko'rishlar" value={nf(totals.views)} />
        <Tile icon="users" tone="text-amber-400" label="Arizalar" value={nf(totals.submissions)} />
        <Tile icon="wallet" tone="text-orange-300" label="Sotildi" value={nf(totals.won)} />
      </div>

      {platformStats.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1424] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Icon name="chart" className="h-4 w-4 text-slate-400" />
              Platformalar statistikasi
            </h2>
            {plat && <button type="button" onClick={() => setPlat(null)} className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10">Barcha platformalar ✕</button>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {platformStats.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={plat === p.key}
                onClick={() => setPlat(plat === p.key ? null : p.key)}
                className={cn("relative overflow-hidden rounded-xl border p-3.5 text-left transition", plat === p.key ? "border-orange-400/70 ring-1 ring-orange-400/70" : "border-white/[0.07] hover:border-white/20")}
                style={{ background: `${p.color}14` }}
              >
                <span className="absolute bottom-0 left-0 h-1 opacity-70" style={{ width: `${p.share}%`, background: p.color }} />
                <span className="mb-2.5 flex items-center gap-2">
                  <Icon name={p.icon} className="h-4 w-4" style={{ color: p.color }} />
                  <span className="text-xs font-semibold" style={{ color: p.color }}>{p.label}</span>
                </span>
                <span className="block space-y-1.5 text-[11px] text-slate-400">
                  <span className="flex justify-between"><span>Havolalar</span><b className="tabular-nums text-slate-100">{p.links}</b></span>
                  <span className="flex justify-between"><span>Ko&apos;rishlar</span><b className="tabular-nums text-slate-100">{nf(p.views)}</b></span>
                  <span className="flex justify-between"><span>Arizalar</span><b className={cn("tabular-nums", p.submissions ? "text-emerald-400" : "text-slate-500")}>{nf(p.submissions)}</b></span>
                  <span className="flex justify-between border-t border-white/10 pt-1"><span>Ulush</span><b className="tabular-nums" style={{ color: p.color }}>{p.share}%</b></span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Havola nomi yoki kodi bo'yicha qidirish..." className={cn(FIELD, "pl-10")} />
        </div>
        <div className="flex rounded-lg border border-white/10 p-0.5">
          {[{ key: "" as const, label: "Barchasi" }, ...LINK_KINDS].map((k) => (
            <button
              key={k.key}
              type="button"
              aria-pressed={kind === k.key}
              onClick={() => { setKind(k.key); setPlat(null); }}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition", kind === k.key ? "bg-brand-600 text-white" : "text-slate-400 hover:bg-white/[0.06]")}
            >
              {k.label}
            </button>
          ))}
        </div>
        <select aria-label="Saralash" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={FIELD_BASE}>
          <option value="submissions" className="bg-[#0d1424]">Eng ko&apos;p ariza</option>
          <option value="cvr" className="bg-[#0d1424]">Eng yuqori konversiya</option>
          <option value="views" className="bg-[#0d1424]">Eng ko&apos;p ko&apos;rilgan</option>
          <option value="newest" className="bg-[#0d1424]">Eng yangi</option>
        </select>
        <button type="button" onClick={() => router.refresh()} title="Yangilash" aria-label="Yangilash" className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:text-slate-100">
          <Icon name="refresh" className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1424]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-white/[0.03] text-left text-xs font-medium text-slate-400">
              <tr>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5">#</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5">Havola</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5">Kod</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5 text-center">Ko&apos;rishlar</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5 text-center">Arizalar</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5">Konversiya</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5 text-center">Sotildi</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5 text-center">Holat</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5">Sana</th>
                <th className="px-3 py-3.5 first:pl-5 last:pr-5 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {shown.length === 0 && <tr><td colSpan={10} className="px-5 py-14 text-center text-slate-400">Havola topilmadi</td></tr>}
              {shown.map((r, i) => {
                const p = platform(r.platform);
                const deletable = !r.builtin && r.submissions === 0;
                return (
                  <tr key={r.code} className={cn("transition hover:bg-white/[0.02]", !r.active && "opacity-60")}>
                    <td className="py-4 pl-5 pr-3 font-mono text-xs text-slate-500">{i + 1}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${p.color}1a`, color: p.color }}>
                          <Icon name={p.icon} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[240px] truncate font-medium text-slate-100">{r.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold">
                            <span className={cn("rounded px-1.5 py-0.5", r.kind === "automation" ? "bg-purple-500/15 text-purple-300" : "bg-brand-500/15 text-brand-300")}>{kindLabel(r.kind)}</span>
                            {r.businessType && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-300">{businessLabel(r.businessType)}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-1.5">
                        <code className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-blue-400">{r.code}</code>
                        <button type="button" onClick={() => copy(r.code)} title="Havolani nusxalash" aria-label={`${r.name} havolasini nusxalash`} className={cn(ROW_ICON, "h-7 w-7 hover:bg-blue-500/10 hover:text-blue-400")}>
                          <Icon name={copied === r.code ? "check" : "copy"} className={cn("h-3.5 w-3.5", copied === r.code && "text-emerald-400")} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center tabular-nums text-slate-300">{nf(r.views)}</td>
                    <td className={cn("px-3 py-4 text-center font-bold tabular-nums", r.submissions ? "text-emerald-400" : "text-slate-500")}>{nf(r.submissions)}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-xs font-bold tabular-nums text-slate-200">{cvrLabel(r.cvr)}</span>
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.07]">
                          <span className="block h-full rounded-full bg-gradient-to-r from-[#ee7a24] to-[#f6b51e]" style={{ width: `${Math.min(100, r.cvr ?? 0)}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className={cn("px-3 py-4 text-center font-bold tabular-nums", r.won ? "text-orange-300" : "text-slate-500")}>{nf(r.won)}</td>
                    <td className="px-3 py-4 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.active}
                        aria-label={`${r.name} holati`}
                        disabled={pending}
                        onClick={() => toggle(r)}
                        className={cn("inline-flex items-center gap-1.5 text-xs font-medium", r.active ? "text-emerald-400" : "text-slate-400")}
                      >
                        <span className={cn("relative h-4 w-7 rounded-full transition", r.active ? "bg-emerald-500" : "bg-slate-600")}>
                          <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-[#f8fafc] transition-all", r.active ? "left-3.5" : "left-0.5")} />
                        </span>
                        {r.active ? "Faol" : "O'chiq"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-400">
                      <div>{dateOf(r.createdAt)}</div>
                      {r.lastLeadAt && <div className="mt-0.5 text-[11px] text-slate-500">Ariza: {dateOf(r.lastLeadAt)}</div>}
                    </td>
                    <td className="py-4 pl-3 pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <a href={`${urlOf(r.code)}?preview=1`} target="_blank" rel="noreferrer" title="Ochish (ko'rish hisoblanmaydi)" aria-label={`${r.name} havolasini ochish`} className={cn(ROW_ICON, "hover:bg-emerald-500/10 hover:text-emerald-400")}>
                          <Icon name="arrowUpRight" className="h-4 w-4" />
                        </a>
                        <button type="button" onClick={() => setQr(r)} title="QR kod" aria-label={`${r.name} QR kodi`} className={cn(ROW_ICON, "hover:bg-white/10 hover:text-slate-100")}>
                          <Icon name="grid" className="h-4 w-4" />
                        </button>
                        {confirming === r.code ? (
                          <button type="button" disabled={pending} onClick={() => remove(r)} className="h-8 rounded-lg bg-red-600 px-2.5 text-xs font-bold text-white hover:bg-red-700">O&apos;chirilsinmi?</button>
                        ) : (
                          <button
                            type="button"
                            disabled={!deletable}
                            onClick={() => setConfirming(r.code)}
                            title={deletable ? "O'chirish" : r.builtin ? "Asosiy havola o'chirilmaydi" : "Arizasi bor havola o'chirilmaydi, uni o'chirib qo'ying"}
                            aria-label={`${r.name} havolasini o'chirish`}
                            className={cn(ROW_ICON, "hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400")}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <CreateModal publicBase={publicBase} onClose={() => setCreating(false)} onCreated={() => router.refresh()} copy={copy} copied={copied} />}
      {qr && <QrModal row={qr} onClose={() => setQr(null)} />}
    </div>
  );
}
