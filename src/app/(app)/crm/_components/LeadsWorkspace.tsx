"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { COLUMNS, branchIdOfCol, branchReplaces, columnDef, columnOf, columnOfLead, customIdOfCol, groupIdOfCol, isBranchCol, isCustomCol, isGroupCol, type BranchColumn, type BranchMode, type BranchModeCfg, type CustomColumn, type GroupColumn, type VLead } from "../_lib/leadColumns";
import { deleteTestLead, dropLeadToBranch, enrollLeadToGroup, moveLeadStage, moveLeadToColumn, removeKanbanColumn, unpinKanbanGroup } from "../actions";
import { type Analytics } from "./AnalyticsTiles";
import FilterBar from "./FilterBar";
import LeadsKanban from "./LeadsKanban";
import LeadsTable from "./LeadsTable";
import SelectionActionBar from "./SelectionActionBar";
import NewLeadForm from "../NewLeadForm";
import CommandPalette, { type PaletteAction } from "./CommandPalette";
import KeyboardHelpOverlay from "./KeyboardHelpOverlay";
import RejectReasonModal from "./modals/RejectReasonModal";
import DeleteLeadModal from "./modals/DeleteLeadModal";
import LevelTestQrModal from "./modals/LevelTestQrModal";
import WonAddDrawer from "./WonAddDrawer";
import GroupLeadPicker from "./GroupLeadPicker";
import EnrollDrawer from "./EnrollDrawer";
import LeadQuickView from "./LeadQuickView";
import { useDoubleClickOpen } from "../../_components/useDoubleClickOpen";

interface Opt { id: string; name: string }

interface Props {
  locale: Locale;
  initialLeads: VLead[];
  managers: Opt[];
  sources: string[];
  analytics: Analytics;
  canWrite: boolean;
  /** Lidni Kanbandan o'chirish huquqi (direktor / o'rinbosari / admin) */
  canDelete?: boolean;
  /** Kanbanga biriktirilgan guruh ustunlari */
  initialGroupColumns: GroupColumn[];
  /** Oddiy nomli ustunlar */
  initialCustomColumns: CustomColumn[];
  /** Filial rejimi — filial ustunlari (null — odatdagi kanban) */
  branchColumns?: BranchColumn[] | null;
  /** "sales" (ROP/admin) yoki "head" (direktor) — leadColumns.ts */
  branchMode?: BranchMode | null;
  /** Bo'sh vaqtlarni tahrirlash: "all" — hamma filial, filial id — faqat o'sha, null — yo'q */
  slotsEditable?: "all" | string | null;
}

