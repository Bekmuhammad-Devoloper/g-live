"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { formatMoney, type Locale } from "@/lib/constants";
import { debtTone, debtMonthsLabel, DEBT_BADGE, DEBT_TEXT } from "@/lib/debtTone";
import { Icon } from "../../_components/Icon";

export interface StudentHoverInfo {
  phone: string | null;
  note: string | null;
  debt: number;
  overdueMonths: number;
  credit: number;
}

export function studentNameTone(info?: StudentHoverInfo): string | null {
  if (!info) return null;
  const tone = debtTone(info.debt, info.overdueMonths, info.credit);
  return tone === "none" ? null : DEBT_TEXT[tone];
}

const CARD_WIDTH = 288;
const FLIP_SPACE = 220;
const EDGE = 8;

type Placement = { left: number; top?: number; bottom?: number; above: boolean; arrow: number };

function place(rect: DOMRect): Placement {
  const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - CARD_WIDTH - EDGE));
  const arrow = Math.max(12, Math.min(rect.left + 20 - left, CARD_WIDTH - 24));
  const above = window.innerHeight - rect.bottom < FLIP_SPACE && rect.top > FLIP_SPACE;
  return above
    ? { left, bottom: window.innerHeight - rect.top + EDGE, above, arrow }
    : { left, top: rect.bottom + EDGE, above, arrow };
}

const heading = "block text-[11px] font-semibold uppercase tracking-wide text-slate-400";

export default function StudentHoverCard({ info, locale, className, children }: {
  info?: StudentHoverInfo;
  locale: Locale;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);

  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [pos]);

  if (!info) return <span className={className}>{children}</span>;

  const show = () => { if (ref.current) setPos(place(ref.current.getBoundingClientRect())); };
  const hide = () => setPos(null);
  const tone = debtTone(info.debt, info.overdueMonths, info.credit);

  return (
    <span ref={ref} className={className} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && createPortal(
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[90] block rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-white/10 dark:bg-[#15243d]"
          style={{ width: CARD_WIDTH, left: pos.left, top: pos.top, bottom: pos.bottom }}
        >
          <span
            aria-hidden
            className={cn("absolute h-3 w-3 rotate-45 bg-white dark:bg-[#15243d]", pos.above ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-l border-t", "border-slate-200 dark:border-white/10")}
            style={{ left: pos.arrow }}
          />
          <span className={heading}>{tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            <Icon name="phone" className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            {info.phone?.trim() || "—"}
          </span>
          <span className={cn(heading, "mt-2.5")}>{tr(locale, { uz: "Qarzdorligi", ru: "Задолженность", en: "Debt", de: "Schulden" })}</span>
          <span className="mt-1 flex items-center gap-2">
            {info.debt > 0 ? (
              <>
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tabular-nums", DEBT_BADGE[tone])}>{formatMoney(info.debt, locale)}</span>
                <span className="text-xs text-slate-500">{debtMonthsLabel(info.overdueMonths, locale)}</span>
              </>
            ) : info.credit > 0 ? (
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tabular-nums", DEBT_BADGE.credit)}>+{formatMoney(info.credit, locale)}</span>
            ) : (
              <span className="text-xs font-medium text-slate-500">{tr(locale, { uz: "Qarzi yo'q", ru: "Долга нет", en: "No debt", de: "Keine Schulden" })}</span>
            )}
          </span>
          <span className={cn(heading, "mt-2.5")}>{tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Comment", de: "Kommentar" })}</span>
          <span className="mt-1 line-clamp-6 block whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-200">{info.note?.trim() || "—"}</span>
        </span>,
        document.body,
      )}
    </span>
  );
}
