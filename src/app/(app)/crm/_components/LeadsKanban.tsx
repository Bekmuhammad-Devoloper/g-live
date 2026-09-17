"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { ARCHIVE_COL, ONLINE_COL, isStudentArchive, columnOfLead, visibleColumns, branchColKey, slotDropKey, type BranchColumn, type BranchMode, type BranchModeCfg, type CustomColumn, type GroupColumn, type GroupInfo, type VLead } from "../_lib/leadColumns";
import LeadCard from "./LeadCard";
import BranchSlotsEditor from "../../branches/slots/BranchSlotsEditor";

interface Props {
  leads: VLead[];
  totals: Record<string, number>;
  locale: Locale;
  selected: Set<string>;
  /** Kanbanga biriktirilgan guruhlar — har biri alohida ustun */
  groupColumns: GroupColumn[];
  /** Oddiy nomli ustunlar — "Taklif" dan keyin turadi */
  customColumns: CustomColumn[];
  onOpen: (id: string, e: React.MouseEvent) => void;
  /** Ikki marta bosilganda — lidning to'liq sahifasi */
  onOpenFull: (id: string) => void;
  onDropToColumn: (columnKey: string, leadId: string) => void;
  onAdd: (defaultStage: string) => void;
  /** Guruh ustunidagi "+" — mavjud lidni shu guruhga biriktirish */
  onAddToGroup: (groupId: string) => void;
  /** Guruh ustunini olib tashlash (o'quvchilar guruhda qoladi) */
  onRemoveGroupCol: (groupId: string) => void;
  /** Oddiy ustundagi "+" — shu ustunga yangi lid */
  onAddToCustom: (columnId: string) => void;
  /** Oddiy ustunni o'chirish (lidlar o'z bosqichiga qaytadi) */
  onRemoveCustomCol: (columnId: string) => void;
  /** "Daraja testi" ustunidagi QR — test sayti havolasini ko'rsatish */
  onLevelTestQr: () => void;
  /** Kartadagi savatcha — lidni o'chirish (huquqi bo'lganlarga beriladi) */
  onDelete?: (id: string) => void;
  /** Filial rejimi: filial ustunlari (null — odatdagi kanban) */
  branchColumns?: BranchColumn[] | null;
  /** Guruh kartalari uchun holat (o'quvchilar / sig'im / jadval) */
  groupInfo?: Record<string, GroupInfo>;
  /** "sales" — test/taklif o'rnida; "head" — faqat taklif o'rnida (leadColumns.ts) */
  branchMode?: BranchMode | null;
  /** "Onlayn" ustuni (filial administratorida ko'rsatilmaydi) */
  showOnlineCol?: boolean;
  /** Ko'rsatilmaydigan standart ustunlar (ROP: "work", "won") */
  hiddenCols?: string[];
  /** Bo'sh vaqtlarni tahrirlash: "all" | filial id | null */
  slotsEditable?: "all" | string | null;
  /** Ustunni bo'shatish — ustundagi barcha lidlarni Yangiga qaytarish (huquqi bo'lsa) */
  onResetColumn?: (leadIds: string[], title: string) => void;
}

/** Har ustunda dastlab shuncha karta chiziladi — qolgani "Yana ko'rsatish" bilan.
 *  Aks holda 2000 lid = 2000 karta × ~10 SVG bir vaqtda DOM'ga tushib, sahifa qotib qolardi. */
const PAGE = 40;