export default function LeadsWorkspace({ locale, initialLeads, managers, sources, analytics, canWrite, canDelete = false, initialGroupColumns, initialCustomColumns, branchColumns = null, branchMode = null, slotsEditable = null }: Props) {
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
  const [create, setCreate] = useState<{ open: boolean; stage: string; column: CustomColumn | null }>({ open: false, stage: "NEW", column: null });
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [showPalette, setShowPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [reject, setReject] = useState<{ id: string; name: string } | null>(null);
  // Kanbandan o'chirish — tasdiqlash oynasi
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  // Guruhga yo'naltirish paneli — "Qabul qilindi" uchun majburiy qadam
  const [enroll, setEnroll] = useState<{ id: string; name: string; groupId: string | null; editCount: number } | null>(null);
  // "Qabul qilindi" ustunidagi "+" — guruh biriktirish yoki yangi o'quvchi
  const [wonAdd, setWonAdd] = useState(false);
  // Sarlavhadagi "+ Qo'shish" va standart ustunlardagi "+" — guruh ustuni /
  // oddiy ustun / yangi lid. `stage` — qaysi ustundan bosilgani (yangi lid
  // formasi shu bosqich bilan ochiladi).
  const [mainAdd, setMainAdd] = useState<{ open: boolean; stage: string }>({ open: false, stage: "NEW" });
  // "Daraja testi" ustunidagi QR oynasi
  const [testQr, setTestQr] = useState(false);
  // Kanbanga biriktirilgan guruhlar (ustun bo'lib chiqadi)
  const [groupColumns, setGroupColumns] = useState<GroupColumn[]>(initialGroupColumns);
  // Oddiy nomli ustunlar
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(initialCustomColumns);
  // Guruh ustunidagi "+" — mavjud lidni shu guruhga biriktirish
  const [pickForGroup, setPickForGroup] = useState<string | null>(null);
  // Yonboshdan ochiladigan tezkor ko'rish oynasi (1 marta bosilganda)
  const [quickId, setQuickId] = useState<string | null>(null);
  const { single, double, cancel: cancelOpen } = useDoubleClickOpen();
  const [flash, setFlash] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  // Server yangilanganda (router.refresh) mahalliy holatni sinxronlash
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);
  useEffect(() => { setGroupColumns(initialGroupColumns); }, [initialGroupColumns]);
  useEffect(() => { setCustomColumns(initialCustomColumns); }, [initialCustomColumns]);

  const pinnedIds = useMemo(() => new Set(groupColumns.map((g) => g.groupId)), [groupColumns]);
  const customIds = useMemo(() => new Set(customColumns.map((c) => c.id)), [customColumns]);
  const branchCfg = useMemo<BranchModeCfg | null>(
    () => (branchColumns && branchMode ? { ids: new Set(branchColumns.map((b) => b.branchId)), mode: branchMode } : null),
    [branchColumns, branchMode],
  );

  // URL sync — `router.replace` har o'zgarishda (har bir terilgan harfda ham) serverga
  // borib sahifani qayta render qilardi: 2000 lid qayta yuklanib, butun Kanban qayta
  // chizilardi. `history.replaceState` Next router bilan sinxron, lekin serverga bormaydi.
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
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (window.location.pathname + window.location.search !== url) {
      window.history.replaceState(null, "", url);
    }
    try { localStorage.setItem("crm-view", view); } catch {}
  }, [view, search, source, manager, activeCols, selection, sort, pathname]);

  // Filtrlash — qidiruv matni kechiktirilgan: kiritish maydoni darhol javob beradi,
  // ro'yxat esa brauzer bo'shaganda qayta hisoblanadi
  const deferredSearch = useDeferredValue(search);
  const baseFiltered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
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
  }, [leads, deferredSearch, source, manager]);

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
    for (const l of shown) {
      const k = columnOfLead(l, pinnedIds, customIds, branchCfg);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [shown, pinnedIds, customIds, branchCfg]);

  // Sana bir marta parse qilinadi — saralash har solishtirishda `new Date` qilmaydi
  const tsOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) m.set(l.id, new Date(l.createdAt).getTime());
    return m;
  }, [leads]);

  const sortedShown = useMemo(() => {
    const arr = [...shown];
    const time = (x: VLead) => tsOf.get(x.id) ?? 0;
    switch (sort) {
      case "oldest": arr.sort((a, b) => time(a) - time(b)); break;
      case "budget": arr.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)); break;
      case "name": arr.sort((a, b) => a.fullName.localeCompare(b.fullName)); break;
      case "activity": arr.sort((a, b) => b.activityCount - a.activityCount); break;
      default: arr.sort((a, b) => time(b) - time(a));
    }
    return arr;
  }, [shown, sort, tsOf]);

  // Tezkor oyna uchun lid — ro'yxat yangilansa avtomatik yopiladi
  const quickLead = useMemo(() => (quickId ? leads.find((l) => l.id === quickId) ?? null : null), [quickId, leads]);

  // Amallar
  // 1 marta bosish -> yonbosh tezkor ko'rish oynasi
  // 2 marta bosish -> lidning to'liq sahifasi (/crm/[id])
  // Ctrl/Cmd + bosish -> avvalgidek belgilash (kechiktirmasdan)
  const openLead = useCallback((id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      cancelOpen();
      setSelection((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
      return;
    }
    single(() => setQuickId(id));
  }, [single, cancelOpen]);

  const openLeadFull = useCallback((id: string) => {
    double(() => router.push(`/crm/${id}`));
  }, [double, router]);

  const toggleSelect = useCallback((id: string) => {
    setSelection((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleAll = useCallback(() => {
    setSelection((prev) => (prev.size === shown.length && shown.length > 0 ? new Set() : new Set(shown.map((l) => l.id))));
  }, [shown]);

  /**
   * Lidni guruhga yozish — guruh ustuniga tashlanganda ham, ustundagi "+"
   * orqali tanlanganda ham shu chaqiriladi. Guruh biriktirilishi bilan lid
   * "Qabul qilindi" bosqichiga o'tadi, shuning uchun alohida qadam kerak emas.
   */
  const enrollToGroup = useCallback((leadId: string, groupId: string) => {
    const gname = groupColumns.find((g) => g.groupId === groupId)?.name ?? "";
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: "WON", groupId, groupName: gname } : l))); // optimistik
    startRefresh(async () => {
      const r = await enrollLeadToGroup(leadId, groupId);
      if (r.error) {
        // Server rad etdi — ko'rinishni haqiqatga qaytaramiz
        setLeads(initialLeads);
        setFlash(
          r.error === "group_full"
            ? tr(locale, { uz: "Guruh to'lgan", ru: "Группа заполнена", en: "The group is full", de: "Die Gruppe ist voll" })
            : r.error === "edit_limit"
              ? tr(locale, { uz: "Guruhni faqat bir marta o'zgartirish mumkin", ru: "Группу можно сменить только один раз", en: "The group can only be changed once", de: "Die Gruppe kann nur einmal geaendert werden" })
              : tr(locale, { uz: "Biriktirib bo'lmadi", ru: "Не удалось привязать", en: "Could not enrol", de: "Einschreiben fehlgeschlagen" }),
        );
      } else {
        setFlash(tr(locale, { uz: `Guruhga yozildi: ${r.groupName ?? gname}`, ru: `Записан в группу: ${r.groupName ?? gname}`, en: `Enrolled in ${r.groupName ?? gname}`, de: `Eingeschrieben: ${r.groupName ?? gname}` }));
      }
      router.refresh();
      setTimeout(() => setFlash(null), 4000);
    });
  }, [groupColumns, initialLeads, locale, router]);

  const onDropToColumn = useCallback((colKey: string, leadId: string) => {
    if (!canWrite) return;
    // Guruh ustuni — lid to'g'ridan-to'g'ri o'sha guruhga yoziladi
    if (isGroupCol(colKey)) {
      enrollToGroup(leadId, groupIdOfCol(colKey));
      return;
    }
    // Filial ustuni (ROP) — lid shu filialga yo'naltiriladi; ishlov boshida bo'lsa "Taklif"ga o'tadi
    if (isBranchCol(colKey)) {
      const branchId = branchIdOfCol(colKey);
      const bname = branchColumns?.find((b) => b.branchId === branchId)?.name ?? "";
      setLeads((prev) => prev.map((l) => (l.id === leadId
        ? { ...l, branchId, branchName: bname, kanbanColumnId: null, stage: ["NEW", "IN_PROGRESS", "CONTACTED", "TEST"].includes(l.stage) ? "OFFER" : l.stage }
        : l))); // optimistik
      startRefresh(async () => {
        const r = await dropLeadToBranch(leadId, branchId);
        if (r.error) setLeads(initialLeads);
        else { setFlash(tr(locale, { uz: `Filialga yo'naltirildi: ${bname}`, ru: `Направлен в филиал: ${bname}`, en: `Directed to ${bname}`, de: `An Filiale weitergeleitet: ${bname}` })); setTimeout(() => setFlash(null), 3000); }
        router.refresh();
      });
      return;
    }
    // Oddiy nomli ustun — bosqich o'zgarmaydi, faqat ustun belgilanadi
    if (isCustomCol(colKey)) {
      const colId = customIdOfCol(colKey);
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, kanbanColumnId: colId } : l))); // optimistik
      startRefresh(async () => {
        const r = await moveLeadToColumn(leadId, colId);
        if (r.error) setLeads(initialLeads);
        router.refresh();
      });
      return;
    }
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
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: target, kanbanColumnId: null } : l))); // optimistik
    startRefresh(async () => { await moveLeadStage(leadId, target); router.refresh(); });
  }, [canWrite, router, leads, enrollToGroup, initialLeads, branchColumns, locale]);

  const confirmReject = useCallback((reason: string) => {
    if (!reject) return;
    const id = reject.id;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: "LOST", kanbanColumnId: null } : l)));
    setReject(null);
    startRefresh(async () => { await moveLeadStage(id, "LOST", reason); router.refresh(); });
  }, [reject, router]);

  // Tezkor o'chirish faqat "Daraja testi" (TEST) lidlari uchun — ishdagi lidlar
  // to'liq sahifadan, ism yozib tasdiqlab o'chiriladi
  const askDelete = useCallback((id: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || columnOf(lead.stage) !== "test") return;
    setQuickId(null);
    setDel({ id, name: lead.fullName });
  }, [leads]);

  const confirmDelete = useCallback(() => {
    if (!del) return;
    const { id, name } = del;
    startRefresh(async () => {
      const r = await deleteTestLead(id);
      if (r.ok) {
        setDel(null);
        setLeads((prev) => prev.filter((l) => l.id !== id));
        setSelection((prev) => { const n = new Set(prev); n.delete(id); return n; });
        setFlash(tr(locale, { uz: `O'chirildi: ${name}`, ru: `Удалено: ${name}`, en: `Deleted: ${name}`, de: `Gelöscht: ${name}` }));
      } else {
        setDel(null);
        setFlash(r.error === "forbidden"
          ? tr(locale, { uz: "Sizda o'chirish huquqi yo'q", ru: "У вас нет прав на удаление", en: "You do not have permission to delete", de: "Keine Berechtigung zum Löschen" })
          : r.error === "not_test"
            ? tr(locale, { uz: "Faqat \"Daraja testi\" bosqichidagi lid shu yerdan o'chiriladi", ru: "Здесь удаляются только лиды на этапе «Тест уровня»", en: "Only leads at the \"Level test\" stage can be deleted here", de: "Hier können nur Leads in der Phase „Einstufungstest“ gelöscht werden" })
            : tr(locale, { uz: "O'chirib bo'lmadi", ru: "Не удалось удалить", en: "Could not delete", de: "Löschen fehlgeschlagen" }));
      }
      router.refresh();
      setTimeout(() => setFlash(null), 4000);
    });
  }, [del, locale, router]);

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
        const map: Record<string, string> = { y: "new", i: "work", d: "test", t: "offer", q: "won", r: "lost" };
        if (map[e.key]) setActiveCols(new Set([map[e.key]]));
        gPending = false;
        return;
      }
      if (e.key === "g") { gPending = true; clearTimeout(gTimer); gTimer = setTimeout(() => (gPending = false), 1000); return; }
      if (e.key === "?") { setShowHelp(true); return; }
      if (e.key === "/") { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="qidirish"]')?.focus(); return; }
      if (e.key === "v") { setView((v) => (v === "kanban" ? "table" : "kanban")); return; }
      if (e.key === "n" && canWrite) { setCreate({ open: true, stage: "NEW", column: null }); return; }
      if (e.key === "r") { clearFilters(); return; }
      if (e.key === "Escape") { setSelection(new Set()); setShowHelp(false); setShowPalette(false); return; }
    };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); clearTimeout(gTimer); };
  }, [canWrite]);

  const paletteActions: PaletteAction[] = [
    { id: "view", label: view === "kanban" ? tr(locale, { uz: "Jadval ko'rinishi", ru: "Табличный вид", en: "Table view", de: "Tabellenansicht" }) : tr(locale, { uz: "Kanban ko'rinishi", ru: "Канбан-вид", en: "Kanban view", de: "Kanban-Ansicht" }), icon: view === "kanban" ? "listView" : "grid", run: () => setView((v) => (v === "kanban" ? "table" : "kanban")) },
    { id: "refresh", label: tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" }), icon: "refresh", run: () => router.refresh() },
    ...(canWrite ? [{ id: "new", label: tr(locale, { uz: "Yangi lid", ru: "Новый лид", en: "New lead", de: "Neuer Lead" }), icon: "plus", run: () => setCreate({ open: true, stage: "NEW", column: null }) }] : []),
    ...COLUMNS.map((c) => ({ id: `f-${c.key}`, label: `${tr(locale, { uz: "Filter", ru: "Фильтр", en: "Filter", de: "Filter" })}: ${tr(locale, c.label)}`, icon: c.icon, run: () => setActiveCols(new Set([c.key])) })),
    { id: "clear", label: tr(locale, { uz: "Filtrlarni tozalash", ru: "Очистить фильтры", en: "Clear filters", de: "Filter zurücksetzen" }), icon: "personX", run: clearFilters },
    { id: "testqr", label: tr(locale, { uz: "Daraja testi QR kodi", ru: "QR-код теста уровня", en: "Level test QR code", de: "QR-Code des Einstufungstests" }), icon: "qr", run: () => setTestQr(true) },
    { id: "help", label: tr(locale, { uz: "Klaviatura yorliqlari", ru: "Горячие клавиши", en: "Keyboard shortcuts", de: "Tastenkürzel" }), icon: "info", run: () => setShowHelp(true) },
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
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Lidlar bazasi", ru: "База лидов", en: "Leads database", de: "Lead-Datenbank" })}</h1>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-500">{leads.length}</span>
              </div>
              <p className="text-xs text-slate-400">{tr(locale, { uz: "Barcha lidlar ro'yxati", ru: "Список всех лидов", en: "List of all leads", de: "Liste aller Leads" })}</p>
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
            <button onClick={() => startRefresh(() => { router.refresh(); })} title={tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.05]">
              <Icon name="refresh" className={cn("h-4 w-4", refreshing && "animate-spin")} /> <span className="hidden sm:inline">{tr(locale, { uz: "Yangilash", ru: "Обновить", en: "Refresh", de: "Aktualisieren" })}</span>
            </button>
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/[0.1]">
              <ToggleBtn active={view === "kanban"} onClick={() => setView("kanban")} icon="grid" label="Kanban" />
              <ToggleBtn active={view === "table"} onClick={() => setView("table")} icon="listView" label={tr(locale, { uz: "Jadval", ru: "Таблица", en: "Table", de: "Tabelle" })} />
            </div>
            {canWrite && (
              // Tanlov paneli: guruh ustuni / oddiy nomli ustun / yangi lid
              <button onClick={() => setMainAdd({ open: true, stage: "NEW" })} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <Icon name="plus" className="h-[18px] w-[18px]" /> <span className="hidden sm:inline">{tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })}</span>
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
            hiddenCols={branchMode ? branchReplaces(branchMode) : undefined}
            counts={chipCounts} hasFilters={hasFilters} onClear={clearFilters}
            sort={sort} onSort={setSort}
          />
        </div>
      </div>

      {view === "kanban" ? (
        <LeadsKanban leads={sortedShown} totals={shownTotals} locale={locale} selected={selection} onOpen={openLead} onOpenFull={openLeadFull} onDropToColumn={onDropToColumn}
          groupColumns={groupColumns}
          customColumns={customColumns}
          onAdd={(stage) => (stage === "WON" ? setWonAdd(true) : setMainAdd({ open: true, stage }))}
          onAddToGroup={(groupId) => setPickForGroup(groupId)}
          onRemoveGroupCol={(groupId) => {
            setGroupColumns((prev) => prev.filter((g) => g.groupId !== groupId));
            startRefresh(async () => { await unpinKanbanGroup(groupId); router.refresh(); });
          }}
          onAddToCustom={(columnId) => {
            const col = customColumns.find((c) => c.id === columnId) ?? null;
            setCreate({ open: true, stage: "NEW", column: col });
          }}
          onRemoveCustomCol={(columnId) => {
            // Ustun yo'qoladi, undagi lidlar o'z bosqichi ustuniga qaytadi
            setCustomColumns((prev) => prev.filter((c) => c.id !== columnId));
            setLeads((prev) => prev.map((l) => (l.kanbanColumnId === columnId ? { ...l, kanbanColumnId: null } : l)));
            startRefresh(async () => { await removeKanbanColumn(columnId); router.refresh(); });
          }}
          onLevelTestQr={() => setTestQr(true)}
          onDelete={canDelete ? askDelete : undefined}
          branchColumns={branchColumns}
          branchMode={branchMode}
          slotsEditable={slotsEditable}
        />
      ) : (
        <LeadsTable leads={sortedShown} locale={locale} selected={selection} onToggle={(id) => toggleSelect(id)} onOpen={openLead} onOpenFull={openLeadFull} allSelected={selection.size === shown.length && shown.length > 0} onToggleAll={toggleAll} />
      )}

      {canWrite && <SelectionActionBar ids={[...selection]} managers={managers} locale={locale} canDelete={canDelete} onDone={() => setSelection(new Set())} />}
      {canWrite && <NewLeadForm locale={locale} open={create.open} onClose={() => setCreate((c) => ({ ...c, open: false }))} defaultStage={create.stage} defaultColumn={create.column} />}

      <CommandPalette locale={locale} open={showPalette} onClose={() => setShowPalette(false)} leads={leads} actions={paletteActions} onOpenLead={(id) => router.push(`/crm/${id}`)} />
      <KeyboardHelpOverlay locale={locale} open={showHelp} onClose={() => setShowHelp(false)} />
      <RejectReasonModal locale={locale} open={!!reject} leadName={reject?.name ?? ""} onClose={() => setReject(null)} onConfirm={confirmReject} pending={refreshing} />
      <DeleteLeadModal locale={locale} open={!!del} leadName={del?.name ?? ""} onClose={() => setDel(null)} onConfirm={confirmDelete} pending={refreshing} />
      <LevelTestQrModal locale={locale} open={testQr} onClose={() => setTestQr(false)} />

      {canWrite && (
        <WonAddDrawer
          locale={locale}
          open={wonAdd}
          pinned={groupColumns}
          onClose={() => setWonAdd(false)}
          onNewLead={() => setCreate({ open: true, stage: "WON", column: null })}
          onPinned={(cols) => { setGroupColumns(cols); router.refresh(); }}
        />
      )}

      {canWrite && (
        <WonAddDrawer
          locale={locale}
          variant="main"
          open={mainAdd.open}
          pinned={groupColumns}
          customColumns={customColumns}
          onClose={() => setMainAdd((m) => ({ ...m, open: false }))}
          onNewLead={() => setCreate({ open: true, stage: mainAdd.stage, column: null })}
          onPinned={(cols) => { setGroupColumns(cols); router.refresh(); }}
          onColumnCreated={(cols) => {
            setCustomColumns(cols);
            setFlash(tr(locale, { uz: "Ustun yaratildi", ru: "Столбец создан", en: "Column created", de: "Spalte erstellt" }));
            setTimeout(() => setFlash(null), 3000);
            router.refresh();
          }}
        />
      )}

      {canWrite && pickForGroup && (
        <GroupLeadPicker
          locale={locale}
          leads={leads}
          pinnedIds={pinnedIds}
          group={groupColumns.find((g) => g.groupId === pickForGroup) ?? null}
          onClose={() => setPickForGroup(null)}
          onPick={(leadId) => { enrollToGroup(leadId, pickForGroup); setPickForGroup(null); }}
        />
      )}

      {quickLead && (
        <LeadQuickView
          lead={quickLead}
          locale={locale}
          canWrite={canWrite}
          onClose={() => setQuickId(null)}
          onEnroll={() => {
            setQuickId(null);
            setEnroll({ id: quickLead.id, name: quickLead.fullName, groupId: quickLead.groupId, editCount: quickLead.enrollEditCount });
          }}
          onDelete={canDelete && columnOf(quickLead.stage) === "test" ? () => askDelete(quickLead.id) : undefined}
        />
      )}

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
