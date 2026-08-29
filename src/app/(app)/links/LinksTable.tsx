"use client";

import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { platform, flagOf } from "./platforms";
import type { VLink, VVacancy } from "./types";

export type DeleteTarget = { kind: "link" | "vacancy"; id: string; label: string };

interface Common {
  locale: Locale;
  canManage: boolean;
  origin: string;
  copiedId: string | null;
  onCopy: (id: string, code: string) => void;
  onToggle: (id: string) => void;
  onRegen: (id: string) => void;
  onQr: (code: string) => void;
  onDelete: (t: DeleteTarget) => void;
}

export default function LinksTable({ rows, hasAny, expanded, onExpand, onCreate, ...c }: Common & {
  rows: VVacancy[];
  hasAny: boolean;
  expanded: Set<string>;
  onExpand: (id: string) => void;
  onCreate: () => void;
}) {
  const { locale, canManage } = c;
  const heads = [
    { t: "#", a: "text-left" },
    { t: tr(locale, { uz: "Vakansiya", ru: "Вакансия", en: "Vacancy", de: "Stelle" }), a: "text-left" },
    { t: tr(locale, { uz: "Davlat", ru: "Страна", en: "Country", de: "Land" }), a: "text-left" },
    { t: tr(locale, { uz: "Link", ru: "Ссылка", en: "Link", de: "Link" }), a: "text-left" },
    { t: tr(locale, { uz: "Ko'rishlar", ru: "Просмотры", en: "Views", de: "Aufrufe" }), a: "text-center" },
    { t: tr(locale, { uz: "Arizalar", ru: "Заявки", en: "Applications", de: "Bewerbungen" }), a: "text-center" },
    { t: tr(locale, { uz: "Status", ru: "Статус", en: "Status", de: "Status" }), a: "text-center" },
    { t: tr(locale, { uz: "Sana", ru: "Дата", en: "Date", de: "Datum" }), a: "text-center" },
    { t: tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" }), a: "text-right" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-200/70 bg-slate-50/70 dark:border-slate-800 dark:bg-white/[0.02]">
              {heads.map((h) => (
                <th key={h.t} className={cn("px-5 py-3.5 text-xs font-medium text-slate-500 dark:text-slate-400", h.a)}>{h.t}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((v, idx) => (
              <RowGroup key={v.id} v={v} idx={idx} open={expanded.has(v.id)} onExpand={() => onExpand(v.id)} {...c} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <Icon name="link" className="h-8 w-8 text-slate-400" />
                    </span>
                    <div>
                      <p className="font-medium text-slate-600 dark:text-slate-300">
                        {hasAny ? tr(locale, { uz: "Filtrlarga mos link yo'q", ru: "Нет ссылок по фильтрам", en: "No links match the filters", de: "Keine Links entsprechen den Filtern" }) : tr(locale, { uz: "Havola topilmadi", ru: "Ссылки не найдены", en: "No links found", de: "Keine Links gefunden" })}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {hasAny ? tr(locale, { uz: "Filtrlarni o'zgartiring", ru: "Измените фильтры", en: "Change the filters", de: "Filter ändern" }) : tr(locale, { uz: "Birinchi vakansiya va linkni yarating", ru: "Создайте первую вакансию и ссылку", en: "Create your first vacancy and link", de: "Erstellen Sie Ihre erste Stelle und Ihren ersten Link" })}
                      </p>
                    </div>
                    {!hasAny && canManage && (
                      <button onClick={onCreate} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700">
                        <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangi kurs + Link", ru: "Новый курс + Ссылка", en: "New course + Link", de: "Neuer Kurs + Link" })}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({ v, idx, open, onExpand, ...c }: Common & { v: VVacancy; idx: number; open: boolean; onExpand: () => void }) {
  const { locale, canManage, copiedId, onCopy, onDelete } = c;
  const first = v.links[0];
  const multi = v.links.length > 1;
  const sub = v.company ?? first.name;

  return (
    <Fragment>
      <tr className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
        <td className="px-5 py-4"><span className="font-mono text-xs text-slate-400">{idx + 1}</span></td>

        <td className="px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400">
              <Icon name="building" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">{v.title}</p>
              {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
              {multi ? (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {v.links.map((l) => {
                    const p = platform(l.platform);
                    return (
                      <span key={l.id} title={p.label} className="flex items-center rounded px-1.5 py-0.5" style={{ background: `${p.color}1a`, color: p.color }}>
                        <Icon name={p.icon} className="h-3 w-3" />
                      </span>
                    );
                  })}
                </div>
              ) : (
                <PlatformChip platformKey={first.platform} />
              )}
            </div>
          </div>
        </td>

        <td className="px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>{v.country ? flagOf(v.countryCode, v.country) : "🌐"}</span>
            <span>{v.country ?? "—"}</span>
          </div>
        </td>

        <td className="px-5 py-4">
          {multi ? (
            <button onClick={onExpand} className="flex items-center gap-1.5 text-xs font-medium text-blue-500 transition hover:text-blue-600 dark:text-blue-400">
              <Icon name="chevronDown" className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
              {tr(locale, { uz: `${v.links.length} ta link`, ru: `${v.links.length} ссылок`, en: `${v.links.length} links`, de: `${v.links.length} Links` })}
            </button>
          ) : (
            <CodeChip locale={locale} link={first} copied={copiedId === first.id} onCopy={onCopy} />
          )}
        </td>

        <td className="px-5 py-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums text-slate-600 dark:text-slate-300">
            <Icon name="eye" className="h-3.5 w-3.5 text-slate-400" />{v.views}
          </span>
        </td>

        <td className="px-5 py-4 text-center">
          <span className={cn("text-sm font-bold tabular-nums", v.submissions > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")}>{v.submissions}</span>
        </td>

        <td className="px-5 py-4 text-center">
          {multi ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {v.activeLinks}/{v.links.length} {tr(locale, { uz: "faol", ru: "актив.", en: "active", de: "aktiv" })}
            </span>
          ) : (
            <StatusToggle locale={locale} link={first} canManage={canManage} onToggle={c.onToggle} />
          )}
        </td>

        <td className="px-5 py-4 text-center"><span className="text-xs tabular-nums text-slate-400">{first.createdAt}</span></td>

        <td className="px-5 py-4">
          <div className="flex items-center justify-end gap-1">
            {multi ? (
              <button onClick={onExpand} title={open ? tr(locale, { uz: "Yig'ish", ru: "Свернуть", en: "Collapse", de: "Einklappen" }) : tr(locale, { uz: "Ochish", ru: "Развернуть", en: "Expand", de: "Ausklappen" })} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-500/10 hover:text-blue-500">
                <Icon name="chevronDown" className={cn("h-4 w-4 transition-transform", open ? "rotate-0" : "-rotate-90")} />
              </button>
            ) : (
              <LinkActions link={first} size="md" {...c} />
            )}
            {canManage && (
              <button onClick={() => onDelete({ kind: "vacancy", id: v.id, label: v.title })} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-500">
                <Icon name="trash" className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {multi && open && v.links.map((l) => {
        const p = platform(l.platform);
        return (
          <tr key={l.id} className="bg-slate-50/60 dark:bg-white/[0.02]">
            <td className="px-5 py-2.5" />
            <td className="px-5 py-2.5">
              <div className="flex items-center gap-2 pl-6">
                <Icon name={p.icon} className="h-4 w-4" style={{ color: p.color }} />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{p.label}</span>
              </div>
            </td>
            <td className="px-5 py-2.5" />
            <td className="px-5 py-2.5"><CodeChip locale={locale} link={l} copied={copiedId === l.id} onCopy={onCopy} small /></td>
            <td className="px-5 py-2.5 text-center"><span className="text-xs tabular-nums text-slate-400">{l.views}</span></td>
            <td className="px-5 py-2.5 text-center"><span className={cn("text-xs font-bold tabular-nums", l.submissions > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")}>{l.submissions}</span></td>
            <td className="px-5 py-2.5 text-center"><StatusToggle locale={locale} link={l} canManage={canManage} onToggle={c.onToggle} compact /></td>
            <td className="px-5 py-2.5 text-center"><span className="text-[11px] tabular-nums text-slate-400">{l.createdAt}</span></td>
            <td className="px-5 py-2.5">
              <div className="flex items-center justify-end gap-1">
                <LinkActions link={l} size="sm" {...c} />
                {canManage && (
                  <button onClick={() => onDelete({ kind: "link", id: l.id, label: `${p.label} · ${l.code}` })} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })} className="rounded-lg p-1 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-500">
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </Fragment>
  );
}

function LinkActions({ link, size, locale, canManage, origin, onCopy, onQr, onRegen }: Common & { link: VLink; size: "sm" | "md" }) {
  const ic = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const pad = size === "md" ? "p-1.5" : "p-1";
  return (
    <>
      <button onClick={() => onCopy(link.id, link.code)} title={tr(locale, { uz: "Link nusxalash", ru: "Копировать ссылку", en: "Copy link", de: "Link kopieren" })} className={cn("rounded-lg text-slate-400 transition hover:bg-blue-500/10 hover:text-blue-500", pad)}>
        <Icon name="copy" className={ic} />
      </button>
      <a href={`${origin}/apply/${link.code}`} target="_blank" rel="noopener noreferrer" title={tr(locale, { uz: "Linkni ochish", ru: "Открыть ссылку", en: "Open link", de: "Link öffnen" })} className={cn("rounded-lg text-slate-400 transition hover:bg-emerald-500/10 hover:text-emerald-500", pad)}>
        <Icon name="arrowUpRight" className={ic} />
      </a>
      <button onClick={() => onQr(link.code)} title={tr(locale, { uz: "QR kod", ru: "QR код", en: "QR code", de: "QR-Code" })} className={cn("rounded-lg text-slate-400 transition hover:bg-slate-500/10 hover:text-slate-600 dark:hover:text-slate-200", pad)}>
        <Icon name="grid" className={ic} />
      </button>
      {canManage && (
        <button onClick={() => onRegen(link.id)} title={tr(locale, { uz: "Kodni yangilash", ru: "Обновить код", en: "Regenerate code", de: "Code erneuern" })} className={cn("rounded-lg text-slate-400 transition hover:bg-amber-500/10 hover:text-amber-500", pad)}>
          <Icon name="refresh" className={ic} />
        </button>
      )}
    </>
  );
}

function CodeChip({ locale, link, copied, onCopy, small }: { locale: Locale; link: VLink; copied: boolean; onCopy: (id: string, code: string) => void; small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <code className={cn("rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400", small ? "px-2 py-0.5" : "px-2.5 py-1")}>{link.code}</code>
      <button onClick={() => onCopy(link.id, link.code)} title={tr(locale, { uz: "Nusxa olish", ru: "Копировать", en: "Copy", de: "Kopieren" })} className={cn("rounded-lg text-slate-400 transition hover:bg-blue-500/10 hover:text-blue-500", small ? "p-1" : "p-1.5")}>
        <Icon name={copied ? "check" : "copy"} className={cn(small ? "h-3 w-3" : "h-3.5 w-3.5", copied && "text-emerald-500")} />
      </button>
    </div>
  );
}

function StatusToggle({ locale, link, canManage, onToggle, compact }: { locale: Locale; link: VLink; canManage: boolean; onToggle: (id: string) => void; compact?: boolean }) {
  if (link.expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {tr(locale, { uz: "Muddati o'tgan", ru: "Истёк", en: "Expired", de: "Abgelaufen" })}
      </span>
    );
  }
  const on = link.isActive;
  return (
    <button
      disabled={!canManage}
      onClick={() => onToggle(link.id)}
      title={on ? tr(locale, { uz: "O'chirish", ru: "Выключить", en: "Turn off", de: "Ausschalten" }) : tr(locale, { uz: "Yoqish", ru: "Включить", en: "Turn on", de: "Einschalten" })}
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium transition", canManage && "cursor-pointer", on ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")}
    >
      <span className={cn("relative h-4 w-7 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", on ? "left-3.5" : "left-0.5")} />
      </span>
      {!compact && (on ? tr(locale, { uz: "Faol", ru: "Активна", en: "Active", de: "Aktiv" }) : tr(locale, { uz: "Nofaol", ru: "Неактивна", en: "Inactive", de: "Inaktiv" }))}
    </button>
  );
}

function PlatformChip({ platformKey }: { platformKey: string }) {
  const p = platform(platformKey);
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${p.color}1a`, color: p.color }}>
      <Icon name={p.icon} className="h-3 w-3" /> {p.label}
    </span>
  );
}
