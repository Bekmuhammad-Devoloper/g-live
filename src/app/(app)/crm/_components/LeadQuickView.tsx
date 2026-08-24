"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { tr } from "@/lib/tr";
import { formatMoney, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { columnDef, columnOf, initials, type VLead } from "../_lib/leadColumns";

// Lidning yonboshdan ochiladigan TEZKOR ko'rish oynasi.
// Qator/kartochka BIR marta bosilganda shu oyna ochiladi; IKKI marta
// bosilsa bevosita /crm/[id] to'liq sahifasiga kiriladi.

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function LeadQuickView({
  lead, locale, canWrite, onClose, onEnroll,
}: {
  lead: VLead;
  locale: Locale;
  canWrite: boolean;
  onClose: () => void;
  onEnroll: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const col = columnDef(columnOf(lead.stage));

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  if (!mounted) return null;

  const call = () => {
    window.dispatchEvent(new CustomEvent("glive:call", {
      detail: { number: lead.phone, leadId: lead.id, contactName: lead.fullName },
    }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[420px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        {/* Sarlavha */}
        <div className="relative shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/10">
          <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(135deg, ${col.color}14, transparent 60%)` }} />
          <div className="relative flex items-start justify-between gap-3 px-5 py-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold shadow-sm ring-2 ring-white dark:ring-white/10"
                style={{ color: col.color, background: `${col.color}24` }}
              >
                {initials(lead.fullName)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{lead.fullName}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: col.color, background: `${col.color}1f` }}>
                    {label(LEAD_STAGE_LABELS, lead.stage, locale)}
                  </span>
                  {lead.source && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">{lead.source}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* Tezkor oynadan lidning to'liq sahifasiga o'tish */}
              <Link
                href={`/crm/${lead.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <Icon name="expand" className="h-3.5 w-3.5" /> {tr(locale, { uz: "To'liq sahifa", ru: "Полная страница", en: "Full page" })}
              </Link>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Aloqa */}
          <Section icon="phone" title={tr(locale, { uz: "Aloqa", ru: "Контакты", en: "Contact" })}>
            <button
              onClick={call}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-white/10 dark:hover:bg-emerald-950/20"
            >
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{lead.phone}</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Icon name="phoneCall" className="h-4 w-4" />
              </span>
            </button>
            {lead.email && <Row label={tr(locale, { uz: "Email", ru: "Email", en: "Email" })} value={lead.email} />}
          </Section>

          {/* Lid ma'lumotlari */}
          <Section icon="info" title={tr(locale, { uz: "Ma'lumotlar", ru: "Данные", en: "Details" })}>
            <Row label={tr(locale, { uz: "Qiziqqan kurs", ru: "Интересующий курс", en: "Course of interest" })} value={lead.interestCourse ?? "—"} />
            <Row label={tr(locale, { uz: "Byudjet", ru: "Бюджет", en: "Budget" })} value={lead.budget ? formatMoney(lead.budget, locale) : "—"} />
            <Row label={tr(locale, { uz: "Menejer", ru: "Менеджер", en: "Manager" })} value={lead.managerName ?? "—"} />
            <Row label={tr(locale, { uz: "Yaratilgan", ru: "Создан", en: "Created" })} value={fmtDate(lead.createdAt)} />
            <Row label={tr(locale, { uz: "Oxirgi harakat", ru: "Последняя активность", en: "Last activity" })} value={fmtDate(lead.lastActivity)} />
            <Row label={tr(locale, { uz: "Harakatlar soni", ru: "Кол-во действий", en: "Activities" })} value={String(lead.activityCount)} />
          </Section>

          {/* Guruh — "Qabul qilindi" bosqichi uchun majburiy qadam */}
          <Section icon="layers" title={tr(locale, { uz: "Guruh", ru: "Группа", en: "Group" })}>
            {lead.groupName ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-emerald-700 dark:text-emerald-400">{lead.groupName}</div>
                  <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70">
                    {lead.enrollEditCount > 0
                      ? tr(locale, { uz: "O'zgartirish imkoni tugagan", ru: "Изменение больше недоступно", en: "No further changes allowed" })
                      : tr(locale, { uz: "Bir marta o'zgartirish mumkin", ru: "Можно изменить один раз", en: "Can be changed once" })}
                  </div>
                </div>
                {canWrite && lead.enrollEditCount === 0 && (
                  <button onClick={onEnroll} className="shrink-0 rounded-lg border border-emerald-300 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30">
                    {tr(locale, { uz: "O'zgartirish", ru: "Изменить", en: "Change" })}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 dark:border-slate-600">
                <span className="text-sm text-slate-400">{tr(locale, { uz: "Yo'naltirilmagan", ru: "Не назначена", en: "Not assigned" })}</span>
                {canWrite && (
                  <button onClick={onEnroll} className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-700">
                    {tr(locale, { uz: "Guruhga yo'naltirish", ru: "Назначить группу", en: "Assign group" })}
                  </button>
                )}
              </div>
            )}
          </Section>

          {lead.note && (
            <Section icon="alignLeft" title={tr(locale, { uz: "Izoh", ru: "Заметка", en: "Note" })}>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">{lead.note}</p>
            </Section>
          )}
        </div>

        {/* Pastki amallar */}
        <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-5 py-3 dark:border-white/10 dark:bg-[#15243d]">
          <Link
            href={`/crm/${lead.id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[.99]"
          >
            <Icon name="expand" className="h-4 w-4" /> {tr(locale, { uz: "To'liq sahifani ochish", ru: "Открыть полностью", en: "Open full page" })}
          </Link>
          <button onClick={call} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/10">
            <Icon name="phone" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label: k, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0 dark:border-white/5">
      <span className="shrink-0 text-xs text-slate-400">{k}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
