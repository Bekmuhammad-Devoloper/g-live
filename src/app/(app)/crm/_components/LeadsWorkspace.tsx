"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { COLUMNS, columnDef, columnOf, type VLead } from "../_lib/leadColumns";
import { moveLeadStage } from "../actions";
import { type Analytics } from "./AnalyticsTiles";
import FilterBar from "./FilterBar";
import LeadsKanban from "./LeadsKanban";
import LeadsTable from "./LeadsTable";
import SelectionActionBar from "./SelectionActionBar";
import NewLeadForm from "../NewLeadForm";
import CommandPalette, { type PaletteAction } from "./CommandPalette";
import KeyboardHelpOverlay from "./KeyboardHelpOverlay";
import RejectReasonModal from "./modals/RejectReasonModal";
import EnrollDrawer from "./EnrollDrawer";

interface Opt { id: string; name: string }

interface Props {
  locale: Locale;
  initialLeads: VLead[];
  managers: Opt[];
  sources: string[];
  analytics: Analytics;
  canWrite: boolean;
}

export default function LeadsWorkspace({ locale, initialLeads, managers, sources, analytics, canWrite }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [leads, setLeads] = useState<VLead[]>(initialLeads);
  const [view, setView] = useState<"kanban" | "table">((params.get("view") as "kanban" | "table") || "kanban");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [source, setSource] = useState(params.get("source") ?? "");
  const [manager, setManager] = useState(params.get("manager") ?? "");
  const [activeCols, setActiveCols] = useState<Set<string>>(new Set((params.get("cols") ?? "").split(",").filter(Boolean)));
  const [selection, setSelection] = useState<Set<string>>(new Set((params.get("selected") ?? "").split(",").filter(Boolean)));
  const [create, setCreate] = useState<{ open: boolean; stage: string }>({ open: false, stage: "NEW" });
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [showPalette, setShowPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [reject, setReject] = useState<{ id: string; name: string } | null>(null);
  // Guruhga yo'naltirish paneli — "Qabul qilindi" uchun majburiy qadam
  const [enroll, setEnroll] = useState<{ id: string; name: string; groupId: string | null; editCount: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  // Server yangilanganda (router.refresh) mahalliy holatni sinxronlash
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams();
    if (view !== "kanban") p.set("view", view);
    if (search) p.set("q", search);
    if (source) p.set("source", source);
    if (manager) p.set("manager", manager);
    if (activeCols.size) p.set("cols", [...activeCols].join(","));
    if (selection.size) p.set("selected", [...selection].join(","));
    if (sort !== "newest") p.set("sort", sort);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    try { localStorage.setItem("crm-view", view); } catch {}
  }, [view, search, source, manager, activeCols, selection, sort, pathname, router]);

  // Filtrlash
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Raqamli qidiruv: telefon formatidagi bo'shliq/qavs/chiziqchalar solishtirishga xalaqit
    // bermasin — ikkala tomonni ham faqat raqamga tozalaymiz. Shunda raqamning
    // OXIRIDAN (masalan "0019") yoki o'rtasidan qidirsa ham topiladi.
    const qDigits = q.replace(/\D/g, "");
    return leads.filter((l) => {
      if (q) {
        const byText = `${l.fullName} ${l.phone}`.toLowerCase().includes(q);
        const byPhone = qDigits.length > 0 && (l.phone ?? "").replace(/\D/g, "").includes(qDigits);
        if (!byText && !byPhone) return false;
      }
      if (source && l.source !== source) return false;
      if (manager && l.managerId !== manager) return false;
      return true;
    });
  }, [leads, search, source, manager]);

  const chipCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const col of COLUMNS) c[col.key] = 0;
    for (const l of baseFiltered) c[columnOf(l.stage)] = (c[columnOf(l.stage)] ?? 0) + 1;
    return c;
  }, [baseFiltered]);

  const shown = useMemo(
    () => (activeCols.size ? baseFiltered.filter((l) => activeCols.has(columnOf(l.stage))) : baseFiltered),
    [baseFiltered, activeCols]
  );
  const shownTotals = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of shown) c[columnOf(l.stage)] = (c[columnOf(l.stage)] ?? 0) + 1;
    return c;
  }, [shown]);

  const sortedShown = useMemo(() => {
    const arr = [...shown];
    const time = (x: VLead) => new Date(x.createdAt).getTime();
    switch (sort) {
      case "oldest": arr.sort((a, b) => time(a) - time(b)); break;
      case "budget": arr.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)); break;
      case "name": arr.sort((a, b) => a.fullName.localeCompare(b.fullName)); break;
      case "activity": arr.sort((a, b) => b.activityCount - a.activityCount); break;
      default: arr.sort((a, b) => time(b) - time(a));
    }
    return arr;
  }, [shown, sort]);

  // Amallar
  const openLead = useCallback((id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelection((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
      return;
    }
    router.push(`/crm/${id}`);
  }, [router]);

  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleAll = useCallback(() => {
    setSelection((prev) => (prev.size === shown.length && shown.length > 0 ? new Set() : new Set(shown.map((l) => l.id))));
  }, [shown]);

  const onDropToColumn = useCallback((colKey: string, leadId: string) => {
    if (!canWrite) return;
    // Yo'qotilganga tashlash — sabab so'raladi
    if (colKey === "lost") {
      const lead = leads.find((l) => l.id === leadId);
      setReject({ id: leadId, name: lead?.fullName ?? "" });
      return;
    }
    // "Qabul qilindi" — guruh tanlanmaguncha bosqich o'zgarmaydi
    if (colKey === "won") {
      const lead = leads.find((l) => l.id === leadId);
      setEnroll({ id: leadId, name: lead?.fullName ?? "", groupId: lead?.groupId ?? null, editCount: lead?.enrollEditCount ?? 0 });
      return;
    }
    const target = columnDef(colKey).defaultStage;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: target } : l))); // optimistik
    startRefresh(async () => { await moveLeadStage(leadId, target); router.refresh(); });
  }, [canWrite, router, leads]);

  const confirmReject = useCallback((reason: string) => {
    if (!reject) return;
    const id = reject.id;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: "LOST" } : l)));
    setReject(null);
    startRefresh(async () => { await moveLeadStage(id, "LOST", reason); router.refresh(); });
  }, [reject, router]);

  const toggleCol = (key: string) => setActiveCols((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const clearFilters = () => { setSearch(""); setSource(""); setManager(""); setActiveCols(new Set()); };
  const hasFilters = !!(search || source || manager || activeCols.size);

  // Klaviatura yorliqlari
  useEffect(() => {
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setShowPalette((v) => !v); return; }
      const el = document.activeElement?.tagName;
      if (el === "INPUT" || el === "TEXTAREA" || el === "SELECT") { if (e.key === "Escape") (document.activeElement as HTMLElement).blur(); return; }
      if (gPending) {
        const map: Record<string, string> = { y: "new", i: "work", t: "offer", q: "won", r: "lost" };
        if (map[e.key]) setActiveCols(new Set([map[e.key]]));
        gPending = false;
        return;
      }
      if (e.key === "g") { gPending = true; clearTimeout(gTimer); gTimer = setTimeout(() => (gPending = false), 1000); return; }
      if (e.key === "?") { setShowHelp(true); return; }
      if (e.key === "/") { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="qidirish"]')?.focus(); return; }
      if (e.key === "v") { setView((v) => (v === "kanban" ? "table" : "kanban")); return; }
      if (e.key === "n" && canWrite) { setCreate({ open: true, stage: "NEW" }); return; }
      if (e.key === "r") { clearFilters(); return; }
      if (e.key === "Escape") { setSelection(new Set()); setShowHelp(false); setShowPalette(false); return; }
    };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); clearTimeout(gTimer); };
  }, [canWrite]);

  const paletteActions: PaletteAction[] = [
    { id: "view", label: view === "kanban" ? tr(locale, { uz: "Jadval ko'rinishi", ru: "Табличный вид", en: "Table view" }) : tr(locale, { uz: "Kanban ko'rinishi", ru: "Канбан-вид", en: "Kanban view" }), icon: view === "kanban" ? "listView" : "grid", run: () => setView((v) => (v === "kanban" ? "table" : "kanban")) },
    { id: "refresh", label: tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh" }), icon: "refresh", run: () => router.refresh() },
    ...(canWrite ? [{ id: "new", label: tr(locale, { uz: "Yangi lid", ru: "Новый лид", en: "New lead" }), icon: "plus", run: () => setCreate({ open: true, stage: "NEW" }) }] : []),
    ...COLUMNS.map((c) => ({ id: `f-${c.key}`, label: `${tr(locale, { uz: "Filter", ru: "Фильтр", en: "Filter" })}: ${tr(locale, c.label)}`, icon: c.icon, run: () => setActiveCols(new Set([c.key])) })),
    { id: "clear", label: tr(locale, { uz: "Filtrlarni tozalash", ru: "Очистить фильтры", en: "Clear filters" }), icon: "personX", run: clearFilters },
    { id: "help", label: tr(locale, { uz: "Klaviatura yorliqlari", ru: "Горячие клавиши", en: "Keyboard shortcuts" }), icon: "info", run: () => setShowHelp(true) },
  ];

  return (
    <div className="space-y-4">
      {/* Katta header karta */}
      <div className="rounded-2xl border border-slate-200 bg-[#ffffff] p-4 shadow-card dark:border-white/[0.08] dark:bg-[#15243d]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
              <Icon name="download" className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Lidlar bazasi", ru: "База лидов", en: "Leads database" })}</h1>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-500">{leads.length}</span>
              </div>
              <p className="text-xs text-slate-400">{tr(locale, { uz: "Barcha lidlar ro'yxati", ru: "Список всех лидов", en: "List of all leads" })}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Count pill-lar */}
            <div className="hidden items-center gap-1.5 xl:flex">
              {COLUMNS.map((c) => (
                <span key={c.key} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold" style={{ color: c.color, background: `${c.color}14` }}>
                  <Icon name={c.icon} className="h-3.5 w-3.5" /> {analytics.byColumn[c.key] ?? 0}
                </span>
              ))}
            </div>
            <button onClick={() => startRefresh(() => { router.refresh(); })} title={tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh" })} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.05]">
              <Icon name="refresh" className={cn("h-4 w-4", refreshing && "animate-spin")} /> <span className="hidden sm:inline">{tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh" })}</span>
            </button>
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/[0.1]">
              <ToggleBtn active={view === "kanban"} onClick={() => setView("kanban")} icon="grid" label="Kanban" />
              <ToggleBtn active={view === "table"} onClick={() => setView("table")} icon="listView" label={tr(locale, { uz: "Jadval", ru: "Таблица", en: "Table" })} />
            </div>
            {canWrite && (
              <button onClick={() => setCreate({ open: true, stage: "NEW" })} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <Icon name="plus" className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">{tr(locale, { uz: "Yangi lid", ru: "Новый лид", en: "New lead" })}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="mt-4">
          <FilterBar
            locale={locale}
            search={search} onSearch={setSearch}
            sources={sources} source={source} onSource={setSource}
            managers={managers} manager={manager} onManager={setManager}
            activeCols={activeCols} onToggleCol={toggleCol}
            counts={chipCounts} hasFilters={hasFilters} onClear={clearFilters}
            sort={sort} onSort={setSort}
          />
        </div>
      </div>

      {view === "kanban" ? (
        <LeadsKanban leads={sortedShown} totals={shownTotals} locale={locale} selected={selection} onOpen={openLead} onDropToColumn={onDropToColumn} onAdd={(stage) => setCreate({ open: true, stage })} />
      ) : (
        <LeadsTable leads={sortedShown} locale={locale} selected={selection} onToggle={(id) => toggleSelect(id)} onOpen={openLead} allSelected={selection.size === shown.length && shown.length > 0} onToggleAll={toggleAll} />
      )}

      {canWrite && <SelectionActionBar ids={[...selection]} managers={managers} locale={locale} onDone={() => setSelection(new Set())} />}
      {canWrite && <NewLeadForm locale={locale} open={create.open} onClose={() => setCreate((c) => ({ ...c, open: false }))} defaultStage={create.stage} />}

      <CommandPalette locale={locale} open={showPalette} onClose={() => setShowPalette(false)} leads={leads} actions={paletteActions} onOpenLead={(id) => router.push(`/crm/${id}`)} />
      <KeyboardHelpOverlay locale={locale} open={showHelp} onClose={() => setShowHelp(false)} />
      <RejectReasonModal locale={locale} open={!!reject} leadName={reject?.name ?? ""} onClose={() => setReject(null)} onConfirm={confirmReject} pending={refreshing} />

      {enroll && (
        <EnrollDrawer
          locale={locale}
          open
          leadId={enroll.id}
          leadName={enroll.name}
          currentGroupId={enroll.groupId}
          editCount={enroll.editCount}
          onClose={() => setEnroll(null)}
          onDone={(msg) => { setEnroll(null); setFlash(msg); router.refresh(); setTimeout(() => setFlash(null), 4000); }}
        />
      )}

      {flash && (
        <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {flash}
        </div>
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition", active ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700")}>
      <Icon name={icon} className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