export default function LeadsKanban({
  leads, totals, locale, selected, groupColumns, customColumns,
  onOpen, onOpenFull, onDropToColumn, onAdd, onAddToGroup, onRemoveGroupCol, onAddToCustom, onRemoveCustomCol, onLevelTestQr, branchColumns = null, groupInfo = {}, branchMode = null, showOnlineCol = true, hiddenCols = [], slotsEditable = null, onResetColumn, onDelete,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  // Ustun kaliti → hozir ko'rsatilayotgan kartalar soni
  const [limits, setLimits] = useState<Record<string, number>>({});
  const showMore = useCallback((key: string) => setLimits((p) => ({ ...p, [key]: (p[key] ?? PAGE) + PAGE })), []);

  const pinnedIds = useMemo(() => new Set(groupColumns.map((g) => g.groupId)), [groupColumns]);
  const customIds = useMemo(() => new Set(customColumns.map((c) => c.id)), [customColumns]);
  const branchCfg = useMemo<BranchModeCfg | null>(
    () => (branchColumns && branchMode ? { ids: new Set(branchColumns.map((b) => b.branchId)), mode: branchMode, online: showOnlineCol } : null),
    [branchColumns, branchMode, showOnlineCol],
  );

  // Tartib: standart 4 ta → oddiy nomli ustunlar → "Qabul qilindi" → guruh ustunlari → "Yo'qotilgan"
  const cols = useMemo(
    () => visibleColumns({ locale, groupColumns, customColumns, branchColumns, branchMode, showOnlineCol, hiddenCols }),
    [locale, groupColumns, customColumns, branchColumns, branchMode, showOnlineCol, hiddenCols],
  );

  const colOf = useCallback((l: VLead) => columnOfLead(l, pinnedIds, customIds, branchCfg), [pinnedIds, customIds, branchCfg]);

  const byCol = useMemo(() => {
    const m: Record<string, VLead[]> = {};
    for (const c of cols) m[c.key] = [];
    for (const l of leads) (m[colOf(l)] ??= []).push(l);
    return m;
  }, [cols, leads, colOf]);

  // Barqaror callback'lar — memo qilingan LeadCard'lar bekorga qayta chizilmasin
  const onDragStart = useCallback((id: string, e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(id);
  }, []);
  const onDragEnd = useCallback(() => { setDragId(null); setOverCol(null); }, []);

  // Filial ustunidagi "+" — yangi lid "Taklif" bosqichi bilan (filialni keyin tashlab belgilaydi)
  const onDropToColumnHint = () => onAdd("OFFER");

  const dragging = dragId ? leads.find((l) => l.id === dragId) ?? null : null;
  const draggingCol = dragging ? colOf(dragging) : null;

  return (
    <div
      className={cn(
        "grid auto-cols-[minmax(272px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4",
        // Qo'shimcha ustunlar bo'lsa 6 ta ustunga sig'maydi — gorizontal scroll qoladi
        groupColumns.length === 0 && customColumns.length === 0 && !branchColumns && "xl:grid-flow-row xl:grid-cols-6",
      )}
    >
      {cols.map((col) => {
        const items = byCol[col.key] ?? [];
        const isOver = overCol === col.key;
        const differentCol = draggingCol !== null && draggingCol !== col.key;
        const limit = limits[col.key] ?? PAGE;
        return (
          <div
            key={col.key}
            // Har doim preventDefault — aks holda brauzer drop'ga ruxsat bermaydi
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (differentCol) setOverCol(col.key); }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragId;
              const lead = id ? leads.find((l) => l.id === id) : null;
              if (id && lead && colOf(lead) !== col.key) onDropToColumn(col.key, id);
              setDragId(null);
              setOverCol(null);
            }}
            className={cn("min-w-0 rounded-2xl p-2.5 transition", isOver ? "bg-slate-100/70 dark:bg-white/[0.03]" : "")}
          >
            {/* Sarlavha */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: col.color, background: `${col.color}1f` }}>
                  <Icon name={col.icon} className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  {/* Bir qator, qo'lda yozilgan shrift — nom tor ustunga ham sig'adi.
                      Caveat baland shrift: qator balandligi tor bo'lsa `truncate` harflarning
                      ustki qismini (i nuqtasi, k/l tepasi) kesib qo'yadi — shuning uchun leading keng */}
                  <span className="font-hand block truncate text-[17px] font-bold leading-[1.35] text-slate-700 dark:text-slate-100">{col.title}</span>
                  {col.sub && <span className="block truncate text-[11px] text-slate-400">{col.sub}</span>}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-sm font-bold" style={{ color: col.color }}>{totals[col.key] ?? items.length}</span>
                {onResetColumn && col.key !== "new" && items.length > 0 && (
                  // Ustunni bo'shatish — hamma lid "Yangi"ga (tasdiq so'raladi)
                  <button
                    onClick={() => onResetColumn(items.map((l) => l.id), col.title)}
                    title={tr(locale, { uz: "Barchasini Yangiga qaytarish", ru: "Вернуть все в «Новые»", en: "Return all to New", de: "Alle zurück zu Neu" })}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-white/[0.06]"
                  >
                    <Icon name="backspace" className="h-4 w-4" />
                  </button>
                )}
                {col.key === "test" && (
                  // QR — lid telefonida skan qiladi, daraja aniqlash testi saytiga o'tadi
                  <button
                    onClick={onLevelTestQr}
                    title={tr(locale, { uz: "Daraja testi QR kodi", ru: "QR-код теста уровня", en: "Level test QR code", de: "QR-Code des Einstufungstests" })}
                    className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-slate-200/60 dark:hover:bg-white/[0.06]"
                    style={{ color: col.color }}
                  >
                    <Icon name="qr" className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                )}
                <button
                  onClick={() => (col.customId ? onAddToCustom(col.customId) : col.groupId ? onAddToGroup(col.groupId) : col.branch ? onDropToColumnHint() : onAdd(col.defaultStage))}
                  title={tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add", de: "Hinzufügen" })}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-white/[0.06]"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </button>
                {(col.groupId || col.customId) && (
                  <button
                    onClick={() => (col.customId ? onRemoveCustomCol(col.customId) : onRemoveGroupCol(col.groupId!))}
                    title={tr(locale, { uz: "Ustunni olib tashlash", ru: "Убрать столбец", en: "Remove column", de: "Spalte entfernen" })}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-white/[0.06]"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Gradient chiziq */}
            <div className="mx-1 mb-3 mt-2 h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${col.color}, ${col.color}22)` }} />

            {/* Filial ustuni: bo'sh xona / vaqtlar — administrator kiritgan, har biri alohida karta.
                Lid xona kartasiga tashlanadi va uning ichida ko'rinadi; xonasiz lidlar pastda. */}
            {col.branch && (
              <div className="mb-3 space-y-3">
                <SectionLabel
                  icon="clock"
                  color="#10b981"
                  text={tr(locale, { uz: "Bo'sh xona / vaqt", ru: "Свободные аудитории / время", en: "Free rooms / time", de: "Freie Räume / Zeit" })}
                  count={col.branch.slots.length}
                />
                <BranchSlotsEditor
                  branchId={col.branch.branchId}
                  initial={col.branch.slots}
                  canEdit={slotsEditable === "all" || slotsEditable === col.branch.branchId}
                  locale={locale}
                  compact
                  cards
                  color={col.color}
                  slotCount={(slotId) => items.filter((l) => l.branchSlotId === slotId).length}
                  slotContent={(slotId) => {
                    const inSlot = items.filter((l) => l.branchSlotId === slotId);
                    if (inSlot.length === 0) return null;
                    // Oddiy lid kartalari — ustundagilar bilan bir xil o'lcham va ko'rinish
                    return (
                      <div className="space-y-3">
                        {inSlot.map((l) => (
                          <LeadCard key={l.id} lead={l} locale={locale} selected={selected.has(l.id)} onOpen={onOpen} onOpenFull={onOpenFull} onDragStart={onDragStart} onDragEnd={onDragEnd} onDelete={onDelete} />
                        ))}
                      </div>
                    );
                  }}
                  onDropLead={(slotId, leadId) => {
                    const lead = leads.find((l) => l.id === leadId);
                    if (lead && lead.branchSlotId !== slotId) onDropToColumn(slotDropKey(col.branch!.branchId, slotId), leadId);
                    setDragId(null); setOverCol(null);
                  }}
                />
                {items.some((l) => !l.branchSlotId) && (
                  <SectionLabel icon="user" color={col.color} text={tr(locale, { uz: "Xonasiz lidlar", ru: "Лиды без аудитории", en: "Leads without a room", de: "Leads ohne Raum" })} count={items.filter((l) => !l.branchSlotId).length} />
                )}
              </div>
            )}

            {/* Kartalar — scrollsiz (butun sahifa scroll bo'ladi) */}
            <div className="space-y-3">
              {col.key === "won" ? (
                // "Qabul qilindi" — guruhga yo'naltirilgan lidlar bu yerda to'planib
                // ketmasin: ular guruhlar ro'yxatiga yig'iladi. Kartochka bo'lib
                // faqat hali guruh kutayotganlari qoladi (ular amal talab qiladi).
                <WonColumn
                  items={items}
                  locale={locale}
                  color={col.color}
                  selected={selected}
                  limit={limit}
                  onMore={() => showMore(col.key)}
                  onOpen={onOpen}
                  onOpenFull={onOpenFull}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDelete={onDelete}
                  groupInfo={groupInfo}
                />
              ) : col.branch && col.branch.slots.length > 0 && !items.some((l) => !l.branchSlotId) ? (
                // Xonalar bor, xonasiz lid yo'q — ustunning o'ziga tashlash uchun kichik zona
                <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-[11px] text-slate-400 dark:border-white/[0.08]">
                  {tr(locale, { uz: "Xonasiz — shu yerga tashlang", ru: "Без аудитории — перетащите сюда", en: "No room — drop here", de: "Ohne Raum — hier ablegen" })}
                </div>
              ) : col.key === "lost" ? (
                // "Yo'qotilgan" — yo'qotilgan lidlar + ichida ikki arxiv bo'limi
                // (Lid arxivi / O'quvchi arxivi); bo'limlar — tashlash joyi
                <LostColumn
                  items={items}
                  locale={locale}
                  selected={selected}
                  limit={limit}
                  onMore={() => showMore(col.key)}
                  onOpen={onOpen}
                  onOpenFull={onOpenFull}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDelete={onDelete}
                  dragging={dragging}
                  onArchive={(leadId) => { onDropToColumn(ARCHIVE_COL, leadId); setDragId(null); setOverCol(null); }}
                />
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-white/[0.08]">
                  <div className="text-2xl opacity-30">{col.groupId ? "🎯" : col.branch ? "🏫" : col.customId ? "🗂️" : "📭"}</div>
                  <p className="mt-1 px-3 text-xs text-slate-400">
                    {col.groupId
                      ? tr(locale, { uz: "Lidni shu yerga tashlang — guruhga yoziladi", ru: "Перетащите лид сюда — он попадёт в группу", en: "Drop a lead here to enrol it", de: "Lead hierher ziehen zum Einschreiben" })
                      : col.key === ONLINE_COL
                      ? tr(locale, { uz: "Arizada «Onlayn» tanlagan lidlar shu yerga tushadi", ru: "Сюда попадают лиды, выбравшие «Онлайн» в анкете", en: "Leads who chose “Online” in the form land here", de: "Leads, die im Formular „Online“ gewählt haben, landen hier" })
                      : col.branch
                      ? tr(locale, { uz: "Lidni shu yerga tashlang — filialga yo'naltiriladi", ru: "Перетащите лид сюда — он будет направлен в филиал", en: "Drop a lead here to direct it to this branch", de: "Lead hierher ziehen — an diese Filiale weiterleiten" })
                      : col.customId
                        ? tr(locale, { uz: "Lidni shu yerga tashlang yoki \"+\" bilan qo'shing", ru: "Перетащите лид сюда или добавьте через «+»", en: "Drop a lead here or add one with \"+\"", de: "Lead hierher ziehen oder mit \"+\" anlegen" })
                        : tr(locale, { uz: "Lid yo'q", ru: "Нет лидов", en: "No leads", de: "Keine Leads" })}
                  </p>
                </div>
              ) : (
                <>
                  {(col.branch ? items.filter((l) => !l.branchSlotId) : items).slice(0, limit).map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      locale={locale}
                      selected={selected.has(lead.id)}
                      onOpen={onOpen}
                      onOpenFull={onOpenFull}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDelete={onDelete}
                    />
                  ))}
                  {items.length > limit && <MoreButton rest={items.length - limit} locale={locale} onClick={() => showMore(col.key)} />}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────── "Yo'qotilgan" ustuni ─────────────────

/**
 * Yo'qotilgan lidlar (kartalar) + pastda ikki arxiv bo'limi: "Lid arxivi" va
 * "O'quvchi arxivi" (qabul qilingan / Student yozuvi bor). Bo'limning o'zi —
 * tashlash joyi: istalgan ustundan lid tashlansa arxivlanadi (bosqichi saqlanadi).
 * Qaysi bo'limda ko'rinishi lidning o'zidan aniqlanadi.
 */
function LostColumn({
  items, locale, selected, limit, onMore, onOpen, onOpenFull, onDragStart, onDragEnd, onDelete, dragging, onArchive,
}: {
  items: VLead[];
  locale: Locale;
  selected: Set<string>;
  limit: number;
  onMore: () => void;
  onOpen: (id: string, e: React.MouseEvent) => void;
  onOpenFull: (id: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete?: (id: string) => void;
  dragging: VLead | null;
  onArchive: (leadId: string) => void;
}) {
  const [overSec, setOverSec] = useState<string | null>(null);
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({});
  const lost = items.filter((l) => !l.archivedAt);
  const archived = items.filter((l) => !!l.archivedAt);
  const sections: { key: string; icon: "archive" | "graduation"; title: string; items: VLead[] }[] = [
    { key: "leads", icon: "archive", title: tr(locale, { uz: "Lid arxivi", ru: "Архив лидов", en: "Lead archive", de: "Lead-Archiv" }), items: archived.filter((l) => !isStudentArchive(l)) },
    { key: "students", icon: "graduation", title: tr(locale, { uz: "O'quvchi arxivi", ru: "Архив учеников", en: "Student archive", de: "Schüler-Archiv" }), items: archived.filter(isStudentArchive) },
  ];
  // Sudralayotgan lid arxivlanmagan bo'lsa — bo'limga tashlash mumkin
  const canArchive = !!dragging && !dragging.archivedAt;

  const card = (lead: VLead) => (
    <LeadCard
      key={lead.id}
      lead={lead}
      locale={locale}
      selected={selected.has(lead.id)}
      onOpen={onOpen}
      onOpenFull={onOpenFull}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDelete={onDelete}
    />
  );

  const lostCards = lost.length === 0 ? (
    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-white/[0.08]">
      {tr(locale, { uz: "Yo'qotilgan lid yo'q", ru: "Нет потерянных лидов", en: "No lost leads", de: "Keine verlorenen Leads" })}
    </div>
  ) : (
    <>
      {lost.slice(0, limit).map(card)}
      {lost.length > limit && <MoreButton rest={lost.length - limit} locale={locale} onClick={onMore} />}
    </>
  );

  return (
    <>
      {/* Arxiv — ikki gorizontal karta, ustma-ust (ustun TEPASIDA). Zamonaviy,
          toza uslub: gradient ikonka, sarlavha + izoh, o'ngda soni va chevron.
          Karta — tashlash joyi; bosilsa ichidagilar pastda ochiladi. */}
      <div className="space-y-2">
        {sections.map((sec) => {
          const count = sec.items.length;
          const opened = openSec[sec.key] ?? false;
          const isOver = overSec === sec.key && canArchive;
          const student = sec.key === "students";
          return (
            <button
              key={sec.key}
              type="button"
              onDragOver={(e) => { if (!canArchive) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; if (overSec !== sec.key) setOverSec(sec.key); }}
              onDragLeave={() => setOverSec((c) => (c === sec.key ? null : c))}
              onDrop={(e) => {
                if (!canArchive) return;
                e.preventDefault(); e.stopPropagation();
                const id = e.dataTransfer.getData("text/plain") || dragging?.id;
                setOverSec(null);
                if (id) onArchive(id);
              }}
              onClick={() => count > 0 && setOpenSec({ [sec.key]: !opened })}
              className={cn(
                "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-white/90 p-3 text-left shadow-[0_8px_24px_-14px_rgba(15,23,42,0.35)] backdrop-blur transition outline-none",
                "focus-visible:ring-2 focus-visible:ring-offset-1 dark:bg-white/[0.04]",
                student ? "focus-visible:ring-violet-400" : "focus-visible:ring-slate-400",
                isOver
                  ? (student ? "scale-[1.02] border-violet-400 shadow-[0_12px_30px_-12px_rgba(139,92,246,0.6)]" : "scale-[1.02] border-slate-400 shadow-[0_12px_30px_-12px_rgba(71,85,105,0.6)]")
                  : opened
                    ? (student ? "border-violet-300 dark:border-violet-500/40" : "border-slate-300 dark:border-slate-500/40")
                    : "border-slate-200/70 dark:border-white/[0.08]",
                count > 0 ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.45)]" : "cursor-default",
              )}
            >
              {/* yumshoq rangli fon nuri — o'ng tepada */}
              <span className={cn("pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl", student ? "bg-violet-400/25" : "bg-slate-400/25")} />

              {/* ikonka */}
              <span className={cn(
                "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white",
                student
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_8px_16px_-6px_rgba(139,92,246,0.8)]"
                  : "bg-gradient-to-br from-slate-500 to-slate-700 shadow-[0_8px_16px_-6px_rgba(71,85,105,0.8)]",
              )}>
                <Icon name={sec.icon} className="h-5 w-5" strokeWidth={1.9} />
              </span>

              {/* matn */}
              <span className="relative min-w-0 flex-1">
                <span className="font-hand block truncate text-[17px] font-bold leading-[1.3] text-slate-800 dark:text-slate-100">{sec.title}</span>
                <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                  {count === 0
                    ? tr(locale, { uz: "Bo'sh — lidni shu yerga tashlang", ru: "Пусто — перетащите лид сюда", en: "Empty — drop a lead here", de: "Leer — Lead hierher ziehen" })
                    : student
                      ? tr(locale, { uz: "Qabul qilingan o'quvchilar", ru: "Зачисленные ученики", en: "Enrolled students", de: "Eingeschriebene Schüler" })
                      : tr(locale, { uz: "Ko'rinishdan olingan lidlar", ru: "Скрытые лиды", en: "Hidden leads", de: "Ausgeblendete Leads" })}
                </span>
              </span>

              {/* soni + chevron */}
              <span className="relative flex shrink-0 items-center gap-1.5">
                <span className={cn(
                  "inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums",
                  count > 0
                    ? (student ? "bg-violet-600 text-white" : "bg-slate-700 text-white dark:bg-slate-600")
                    : "bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-slate-400",
                )}>
                  {count}
                </span>
                {count > 0 && <Icon name="chevronDown" className={cn("h-4 w-4 text-slate-400 transition group-hover:text-slate-600", opened && "rotate-180")} />}
              </span>

              {/* Tashlash ko'rsatkichi — karta ustini qoplaydi */}
              {isOver && (
                <span className={cn(
                  "absolute inset-0 grid place-items-center rounded-2xl text-[13px] font-bold text-white backdrop-blur-[2px]",
                  student ? "bg-gradient-to-r from-violet-500/90 to-fuchsia-500/90" : "bg-gradient-to-r from-slate-600/90 to-slate-800/90",
                )}>
                  <span className="inline-flex items-center gap-2"><Icon name="arrowDownToLine" className="h-4 w-4" /> {tr(locale, { uz: "Arxivga qo'yish", ru: "В архив", en: "Archive", de: "Archivieren" })}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ochilgan arxivning lidlari — plitkalar ostida, sarlavha bilan */}
      {sections.map((sec) => {
        if (!(openSec[sec.key] ?? false) || sec.items.length === 0) return null;
        const student = sec.key === "students";
        return (
          <div key={`${sec.key}-list`} className={cn("relative ml-2 space-y-3 border-l-2 border-dashed pl-3", student ? "border-violet-300 dark:border-violet-500/40" : "border-slate-300 dark:border-slate-500/40")}>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Icon name={sec.icon} className={cn("h-3.5 w-3.5", student ? "text-violet-500" : "text-slate-500")} />
                {sec.title} · {sec.items.length}
              </span>
              <span className="text-slate-400">{tr(locale, { uz: "Boshqa ustunga tashlang — qaytadi", ru: "Перетащите в колонку — вернётся", en: "Drag to a column to restore", de: "In Spalte ziehen — zurückholen" })}</span>
            </div>
            {sec.items.map(card)}
          </div>
        );
      })}

      {lostCards}
    </>
  );
}

// ───────────────── "Qabul qilindi" ustuni ─────────────────

interface Bucket {
  groupId: string | null;
  groupName: string;
  count: number;
}

function WonColumn({
  items, locale, color, selected, limit, onMore, onOpen, onOpenFull, onDragStart, onDragEnd, onDelete, groupInfo = {},
}: {
  groupInfo?: Record<string, GroupInfo>;
  items: VLead[];
  locale: Locale;
  color: string;
  selected: Set<string>;
  /** Guruh kutayotganlardan nechtasi chizilgan */
  limit: number;
  onMore: () => void;
  onOpen: (id: string, e: React.MouseEvent) => void;
  onOpenFull: (id: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete?: (id: string) => void;
}) {
  // Guruh kutayotganlar kartochka bo'lib qoladi, qolganlari guruhlarga yig'iladi
  const waiting = useMemo(() => items.filter((l) => !l.groupName), [items]);

  const buckets = useMemo(() => {
    const map = new Map<string, Bucket>();
    for (const l of items) {
      if (!l.groupName) continue;
      const key = l.groupId ?? `name:${l.groupName}`;
      const b = map.get(key);
      if (b) b.count += 1;
      else map.set(key, { groupId: l.groupId, groupName: l.groupName, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.groupName.localeCompare(b.groupName));
  }, [items]);

  if (waiting.length === 0 && buckets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-white/[0.08]">
        <div className="text-2xl opacity-30">📭</div>
        <p className="mt-1 text-xs text-slate-400">{tr(locale, { uz: "Lid yo'q", ru: "Нет лидов", en: "No leads", de: "Keine Leads" })}</p>
      </div>
    );
  }

  return (
    <>
      {/* Guruh kutayotganlar — amal talab qiladi, shuning uchun to'liq kartochka */}
      {waiting.length > 0 && (
        <>
          <SectionLabel
            icon="alert"
            color="#f59e0b"
            text={tr(locale, { uz: "Guruh kutmoqda", ru: "Ожидают группу", en: "Awaiting group", de: "Gruppe wird erwartet" })}
            count={waiting.length}
          />
          {waiting.slice(0, limit).map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              locale={locale}
              selected={selected.has(lead.id)}
              onOpen={onOpen}
              onOpenFull={onOpenFull}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDelete={onDelete}
            />
          ))}
          {waiting.length > limit && <MoreButton rest={waiting.length - limit} locale={locale} onClick={onMore} />}
        </>
      )}

      {/* Guruhlar — yo'naltirilgan lidlar shu yerga yig'iladi */}
      {buckets.length > 0 && (
        <>
          <SectionLabel
            icon="layers"
            color={color}
            text={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })}
            count={buckets.reduce((n, b) => n + b.count, 0)}
          />
          {buckets.map((b) => (
            <GroupBucketCard key={b.groupId ?? b.groupName} bucket={b} locale={locale} color={color} info={b.groupId ? groupInfo[b.groupId] : undefined} />
          ))}
        </>
      )}
    </>
  );
}

/** "Yana N ta ko'rsatish" — ustunning chizilmagan qismini ochadi */
function MoreButton({ rest, locale, onClick }: { rest: number; locale: Locale; onClick: () => void }) {
  const n = Math.min(rest, PAGE);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-white/[0.12] dark:text-slate-400 dark:hover:text-brand-300"
    >
      <Icon name="plus" className="h-3.5 w-3.5" />
      {tr(locale, { uz: `Yana ${n} ta ko'rsatish`, ru: `Показать ещё ${n}`, en: `Show ${n} more`, de: `${n} weitere anzeigen` })}
      <span className="text-slate-400">({rest})</span>
    </button>
  );
}

function SectionLabel({ icon, color, text, count }: { icon: string; color: string; text: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      <Icon name={icon} className="h-3.5 w-3.5" style={{ color }} />
      <span>{text}</span>
      <span className="ml-auto tabular-nums">{count}</span>
    </div>
  );
}

function GroupBucketCard({ bucket, locale, color, info }: { bucket: Bucket; locale: Locale; color: string; info?: GroupInfo }) {
  // Guruhning haqiqiy holati: o'quvchilar / sig'im, bo'sh joy; to'lganda qizil, 80%+ da sariq
  const students = info?.students ?? 0;
  const capacity = info?.capacity ?? 0;
  const free = Math.max(0, capacity - students);
  const pct = capacity > 0 ? Math.min(100, Math.round((students / capacity) * 100)) : 0;
  const full = capacity > 0 && students >= capacity;
  const tone = full ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#10b981";

  const inner = (
    <>
      {/* Sarlavha: belgi + nom + kanbandan kelgan lidlar soni */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `${color}1f` }}>
          <Icon name="layers" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{bucket.groupName}</div>
        <span className="shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums" style={{ color, background: `${color}1a` }} title={tr(locale, { uz: "Kanbandan qabul qilingan lidlar", ru: "Лиды, принятые из канбана", en: "Leads accepted from the board", de: "Aus dem Board aufgenommene Leads" })}>
          {bucket.count} {tr(locale, { uz: "lid", ru: "лид", en: "lead", de: "Lead" })}
        </span>
      </div>

      {info ? (
        <>
          {/* O'quvchilar / sig'im va bo'sh joy — bir qatorda, chiplar */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
              <Icon name="user" className="h-3 w-3" /> <span className="tabular-nums">{students} / {capacity}</span>
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ color: tone, background: `${tone}1a` }}>
              {full ? tr(locale, { uz: "To'ldi", ru: "Полно", en: "Full", de: "Voll" }) : tr(locale, { uz: `${free} joy bo'sh`, ru: `${free} мест`, en: `${free} seats left`, de: `${free} Plätze frei` })}
            </span>
          </div>
          {/* To'lganlik chizig'i */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
          </div>
          {/* Xona · jadval · o'qituvchi — har biri o'z qatorida, ikkala rejimda o'qiladi */}
          {(info.room || info.schedule || info.teacher) && (
            // Aniq ko'rinadigan rang: matn to'q, ikonkalar ustun rangida
            <div className="mt-2 space-y-1 text-[11.5px] font-medium leading-tight text-slate-700 dark:text-slate-100">
              {(info.room || info.schedule) && (
                <div className="flex items-center gap-1.5">
                  {info.room && <span className="inline-flex items-center gap-1 whitespace-nowrap"><Icon name="building" className="h-3.5 w-3.5 shrink-0" style={{ color }} strokeWidth={1.8} /> {info.room}</span>}
                  {info.room && info.schedule && <span className="text-slate-300 dark:text-slate-500">·</span>}
                  {info.schedule && <span className="inline-flex min-w-0 items-center gap-1"><Icon name="clock" className="h-3.5 w-3.5 shrink-0" style={{ color }} strokeWidth={1.8} /> <span className="truncate">{info.schedule}</span></span>}
                </div>
              )}
              {info.teacher && (
                <div className="flex items-center gap-1.5">
                  <Icon name="teacher" className="h-3.5 w-3.5 shrink-0" style={{ color }} strokeWidth={1.8} />
                  <span className="truncate font-semibold text-slate-800 dark:text-white">{info.teacher}</span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-1.5 text-[11px] text-slate-400">{tr(locale, { uz: `${bucket.count} ta qabul qilingan lid`, ru: `${bucket.count} принятых лидов`, en: `${bucket.count} accepted leads`, de: `${bucket.count} akzeptierte Leads` })}</div>
      )}
    </>
  );

  const cls = "block rounded-xl border border-slate-200 bg-white p-3 transition dark:border-white/[0.07] dark:bg-[#15243d]";

  // Guruh o'chirilgan bo'lsa (groupId yo'q) — havolasiz ko'rsatiladi
  return bucket.groupId ? (
    <Link href={`/groups/${bucket.groupId}`} draggable={false} className={cn(cls, "hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
