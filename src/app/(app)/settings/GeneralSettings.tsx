"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import LoginSettings from "./LoginSettings";
import LeadFormSettings from "./LeadFormSettings";
import PaymentSettings from "./PaymentSettings";
import ContactSettings from "./ContactSettings";
import IntegrationsSettings from "./IntegrationsSettings";
import BillingSettings from "./BillingSettings";
import ExamsSettings from "./ExamsSettings";
import ChekSettings from "./ChekSettings";
import type { ReceiptMode } from "@/lib/receiptMode";
import DebtSettings from "./DebtSettings";
import AccountSettings from "./AccountSettings";
import LandingSettings from "./LandingSettings";

const SECTIONS: { key: string; label: { uz: string; ru: string; en: string } }[] = [
  { key: "general", label: { uz: "Umumiy sozlamalari", ru: "Общие настройки", en: "General settings" } },
  { key: "login", label: { uz: "Sistemaga kirish", ru: "Вход в систему", en: "System login" } },
  { key: "leadform", label: { uz: "Lid forma", ru: "Форма лида", en: "Lead form" } },
  { key: "payment", label: { uz: "To'lov usullari", ru: "Способы оплаты", en: "Payment methods" } },
  { key: "contact", label: { uz: "Aloqa", ru: "Связь", en: "Contact" } },
  { key: "integrations", label: { uz: "Integratsiyalar", ru: "Интеграции", en: "Integrations" } },
  { key: "exams", label: { uz: "Imtihonlar", ru: "Экзамены", en: "Exams" } },
  { key: "receipt", label: { uz: "Chek", ru: "Чек", en: "Receipt" } },
  { key: "debt", label: { uz: "Qarzdorlik", ru: "Задолженность", en: "Debt" } },
  { key: "account", label: { uz: "Hisob va to'lovlar", ru: "Счёт и платежи", en: "Account and payments" } },
  { key: "landing", label: { uz: "Landing page", ru: "Лендинг", en: "Landing page" } },
];

const COLORS = ["#a21caf", "#4148ef", "#4d7c0f", "#ea580c", "#b91c1c"];
const STORAGE_KEY = "gl-general-settings";

interface Form {
  name: string; phone: string; workStart: string; workEnd: string;
  step5: boolean; coin: boolean; onlinePbx: boolean; animation: boolean;
  logo: string | null; color: string; offerName: string;
}

