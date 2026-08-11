"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

const STORAGE_KEY = "gl-payment-settings";

interface Form {
  paymeMerchantId: string;
  uzumServiceId: string;
  clickServiceId: string;
  companyLink: string;
  paycomMerchantId: string;
  paycomUsername: string;
  paycomPassword: string;
  midtransServerKey: string;
  midtransClientKey: string;
}

const empty: Form = {
  paymeMerchantId: "", uzumServiceId: "", clickServiceId: "",
  companyLink: "", paycomMerchantId: "", paycomUsername: "", paycomPassword: "",
  midtransServerKey: "", midtransClientKey: "",
};

export default function PaymentSettings({ locale, centerName }: { locale: Locale; centerName: string }) {
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
    <div>
      <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "To'lov usullari", ru: "Способы оплаты", en: "Payment methods" })}</h2>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Yuqori qator — 3 ta ID kartochkasi */}
        <Fieldset title="Payme merchant ID">
          <SubLabel>{centerName}</SubLabel>
          <Input value={f.paymeMerchantId} onChange={(v) => set("paymeMerchantId", v)} />
        </Fieldset>
        <Fieldset title="Uzum service ID">
          <SubLabel>{centerName}</SubLabel>
          <Input value={f.uzumServiceId} onChange={(v) => set("uzumServiceId", v)} />
        </Fieldset>
        <Fieldset title="Click service ID">
          <SubLabel>{centerName}</SubLabel>
          <Input value={f.clickServiceId} onChange={(v) => set("clickServiceId", v)} />
        </Fieldset>

        {/* Payme — 2 ustun kenglikda */}
        <Fieldset title="Payme" className="lg:col-span-2">
          <div className="space-y-4">
            <div>
              <Label>{tr(locale, { uz: "Kompaniya havolasi", ru: "Ссылка компании", en: "Company link" })}</Label>
              <Input value={f.companyLink} onChange={(v) => set("companyLink", v)} disabled />
            </div>
            <div>
              <Label>{tr(locale, { uz: "Paycom sotuvchi identifikatori", ru: "Идентификатор продавца Paycom", en: "Paycom merchant ID" })}</Label>
              <Input value={f.paycomMerchantId} onChange={(v) => set("paycomMerchantId", v)} />
            </div>
            <div>
              <Label>{tr(locale, { uz: "Paycom foydalanuvchi nomi", ru: "Имя пользователя Paycom", en: "Paycom username" })}</Label>
              <Input value={f.paycomUsername} onChange={(v) => set("paycomUsername", v)} highlight />
            </div>
            <div>
              <Label>{tr(locale, { uz: "Paycom paroli", ru: "Пароль Paycom", en: "Paycom password" })}</Label>
              <div className="relative">
                <Input value={f.paycomPassword} onChange={(v) => set("paycomPassword", v)} type={showPass ? "text" : "password"} highlight className="pr-10" />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <Icon name={showPass ? "eye" : "eye"} className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </Fieldset>

        {/* Midtrans */}
        <Fieldset title="Midtrans">
          <div className="space-y-4">
            <div>
              <Label>MIDTRANS SERVER KEY</Label>
              <Input value={f.midtransServerKey} onChange={(v) => set("midtransServerKey", v)} />
            </div>
            <div>
              <Label>MIDTRANS CLIENT KEY</Label>
              <Input value={f.midtransClientKey} onChange={(v) => set("midtransClientKey", v)} />
            </div>
          </div>
        </Fieldset>
      </div>

      <button onClick={save} className="mt-7 rounded-lg bg-sky-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600">
        {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
      </button>
    </div>
  );
}

function Fieldset({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative self-start rounded-xl border border-slate-300 p-5 pt-6 dark:border-slate-600 ${className ?? ""}`}>
      <span className="absolute -top-2.5 left-4 bg-white px-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">{title}</span>
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{children}</label>;
}

function Input({
  value, onChange, type = "text", disabled, highlight, className,
}: { value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; highlight?: boolean; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={[
        "h-11 w-full rounded-lg border px-3.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900",
        disabled ? "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800/40" :
          highlight ? "border-sky-300 bg-sky-50/60 text-slate-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-slate-100"
            : "border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100",
        className ?? "",
      ].join(" ")}
    />
  );
}
