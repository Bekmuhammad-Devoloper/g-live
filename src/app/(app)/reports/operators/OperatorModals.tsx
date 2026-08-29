"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { archiveOperator, assignOperatorTask, createOperator, sendOperatorNotification, updateOperator, type OpResult } from "./actions";
import type { VOperator } from "./OperatorsBoard";

// Operatorlar bo'limi oynalari: yaratish/tahrirlash (drawer), o'chirish tasdig'i,
// kirish ma'lumotlari, topshiriq berish va bildirishnoma yuborish.

export const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const money = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 12); return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""; };
const grouped = (n: number) => (n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "");

function useLockBody(onClose: () => void) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [onClose]);
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Shell({ title, icon, onClose, children, wide }: { title: string; icon?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useLockBody(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cn("max-h-full w-full overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900", wide ? "max-w-lg" : "max-w-md")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            {icon && <Icon name={icon} className="h-5 w-5 text-brand-500" />} {title}
          </h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Actions({ locale, pending, onClose, submitLabel, tone = "brand" }: { locale: Locale; pending: boolean; onClose: () => void; submitLabel?: string; tone?: "brand" | "red" | "amber" }) {
  const toneCls = tone === "red" ? "bg-red-600 hover:bg-red-700" : tone === "amber" ? "bg-amber-600 hover:bg-amber-700" : "bg-brand-600 hover:bg-brand-700";
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onClose} className="h-10 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
        {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel", de: "Abbrechen" })}
      </button>
      <button type="submit" disabled={pending} className={cn("h-10 flex-1 rounded-lg text-sm font-semibold text-white shadow-sm transition disabled:opacity-60", toneCls)}>
        {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : submitLabel ?? tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
      </button>
    </div>
  );
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{text}</div>;
}

function useSubmit(locale: Locale, run: (fd: FormData) => Promise<OpResult>, done: (r: OpResult) => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await run(fd);
      if (r.ok) done(r);
      else setError(r.error ?? tr(locale, { uz: "Xatolik yuz berdi", ru: "Произошла ошибка", en: "An error occurred", de: "Ein Fehler ist aufgetreten" }));
    });
  };
  return { pending, error, submit };
}

