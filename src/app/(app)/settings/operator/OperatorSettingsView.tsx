"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import UserAvatar from "../../_components/UserAvatar";
import { AUTO_LOGOUT_OPTIONS, type OperatorPrefs } from "./prefs";
import { saveOperatorPrefs, saveOperatorLocale } from "./actions";
import { Card, MoneyCard, SaveBtn, TabBtn, ThemeBtn, ToggleRow } from "./parts";

type Tab = "notifications" | "appearance" | "salary";

export type SalaryInfo = {
  configured: boolean;
  fiksa: string;
  bonusPerLead: string;
  monthLabel: string;
  wonThisMonth: number;
  bonusThisMonth: string;
  total: string;
  formula: string;
  wonTotal: number;
  previous: { key: string; label: string; count: number; total: string; formula: string }[];
  monthLeads: { id: string; name: string; phone: string; date: string }[];
  monthLeadsMore: number;
};

export type Me = {
  fullName: string;
  email: string;
  imageUrl: string | null;
  roleLabel: string;
  branchName: string | null;
  position: string | null;
  sipExtension: string | null;
  lastLogin: string | null;
  locale: string;
};


export default function OperatorSettingsView({ locale, initialTab, me, prefs: prefs0, salary }: {
  locale: Locale;
  initialTab: Tab;
  me: Me;
  prefs: OperatorPrefs;
  salary: SalaryInfo;
}) {
  const router = useRouter();
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });

  const [tab, setTab] = useState<Tab>(initialTab);
  const [prefs, setPrefs] = useState<OperatorPrefs>(prefs0);
  const [lang, setLang] = useState(me.locale);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Mavzu — butun ilovada bo'lgani kabi localStorage("gl-theme") + <html class="dark">
  const [dark, setDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setThemeReady(true);
  }, []);

  const applyTheme = (next: boolean) => {
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("gl-theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };

  const flash = (m: string) => { setError(null); setMsg(m); setTimeout(() => setMsg(null), 2500); };

  const savePrefs = () => {
    setError(null); setMsg(null);
    const fd = new FormData();
    fd.set("notifyEmail", prefs.notifyEmail ? "1" : "0");
    fd.set("notifyPush", prefs.notifyPush ? "1" : "0");
    fd.set("notifySound", prefs.notifySound ? "1" : "0");
    fd.set("autoLogoutMinutes", String(prefs.autoLogoutMinutes));
    start(async () => {
      const r = await saveOperatorPrefs(fd);
      if (r.ok) flash(L("Saqlandi ✓", "Сохранено ✓", "Saved ✓"));
      else setError(r.error ?? L("Xatolik", "Ошибка", "Error"));
    });
  };

  const saveLang = () => {
    setError(null); setMsg(null);
    const fd = new FormData();
    fd.set("locale", lang);
    start(async () => {
      const r = await saveOperatorLocale(fd);
      if (r.ok) { flash(L("Til yangilandi ✓", "Язык обновлён ✓", "Language updated ✓")); router.refresh(); }
      else setError(r.error ?? L("Xatolik", "Ошибка", "Error"));
    });
  };

  const autoLogoutLabel = (m: number) =>
    m === 0 ? L("Hech qachon", "Никогда", "Never")
      : m < 60 ? `${m} ${L("daq", "мин", "min")}`
        : `${m / 60} ${L("soat", "ч", "h")}`;

  return (
    <div className="space-y-5">
      {/* ── Sarlavha ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-soft">
            <Icon name="headphones" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {L("Operator sozlamalari", "Настройки оператора", "Operator settings")}
            </h1>
            <p className="text-sm text-slate-400">
              {L("Bildirishnoma, ko'rinish va shaxsiy KPI ma'lumotlari", "Уведомления, оформление и личные KPI-данные", "Notifications, appearance and personal KPI data")}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
          <Icon name="shieldCheck" className="h-3.5 w-3.5" /> {me.roleLabel}
        </span>
      </div>

      {/* ── Profil kartasi (tahrirlash /profile sahifasida) ── */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <UserAvatar name={me.fullName} imageUrl={me.imageUrl} role="MANAGER" size="lg" className="!h-14 !w-14" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{me.fullName}</div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span>{me.email}</span>
            {me.position && <span>· {me.position}</span>}
            {me.branchName && <span>· {me.branchName}</span>}
            {me.sipExtension && <span className="inline-flex items-center gap-1">· <Icon name="phone" className="h-3 w-3" /> {me.sipExtension}</span>}
            {me.lastLogin && <span className="inline-flex items-center gap-1">· <Icon name="clock" className="h-3 w-3" /> {L("Oxirgi kirish", "Последний вход", "Last login")}: {me.lastLogin}</span>}
          </p>
        </div>
        <Link href="/profile" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          <Icon name="user" className="h-4 w-4" />
          {L("Shaxsiy ma'lumotlar va parol", "Личные данные и пароль", "Personal info & password")}
        </Link>
      </div>

      {/* ── Tablar ── */}
      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "notifications"} onClick={() => setTab("notifications")} icon="bell">{L("Bildirishnomalar", "Уведомления", "Notifications")}</TabBtn>
        <TabBtn active={tab === "appearance"} onClick={() => setTab("appearance")} icon="sun">{L("Ko'rinish", "Оформление", "Appearance")}</TabBtn>
        <TabBtn active={tab === "salary"} onClick={() => setTab("salary")} icon="wallet">{L("Maosh va KPI", "Зарплата и KPI", "Salary & KPI")}</TabBtn>
      </div>

      {msg && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">{msg}</div>}
      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}

      {/* ───────── BILDIRISHNOMALAR ───────── */}
      {tab === "notifications" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card icon="bell" title={L("Bildirishnoma sozlamalari", "Настройки уведомлений", "Notification preferences")} desc={L("Qaysi hodisalar haqida qanday xabar olishni tanlang.", "Выберите, как получать уведомления о событиях.", "Choose how you want to be notified about events.")}>
            <div className="space-y-3">
              <ToggleRow
                on={prefs.notifyEmail}
                onChange={(v) => setPrefs((p) => ({ ...p, notifyEmail: v }))}
                icon="mail"
                title={L("Email bildirishnomalar", "Email-уведомления", "Email notifications")}
                desc={L("Yangi xabarlar email orqali yuboriladi", "Новые сообщения приходят на email", "New messages are sent by email")}
              />
              <ToggleRow
                on={prefs.notifyPush}
                onChange={(v) => setPrefs((p) => ({ ...p, notifyPush: v }))}
                icon="bell"
                title={L("Push bildirishnomalar", "Push-уведомления", "Push notifications")}
                desc={L("Brauzerda bildirishnoma ko'rsatiladi", "Уведомления показываются в браузере", "Notifications are shown in the browser")}
              />
              <ToggleRow
                on={prefs.notifySound}
                onChange={(v) => setPrefs((p) => ({ ...p, notifySound: v }))}
                icon="phoneCall"
                title={L("Ovozli signal", "Звуковой сигнал", "Sound alert")}
                desc={L("Yangi bildirishnoma va qo'ng'iroqda ovoz", "Звук при новом уведомлении и звонке", "Play a sound on new notifications and calls")}
              />
            </div>
            <SaveBtn locale={locale} pending={pending} onClick={savePrefs} />
          </Card>

          <aside className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200">
              <Icon name="info" className="h-5 w-5 text-slate-400" /> {L("Eslatma", "Примечание", "Note")}
            </h3>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {L("Bu sozlamalar faqat sizning hisobingizga tegishli va boshqa xodimlarga ta'sir qilmaydi.", "Эти настройки относятся только к вашему аккаунту и не влияют на других сотрудников.", "These preferences apply only to your account and do not affect other staff.")}
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
              {L("Brauzer push bildirishnomalari uchun brauzer ruxsatini ham yoqishingiz kerak.", "Для push-уведомлений также нужно разрешение браузера.", "Browser push notifications also require the browser permission to be granted.")}
            </div>
          </aside>
        </div>
      )}

      {/* ───────── KO'RINISH ───────── */}
      {tab === "appearance" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card icon="sun" title={L("Mavzu", "Тема", "Theme")} desc={L("Yorug' yoki tungi rejimni tanlang — darhol qo'llanadi.", "Выберите светлый или тёмный режим — применяется сразу.", "Pick the light or dark mode — applied instantly.")}>
            <div className="grid grid-cols-2 gap-4">
              <ThemeBtn active={themeReady && !dark} onClick={() => applyTheme(false)} icon="sun" title={L("Yorug'", "Светлая", "Light")} desc={L("Kunduzgi rejim", "Дневной режим", "Day mode")} tone="from-amber-400 to-orange-500" />
              <ThemeBtn active={themeReady && dark} onClick={() => applyTheme(true)} icon="moon" title={L("Tungi", "Тёмная", "Dark")} desc={L("Tungi rejim", "Ночной режим", "Night mode")} tone="from-indigo-500 to-purple-600" />
            </div>
          </Card>

          <Card icon="globe" title={L("Interfeys tili", "Язык интерфейса", "Interface language")} desc={L("Tanlangan til butun tizimda ishlatiladi.", "Выбранный язык используется во всей системе.", "The selected language is used across the whole system.")}>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
            >
              <option value="uz">O&apos;zbekcha</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
            <SaveBtn locale={locale} pending={pending} onClick={saveLang} />
          </Card>

          <Card className="lg:col-span-2" icon="clock" title={L("Avtomatik chiqish vaqti", "Время автовыхода", "Auto sign-out timer")} desc={L("Faoliyatsiz qolgandan keyin hisobdan avtomatik chiqish.", "Автоматический выход после периода бездействия.", "Sign out automatically after a period of inactivity.")}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {AUTO_LOGOUT_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, autoLogoutMinutes: m }))}
                  className={cn(
                    "rounded-xl py-2.5 text-xs font-semibold transition",
                    prefs.autoLogoutMinutes === m
                      ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-soft"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                  )}
                >
                  {autoLogoutLabel(m)}
                </button>
              ))}
            </div>
            <SaveBtn locale={locale} pending={pending} onClick={savePrefs} />
          </Card>
        </div>
      )}

      {/* ───────── MAOSH VA KPI ───────── */}
      {tab === "salary" && (
        <div className="space-y-5">
          {salary.configured ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <MoneyCard icon="coins" tone="violet" label={L("Fiksa maosh", "Фиксированная зарплата", "Fixed salary")} value={salary.fiksa} unit={L("so'm", "сум", "UZS")} />
                <MoneyCard
                  icon="chart" tone="amber"
                  label={`${L("KPI bonus", "KPI бонус", "KPI bonus")} (${salary.monthLabel})`}
                  value={salary.bonusPerLead}
                  unit={L("so'm / lid", "сум / лид", "UZS / lead")}
                  hint={`${L("Muvaffaqiyatli lidlar", "Успешные лиды", "Successful leads")}: ${salary.wonThisMonth} = ${salary.bonusThisMonth} ${L("so'm", "сум", "UZS")}`}
                />
                <MoneyCard
                  icon="award" tone="emerald"
                  label={`${L("Jami oylik", "Итого за месяц", "Monthly total")} (${salary.monthLabel})`}
                  value={salary.total}
                  unit={L("so'm", "сум", "UZS")}
                  hint={salary.formula}
                />
              </div>

              {salary.monthLeads.length > 0 && (
                <Card icon="personCheck" title={`${L("Joriy oyning muvaffaqiyatli lidlari", "Успешные лиды текущего месяца", "This month's successful leads")} (${salary.wonThisMonth})`} desc={L("Bosib lid kartasiga o'ting.", "Нажмите, чтобы открыть карточку лида.", "Click to open the lead card.")}>
                  <div className="space-y-2">
                    {salary.monthLeads.map((l, i) => (
                      <Link
                        key={l.id}
                        href={`/crm/${l.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">#{i + 1}</span>
                            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{l.name}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">{l.phone} · {l.date}</div>
                        </div>
                        <Icon name="arrowUpRight" className="h-4 w-4 shrink-0 text-slate-400" />
                      </Link>
                    ))}
                    {salary.monthLeadsMore > 0 && (
                      <p className="pt-1 text-xs text-slate-400">
                        {L("Yana", "Ещё", "And")} {salary.monthLeadsMore} {L("ta lid", "лидов", "more leads")}
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {salary.previous.length > 0 && (
                <Card icon="calendar" title={L("Oldingi oylar", "Предыдущие месяцы", "Previous months")} desc={L("Oxirgi 5 oy bo'yicha hisob-kitob.", "Расчёт за последние 5 месяцев.", "Breakdown for the last 5 months.")}>
                  <div className="space-y-2">
                    {salary.previous.map((m) => (
                      <div key={m.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
                        <div>
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.label}</div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {L("Muvaffaqiyatli lidlar", "Успешные лиды", "Successful leads")}: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{m.count}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{m.total}</div>
                          <div className="text-[10px] text-slate-400">{m.formula}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <p className="text-xs text-slate-400">
                {L("Maosh va KPI stavkasini faqat rahbariyat o'zgartiradi. Hisob WON bosqichiga o'tgan lidlar bo'yicha yuritiladi.", "Ставку зарплаты и KPI меняет только руководство. Расчёт ведётся по лидам в стадии WON.", "Salary and KPI rates are set by management only. The calculation is based on leads in the WON stage.")}
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-10 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
              <Icon name="wallet" className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {L("Maosh ma'lumotlari hali belgilanmagan.", "Данные о зарплате ещё не заданы.", "Salary details have not been set yet.")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {L("Jami muvaffaqiyatli lidlar", "Всего успешных лидов", "Total successful leads")}: {salary.wonTotal}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