export default function GeneralSettings({ locale, defaultName, defaultPhone, branches = [], initialSection, receiptMode, defaultFee }: { locale: Locale; defaultName: string; defaultPhone: string; branches?: string[]; initialSection?: string; receiptMode: ReceiptMode; defaultFee: number }) {
  const [section, setSection] = useState(initialSection ?? "general");
  const [f, setF] = useState<Form>({
    name: defaultName, phone: defaultPhone, workStart: "09:00", workEnd: "20:00",
    step5: false, coin: false, onlinePbx: false, animation: true,
    logo: null, color: "#4148ef", offerName: "",
  });
  const [saved, setSaved] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const offerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setF((cur) => ({ ...cur, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, []);

  // URL ?tab= o'zgarganda (masalan "Billing" bosilganda) o'sha bo'limga o'tamiz
  useEffect(() => { setSection(initialSection ?? "general"); }, [initialSection]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 240, scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) { ctx.drawImage(img, 0, 0, w, h); set("logo", c.toDataURL("image/png")); }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col md:flex-row">
        {/* Ichki sidebar */}
        <aside className="shrink-0 border-b border-slate-200/70 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/30 md:w-56 md:border-b-0 md:border-r">
          <nav className="flex flex-wrap gap-1 md:flex-col">
            {SECTIONS.map((sec) => (
              <button key={sec.key} onClick={() => setSection(sec.key)}
                className={cn("rounded-lg px-4 py-2.5 text-sm font-medium transition md:text-right",
                  section === sec.key ? "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800")}>
                {tr(locale, sec.label)}
              </button>
            ))}
          </nav>
        </aside>

        {/* Kontent */}
        <div className="min-w-0 flex-1 p-6">
          {section === "login" ? (
            <LoginSettings locale={locale} />
          ) : section === "leadform" ? (
            <LeadFormSettings locale={locale} centerName={f.name} />
          ) : section === "payment" ? (
            <PaymentSettings locale={locale} centerName={f.name} />
          ) : section === "contact" ? (
            <ContactSettings locale={locale} />
          ) : section === "integrations" ? (
            <IntegrationsSettings locale={locale} />
          ) : section === "billing" ? (
            <BillingSettings locale={locale} />
          ) : section === "account" ? (
            <AccountSettings locale={locale} />
          ) : section === "exams" ? (
            <ExamsSettings locale={locale} />
          ) : section === "receipt" ? (
            <ChekSettings locale={locale} centerName={f.name} receiptMode={receiptMode} />
          ) : section === "debt" ? (
            <DebtSettings locale={locale} defaultFee={defaultFee} />
          ) : section === "landing" ? (
            <LandingSettings locale={locale} branches={branches} />
          ) : section !== "general" ? (
            <div className="flex h-72 flex-col items-center justify-center text-slate-400">
              <Icon name="settings" className="h-9 w-9 opacity-40" />
              <p className="mt-3 text-sm">{tr(locale, { uz: "Bu bo'lim tayyorlanmoqda", ru: "Этот раздел в разработке", en: "This section is being prepared" })}</p>
            </div>
          ) : (
            <>
              <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Umumiy sozlamalari", ru: "Общие настройки", en: "General settings" })}</h2>

              <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                <Field label={tr(locale, { uz: "O'quv markazining nomi", ru: "Название учебного центра", en: "Name of the learning center" })} required>
                  <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} />
                </Field>
                <Field label={tr(locale, { uz: "O'quv markazining telefon raqami", ru: "Телефон учебного центра", en: "Learning center phone number" })} required>
                  <input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inp} />
                </Field>

                <Field label={tr(locale, { uz: "Ish boshlanish vaqti", ru: "Время начала работы", en: "Work start time" })} required>
                  <TimeInput value={f.workStart} onChange={(v) => set("workStart", v)} />
                </Field>
                <Field label={tr(locale, { uz: "ish tugash vaqti", ru: "Время окончания работы", en: "Work end time" })} required>
                  <TimeInput value={f.workEnd} onChange={(v) => set("workEnd", v)} />
                </Field>

                <Toggle label={tr(locale, { uz: "Dars boshlanish vaqti: (qadam 5 daqiqa)", ru: "Время начала урока: (шаг 5 минут)", en: "Lesson start time: (step 5 minutes)" })} on={f.step5} onClick={() => set("step5", !f.step5)} />
                <Toggle label={tr(locale, { uz: "Barcha xodimlar coin bera oladi", ru: "Все сотрудники могут начислять коины", en: "All staff can give coins" })} on={f.coin} onClick={() => set("coin", !f.coin)} />

                <Toggle label={tr(locale, { uz: "OnlinePBX filial rejimida", ru: "OnlinePBX в режиме филиала", en: "OnlinePBX in branch mode" })} on={f.onlinePbx} onClick={() => set("onlinePbx", !f.onlinePbx)} />
                <Toggle label={tr(locale, { uz: "Animatsiya", ru: "Анимация", en: "Animation" })} on={f.animation} onClick={() => set("animation", !f.animation)} />

                {/* Logotip */}
                <Field label={tr(locale, { uz: "Logotip", ru: "Логотип", en: "Logo" })}>
                  <button type="button" onClick={() => logoRef.current?.click()}
                    className="grid h-44 w-44 place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800/40">
                    {f.logo ? (
                      <span className="h-full w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${f.logo})` }} />
                    ) : (
                      <span className="flex flex-col items-center gap-1.5 text-slate-400">
                        <Icon name="camera" className="h-7 w-7" />
                        <span className="text-xs">{tr(locale, { uz: "Logotip yuklash", ru: "Загрузить логотип", en: "Upload logo" })}</span>
                      </span>
                    )}
                  </button>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
                </Field>

                {/* Asosiy rang + oferta */}
                <div className="space-y-5">
                  <Field label={tr(locale, { uz: "Asosiy rangni ko'rsating", ru: "Укажите основной цвет", en: "Choose the primary color" })}>
                    <div className="flex items-center gap-4">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => set("color", c)}
                          className={cn("h-7 w-7 rounded-full transition", f.color === c ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : "hover:scale-110")}
                          style={{ background: c, boxShadow: f.color === c ? `0 0 0 2px ${c}` : undefined }}
                          aria-label={c}
                        >
                          {f.color === c && <Icon name="check" className="mx-auto h-4 w-4 text-white" />}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label={tr(locale, { uz: "Kompaniya Ofertasi", ru: "Оферта компании", en: "Company offer" })}>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => offerRef.current?.click()}
                        className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-sky-600">
                        {tr(locale, { uz: "Faylni tanlang", ru: "Выберите файл", en: "Choose file" })}
                      </button>
                      {f.offerName && <span className="truncate text-sm text-slate-500">{f.offerName}</span>}
                      <input ref={offerRef} type="file" className="hidden" onChange={(e) => set("offerName", e.target.files?.[0]?.name ?? "")} />
                    </div>
                  </Field>
                </div>
              </div>

              <button onClick={save} className="mt-8 rounded-lg bg-amber-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600">
                {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:ring-brand-900";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800/60">
      <Icon name="clock" className="h-4 w-4 text-slate-400" />
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" />
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
      <button onClick={onClick} className={cn("relative h-6 w-11 rounded-full transition", on ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")} aria-pressed={on}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