/* ─────────── Yaratish / Tahrirlash (o'ng tomondan chiqadigan panel) ─────────── */
export function OperatorDrawer({
  locale, op, onClose, onCreated,
}: { locale: Locale; op: VOperator | null; onClose: () => void; onCreated: (c: NonNullable<OpResult["credentials"]>) => void }) {
  const router = useRouter();
  const isEdit = !!op;
  const [fiksaStr, setFiksaStr] = useState(op ? grouped(op.fiksa) : "");
  const [kpiStr, setKpiStr] = useState(op ? grouped(op.kpiBonus) : "200 000");
  useLockBody(onClose);

  const { pending, error, submit } = useSubmit(locale, isEdit ? updateOperator : createOperator, (r) => {
    onClose();
    router.refresh();
    if (r.credentials) onCreated(r.credentials);
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="animate-slide-in-right h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isEdit
              ? tr(locale, { uz: "Operatorni tahrirlash", ru: "Редактировать оператора", en: "Edit operator", de: "Operator bearbeiten" })
              : tr(locale, { uz: "Yangi operator", ru: "Новый оператор", en: "New operator", de: "Neuer Operator" })}
          </h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          {isEdit && <input type="hidden" name="id" value={op.id} />}
          <Field label={tr(locale, { uz: "F.I.Sh.", ru: "Ф.И.О.", en: "Full name", de: "Vollständiger Name" })} required>
            <input name="fullName" required defaultValue={op?.name ?? ""} placeholder={tr(locale, { uz: "Ism Familiya", ru: "Имя Фамилия", en: "First Last", de: "Vorname Nachname" })} className={inputCls} />
          </Field>
          {isEdit ? (
            <Field label="Email">
              <input value={op.email} readOnly disabled className={cn(inputCls, "opacity-60")} />
            </Field>
          ) : (
            <Field label="Email" required>
              <input name="email" type="email" required placeholder="operator@example.com" className={inputCls} />
            </Field>
          )}
          <Field label={tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })}>
            <input name="phone" defaultValue={op?.phone ?? ""} placeholder="+998 90 123 45 67" className={inputCls} />
          </Field>
          <Field label={tr(locale, { uz: "SIP raqam (telefoniya)", ru: "SIP номер (телефония)", en: "SIP extension (telephony)", de: "SIP-Nummer (Telefonie)" })}>
            <input name="sipExtension" defaultValue={op?.sip ?? ""} placeholder="operator3" className={inputCls} />
          </Field>
          <Field label={tr(locale, { uz: "Parol", ru: "Пароль", en: "Password", de: "Passwort" })} required={!isEdit}>
            <input
              name="password"
              type="password"
              required={!isEdit}
              placeholder={isEdit
                ? tr(locale, { uz: "O'zgartirmaslik uchun bo'sh qoldiring", ru: "Оставьте пустым, чтобы не менять", en: "Leave empty to keep current", de: "Leer lassen, um es nicht zu ändern" })
                : tr(locale, { uz: "Kamida 4 ta belgi", ru: "Минимум 4 символа", en: "At least 4 characters", de: "Mindestens 4 Zeichen" })}
              className={inputCls}
            />
          </Field>
          <Field label={tr(locale, { uz: "Fiksa (oylik, so'm)", ru: "Фикса (оклад, сум)", en: "Fixed salary (UZS)", de: "Fixgehalt (UZS)" })}>
            <div className="relative">
              <input name="fiksa" type="text" inputMode="numeric" value={fiksaStr} onChange={(e) => setFiksaStr(money(e.target.value))} placeholder="0" className={cn(inputCls, "pr-12 font-semibold")} style={{ borderLeft: "3px solid #3b82f6" }} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">{tr(locale, { uz: "so'm", ru: "сум", en: "UZS", de: "UZS" })}</span>
            </div>
          </Field>
          <Field label={tr(locale, { uz: "KPI — har muvaffaqiyatli lid uchun bonus (so'm)", ru: "KPI — бонус за каждый успешный лид (сум)", en: "KPI — bonus per successful lead (UZS)", de: "KPI — Bonus für jeden erfolgreichen Lead (UZS)" })}>
            <div className="relative">
              <input name="kpiBonus" type="text" inputMode="numeric" value={kpiStr} onChange={(e) => setKpiStr(money(e.target.value))} placeholder="200 000" className={cn(inputCls, "pr-12 font-semibold")} style={{ borderLeft: "3px solid #10b981" }} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">{tr(locale, { uz: "so'm", ru: "сум", en: "UZS", de: "UZS" })}</span>
            </div>
          </Field>
          <ErrorBox text={error} />
          <Actions locale={locale} pending={pending} onClose={onClose} />
        </form>
      </div>
    </div>,
    document.body,
  );
}

