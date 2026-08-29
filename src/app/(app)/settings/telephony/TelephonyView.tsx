"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { saveTelephony, checkTelephony } from "./actions";

export default function TelephonyView({ locale, domain: domain0, hasKey, keyHint, enabled: enabled0 }: {
  locale: Locale; domain: string; hasKey: boolean; keyHint: string; enabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [domain, setDomain] = useState(domain0);
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(enabled0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, startCheck] = useTransition();

  const configured = hasKey || domain0.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSaved(false); setCheck(null);
    const fd = new FormData();
    fd.set("domain", domain);
    fd.set("apiKey", apiKey);
    fd.set("enabled", enabled ? "1" : "0");
    start(async () => {
      const r = await saveTelephony(fd);
      if (r.ok) { setSaved(true); setApiKey(""); setTimeout(() => setSaved(false), 2500); }
      else setError(r.error ?? tr(locale, { uz: "Xatolik", ru: "Ошибка", en: "Error", de: "Fehler" }));
    });
  };

  const runCheck = () => { setCheck(null); startCheck(async () => setCheck(await checkTelephony())); };

  const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-soft"><Icon name="phone" className="h-6 w-6" /></span>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(locale, { uz: "Onlain telefoniya", ru: "Онлайн-телефония", en: "Online telephony", de: "Online-Telefonie" })}</h1>
            <p className="text-sm text-slate-400">{tr(locale, { uz: "Qo'ng'iroqlar markazini OnlinePBX bilan ulash", ru: "Подключение колл-центра через OnlinePBX", en: "Connect the call center via OnlinePBX", de: "Callcenter über OnlinePBX verbinden" })}</p>
          </div>
        </div>
        {configured ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {tr(locale, { uz: "Sozlangan", ru: "Настроено", en: "Configured", de: "Konfiguriert" })}{!enabled && tr(locale, { uz: " (o'chirilgan)", ru: " (отключено)", en: " (disabled)", de: " (deaktiviert)" })}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> {tr(locale, { uz: "Sozlanmagan", ru: "Не настроено", en: "Not configured", de: "Nicht konfiguriert" })}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <button className="border-b-2 border-brand-500 px-4 py-2.5 text-sm font-semibold text-brand-600 dark:text-brand-400">OnlinePBX</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form */}
        <form onSubmit={submit} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">OnlinePBX domain</span>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="pbx00000.onpbx.ru" className={inp} />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">API KEY</span>
              <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" autoComplete="off" placeholder={hasKey ? tr(locale, { uz: `${keyHint} (saqlangan — o'zgartirish uchun yangisini kiriting)`, ru: `${keyHint} (сохранён — введите новый, чтобы изменить)`, en: `${keyHint} (saved — enter a new one to change)`, de: `${keyHint} (gespeichert — geben Sie einen neuen ein, um ihn zu ändern)` }) : "xBHHR9…"} className={inp} />
              {hasKey && <span className="mt-1 block text-[11px] text-slate-400">{tr(locale, { uz: "Kalit saqlangan. Bo'sh qoldirsangiz o'zgarmaydi.", ru: "Ключ сохранён. Если оставить пустым, он не изменится.", en: "Key saved. Leave empty to keep it unchanged.", de: "Schlüssel gespeichert. Leer lassen, um ihn nicht zu ändern." })}</span>}
            </label>

            <label className="flex items-center gap-2.5">
              <button type="button" onClick={() => setEnabled((v) => !v)} className={cn("relative h-6 w-11 rounded-full transition", enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>
                <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", enabled ? "left-[22px]" : "left-0.5")} />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">{tr(locale, { uz: "Telefoniya yoqilgan", ru: "Телефония включена", en: "Telephony enabled", de: "Telefonie aktiviert" })}</span>
            </label>

            {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}
            {saved && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">{tr(locale, { uz: "✓ Saqlandi", ru: "✓ Сохранено", en: "✓ Saved", de: "✓ Gespeichert" })}</div>}
            {check && <div className={cn("rounded-lg px-3 py-2 text-sm", check.ok ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400")}>{check.ok ? "✓ " : "⚠ "}{check.message}</div>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="submit" disabled={pending} className="h-11 rounded-xl bg-brand-700 px-8 text-sm font-bold text-white transition hover:bg-brand-800 disabled:opacity-60">{pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving...", de: "Wird gespeichert..." }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</button>
              <button type="button" onClick={runCheck} disabled={checking} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{checking ? tr(locale, { uz: "Tekshirilmoqda...", ru: "Проверка...", en: "Checking...", de: "Wird geprüft..." }) : tr(locale, { uz: "Ulanishni tekshirish", ru: "Проверить подключение", en: "Check connection", de: "Verbindung prüfen" })}</button>
            </div>
          </div>
        </form>

        {/* Tavsif */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200"><Icon name="info" className="h-5 w-5 text-slate-400" /> {tr(locale, { uz: "Tavsif", ru: "Описание", en: "Description", de: "Beschreibung" })}</h3>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Telefoniya sozlamalari ma'lumotlarini olish uchun", ru: "Чтобы получить данные для настройки телефонии, обратитесь в техподдержку", en: "To obtain telephony setup details, contact the technical support of", de: "Um die Einstellungen für die Telefonie zu erhalten, wenden Sie sich an den technischen Support von" })} <b className="text-slate-600 dark:text-slate-300">Modme</b> {tr(locale, { uz: "yoki", ru: "или", en: "or", de: "oder" })} <b className="text-slate-600 dark:text-slate-300">OnlinePBX</b> {tr(locale, { uz: "texnik yordamiga murojaat qiling.", ru: ".", en: ".", de: "." })}</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li className="flex gap-2"><span className="text-brand-500">1.</span> {tr(locale, { uz: "OnlinePBX kabinetidan", ru: "В кабинете OnlinePBX получите", en: "From the OnlinePBX dashboard, get the", de: "Holen Sie sich im OnlinePBX-Dashboard die" })} <b>{tr(locale, { uz: "domen", ru: "домен", en: "domain", de: "Domain" })}</b> {tr(locale, { uz: "va", ru: "и", en: "and", de: "und" })} <b>{tr(locale, { uz: "API kalit", ru: "API-ключ", en: "API key", de: "API-Schlüssel" })}</b>{tr(locale, { uz: "ni oling.", ru: ".", en: ".", de: "." })}</li>
              <li className="flex gap-2"><span className="text-brand-500">2.</span> {tr(locale, { uz: "Ularni chapdagi maydonlarga kiriting va", ru: "Введите их в поля слева и нажмите", en: "Enter them in the fields on the left and click", de: "Geben Sie diese in die Felder links ein und klicken Sie auf" })} <b>{tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}</b>{tr(locale, { uz: "ni bosing.", ru: ".", en: ".", de: "." })}</li>
              <li className="flex gap-2"><span className="text-brand-500">3.</span> {tr(locale, { uz: "Ulangach qo'ng'iroqlar", ru: "После подключения звонки появятся в", en: "Once connected, calls appear in the", de: "Nach der Verbindung erscheinen Anrufe im" })} <b>{tr(locale, { uz: "Qo'ng'iroqlar jurnali", ru: "Журнале звонков", en: "Call log", de: "Anrufprotokoll" })}</b>{tr(locale, { uz: "da ko'rinadi.", ru: ".", en: ".", de: "." })}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{tr(locale, { uz: "Provayder", ru: "Провайдер", en: "Provider", de: "Anbieter" })}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">OnlinePBX</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">{tr(locale, { uz: "Holat", ru: "Статус", en: "Status", de: "Status" })}</span>
              <span className={cn("font-semibold", configured && enabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500")}>{configured ? (enabled ? tr(locale, { uz: "Faol", ru: "Активно", en: "Active", de: "Aktiv" }) : tr(locale, { uz: "O'chirilgan", ru: "Отключено", en: "Disabled", de: "Deaktiviert" })) : tr(locale, { uz: "Sozlanmagan", ru: "Не настроено", en: "Not configured", de: "Nicht konfiguriert" })}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
