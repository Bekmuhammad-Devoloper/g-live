"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatMoney, LEAD_STAGE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Icon } from "../../_components/Icon";
import { COLUMNS, colorOfStage, initials } from "../_lib/leadColumns";
import { updateLeadField, setLeadManager, moveLeadStage, convertLead, addLeadActivity } from "../actions";

export interface DLead {
  id: string; fullName: string; phone: string; email: string | null; source: string | null;
  stage: string; interestCourse: string | null; budget: number | null; note: string | null;
  managerId: string | null; managerName: string | null; studentId: string | null; createdAt: string;
}
export interface DActivity {
  id: string; type: string; result: string | null; nextStepAt: string | null; authorName: string | null; createdAt: string;
}
interface Opt { id: string; name: string }

function fmt(iso: string) {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function LeadDetail({ lead, activities, managers, prevId, nextId, canWrite, locale }: {
  lead: DLead; activities: DActivity[]; managers: Opt[]; prevId: string | null; nextId: string | null; canWrite: boolean; locale: Locale;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"info" | "activity">("info");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const color = colorOfStage(lead.stage);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  // Klaviatura: Esc → orqaga, ←/→ → oldingi/keyingi
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement?.tagName;
      if (el === "INPUT" || el === "TEXTAREA" || el === "SELECT") return;
      if (e.key === "Escape") router.push("/crm");
      if (e.key === "ArrowLeft" && prevId) router.push(`/crm/${prevId}`);
      if (e.key === "ArrowRight" && nextId) router.push(`/crm/${nextId}`);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router, prevId, nextId]);

  const save = (field: string, value: string) => run(() => updateLeadField(lead.id, field, value));

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/crm" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> {tr(locale, { uz: "Orqaga", ru: "Назад", en: "Back" })}
        </Link>
        <div className="flex items-center gap-2">
          <NavBtn href={prevId ? `/crm/${prevId}` : null} icon="arrow" flip label={tr(locale, { uz: "Oldingi", ru: "Предыдущий", en: "Previous" })} />
          <NavBtn href={nextId ? `/crm/${nextId}` : null} icon="arrow" label={tr(locale, { uz: "Keyingi", ru: "Следующий", en: "Next" })} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Chap: profil + tablar */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900" style={{ borderTop: `3px solid ${color}` }}>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold" style={{ color, background: `${color}1f`, boxShadow: `inset 0 0 0 3px ${color}55` }}>
                {initials(lead.fullName)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">{lead.fullName}</h1>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("glive:call", { detail: { number: lead.phone, leadId: lead.id, contactName: lead.fullName } }))}
                  title={tr(locale, { uz: "Qo'ng'iroq qilish", ru: "Позвонить", en: "Call" })}
                  className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                >
                  <Icon name="phone" className="h-3.5 w-3.5" /> {lead.phone}
                </button>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color, background: `${color}1a` }}>
                    {label(LEAD_STAGE_LABELS, lead.stage, locale)}
                  </span>
                  {lead.studentId && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">✓ {tr(locale, { uz: "O'quvchi", ru: "Ученик", en: "Student" })}</span>}
                </div>
              </div>
            </div>

            {/* Tablar */}
            <div className="mt-5 flex gap-1 border-b border-slate-100 dark:border-slate-800">
              <TabBtn active={tab === "info"} onClick={() => setTab("info")}>{tr(locale, { uz: "Ma'lumot", ru: "Информация", en: "Info" })}</TabBtn>
              <TabBtn active={tab === "activity"} onClick={() => setTab("activity")}>{tr(locale, { uz: "Faoliyat", ru: "Активность", en: "Activity" })} ({activities.length})</TabBtn>
            </div>

            {tab === "info" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label={tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name" })} value={lead.fullName} onSave={(v) => save("fullName", v)} readonly={!canWrite} />
                <Field label={tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone" })} value={lead.phone} onSave={(v) => save("phone", v)} readonly={!canWrite} />
                <Field label={tr(locale, { uz: "E-mail", ru: "E-mail", en: "E-mail" })} value={lead.email ?? ""} onSave={(v) => save("email", v)} readonly={!canWrite} />
                <Field label={tr(locale, { uz: "Manba", ru: "Источник", en: "Source" })} value={lead.source ?? ""} onSave={(v) => save("source", v)} readonly={!canWrite} />
                <Field label={tr(locale, { uz: "Kurs", ru: "Курс", en: "Course" })} value={lead.interestCourse ?? ""} onSave={(v) => save("interestCourse", v)} readonly={!canWrite} />
                <Field label={tr(locale, { uz: "Byudjet (so'm)", ru: "Бюджет (сум)", en: "Budget (UZS)" })} value={lead.budget?.toString() ?? ""} onSave={(v) => save("budget", v)} readonly={!canWrite} />
                <div className="sm:col-span-2">
                  <Field label={tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note" })} value={lead.note ?? ""} onSave={(v) => save("note", v)} readonly={!canWrite} textarea />
                </div>
              </div>
            ) : (
              <div className="mt-4">
                {activities.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">{tr(locale, { uz: "Faoliyat yo'q", ru: "Нет активности", en: "No activity" })}</p>
                ) : (
                  <ul className="space-y-3">
                    {activities.map((a) => (
                      <li key={a.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                          <span className="mt-1 w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                        </div>
                        <div className="min-w-0 flex-1 pb-1">
                          <div className="text-sm text-slate-700 dark:text-slate-200">{a.result ?? a.type}</div>
                          <div className="mt-0.5 text-xs text-slate-400">{a.authorName ?? "—"} · {fmt(a.createdAt)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* O'ng: tez amallar */}
        <div className="space-y-4">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Tez amallar", ru: "Быстрые действия", en: "Quick actions" })}</h3>
              {canWrite ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">{tr(locale, { uz: "Menejer", ru: "Менеджер", en: "Manager" })}</label>
                    <select value={lead.managerId ?? ""} disabled={pending} onChange={(e) => run(() => setLeadManager(lead.id, e.target.value || null))} className="input">
                      <option value="">{tr(locale, { uz: "— tayinlanmagan", ru: "— не назначен", en: "— unassigned" })}</option>
                      {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">{tr(locale, { uz: "Bosqich", ru: "Этап", en: "Stage" })}</label>
                    <select value={lead.stage} disabled={pending} onChange={(e) => run(() => moveLeadStage(lead.id, e.target.value))} className="input">
                      {COLUMNS.map((c) => <option key={c.key} value={c.defaultStage}>{label(LEAD_STAGE_LABELS, c.defaultStage, locale)}</option>)}
                    </select>
                  </div>
                  {!lead.studentId && (
                    <button onClick={() => run(() => convertLead(lead.id))} disabled={pending} className="btn-ghost w-full justify-start">
                      <Icon name="graduation" className="h-4 w-4" /> {tr(locale, { uz: "O'quvchiga aylantirish", ru: "Преобразовать в ученика", en: "Convert to student" })}
                    </button>
                  )}
                  <button onClick={() => window.dispatchEvent(new CustomEvent("glive:call", { detail: { number: lead.phone, leadId: lead.id, contactName: lead.fullName } }))} className="btn-ghost w-full justify-start">
                    <Icon name="phoneCall" className="h-4 w-4" /> {tr(locale, { uz: "Qo'ng'iroq qilish", ru: "Позвонить", en: "Call" })}
                  </button>
                  <button onClick={() => navigator.clipboard?.writeText(lead.phone)} className="btn-ghost w-full justify-start">
                    <Icon name="copy" className="h-4 w-4" /> {tr(locale, { uz: "Telefonni nusxalash", ru: "Копировать телефон", en: "Copy phone" })}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">{tr(locale, { uz: "Sizda tahrirlash huquqi yo'q.", ru: "У вас нет прав на редактирование.", en: "You do not have edit permission." })}</p>
              )}
            </div>

            {/* Izoh qo'shish */}
            {canWrite && (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Izoh qo'shish", ru: "Добавить комментарий", en: "Add note" })}</h3>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={tr(locale, { uz: "Izoh yozing...", ru: "Напишите комментарий...", en: "Write a note..." })} className="input" />
                <button
                  onClick={() => { if (note.trim()) { run(() => addLeadActivity(lead.id, "note", note)); setNote(""); } }}
                  disabled={pending || !note.trim()}
                  className="btn-primary mt-2 w-full"
                >
                  {tr(locale, { uz: "Qo'shish", ru: "Добавить", en: "Add" })}
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 text-xs text-slate-400 shadow-card dark:border-slate-800 dark:bg-slate-900">
              {tr(locale, { uz: "Yaratilgan", ru: "Создан", en: "Created" })}: {fmt(lead.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("border-b-2 px-3 py-2 text-sm font-medium transition", active ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
      {children}
    </button>
  );
}

function NavBtn({ href, icon, label, flip }: { href: string | null; icon: string; label: string; flip?: boolean }) {
  const cls = "flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300";
  if (!href) return <span className={cn(cls, "cursor-not-allowed opacity-40")}><Icon name={icon} className={cn("h-4 w-4", flip && "rotate-180")} /> {label}</span>;
  return <Link href={href} className={cls}><Icon name={icon} className={cn("h-4 w-4", flip && "rotate-180")} /> {label}</Link>;
}

function Field({ label, value, onSave, readonly, textarea }: { label: string; value: string; onSave: (v: string) => void; readonly?: boolean; textarea?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v !== value) onSave(v); };
  const cls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:bg-white disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800";
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {textarea ? (
        <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} disabled={readonly} rows={2} className={cls} />
      ) : (
        <input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} disabled={readonly} className={cls} />
      )}
    </div>
  );
}