/* ─────────── O'chirish (arxivlash) tasdig'i ─────────── */
export function ArchiveModal({ locale, op, onClose }: { locale: Locale; op: VOperator; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, submit } = useSubmit(locale, archiveOperator, () => { onClose(); router.refresh(); });
  return (
    <Shell title={tr(locale, { uz: "Operatorni o'chirish", ru: "Удалить оператора", en: "Remove operator", de: "Operator entfernen" })} icon="trash" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <input type="hidden" name="id" value={op.id} />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <b>{op.name}</b> {tr(locale, {
            uz: "operatorini ro'yxatdan olib tashlaysizmi? Lid va qo'ng'iroq tarixi saqlanadi — foydalanuvchi arxivga o'tadi.",
            ru: "будет убран из списка? История лидов и звонков сохранится — пользователь уйдёт в архив.",
            en: "will be removed from the list? Lead and call history is kept — the user is archived.", de: "wird aus der Liste entfernt? Der Lead- und Anrufverlauf bleibt erhalten — der Benutzer wird archiviert.",
          })}
        </p>
        <Field label={tr(locale, { uz: "Sabab", ru: "Причина", en: "Reason", de: "Grund" })}>
          <input name="reason" placeholder={tr(locale, { uz: "Ixtiyoriy", ru: "Необязательно", en: "Optional", de: "Optional" })} className={inputCls} />
        </Field>
        <ErrorBox text={error} />
        <Actions locale={locale} pending={pending} onClose={onClose} tone="red" submitLabel={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Remove", de: "Entfernen" })} />
      </form>
    </Shell>
  );
}

/* ─────────── Topshiriq berish ─────────── */
export function TaskModal({ locale, op, onClose }: { locale: Locale; op: VOperator; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, submit } = useSubmit(locale, assignOperatorTask, () => { onClose(); router.refresh(); });
  return (
    <Shell title={`${tr(locale, { uz: "Topshiriq", ru: "Задача", en: "Task", de: "Aufgabe" })} — ${op.name}`} icon="clipboard" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4 p-5">
        <input type="hidden" name="id" value={op.id} />
        <Field label={tr(locale, { uz: "Topshiriq sarlavhasi", ru: "Заголовок задачи", en: "Task title", de: "Aufgabentitel" })} required>
          <input name="title" required placeholder={tr(locale, { uz: "Masalan: 50 ta qo'ng'iroq qiling", ru: "Например: сделать 50 звонков", en: "e.g. Make 50 calls", de: "z. B.: 50 Anrufe tätigen" })} className={inputCls} />
        </Field>
        <Field label={tr(locale, { uz: "Tavsif", ru: "Описание", en: "Description", de: "Beschreibung" })}>
          <textarea name="note" rows={3} placeholder={tr(locale, { uz: "Topshiriq haqida batafsil...", ru: "Подробнее о задаче...", en: "More about the task...", de: "Mehr zur Aufgabe..." })} className={cn(inputCls, "h-auto resize-none py-2")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr(locale, { uz: "Muhimligi", ru: "Приоритет", en: "Priority", de: "Priorität" })}>
            <select name="priority" defaultValue="NORMAL" className={inputCls}>
              <option value="LOW">{tr(locale, { uz: "Past", ru: "Низкий", en: "Low", de: "Niedrig" })}</option>
              <option value="NORMAL">{tr(locale, { uz: "O'rta", ru: "Средний", en: "Normal", de: "Normal" })}</option>
              <option value="HIGH">{tr(locale, { uz: "Yuqori", ru: "Высокий", en: "High", de: "Hoch" })}</option>
            </select>
          </Field>
          <Field label={tr(locale, { uz: "Muddat", ru: "Дедлайн", en: "Deadline", de: "Frist" })}>
            <input name="dueAt" type="date" className={inputCls} />
          </Field>
        </div>
        <ErrorBox text={error} />
        <Actions locale={locale} pending={pending} onClose={onClose} submitLabel={tr(locale, { uz: "Topshiriq yuborish", ru: "Отправить задачу", en: "Send task", de: "Aufgabe senden" })} />
      </form>
    </Shell>
  );
}

/* ─────────── Bildirishnoma yuborish ─────────── */
export function NotifyModal({ locale, op, onClose }: { locale: Locale; op: VOperator; onClose: () => void }) {
  const router = useRouter();
  const { pending, error, submit } = useSubmit(locale, sendOperatorNotification, () => { onClose(); router.refresh(); });
  return (
    <Shell title={`${tr(locale, { uz: "Bildirishnoma", ru: "Уведомление", en: "Notification", de: "Benachrichtigung" })} — ${op.name}`} icon="bell" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4 p-5">
        <input type="hidden" name="id" value={op.id} />
        <Field label={tr(locale, { uz: "Sarlavha", ru: "Заголовок", en: "Title", de: "Titel" })} required>
          <input name="title" required placeholder={tr(locale, { uz: "Masalan: Muhim xabar", ru: "Например: Важное сообщение", en: "e.g. Important message", de: "z. B.: Wichtige Nachricht" })} className={inputCls} />
        </Field>
        <Field label={tr(locale, { uz: "Xabar matni", ru: "Текст сообщения", en: "Message", de: "Nachricht" })}>
          <textarea name="body" rows={3} placeholder={tr(locale, { uz: "Xabar matnini yozing...", ru: "Введите текст сообщения...", en: "Write the message...", de: "Nachricht eingeben..." })} className={cn(inputCls, "h-auto resize-none py-2")} />
        </Field>
        <Field label={tr(locale, { uz: "Turi", ru: "Тип", en: "Type", de: "Typ" })}>
          <select name="event" defaultValue="message" className={inputCls}>
            <option value="message">{tr(locale, { uz: "Oddiy xabar", ru: "Обычное сообщение", en: "Plain message", de: "Einfache Nachricht" })}</option>
            <option value="info">{tr(locale, { uz: "Ma'lumot", ru: "Информация", en: "Info", de: "Info" })}</option>
            <option value="success">{tr(locale, { uz: "Muvaffaqiyat", ru: "Успех", en: "Success", de: "Erfolg" })}</option>
            <option value="warning">{tr(locale, { uz: "Ogohlantirish", ru: "Предупреждение", en: "Warning", de: "Warnung" })}</option>
            <option value="error">{tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" })}</option>
          </select>
        </Field>
        <ErrorBox text={error} />
        <Actions locale={locale} pending={pending} onClose={onClose} tone="amber" submitLabel={tr(locale, { uz: "Yuborish", ru: "Отправить", en: "Send", de: "Senden" })} />
      </form>
    </Shell>
  );
}

/* ─────────── Yaratilgan operator kirish ma'lumotlari ─────────── */
export function CredentialsModal({
  locale, cred, onClose,
}: { locale: Locale; cred: NonNullable<OpResult["credentials"]>; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, field: string) => { navigator.clipboard.writeText(text); setCopied(field); setTimeout(() => setCopied(null), 2000); };
  return (
    <Shell title={tr(locale, { uz: "Operator yaratildi", ru: "Оператор создан", en: "Operator created", de: "Operator erstellt" })} icon="check" onClose={onClose}>
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <b className="text-slate-700 dark:text-slate-200">{cred.fullName}</b>{" "}
          {tr(locale, { uz: "muvaffaqiyatli yaratildi. Kirish ma'lumotlarini saqlab qo'ying:", ru: "успешно создан. Сохраните данные для входа:", en: "was created successfully. Save the login details:", de: "wurde erfolgreich erstellt. Speichern Sie die Anmeldedaten:" })}
        </p>
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-white/[0.03]">
          {[
            { k: "login", label: "Login", value: cred.email },
            { k: "pass", label: tr(locale, { uz: "Parol", ru: "Пароль", en: "Password", de: "Passwort" }), value: cred.password },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{r.label}:</span>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{r.value}</span>
                <button type="button" onClick={() => copy(r.value, r.k)} className="rounded p-1 text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700">
                  <Icon name={copied === r.k ? "check" : "copy"} className={cn("h-3.5 w-3.5", copied === r.k && "text-emerald-500")} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {tr(locale, { uz: "Parol keyinchalik kartadagi \"Kirish ma'lumotlari\" bo'limida ham ko'rinadi.", ru: "Пароль позже также виден в разделе «Данные входа» на карточке.", en: "The password is also visible later in the card's \"Login details\" section.", de: "Das Passwort ist später auch im Abschnitt \"Anmeldedaten\" der Karte sichtbar." })}
        </p>
        <button type="button" onClick={onClose} className="h-10 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700">
          {tr(locale, { uz: "Tushunarli", ru: "Понятно", en: "Got it", de: "Verstanden" })}
        </button>
      </div>
    </Shell>
  );
}
