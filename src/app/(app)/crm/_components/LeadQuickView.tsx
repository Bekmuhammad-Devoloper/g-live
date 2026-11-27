"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import { formatMoney, LEAD_STAGE_LABELS, ROLE_LABELS, label, type Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import DemoAvatar from "../../_components/DemoAvatar";
import { columnDef, columnOf, type VLead } from "../_lib/leadColumns";
import { addLeadComment, listLeadComments, type LeadComment } from "../actions";
import PaymentPanel from "../../students/PaymentPanel";
import type { LeadPayment } from "../[id]/LeadDetail";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const SOURCE_ICON: Record<string, string> = { instagram: "instagram", telegram: "telegram", sayt: "globe", site: "globe", web: "globe" };
const sourceIcon = (s: string) => SOURCE_ICON[s.trim().toLowerCase()] ?? "tag";
const iconBtn = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-100";

export default function LeadQuickView({
  lead, locale, canWrite, onClose, onEnroll, onDelete, onCommented, payment,
}: {
  payment?: LeadPayment | null;
  lead: VLead;
  locale: Locale;
  canWrite: boolean;
  onClose: () => void;
  onEnroll: () => void;
  onDelete?: () => void;
  onCommented?: (leadId: string, at: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const col = columnDef(columnOf(lead.stage));
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

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

  const copyPhone = () => {
    const done = navigator.clipboard?.writeText(lead.phone);
    if (!done) return;
    done.then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };

  const tiles: { icon: string; label: string; value: string | null }[] = [
    {
      icon: "graduation",
      label: L("Ta'lim shakli", "Формат обучения", "Study format", "Unterrichtsform"),
      value: lead.studyFormat ? (lead.studyFormat === "ONLINE" ? L("Onlayn", "Онлайн", "Online", "Online") : L("Oflayn", "Офлайн", "Offline", "Präsenz")) : null,
    },
    { icon: "book", label: L("Qiziqqan kurs", "Интересующий курс", "Course of interest", "Interessierter Kurs"), value: lead.interestCourse },
    { icon: "wallet", label: L("Byudjet", "Бюджет", "Budget", "Budget"), value: lead.budget ? formatMoney(lead.budget, locale) : null },
    { icon: "user", label: L("Menejer", "Менеджер", "Manager", "Manager"), value: lead.managerName },
    { icon: "calendar", label: L("Yaratilgan", "Создан", "Created", "Erstellt"), value: fmtDate(lead.createdAt) },
    { icon: "clock", label: L("Oxirgi harakat", "Последняя активность", "Last activity", "Letzte Aktivität"), value: fmtDate(lead.lastActivity) },
    { icon: "history", label: L("Harakatlar soni", "Кол-во действий", "Activities", "Aktivitäten"), value: String(lead.activityCount) },
    ...(lead.testPct != null
      ? [{
          icon: "filecheck",
          label: L("Daraja testi", "Тест уровня", "Level test", "Einstufungstest"),
          value: `${lead.testSet ?? ""} ${lead.testPct}% · ${lead.testLevel ?? L("o'tmadi", "не сдал", "failed", "nicht bestanden")}`.trim(),
        }]
      : []),
  ];

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lead.fullName}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[400px] max-w-[92%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#171614]"
      >
        <div className="relative shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/[0.06]">
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 95% at 0% 0%, ${col.color}29 0%, ${col.color}0b 40%, transparent 66%)` }} />
          <div className="relative px-4 pb-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} />
                {L("Lid kartasi", "Карточка лида", "Lead card", "Lead-Karte")}
              </span>
              <button type="button" onClick={onClose} aria-label={L("Yopish", "Закрыть", "Close", "Schließen")} className={iconBtn}>
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <DemoAvatar size={48} ringColor={col.color} className="ring-offset-2 ring-offset-white dark:ring-offset-[#171614]" />
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-[16px] font-bold leading-snug text-slate-900 dark:text-white">{lead.fullName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: col.color, background: `${col.color}1f` }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} />
                    {label(LEAD_STAGE_LABELS, lead.stage, locale)}
                  </span>
                  {lead.source && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 dark:bg-white/[0.07] dark:text-slate-300">
                      <Icon name={sourceIcon(lead.source)} className="h-3 w-3" /> {lead.source}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 py-1 pl-3 pr-1 shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.04]">
              <Icon name="phone" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="ml-1 min-w-0 flex-1 select-all truncate text-[14px] font-semibold tabular-nums text-slate-900 dark:text-white">{lead.phone}</span>
              <button type="button" onClick={copyPhone} title={L("Nusxa olish", "Копировать", "Copy", "Kopieren")} className={iconBtn}>
                <Icon name={copied ? "check" : "copy"} className={cn("h-3.5 w-3.5", copied && "text-emerald-500")} />
              </button>
              <button
                type="button"
                onClick={call}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[.98]"
              >
                <Icon name="phoneCall" className="h-3.5 w-3.5" /> {L("Qo'ng'iroq", "Позвонить", "Call", "Anrufen")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {(lead.email || lead.telegram) && (
            <Section icon="mail" title={L("Aloqa", "Контакты", "Contact", "Kontakt")}>
              <div className="space-y-1.5">
                {lead.email && <InfoLine icon="mail" label="Email" value={lead.email} />}
                {lead.telegram && <InfoLine icon="telegram" label="Telegram" value={lead.telegram} />}
              </div>
            </Section>
          )}

          <Section icon="info" title={L("Ma'lumotlar", "Данные", "Details", "Details")}>
            <div className="grid grid-cols-2 gap-1.5">
              {tiles.map((t, i) => (
                <Tile key={t.label} icon={t.icon} label={t.label} value={t.value} wide={i === tiles.length - 1 && tiles.length % 2 === 1} />
              ))}
            </div>
          </Section>

          <Section icon="layers" title={L("Guruh", "Группа", "Group", "Gruppe")}>
            {lead.groupName ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 dark:border-emerald-500/25 dark:bg-emerald-500/[0.08]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Icon name="layers" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">{lead.groupName}</div>
                  <div className="truncate text-[11px] text-emerald-600/80 dark:text-emerald-400/70">
                    {lead.enrollEditCount > 0
                      ? L("O'zgartirish imkoni tugagan", "Изменение больше недоступно", "No further changes allowed", "Keine weiteren Änderungen möglich")
                      : L("Bir marta o'zgartirish mumkin", "Можно изменить один раз", "Can be changed once", "Kann einmal geändert werden")}
                  </div>
                </div>
                {canWrite && lead.enrollEditCount === 0 && (
                  <button
                    type="button"
                    onClick={onEnroll}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300 transition hover:bg-emerald-100 dark:bg-transparent dark:text-emerald-300 dark:ring-emerald-500/40 dark:hover:bg-emerald-500/15"
                  >
                    <Icon name="pencil" className="h-3.5 w-3.5" /> {L("O'zgartirish", "Изменить", "Change", "Ändern")}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 dark:border-white/15">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 dark:bg-white/[0.06]">
                  <Icon name="layers" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200">{L("Yo'naltirilmagan", "Не назначена", "Not assigned", "Nicht zugewiesen")}</div>
                  <div className="truncate text-[11px] text-slate-400">{L("Guruh hali tanlanmagan", "Группа ещё не выбрана", "No group chosen yet", "Noch keine Gruppe")}</div>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={onEnroll}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-[12px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-100 active:scale-[.98] dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/30 dark:hover:bg-brand-500/25"
                  >
                    <Icon name="plus" className="h-3.5 w-3.5" /> {L("Guruhga yo'naltirish", "Назначить группу", "Assign group", "Gruppe zuweisen")}
                  </button>
                )}
              </div>
            )}
          </Section>

          {lead.studentId && payment && (payment.canManage || payment.canPay || payment.rop) && (
            <div className="rounded-xl border border-slate-200/80 p-2.5 dark:border-white/[0.08]">
              <PaymentPanel
                studentId={lead.studentId}
                locale={locale}
                canManage={payment.canManage}
                canPay={payment.canPay}
                rop={payment.rop}
                cashierName={payment.cashierName}
                receiptMode={payment.receiptMode}
                defaultPurpose={payment.defaultPurpose}
              />
            </div>
          )}

          <Comments lead={lead} locale={locale} canWrite={canWrite} onCommented={onCommented} />
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white px-4 py-3 dark:border-white/[0.06] dark:bg-[#171614]">
          <Link
            href={`/crm/${lead.id}`}
            className="group flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:border-brand-400/40 dark:hover:bg-brand-500/10 dark:hover:text-white"
          >
            {L("To'liq sahifani ochish", "Открыть полностью", "Open full page", "Vollständige Seite öffnen")}
            <Icon name="arrowUpRight" className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title={L("Lidni o'chirish", "Удалить лид", "Delete lead", "Lead löschen")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Comments({ lead, locale, canWrite, onCommented }: { lead: VLead; locale: Locale; canWrite: boolean; onCommented?: (leadId: string, at: string) => void }) {
  const [items, setItems] = useState<LeadComment[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  useEffect(() => {
    let alive = true;
    setItems(null);
    listLeadComments(lead.id).then((r) => { if (alive) setItems(r); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [lead.id]);

  const submit = () => {
    const body = text.trim();
    if (!body || pending) return;
    setError(false);
    start(async () => {
      const r = await addLeadComment(lead.id, body);
      if (r.ok && r.comment) {
        const added = r.comment;
        setItems((prev) => [added, ...(prev ?? [])]);
        setText("");
        onCommented?.(lead.id, added.createdAt);
      } else setError(true);
    });
  };

  const count = (items?.length ?? 0) + (lead.note ? 1 : 0);
  const kbd = "rounded border border-slate-200 px-1 font-sans text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400";

  return (
    <Section icon="alignLeft" title={`${L("Izohlar", "Комментарии", "Comments", "Kommentare")}${items ? ` (${count})` : ""}`}>
      <div className="space-y-2.5">
        {canWrite && (
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/10 dark:border-white/10 dark:bg-white/[0.03]">
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
              rows={2}
              maxLength={2000}
              placeholder={L("Izoh yozing...", "Напишите комментарий...", "Write a comment...", "Kommentar schreiben...")}
              className="block w-full resize-none bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-400">
                {error
                  ? <span className="font-medium text-rose-500">{L("Saqlab bo'lmadi, qayta urinib ko'ring", "Не удалось сохранить, попробуйте снова", "Could not save, try again", "Speichern fehlgeschlagen, erneut versuchen")}</span>
                  : <><kbd className={kbd}>Ctrl</kbd> + <kbd className={kbd}>Enter</kbd></>}
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !text.trim()}
                className="h-7 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? L("Saqlanmoqda...", "Сохранение...", "Saving...", "Wird gespeichert...") : L("Izoh qo'shish", "Добавить", "Add comment", "Hinzufügen")}
              </button>
            </div>
          </div>
        )}

        {items === null ? (
          <div className="space-y-2">
            {[0, 1].map((k) => <div key={k} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}
          </div>
        ) : count === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-white/10">
            {L("Hali izoh yozilmagan", "Комментариев пока нет", "No comments yet", "Noch keine Kommentare")}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]">
                <div className="flex items-center gap-2">
                  <DemoAvatar size={24} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                    {c.authorName ?? L("Noma'lum", "Неизвестно", "Unknown", "Unbekannt")}
                    {c.authorRole && <span className="ml-1.5 text-[11px] font-normal text-slate-400">{label(ROLE_LABELS, c.authorRole, locale)}</span>}
                  </span>
                  <time dateTime={c.createdAt} className="shrink-0 text-[10.5px] tabular-nums text-slate-400">{fmtDateTime(c.createdAt)}</time>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">{c.text}</p>
              </li>
            ))}
            {lead.note && (
              <li className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
                    <Icon name="clipboard" className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-amber-700 dark:text-amber-300">
                    {L("Dastlabki izoh (ariza)", "Первичная заметка (заявка)", "Initial note (application)", "Erste Notiz (Antrag)")}
                  </span>
                  <time dateTime={lead.createdAt} className="shrink-0 text-[10.5px] tabular-nums text-slate-400">{fmtDateTime(lead.createdAt)}</time>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">{lead.note}</p>
              </li>
            )}
          </ul>
        )}
      </div>
    </Section>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </section>
  );
}

function Tile({ icon, label: k, value, wide }: { icon: string; label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-slate-200/80 bg-slate-50/70 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]", wide && "col-span-2")}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400">
        <Icon name={icon} className="h-3 w-3 shrink-0" />
        <span className="truncate">{k}</span>
      </div>
      <div className={cn("mt-0.5 break-words text-[13px] font-semibold", value ? "text-slate-800 dark:text-slate-100" : "text-slate-300 dark:text-slate-600")}>{value || "—"}</div>
    </div>
  );
}

function InfoLine({ icon, label: k, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 px-2.5 py-2 dark:border-white/[0.06]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10.5px] text-slate-400">{k}</div>
        <div className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{value}</div>
      </div>
    </div>
  );
}
