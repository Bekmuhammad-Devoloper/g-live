"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { LEAD_STAGE_LABELS, formatMoney, type Locale } from "@/lib/constants";
import { Icon } from "../../../_components/Icon";
import type { DLead } from "./OperatorDetail";

// Operatorga biriktirilgan lidlar ro'yxati — har bir qator ochiladi va
// lid ma'lumotlari, qo'ng'iroq statistikasi hamda faoliyat tarixini ko'rsatadi.

const fmtDur = (sec: number) => {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}:${p2(m)}:${p2(sec % 60)}` : `${m}:${p2(sec % 60)}`;
};

const STAGE_TONE: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  CONTACTED: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  TEST: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  OFFER: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  AWAITING_PAYMENT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PAID: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  WON: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  LOST: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const ACT_ICON: Record<string, string> = {
  call: "phoneCall",
  message: "mail",
  meeting: "users",
  note: "clipboard",
  stage_change: "chart",
  test: "filecheck",
};

const ACT_LABEL: Record<string, { uz: string; ru: string; en: string; de: string }> = {
  call: { uz: "Qo'ng'iroq", ru: "Звонок", en: "Call", de: "Anruf" },
  message: { uz: "Xabar", ru: "Сообщение", en: "Message", de: "Nachricht" },
  meeting: { uz: "Uchrashuv", ru: "Встреча", en: "Meeting", de: "Treffen" },
  note: { uz: "Izoh", ru: "Заметка", en: "Note", de: "Notiz" },
  stage_change: { uz: "Bosqich o'zgarishi", ru: "Смена этапа", en: "Stage change", de: "Phasenwechsel" },
  test: { uz: "Test", ru: "Тест", en: "Test", de: "Test" },
};

const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function LeadList({ locale, leads }: { locale: Locale; leads: DLead[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (leads.length === 0) {
    return (
      <div className="py-14 text-center">
        <Icon name="phoneOff" className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Lid topilmadi", ru: "Лид не найден", en: "No lead found", de: "Kein Lead gefunden" })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 p-4">
      {leads.map((l) => {
        const expanded = open === l.id;
        const stageLabel = LEAD_STAGE_LABELS[l.stage]?.[locale] ?? l.stage;
        return (
          <div key={l.id} className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : l.id)}
              className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.03]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  {initials(l.name)}
                </span>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{l.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Icon name="phone" className="h-3 w-3" />
                    <span>{l.phone}</span>
                    {l.source && <><span>•</span><span className="truncate">{l.source}</span></>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {l.talked && (
                  <span className="hidden items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400">
                    <Icon name="phoneCall" className="h-3 w-3" /> {tr(locale, { uz: "Gaplashilgan", ru: "Поговорили", en: "Talked", de: "Gesprochen" })}
                  </span>
                )}
                {l.calls > 0 && (
                  <span className="hidden items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-600 sm:inline-flex dark:text-blue-400">
                    <Icon name="phone" className="h-3 w-3" /> {l.calls}
                  </span>
                )}
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", STAGE_TONE[l.stage] ?? STAGE_TONE.NEW)}>{stageLabel}</span>
                <span className="hidden text-xs text-slate-400 md:inline">{l.updatedAt}</span>
                <Icon name="chevronDown" className={cn("h-4 w-4 shrink-0 text-slate-300 transition-transform", expanded && "rotate-180")} />
              </div>
            </button>

            {expanded && (
              <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-white/[0.02]">
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Cell label={tr(locale, { uz: "Ism", ru: "Имя", en: "Name", de: "Name" })} value={l.name} />
                  <Cell label={tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })} value={l.phone} />
                  <Cell label={tr(locale, { uz: "Manba", ru: "Источник", en: "Source", de: "Quelle" })} value={l.source ?? "—"} />
                  <Cell label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course", de: "Kurs" })} value={l.course ?? "—"} />
                  <Cell label={tr(locale, { uz: "Byudjet", ru: "Бюджет", en: "Budget", de: "Budget" })} value={l.budget != null ? formatMoney(l.budget, locale) : "—"} />
                  <Cell label={tr(locale, { uz: "Qo'ng'iroqlar", ru: "Звонки", en: "Calls", de: "Anrufe" })} value={`${l.calls} (${tr(locale, { uz: "javob", ru: "ответ", en: "answered", de: "beantwortet" })}: ${l.answered})`} />
                  <Cell label={tr(locale, { uz: "Gaplashgan", ru: "Наговорено", en: "Talk time", de: "Sprechzeit" })} value={fmtDur(l.talkSec)} />
                  <Cell label={tr(locale, { uz: "Yaratilgan", ru: "Создан", en: "Created", de: "Erstellt" })} value={l.createdAt} />
                </div>

                {l.note && (
                  <div className="rounded-xl bg-white p-3.5 dark:bg-slate-900">
                    <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <Icon name="alignLeft" className="h-4 w-4 text-slate-400" /> {tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note", de: "Notiz" })}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{l.note}</p>
                  </div>
                )}

                {l.activities.length > 0 && (
                  <div>
                    <h5 className="mb-2.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <Icon name="history" className="h-4 w-4 text-slate-400" />
                      {tr(locale, { uz: "Faoliyat tarixi", ru: "История активности", en: "Activity history", de: "Aktivitätsverlauf" })} ({l.activities.length})
                    </h5>
                    <div className="space-y-2">
                      {l.activities.map((a) => (
                        <div key={a.id} className="rounded-xl bg-white p-3 dark:bg-slate-900">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon name={ACT_ICON[a.type] ?? "info"} className="h-4 w-4 text-brand-500" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                {ACT_LABEL[a.type] ? tr(locale, ACT_LABEL[a.type]) : a.type}
                              </span>
                            </div>
                            <span className="shrink-0 text-xs text-slate-400">{a.date}</span>
                          </div>
                          {a.result && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{a.result}</p>}
                          {a.author && <span className="mt-1 block text-xs text-slate-400">— {a.author}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link href={`/crm/${l.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
                  <Icon name="eye" className="h-4 w-4" /> {tr(locale, { uz: "Lid kartasini ochish", ru: "Открыть карточку лида", en: "Open lead card", de: "Lead-Karte öffnen" })}
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-xs text-slate-400">{label}</span>
      <span className="block truncate font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
