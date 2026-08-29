"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../_components/Icon";
import { formatMoney, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getStaffDetail, setUserPassword, type StaffDetail } from "./actions";

const WD: Record<Locale, string[]> = {
  uz: ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], de: ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};

export default function StaffDetailModal({ userId, locale, onClose }: { userId: string; locale: Locale; onClose: () => void }) {
  const [d, setD] = useState<StaffDetail | null>(null);
  const [, startLoad] = useTransition();
  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => { startLoad(async () => { const r = await getStaffDetail(userId); if (r.ok && r.data) setD(r.data); }); }, [userId]);

  const savePw = () => startSave(async () => {
    const r = await setUserPassword(userId, newPw);
    if (r.ok) { setD((x) => (x ? { ...x, password: newPw } : x)); setShowPw(true); setNewPw(""); setMsg(tr(locale, { uz: "Parol yangilandi", ru: "Пароль обновлён", en: "Password updated", de: "Passwort aktualisiert" })); }
    else setMsg(r.error === "short" ? tr(locale, { uz: "Parol kamida 4 ta belgi", ru: "Пароль минимум 4 символа", en: "Password min 4 chars", de: "Passwort mind. 4 Zeichen" }) : tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" }));
  });
  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => setMsg(tr(locale, { uz: "Nusxalandi", ru: "Скопировано", en: "Copied", de: "Kopiert" }))).catch(() => {}); };

  if (!mounted) return null;

  const box = "flex h-9 flex-1 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200";
  const ico = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-white/10";

  return createPortal(
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div onMouseDown={(e) => e.stopPropagation()} className="animate-slide-in-right absolute right-0 top-0 flex h-full w-[440px] max-w-[94%] flex-col border-l border-slate-200 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300"><Icon name="user" className="h-6 w-6" /></span>
            <div className="min-w-0">
              <div className="truncate text-base font-bold text-slate-800 dark:text-slate-100">{d?.fullName ?? "…"}</div>
              {d && <span className="text-xs font-medium text-brand-600 dark:text-brand-300">{d.roleLabel}</span>}
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">✕</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {!d ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Icon name="refresh" className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              {/* Kirish ma'lumotlari */}
              <Section title={tr(locale, { uz: "Kirish ma'lumotlari", ru: "Данные для входа", en: "Login credentials", de: "Anmeldedaten" })} icon="key">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs text-slate-400">Login</span>
                    <div className={box + " truncate"}>{d.email}</div>
                    <button onClick={() => copy(d.email)} className={ico} title={tr(locale, { uz: "Nusxalash", ru: "Копировать", en: "Copy", de: "Kopieren" })}><Icon name="copy" className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs text-slate-400">{tr(locale, { uz: "Parol", ru: "Пароль", en: "Password", de: "Passwort" })}</span>
                    <div className={box + " font-mono"}>{d.password ? (showPw ? d.password : "••••••••") : tr(locale, { uz: "— (yangi parol qo'ying)", ru: "— (задайте пароль)", en: "— (set a password)", de: "— (Passwort festlegen)" })}</div>
                    {d.password && <button onClick={() => setShowPw((v) => !v)} className={ico} title={tr(locale, { uz: "Ko'rsatish/yashirish", ru: "Показать/скрыть", en: "Show/hide", de: "Anzeigen/Verbergen" })}><Icon name="eye" className="h-4 w-4" /></button>}
                    {d.password && showPw && <button onClick={() => copy(d.password!)} className={ico} title={tr(locale, { uz: "Nusxalash", ru: "Копировать", en: "Copy", de: "Kopieren" })}><Icon name="copy" className="h-4 w-4" /></button>}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={tr(locale, { uz: "Yangi parol o'rnatish", ru: "Задать новый пароль", en: "Set new password", de: "Neues Passwort festlegen" })} className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100" />
                    <button onClick={savePw} disabled={saving || newPw.trim().length < 4} className="h-9 shrink-0 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">{saving ? "…" : tr(locale, { uz: "O'rnatish", ru: "Задать", en: "Set", de: "Festlegen" })}</button>
                  </div>
                  {msg && <p className="text-xs text-emerald-600 dark:text-emerald-400">{msg}</p>}
                </div>
              </Section>

              {/* Ish ma'lumotlari */}
              <Section title={tr(locale, { uz: "Ish ma'lumotlari", ru: "Рабочие данные", en: "Work info", de: "Arbeitsinformationen" })} icon="wallet">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label={tr(locale, { uz: "Belgilangan oylik", ru: "Установленная зарплата", en: "Base salary", de: "Grundgehalt" })} value={formatMoney(d.fiksa, locale)} />
                  <Stat label={tr(locale, { uz: "KPI bonus", ru: "KPI бонус", en: "KPI bonus", de: "KPI-Bonus" })} value={formatMoney(d.kpiBonus, locale)} />
                  <Stat label={tr(locale, { uz: "Bu oy jami", ru: "Итого за месяц", en: "This month total", de: "Gesamt diesen Monat" })} value={formatMoney(d.monthTotal, locale)} accent />
                  <Stat label={tr(locale, { uz: "Ish kunlari", ru: "Рабочие дни", en: "Work days", de: "Arbeitstage" })} value={d.workdays.length ? d.workdays.map((n) => WD[locale][n]).join(", ") : "—"} />
                  {(d.startTime || d.endTime) && <Stat label={tr(locale, { uz: "Ish vaqti", ru: "Время работы", en: "Work time", de: "Arbeitszeit" })} value={`${d.startTime ?? "—"} – ${d.endTime ?? "—"}`} />}
                </div>
              </Section>

              {/* Guruhlar (o'qituvchi bo'lsa) */}
              {d.groups.length > 0 && (
                <Section title={tr(locale, { uz: "Guruhlar", ru: "Группы", en: "Groups", de: "Gruppen" })} icon="layers">
                  <div className="flex flex-wrap gap-1.5">
                    {d.groups.map((g) => <span key={g} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{g}</span>)}
                  </div>
                </Section>
              )}

              {/* Kontakt */}
              <Section title={tr(locale, { uz: "Kontakt", ru: "Контакт", en: "Contact", de: "Kontakt" })} icon="phone">
                <div className="space-y-1.5 text-sm">
                  <Row label={tr(locale, { uz: "Telefon", ru: "Телефон", en: "Phone", de: "Telefon" })} value={d.phone ?? "—"} />
                  <Row label={tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" })} value={d.branch ?? "—"} />
                  <Row label={tr(locale, { uz: "Jinsi", ru: "Пол", en: "Gender", de: "Geschlecht" })} value={d.gender === "MALE" ? tr(locale, { uz: "Erkak", ru: "Мужской", en: "Male", de: "Männlich" }) : d.gender === "FEMALE" ? tr(locale, { uz: "Ayol", ru: "Женский", en: "Female", de: "Weiblich" }) : "—"} />
                  <Row label={tr(locale, { uz: "Tug'ilgan sana", ru: "Дата рождения", en: "Birth date", de: "Geburtsdatum" })} value={d.birthDate ?? "—"} />
                  <Row label={tr(locale, { uz: "Holati", ru: "Статус", en: "Status", de: "Status" })} value={d.isActive ? tr(locale, { uz: "Faol", ru: "Активен", en: "Active", de: "Aktiv" }) : tr(locale, { uz: "Nofaol", ru: "Неактивен", en: "Inactive", de: "Inaktiv" })} />
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>, document.body);
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon name={icon} className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.03]">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${accent ? "text-brand-600 dark:text-brand-300" : "text-slate-800 dark:text-slate-100"}`}>{value}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}
