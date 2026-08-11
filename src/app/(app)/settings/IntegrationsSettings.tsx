"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

const STORAGE_KEY = "gl-integrations-settings";

interface Form {
  worklyClientId: string;
  worklySecret: string;
  worklyUsername: string;
  worklyPassword: string;
  telegramReportId: string;
  facebookPixel: string;
  telegramSocial: string;
  fbConnected: boolean;
  amoConnected: boolean;
}

const empty: Form = {
  worklyClientId: "", worklySecret: "", worklyUsername: "", worklyPassword: "",
  telegramReportId: "", facebookPixel: "", telegramSocial: "", fbConnected: false, amoConnected: false,
};

export default function IntegrationsSettings({ locale }: { locale: Locale }) {
  const [f, setF] = useState<Form>(empty);
  const [saved, setSaved] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setF((cur) => ({ ...cur, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Bog'langan integratsiyalar */}
      <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-card dark:border-slate-600 dark:bg-slate-900">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Bog'langan integratsiyalar", ru: "Подключённые интеграции", en: "Connected integrations" })}</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Ijtimoiy tarmoq hisoblari va CRM tizimlarini ulang va boshqaring", ru: "Подключайте и управляйте аккаунтами соцсетей и CRM-системами", en: "Connect and manage social network accounts and CRM systems" })}</p>

        <div className="space-y-3">
          <IntegrationRow
            locale={locale}
            badge={<span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white">f</span>}
            title={tr(locale, { uz: "Facebook sahifasi", ru: "Страница Facebook", en: "Facebook page" })} desc={tr(locale, { uz: "Facebook biznes sahifangizni ulang", ru: "Подключите вашу бизнес-страницу Facebook", en: "Connect your Facebook business page" })}
            connected={f.fbConnected} onToggle={() => set("fbConnected", !f.fbConnected)}
          />
          <IntegrationRow
            locale={locale}
            badge={<span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-white"><Icon name="link" className="h-5 w-5" /></span>}
            title="amoCRM | Kommo" desc={tr(locale, { uz: "Lidlarni amoCRM | Kommo hisobingiz bilan sinxronlang", ru: "Синхронизируйте лиды с аккаунтом amoCRM | Kommo", en: "Sync leads with your amoCRM | Kommo account" })}
            connected={f.amoConnected} onToggle={() => set("amoConnected", !f.amoConnected)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chap ustun */}
        <div className="space-y-6">
          <Fieldset title="Workly">
            <div className="space-y-4">
              <div><Label>Workly client id</Label><Input value={f.worklyClientId} onChange={(v) => set("worklyClientId", v)} /></div>
              <div><Label>Workly secret</Label><Input value={f.worklySecret} onChange={(v) => set("worklySecret", v)} /></div>
              <div><Label>Workly username</Label><Input value={f.worklyUsername} onChange={(v) => set("worklyUsername", v)} highlight /></div>
              <div>
                <Label>Workly password</Label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={f.worklyPassword} onChange={(e) => set("worklyPassword", e.target.value)} className={inpCls(true, "pr-10")} />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><Icon name="eye" className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </Fieldset>

          <Fieldset title="Social Media">
            <div className="space-y-4">
              <div><Label>Facebook pixel</Label><Input value={f.facebookPixel} onChange={(v) => set("facebookPixel", v)} /></div>
              <div><Label>Telegram</Label><Input value={f.telegramSocial} onChange={(v) => set("telegramSocial", v)} /></div>
            </div>
          </Fieldset>
        </div>

        {/* O'ng ustun — Telegram Reports */}
        <Fieldset title="Telegram Reports">
          <div className="space-y-4">
            <Input value={f.telegramReportId} onChange={(v) => set("telegramReportId", v)} />
            <div className="rounded-xl border border-slate-300 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
              <p className="mb-3">{tr(locale, { uz: "Telegram bot orqali avtomatik hisobot yuborilishi uchun quyidagi qadamlarni bajaring:", ru: "Чтобы получать автоматические отчёты через Telegram-бота, выполните следующие шаги:", en: "To receive automatic reports via the Telegram bot, follow these steps:" })}</p>
              <ol className="space-y-2.5">
                <li>1. {tr(locale, { uz: "Telegramda", ru: "В Telegram перейдите к", en: "In Telegram, open" })} <TgLink u="getidsbot">@getidsbot</TgLink> {tr(locale, { uz: "ga kiring.", ru: ".", en: "." })}</li>
                <li>2. {tr(locale, { uz: "ID ni nusxalang.", ru: "Скопируйте ID.", en: "Copy the ID." })}</li>
                <li>3. {tr(locale, { uz: "\"Telegram for Report\" nomli inputga ID ni joylashtiring.", ru: "Вставьте ID в поле \"Telegram for Report\".", en: "Paste the ID into the \"Telegram for Report\" input." })}</li>
                <li>4. {tr(locale, { uz: "\"Saqlash\" tugmasiga bosing.", ru: "Нажмите кнопку \"Сохранить\".", en: "Click the \"Save\" button." })}</li>
                <li>5. {tr(locale, { uz: "Germaniya Live botiga (", ru: "Запустите бота Germaniya Live (", en: "Start the Germaniya Live bot (" })}<TgLink u="germaniya_live_bot">@germaniya_live_bot</TgLink>{tr(locale, { uz: ") ga start bosing.", ru: ").", en: ")." })}</li>
              </ol>
            </div>
          </div>
        </Fieldset>
      </div>

      <button onClick={save} className="rounded-full bg-brand-800 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900">
        {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
      </button>
    </div>
  );
}

function IntegrationRow({ locale, badge, title, desc, connected, onToggle }: { locale: Locale; badge: React.ReactNode; title: string; desc: string; connected: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-sm dark:border-slate-600 dark:bg-slate-900">
      {badge}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-800 dark:text-slate-100">{title}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{desc}</div>
      </div>
      <span className={cn("flex items-center gap-1.5 text-sm", connected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")}>
        <Icon name={connected ? "check" : "close"} className="h-4 w-4" />
        {connected ? tr(locale, { uz: "Bog'langan", ru: "Подключено", en: "Connected" }) : tr(locale, { uz: "Bog'lanmagan", ru: "Не подключено", en: "Not connected" })}
      </span>
      <button onClick={onToggle} className={cn("rounded-lg px-6 py-2 text-sm font-semibold text-white transition", connected ? "bg-rose-500 hover:bg-rose-600" : "bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600")}>
        {connected ? tr(locale, { uz: "Uzish", ru: "Отключить", en: "Disconnect" }) : tr(locale, { uz: "Ulash", ru: "Подключить", en: "Connect" })}
      </button>
    </div>
  );
}

function TgLink({ u, children }: { u: string; children: React.ReactNode }) {
  return <a href={`https://t.me/${u}`} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline dark:text-brand-400">{children}</a>;
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative self-start rounded-xl border border-slate-300 p-5 pt-6 dark:border-slate-600">
      <span className="absolute -top-2.5 left-4 bg-white px-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">{title}</span>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{children}</label>;
}
const inpCls = (highlight?: boolean, extra?: string) =>
  [
    "h-11 w-full rounded-lg border px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:text-slate-100 dark:focus:ring-brand-900",
    highlight ? "border-sky-300 bg-sky-50/60 dark:border-sky-500/40 dark:bg-sky-500/10" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800/60",
    extra ?? "",
  ].join(" ");
function Input({ value, onChange, highlight }: { value: string; onChange: (v: string) => void; highlight?: boolean }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={inpCls(highlight)} />;
}
