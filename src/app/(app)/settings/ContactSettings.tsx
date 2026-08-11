"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

const STORAGE_KEY = "gl-contact-settings";

interface Form {
  pmUsername: string;
  pmPassword: string;
  pmOriginator: string;
  eskizEmail: string;
  eskizSecret: string;
  eskizNickname: string;
}

const empty: Form = { pmUsername: "", pmPassword: "", pmOriginator: "3700", eskizEmail: "", eskizSecret: "", eskizNickname: "" };

export default function ContactSettings({ locale }: { locale: Locale }) {
  const [f, setF] = useState<Form>(empty);
  const [saved, setSaved] = useState(false);
  const [showPm, setShowPm] = useState(false);
  const [showEskiz, setShowEskiz] = useState(false);

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
      <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Aloqa", ru: "Связь", en: "Contact" })}</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* PlayMobile SMS */}
        <Fieldset title="PlayMobile SMS">
          <div className="space-y-4">
            <div>
              <Label>PlayMobile gateway username</Label>
              <Input value={f.pmUsername} onChange={(v) => set("pmUsername", v)} />
            </div>
            <div>
              <Label>PlayMobile gateway password</Label>
              <Password value={f.pmPassword} onChange={(v) => set("pmPassword", v)} show={showPm} onToggle={() => setShowPm((s) => !s)} locale={locale} />
            </div>
            <div>
              <Label>PlayMobile gateway Originator</Label>
              <Input value={f.pmOriginator} onChange={(v) => set("pmOriginator", v)} highlight />
            </div>
          </div>
        </Fieldset>

        {/* Eskiz SMS */}
        <Fieldset title="Eskiz SMS">
          <div className="space-y-4">
            <div>
              <Label>Eskiz email (login)</Label>
              <Input value={f.eskizEmail} onChange={(v) => set("eskizEmail", v)} />
            </div>
            <div>
              <Label>Eskiz secret key (password)</Label>
              <Password value={f.eskizSecret} onChange={(v) => set("eskizSecret", v)} show={showEskiz} onToggle={() => setShowEskiz((s) => !s)} locale={locale} />
            </div>
            <div>
              <Label>Eskiz nickname</Label>
              <Input value={f.eskizNickname} onChange={(v) => set("eskizNickname", v)} />
            </div>
          </div>
        </Fieldset>
      </div>

      <button onClick={save} className="mt-7 rounded-full bg-brand-800 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900">
        {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
      </button>
    </div>
  );
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

function Password({ value, onChange, show, onToggle, locale }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; locale: Locale }) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className={inpCls(false, "pr-10")} />
      <button type="button" onClick={onToggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title={show ? tr(locale, { uz: "Yashirish", ru: "Скрыть", en: "Hide" }) : tr(locale, { uz: "Ko'rsatish", ru: "Показать", en: "Show" })}>
        <Icon name="eye" className="h-4 w-4" />
      </button>
    </div>
  );
}
