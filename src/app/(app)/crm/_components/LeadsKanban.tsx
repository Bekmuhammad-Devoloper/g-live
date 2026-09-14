"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { COLUMNS, columnOfLead, customColKey, groupColKey, type CustomColumn, type GroupColumn, type VLead } from "../_lib/leadColumns";
import LeadCard from "./LeadCard";

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
}

/** Standart va guruh ustunlari bitta ko'rinishga keltiriladi */
interface ViewCol {
  key: string;
  title: string;
  sub: string | null;
  color: string;
  icon: string;
  defaultStage: string;
  groupId: string | null;
  customId: string | null;
}

/** Har ustunda dastlab shuncha karta chiziladi — qolgani "Yana ko'rsatish" bilan.
 *  Aks holda 2000 lid = 2000 karta × ~10 SVG bir vaqtda DOM'ga tushib, sahifa qotib qolardi. */
const PAGE = 40;

export default function LeadsKanban({
  leads, totals, locale, selected, groupColumns, customColumns,
  onOpen, onOpenFull, onDropToColumn, onAdd, onAddToGroup, onRemoveGroupCol, onAddToCustom, onRemoveCustomCol, onLevelTestQr,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  // Ustun kaliti → hozir ko'rsatilayotgan kartalar soni
  const [limits, setLimits] = useState<Record<string, number>>({});
  const showMore = useCallback((key: string) => setLimits((p) => ({ ...p, [key]: (p[key] ?? PAGE) + PAGE })), []);

  const pinnedIds = useMemo(() => new Set(groupColumns.map((g) => g.groupId)), [groupColumns]);
  const customIds = useMemo(() => new Set(customColumns.map((c) => c.id)), [customColumns]);

  // Tartib: standart 4 ta → oddiy nomli ustunlar → "Qabul qilindi" → guruh ustunlari → "Yo'qotilgan"
  const cols = useMemo<ViewCol[]>(() => {
    const std = (key: string): ViewCol => {
      const c = COLUMNS.find((x) => x.key === key)!;
      return { key: c.key, title: tr(locale, c.label), sub: null, color: c.color, icon: c.icon, defaultStage: c.defaultStage, groupId: null, customId: null };
    };
    const custom = customColumns.map<ViewCol>((c) => ({
      key: customColKey(c.id),
      title: c.name,
      sub: null,
      color: c.color,
      icon: c.icon,
      defaultStage: "NEW",
      groupId: null,
      customId: c.id,
    }));
    const groups = groupColumns.map<ViewCol>((g) => ({
      key: groupColKey(g.groupId),
      title: g.name,
      sub: g.program,
      color: g.color,
      icon: g.icon,
      defaultStage: "WON",
      groupId: g.groupId,
      customId: null,
    }));
    return [std("new"), std("work"), std("test"), std("offer"), ...custom, std("won"), ...groups, std("lost")];
  }, [groupColumns, customColumns, locale]);

  const colOf = useCallback((l: VLead) => columnOfLead(l, pinnedIds, customIds), [pinnedIds, customIds]);

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

  const dragging = dragId ? leads.find((l) => l.id === dragId) ?? null : null;
  const draggingCol = dragging ? colOf(dragging) : null;

  return (
    <div
      className={cn(
        "grid auto-cols-[minmax(272px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4",
        // Qo'shimcha ustunlar bo'lsa 6 ta ustunga sig'maydi — gorizontal scroll qoladi
        groupColumns.length === 0 && customColumns.length === 0 && "xl:grid-flow-row xl:grid-cols-6",
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
                  <span className="block truncate text-sm font-semibold text-slate-700 dark:text-slate-100">{col.title}</span>
                  {col.sub && <span className="block truncate text-[11px] text-slate-400">{col.sub}</span>}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-sm font-bold" style={{ color: col.color }}>{totals[col.key] ?? items.length}</span>
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
                  onClick={() => (col.customId ? onAddToCustom(col.customId) : col.groupId ? onAddToGroup(col.groupId) : onAdd(col.defaultStage))}
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
                />
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-white/[0.08]">
                  <div className="text-2xl opacity-30">{col.groupId ? "🎯" : col.customId ? "🗂️" : "📭"}</div>
                  <p className="mt-1 px-3 text-xs text-slate-400">
                    {col.groupId
                      ? tr(locale, { uz: "Lidni shu yerga tashlang — guruhga yoziladi", ru: "Перетащите лид сюда — он попадёт в группу", en: "Drop a lead here to enrol it", de: "Lead hierher ziehen zum Einschreiben" })
                      : col.customId
                        ? tr(locale, { uz: "Lidni shu yerga tashlang yoki \"+\" bilan qo'shing", ru: "Перетащите лид сюда или добавьте через «+»", en: "Drop a lead here or add one with \"+\"", de: "Lead hierher ziehen oder mit \"+\" anlegen" })
                        : tr(locale, { uz: "Lid yo'q", ru: "Нет лидов", en: "No leads", de: "Keine Leads" })}
                  </p>
                </div>
              ) : (
                <>
                  {items.slice(0, limit).map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      locale={locale}
                      selected={selected.has(lead.id)}
                      onOpen={onOpen}
                      onOpenFull={onOpenFull}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
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

// ───────────────── "Qabul qilindi" ustuni ─────────────────

interface Bucket {
  groupId: string | null;
  groupName: string;
  count: number;
}

function WonColumn({
  items, locale, color, selected, limit, onMore, onOpen, onOpenFull, onDragStart, onDragEnd,
}: {
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
            <GroupBucketCard key={b.groupId ?? b.groupName} bucket={b} locale={locale} color={color} />
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

function GroupBucketCard({ bucket, locale, color }: { bucket: Bucket; locale: Locale; color: string }) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ color, background: `${color}1f` }}>
        <Icon name="layers" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{bucket.groupName}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          {tr(locale, {
            uz: `${bucket.count} ta qabul qilingan lid`,
            ru: `${bucket.count} принятых лидов`,
            en: `${bucket.count} accepted leads`,
            de: `${bucket.count} akzeptierte Leads`,
          })}
        </div>
      </div>
      <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums" style={{ color, background: `${color}1a` }}>
        {bucket.count}
      </span>
    </>
  );

  const cls = "flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition dark:border-white/[0.07] dark:bg-[#15243d]";

  // Guruh o'chirilgan bo'lsa (groupId yo'q) — havolasiz ko'rsatiladi
  return bucket.groupId ? (
    <Link href={`/groups/${bucket.groupId}`} draggable={false} className={cn(cls, "hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
