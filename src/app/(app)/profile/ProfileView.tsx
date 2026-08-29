"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { fmtUzPhoneInput } from "@/lib/phone";
import { Icon } from "../_components/Icon";
import UserAvatar from "../_components/UserAvatar";
import { updateProfile, changePassword } from "./actions";

export interface Me {
  fullName: string; email: string; phone: string | null;
  gender: "MALE" | "FEMALE" | null; birthDate: string; imageUrl: string | null;
  locale: string; role: string; roleLabel: string; branchName: string | null;
  position: string | null; sipExtension: string | null; joined: string; lastLogin: string | null;
}

// +998 doimiy prefiks — foydalanuvchi faqat 9 raqam kiritadi (src/lib/phone.ts)
const fmtPhone = fmtUzPhoneInput;

export default function ProfileView({ locale, me, stats }: {
  locale: Locale; me: Me; stats: { leads: number; tasksOpen: number; calls: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"info" | "security">("info");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(me.fullName);
  const [email, setEmail] = useState(me.email);
  const [phone, setPhone] = useState(fmtPhone(me.phone ?? ""));
  const [gender, setGender] = useState<"MALE" | "FEMALE" | null>(me.gender);
  const [birthDate, setBirthDate] = useState(me.birthDate);
  const [lang, setLang] = useState(me.locale);
  const [img, setImg] = useState<string | null>(me.imageUrl);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const pickPhoto = (f: File | null) => {
    if (!f) return;
    if (f.size > 900_000) { setError(tr(locale, { uz: "Rasm 900KB dan kichik bo'lsin", ru: "Фото должно быть меньше 900КБ", en: "Photo must be under 900KB", de: "Das Foto muss kleiner als 900 KB sein" })); return; }
    const r = new FileReader();
    r.onload = () => setImg(String(r.result));
    r.readAsDataURL(f);
  };

  const save = () => {
    setError(null);
    const fd = new FormData();
    fd.set("fullName", fullName);
    fd.set("email", email);
    fd.set("phone", phone.trim() ? "+998 " + phone.trim() : "");
    if (gender) fd.set("gender", gender);
    fd.set("birthDate", birthDate);
    fd.set("locale", lang);
    fd.set("imageUrl", img ?? "");
    start(async () => {
      const r = await updateProfile(fd);
      if (r.ok) { flash(tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓", de: "Gespeichert ✓" })); router.refresh(); }
      else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" }));
    });
  };

  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  return (
    <div className="space-y-5">
      {/* ── Sarlavha kartasi ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="h-24 bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div className="-mt-12 shrink-0">
            <div className="relative">
              {img ? (
                <img src={img} alt="" className="h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-md dark:border-slate-900" />
              ) : (
                <UserAvatar name={me.fullName} role={me.role} size="xl" className="h-24 w-24 border-4 border-white shadow-md dark:border-slate-900" />
              )}
              <button
                onClick={() => fileRef.current?.click()}
                title={L("Rasm yuklash", "Загрузить фото", "Upload photo", "Foto hochladen")}
                className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-xl border-2 border-white bg-brand-600 text-white shadow transition hover:bg-brand-700 dark:border-slate-900"
              >
                <Icon name="pencil" className="h-3.5 w-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <h1 className="truncate text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{me.fullName}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
              <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-300">{me.roleLabel}</span>
              {me.branchName && <span>· {me.branchName}</span>}
              {me.sipExtension && <span className="flex items-center gap-1">· <Icon name="phone" className="h-3.5 w-3.5" /> {me.sipExtension}</span>}
            </p>
          </div>
          {img && (
            <button onClick={() => setImg(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              {L("Rasmni o'chirish", "Удалить фото", "Remove photo", "Foto entfernen")}
            </button>
          )}
        </div>
      </div>

      {/* ── Statistika ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon="download" tone="#6366f1" label={L("Mening lidlarim", "Мои лиды", "My leads", "Meine Leads")} value={stats.leads} />
        <Tile icon="clipboard" tone="#f59e0b" label={L("Ochiq topshiriqlar", "Открытые задачи", "Open tasks", "Offene Aufgaben")} value={stats.tasksOpen} />
        <Tile icon="phone" tone="#10b981" label={L("Qo'ng'iroqlarim", "Мои звонки", "My calls", "Meine Anrufe")} value={stats.calls} />
        <Tile icon="calendar" tone="#0ea5e9" label={L("Ro'yxatdan o'tgan", "Дата регистрации", "Joined", "Beigetreten")} value={me.joined} small />
      </div>

      {/* ── Tablar ── */}
      <div className="flex gap-2">
        <TabBtn active={tab === "info"} onClick={() => setTab("info")} icon="user">{L("Shaxsiy ma'lumotlar", "Личные данные", "Personal info", "Persönliche Daten")}</TabBtn>
        <TabBtn active={tab === "security"} onClick={() => setTab("security")} icon="shieldCheck">{L("Xavfsizlik", "Безопасность", "Security", "Sicherheit")}</TabBtn>
      </div>

      {tab === "info" ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={L("F.I.Sh.", "Ф.И.О.", "Full name", "Vollständiger Name")} required>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inp} />
            </Field>
            <Field label={L("Email (login uchun)", "Email (для входа)", "Email (for login)", "E-Mail (für Anmeldung)")} required>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inp} />
            </Field>

            <Field label={L("Telefon", "Телефон", "Phone", "Telefon")}>
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 transition focus-within:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="select-none text-sm font-medium text-slate-500 dark:text-slate-400">+998</span>
                <input value={phone} onChange={(e) => setPhone(fmtPhone(e.target.value))} inputMode="numeric" placeholder="90 123 45 67" className="ml-2 h-full w-full flex-1 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
              </div>
            </Field>
            <Field label={L("Tug'ilgan sana", "Дата рождения", "Date of birth", "Geburtsdatum")}>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inp} />
            </Field>

            <Field label={L("Jinsi", "Пол", "Gender", "Geschlecht")}>
              <div className="grid grid-cols-2 gap-2">
                <GBtn active={gender === "MALE"} onClick={() => setGender("MALE")} icon="♂" label={L("Erkak", "Мужчина", "Male", "Männlich")} color="#3b82f6" />
                <GBtn active={gender === "FEMALE"} onClick={() => setGender("FEMALE")} icon="♀" label={L("Ayol", "Женщина", "Female", "Weiblich")} color="#ec4899" />
              </div>
            </Field>
            <Field label={L("Interfeys tili", "Язык интерфейса", "Interface language", "Oberflächensprache")}>
              <select value={lang} onChange={(e) => setLang(e.target.value)} className={inp}>
                <option value="uz">O&apos;zbekcha</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>

          {/* O'zgartirib bo'lmaydigan ma'lumotlar */}
          <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/[0.03] sm:grid-cols-3">
            <RO label={L("Lavozim", "Должность", "Position", "Position")} value={me.position ?? me.roleLabel} />
            <RO label={L("Filial", "Филиал", "Branch", "Filiale")} value={me.branchName ?? "—"} />
            <RO label={L("Oxirgi kirish", "Последний вход", "Last login", "Letzte Anmeldung")} value={me.lastLogin ?? "—"} />
          </div>
          <p className="mt-2 text-xs text-slate-400">{L("Rol va filialni faqat administrator o'zgartiradi.", "Роль и филиал меняет только администратор.", "Role and branch can only be changed by an administrator.", "Rolle und Filiale können nur vom Administrator geändert werden.")}</p>

          {error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => router.refresh()} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {L("Bekor qilish", "Отмена", "Cancel", "Abbrechen")}
            </button>
            <button onClick={save} disabled={pending} className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
              {pending ? L("Saqlanmoqda...", "Сохранение...", "Saving...", "Wird gespeichert...") : L("Saqlash", "Сохранить", "Save", "Speichern")}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <PasswordCard locale={locale} onDone={flash} />

          {/* Hisob xavfsizligi — o'ng ustun */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              <Icon name="eye" className="h-5 w-5 text-slate-400" /> {L("Hisob ma'lumotlari", "Данные аккаунта", "Account details", "Kontodaten")}
            </h3>
            <p className="mb-4 text-xs text-slate-400">{L("Hisobingiz holati va kirish tarixi.", "Состояние аккаунта и история входа.", "Your account status and sign-in history.", "Ihr Kontostatus und Anmeldeverlauf.")}</p>

            <div className="space-y-2.5">
              <InfoRow icon="mail" label={L("Email (login)", "Email (логин)", "Email (login)", "E-Mail (Login)")} value={me.email} />
              <InfoRow icon="shieldCheck" label={L("Rol", "Роль", "Role", "Rolle")} value={me.roleLabel} />
              <InfoRow icon="building" label={L("Filial", "Филиал", "Branch", "Filiale")} value={me.branchName ?? "—"} />
              <InfoRow icon="clock" label={L("Oxirgi kirish", "Последний вход", "Last login", "Letzte Anmeldung")} value={me.lastLogin ?? "—"} />
              <InfoRow icon="calendar" label={L("Ro'yxatdan o'tgan", "Дата регистрации", "Joined", "Beigetreten")} value={me.joined} />
              {me.sipExtension && <InfoRow icon="phone" label={L("SIP raqami", "SIP номер", "SIP extension", "SIP-Nebenstelle")} value={me.sipExtension} />}
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <Icon name="info" className="h-4 w-4" /> {L("Xavfsizlik tavsiyalari", "Рекомендации по безопасности", "Security tips", "Sicherheitstipps")}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-amber-700/80 dark:text-amber-300/80">
                <li>• {L("Parolni hech kimga bermang.", "Никому не сообщайте пароль.", "Never share your password.", "Geben Sie Ihr Passwort niemandem weiter.")}</li>
                <li>• {L("Kamida 8 ta belgi, harf va raqam aralash bo'lsin.", "Минимум 8 символов, буквы и цифры.", "Use at least 8 characters, letters and numbers.", "Verwenden Sie mindestens 8 Zeichen, Buchstaben und Zahlen.")}</li>
                <li>• {L("Parolni har 3 oyda yangilab turing.", "Меняйте пароль каждые 3 месяца.", "Change your password every 3 months.", "Ändern Sie Ihr Passwort alle 3 Monate.")}</li>
                <li>• {L("Umumiy kompyuterda ishlagach, tizimdan chiqing.", "Выходите из системы на общих компьютерах.", "Sign out on shared computers.", "Melden Sie sich an gemeinsam genutzten Computern ab.")}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-pop dark:bg-slate-700">{toast}</div>}
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

function PasswordCard({ locale, onDone }: { locale: Locale; onDone: (m: string) => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await changePassword(fd);
      if (r.ok) { ref.current?.reset(); onDone(L("Parol o'zgartirildi ✓", "Пароль изменён ✓", "Password changed ✓", "Passwort geändert ✓")); }
      else setErr(r.error ?? L("Xatolik", "Ошибка", "Error", "Fehler"));
    });
  };

  return (
    <form ref={ref} onSubmit={submit} className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
        <Icon name="shieldCheck" className="h-5 w-5 text-slate-400" /> {L("Parolni o'zgartirish", "Смена пароля", "Change password", "Passwort ändern")}
      </h3>
      <p className="mb-4 text-xs text-slate-400">{L("Xavfsizlik uchun avval joriy parolni kiriting.", "Для безопасности сначала введите текущий пароль.", "For security, enter your current password first.", "Geben Sie aus Sicherheitsgründen zuerst Ihr aktuelles Passwort ein.")}</p>
      <div className="space-y-3">
        <Field label={L("Joriy parol", "Текущий пароль", "Current password", "Aktuelles Passwort")} required>
          <input name="current" type="password" required className={inp} />
        </Field>
        <Field label={L("Yangi parol", "Новый пароль", "New password", "Neues Passwort")} required>
          <input name="next" type="password" required minLength={4} className={inp} />
        </Field>
        <Field label={L("Yangi parolni tasdiqlang", "Повторите новый пароль", "Confirm new password", "Neues Passwort bestätigen")} required>
          <input name="confirm" type="password" required minLength={4} className={inp} />
        </Field>
      </div>
      {err && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{err}</div>}
      <button type="submit" disabled={pending} className="mt-auto w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60" style={{ marginTop: "1.25rem" }}>
        {pending ? L("O'zgartirilmoqda...", "Изменение...", "Changing...", "Wird geändert...") : L("Parolni o'zgartirish", "Сменить пароль", "Change password", "Passwort ändern")}
      </button>
    </form>
  );
}

function Tile({ icon, tone, label, value, small }: { icon: string; tone: string; label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${tone}1a`, color: tone }}><Icon name={icon} className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className={cn("font-bold text-slate-800 dark:text-slate-100", small ? "text-base" : "text-xl")}>{value}</div>
          <div className="truncate text-[11px] text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
      active ? "bg-brand-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800")}>
      <Icon name={icon} className="h-4 w-4" /> {children}
    </button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
    </label>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-white/[0.03]">
      <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon name={icon} className="h-4 w-4 shrink-0 text-slate-400" /> {label}
      </span>
      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}

function RO({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

function GBtn({ active, onClick, icon, label, color }: { active: boolean; onClick: () => void; icon: string; label: string; color: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition",
        active ? "text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5")}
      style={active ? { background: color, borderColor: color } : undefined}>
      <span className="text-base leading-none">{icon}</span> {label}
    </button>
  );
}
