"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { COLUMNS, columnOf, type VLead } from "../_lib/leadColumns";
import LeadCard from "./LeadCard";

interface Props {
  leads: VLead[];
  totals: Record<string, number>;
  locale: Locale;
  selected: Set<string>;
  onOpen: (id: string, e: React.MouseEvent) => void;
  /** Ikki marta bosilganda — lidning to'liq sahifasi */
  onOpenFull: (id: string) => void;
  onDropToColumn: (columnKey: string, leadId: string) => void;
  onAdd: (defaultStage: string) => void;
}

export default function LeadsKanban({ leads, totals, locale, selected, onOpen, onOpenFull, onDropToColumn, onAdd }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const byCol: Record<string, VLead[]> = {};
  for (const c of COLUMNS) byCol[c.key] = [];
  for (const l of leads) (byCol[columnOf(l.stage)] ??= []).push(l);

  const onDragStart = (id: string, e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(id);
  };
  const onDragEnd = () => { setDragId(null); setOverCol(null); };

  return (
    <div className="grid auto-cols-[minmax(272px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4 lg:grid-flow-row lg:grid-cols-5">
      {COLUMNS.map((col) => {
        const items = byCol[col.key] ?? [];
        const isOver = overCol === col.key;
        const draggingFrom = leads.find((l) => l.id === dragId)?.stage;
        const differentCol = dragId !== null && columnOf(draggingFrom ?? "") !== col.key;
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
              if (id && lead && columnOf(lead.stage) !== col.key) onDropToColumn(col.key, id);
              setDragId(null);
              setOverCol(null);
            }}
            className={cn("min-w-0 rounded-2xl p-2.5 transition", isOver ? "bg-slate-100/70 dark:bg-white/[0.03]" : "")}
          >
            {/* Sarlavha */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: col.color, background: `${col.color}1f` }}>
                  <Icon name={col.icon} className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">{tr(locale, col.label)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold" style={{ color: col.color }}>{totals[col.key] ?? items.length}</span>
                <button onClick={() => onAdd(col.defaultStage)} title={tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add" })} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-white/[0.06]">
                  <Icon name="plus" className="h-4 w-4" />
                </button>
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
                  onOpen={onOpen}
                  onOpenFull={onOpenFull}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-white/[0.08]">
                  <div className="text-2xl opacity-30">📭</div>
                  <p className="mt-1 text-xs text-slate-400">{tr(locale, { uz: "Lid yo'q", ru: "Нет лидов", en: "No leads" })}</p>
                </div>
              ) : (
                items.map((lead) => (
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
                ))
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
  items, locale, color, selected, onOpen, onOpenFull, onDragStart, onDragEnd,
}: {
  items: VLead[];
  locale: Locale;
  color: string;
  selected: Set<string>;
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
        <p className="mt-1 text-xs text-slate-400">{tr(locale, { uz: "Lid yo'q", ru: "Нет лидов", en: "No leads" })}</p>
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
            text={tr(locale, { uz: "Guruh kutmoqda", ru: "Ожидают группу", en: "Awaiting group" })}
            count={waiting.length}
          />
          {waiting.map((lead) => (
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
        </>
      )}

      {/* Guruhlar — yo'naltirilgan lidlar shu yerga yig'iladi */}
      {buckets.length > 0 && (
        <>
          <SectionLabel
            icon="layers"
            color={color}
            text={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups" })}
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
