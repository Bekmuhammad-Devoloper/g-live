"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../_components/Icon";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import type { VTeacher } from "./TeachersView";
import { setTeacherFiksa, updateCurrentSalary } from "./salaryActions";
import { getTeacherCredentials, setTeacherPassword } from "./teacherActions";

const MONTHS: Record<Locale, string[]> = {
  uz: ["", "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["", "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
const monthLabel = (y: number, m: number, locale: Locale) => `${MONTHS[locale][m] ?? m}, ${y}`;
// ixcham raqam (birliksiz): 3000000 -> "3 000 000"
const nf = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function SalaryModal({ teacher: t, canManage, locale, onClose }: { teacher: VTeacher; canManage: boolean; locale: Locale; onClose: () => void }) {
  const [fiksa, setFiksa] = useState(t.fiksa);
  const [bonus, setBonus] = useState(t.bonus);
  const [penalty, setPenalty] = useState(t.penalty);
  const [kpi, setKpi] = useState(t.kpi);
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);

  const total = Math.max(0, fiksa) + Math.max(0, bonus) + Math.max(0, kpi) - Math.max(0, penalty);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function save() {
    start(async () => {
      await setTeacherFiksa(t.id, fiksa);
      await updateCurrentSalary(t.id, bonus, penalty, kpi);
      onClose();
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[400px] max-w-[90%] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            {t.imageUrl ? (
              <span className="h-11 w-11 shrink-0 rounded-full bg-cover bg-center ring-2 ring-brand-500/30" style={{ backgroundImage: `url(${t.imageUrl})` }} />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300"><Icon name="user" className="h-6 w-6" /></span>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-slate-800 dark:text-slate-100">{t.fullName}</div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400"><Icon name="wallet" className="h-3.5 w-3.5 text-amber-500" /> {tr(locale, { uz: "Maosh boshqaruvi", ru: "Управление зарплатой", en: "Salary management", de: "Gehaltsverwaltung" })} · {monthLabel(new Date().getFullYear(), new Date().getMonth() + 1, locale)}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
        </div>

        {/* Joriy oy */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tr(locale, { uz: "Joriy oy", ru: "Текущий месяц", en: "Current month", de: "Aktueller Monat" })}</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{tr(locale, { uz: "Ochiq", ru: "Открыт", en: "Open", de: "Offen" })}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tr(locale, { uz: "Fiksa (asosiy)", ru: "Фикса (основная)", en: "Base (fixed)", de: "Grundgehalt (fest)" })} value={fiksa} onChange={setFiksa} disabled={!canManage} color="#3b82f6" />
            <Field label={tr(locale, { uz: "Bonus", ru: "Бонус", en: "Bonus", de: "Bonus" })} value={bonus} onChange={setBonus} disabled={!canManage} color="#10b981" />
            <Field label={tr(locale, { uz: "Jarima", ru: "Штраф", en: "Penalty", de: "Strafe" })} value={penalty} onChange={setPenalty} disabled={!canManage} color="#ef4444" />
            <Field label={tr(locale, { uz: "KPI bonus (so'm)", ru: "KPI бонус (сум)", en: "KPI bonus (so'm)", de: "KPI-Bonus (UZS)" })} value={kpi} onChange={setKpi} disabled={!canManage} color="#8b5cf6" />
          </div>

          {/* Jami */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-300">{tr(locale, { uz: "Bu oy jami", ru: "Итого за месяц", en: "Total this month", de: "Summe diesen Monat" })}</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">{formatMoney(total, locale)}</span>
          </div>

          {canManage && (
            <button
              onClick={save}
              disabled={pending}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
            </button>
          )}
        </div>

        {/* Kirish ma'lumotlari (faqat rahbariyat) */}
        {canManage && <CredentialsSection teacherId={t.id} email={t.email} locale={locale} />}

        {/* Tarix */}
        <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Icon name="history" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Oldingi oylar", ru: "Прошлые месяцы", en: "Previous months", de: "Vorherige Monate" })}
          </div>
          {t.history.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-400">{tr(locale, { uz: "Tarix hali yo'q", ru: "Истории пока нет", en: "No history yet", de: "Noch keine Historie" })}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 dark:bg-white/[0.03]">
                  <tr>
                    <th className="px-3 py-2">{tr(locale, { uz: "Oy", ru: "Месяц", en: "Month", de: "Monat" })}</th>
                    <th className="px-3 py-2 text-right">{tr(locale, { uz: "Fiksa", ru: "Фикса", en: "Base", de: "Grundgehalt" })}</th>
                    <th className="px-3 py-2 text-right">{tr(locale, { uz: "Bonus", ru: "Бонус", en: "Bonus", de: "Bonus" })}</th>
                    <th className="px-3 py-2 text-right">{tr(locale, { uz: "Jarima", ru: "Штраф", en: "Penalty", de: "Strafe" })}</th>
                    <th className="px-3 py-2 text-right">KPI</th>
                    <th className="px-3 py-2 text-right">{tr(locale, { uz: "Jami", ru: "Итого", en: "Total", de: "Summe" })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {t.history.map((h) => (
                    <tr key={`${h.year}-${h.month}`} className="text-slate-600 dark:text-slate-300">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{monthLabel(h.year, h.month, locale)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{nf(h.fiksa)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{h.bonus ? `+${nf(h.bonus)}` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-rose-500">{h.penalty ? `−${nf(h.penalty)}` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-violet-600 dark:text-violet-400">{h.kpi ? `+${nf(h.kpi)}` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">{nf(h.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-1.5 text-right text-[10px] text-slate-400">{tr(locale, { uz: "summalar so'mda", ru: "суммы в сумах", en: "amounts in so'm", de: "Beträge in UZS" })}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, value, onChange, disabled, color, max }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean; color: string; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-400">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value ? nf(value) : ""}
        disabled={disabled}
        placeholder="0"
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").slice(0, max != null ? 3 : 12);
          let n = d ? parseInt(d, 10) : 0;
          if (max != null) n = Math.min(max, n);
          onChange(n);
        }}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold tabular-nums text-slate-800 outline-none transition focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:disabled:bg-slate-800/30"
        style={{ borderLeft: `3px solid ${color}` }}
      />
    </label>
  );
}

// Kirish ma'lumotlari — login (email) + parol (talab bo'yicha ochiladi) + parolni yangilash
function CredentialsSection({ teacherId, email, locale }: { teacherId: string; email: string | null; locale: Locale }) {
  const [password, setPassword] = useState<string | null | undefined>(undefined); // undefined = hali olinmagan
  const [show, setShow] = useState(false);
  const [loading, startLoad] = useTransition();
  const [newPw, setNewPw] = useState("");
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const reveal = () => startLoad(async () => {
    const r = await getTeacherCredentials(teacherId);
    if (r.ok) { setPassword(r.password ?? null); setShow(true); } else setMsg(r.error ?? "Xatolik");
  });
  const savePw = () => startSave(async () => {
    const r = await setTeacherPassword(teacherId, newPw);
    if (r.ok) { setPassword(newPw); setShow(true); setNewPw(""); setMsg(tr(locale, { uz: "Parol yangilandi", ru: "Пароль обновлён", en: "Password updated", de: "Passwort aktualisiert" })); }
    else setMsg(r.error ?? "Xatolik");
  });
  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => setMsg(tr(locale, { uz: "Nusxalandi", ru: "Скопировано", en: "Copied", de: "Kopiert" }))).catch(() => {}); };

  const box = "flex h-9 flex-1 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200";
  const ico = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-white/10";

  return (
    <div className="border-t border-slate-100 px-5 py-4 dark:border-white/10">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon name="key" className="h-3.5 w-3.5" /> {tr(locale, { uz: "Kirish ma'lumotlari", ru: "Данные для входа", en: "Login credentials", de: "Anmeldedaten" })}
      </div>
      <div className="space-y-2">
        {/* Login */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-slate-400">Login</span>
          <div className={box + " truncate"}>{email || "—"}</div>
          {email && <button type="button" onClick={() => copy(email)} className={ico} title={tr(locale, { uz: "Nusxalash", ru: "Копировать", en: "Copy", de: "Kopieren" })}><Icon name="copy" className="h-4 w-4" /></button>}
        </div>
        {/* Parol */}
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-slate-400">{tr(locale, { uz: "Parol", ru: "Пароль", en: "Password", de: "Passwort" })}</span>
          <div className={box + " font-mono"}>
            {password === undefined ? "••••••••" : show ? (password || tr(locale, { uz: "— (o'rnatilmagan, yangi parol qo'ying)", ru: "— (не задан)", en: "— (not set)", de: "— (nicht festgelegt)" })) : "••••••••"}
          </div>
          {password === undefined ? (
            <button type="button" onClick={reveal} disabled={loading} className={ico} title={tr(locale, { uz: "Ko'rsatish", ru: "Показать", en: "Show", de: "Anzeigen" })}><Icon name={loading ? "refresh" : "eye"} className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          ) : (
            <>
              <button type="button" onClick={() => setShow((v) => !v)} className={ico} title={tr(locale, { uz: "Ko'rsatish/yashirish", ru: "Показать/скрыть", en: "Show/hide", de: "Anzeigen/verbergen" })}><Icon name="eye" className="h-4 w-4" /></button>
              {show && password && <button type="button" onClick={() => copy(password)} className={ico} title={tr(locale, { uz: "Nusxalash", ru: "Копировать", en: "Copy", de: "Kopieren" })}><Icon name="copy" className="h-4 w-4" /></button>}
            </>
          )}
        </div>
        {/* Parolni o'zgartirish */}
        <div className="flex items-center gap-2 pt-1">
          <input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={tr(locale, { uz: "Yangi parol o'rnatish", ru: "Задать новый пароль", en: "Set new password", de: "Neues Passwort festlegen" })} className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
          <button type="button" onClick={savePw} disabled={saving || newPw.trim().length < 4} className="h-9 shrink-0 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{saving ? "…" : tr(locale, { uz: "O'rnatish", ru: "Задать", en: "Set", de: "Festlegen" })}</button>
        </div>
        {msg && <p className="text-xs text-emerald-600 dark:text-emerald-400">{msg}</p>}
      </div>
    </div>
  );
}
