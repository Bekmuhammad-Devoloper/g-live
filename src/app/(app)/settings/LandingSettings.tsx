"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

const STORAGE_KEY = "gl-landing-pages";
const SECTIONS: { value: string; label: { uz: string; ru: string; en: string; de: string } }[] = [
  { value: "Asosiy sahifa", label: { uz: "Asosiy sahifa", ru: "Главная страница", en: "Home page", de: "Startseite" } },
  { value: "Kurslar", label: { uz: "Kurslar", ru: "Курсы", en: "Courses", de: "Kurse" } },
  { value: "Aloqa", label: { uz: "Aloqa", ru: "Связь", en: "Contact", de: "Kontakt" } },
  { value: "Biz haqimizda", label: { uz: "Biz haqimizda", ru: "О нас", en: "About us", de: "Über uns" } },
];
const SOURCES: { value: string; label: { uz: string; ru: string; en: string; de: string } }[] = [
  { value: "telegram", label: { uz: "telegram", ru: "телеграм", en: "telegram", de: "telegram" } },
  { value: "instagram", label: { uz: "instagram", ru: "инстаграм", en: "instagram", de: "instagram" } },
  { value: "sayt", label: { uz: "sayt", ru: "сайт", en: "website", de: "Webseite" } },
  { value: "reklama", label: { uz: "reklama", ru: "реклама", en: "advertising", de: "Werbung" } },
  { value: "tashrif", label: { uz: "tashrif", ru: "визит", en: "visit", de: "Besuch" } },
];

interface Page { id: string; name: string; slug: string; branch: string; section: string; source: string }

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/['']/g, "").replace(/[^a-z0-9Ѐ-ӿ\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-");

export default function LandingSettings({ locale, branches }: { locale: Locale; branches: string[] }) {
  const [form, setForm] = useState({ name: "", slug: "", slugTouched: false, branch: "", section: "", source: "" });
  const [list, setList] = useState<Page[]>([]);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setList(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);

  const persist = (next: Page[]) => {
    setList(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const onName = (v: string) => setForm((f) => ({ ...f, name: v, slug: f.slugTouched ? f.slug : slugify(v) }));

  const create = () => {
    setError("");
    if (form.name.trim().length < 2) return setError(tr(locale, { uz: "Nomi kamida 2 ta belgi bo'lsin", ru: "Название должно содержать не менее 2 символов", en: "Name must be at least 2 characters", de: "Der Name muss mindestens 2 Zeichen lang sein" }));
    if (!form.slug.trim()) return setError(tr(locale, { uz: "Slug majburiy", ru: "Slug обязателен", en: "Slug is required", de: "Slug ist erforderlich" }));
    if (list.some((p) => p.slug === form.slug.trim())) return setError(tr(locale, { uz: "Bu slug allaqachon mavjud", ru: "Такой slug уже существует", en: "This slug already exists", de: "Dieser Slug existiert bereits" }));
    const id = `lp-${Date.now().toString(36)}-${seed}`;
    setSeed((s) => s + 1);
    persist([{ id, name: form.name.trim(), slug: form.slug.trim(), branch: form.branch, section: form.section, source: form.source }, ...list]);
    setForm({ name: "", slug: "", slugTouched: false, branch: "", section: "", source: "" });
  };

  const remove = (id: string) => persist(list.filter((p) => p.id !== id));

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Landing page", ru: "Лендинг", en: "Landing page", de: "Landingpage" })}</h2>

      {/* Yaratish formasi */}
      <fieldset className="relative max-w-2xl rounded-xl border border-slate-300 p-6 pt-7 dark:border-slate-600">
        <legend className="ml-2 px-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Landing page yaratish", ru: "Создать лендинг", en: "Create landing page", de: "Landingpage erstellen" })}</legend>
        <div className="space-y-4">
          <Field label={tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })} required>
            <input value={form.name} onChange={(e) => onName(e.target.value)} className={inp} placeholder={tr(locale, { uz: "Landing sahifa nomi", ru: "Название лендинга", en: "Landing page name", de: "Name der Landingpage" })} />
          </Field>
          <Field label={tr(locale, { uz: "Slug", ru: "Slug", en: "Slug", de: "Slug" })} required>
            <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value, slugTouched: true }))} className={inp} placeholder="landing-sahifa" />
          </Field>
          <Field label={tr(locale, { uz: "Filial", ru: "Филиал", en: "Branch", de: "Filiale" })}>
            <Select value={form.branch} onChange={(v) => setForm((f) => ({ ...f, branch: v }))} options={branches.map((b) => ({ value: b, label: b }))} placeholder={tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })} />
          </Field>
          <Field label={tr(locale, { uz: "Bo'lim", ru: "Раздел", en: "Section", de: "Bereich" })}>
            <Select value={form.section} onChange={(v) => setForm((f) => ({ ...f, section: v }))} options={SECTIONS.map((s) => ({ value: s.value, label: tr(locale, s.label) }))} placeholder={tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })} muted />
          </Field>
          <Field label={tr(locale, { uz: "Manba", ru: "Источник", en: "Source", de: "Quelle" })}>
            <Select value={form.source} onChange={(v) => setForm((f) => ({ ...f, source: v }))} options={SOURCES.map((s) => ({ value: s.value, label: tr(locale, s.label) }))} placeholder={tr(locale, { uz: "Tanlang", ru: "Выберите", en: "Select", de: "Auswählen" })} muted />
          </Field>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

          <button onClick={create} className="rounded-full bg-teal-400 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500">
            {tr(locale, { uz: "Yaratish", ru: "Создать", en: "Create", de: "Erstellen" })}
          </button>
        </div>
      </fieldset>

      {/* Yaratilgan landinglar jadvali */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-card dark:border-slate-600 dark:bg-slate-900">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-300 text-[13px] font-semibold text-slate-500 dark:border-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-5 py-3.5">{tr(locale, { uz: "Nomi", ru: "Название", en: "Name", de: "Name" })}</th>
              <th className="px-5 py-3.5">{tr(locale, { uz: "Slug", ru: "Slug", en: "Slug", de: "Slug" })}</th>
              <th className="px-5 py-3.5 text-right">{tr(locale, { uz: "Amallar", ru: "Действия", en: "Actions", de: "Aktionen" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">{tr(locale, { uz: "Bo'sh", ru: "Пусто", en: "Empty", de: "Leer" })}</td></tr>
            ) : (
              list.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{p.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">/{p.slug}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <a href={`/${p.slug}`} target="_blank" rel="noreferrer" className="transition hover:text-brand-600" title={tr(locale, { uz: "Ochish", ru: "Открыть", en: "Open", de: "Öffnen" })}><Icon name="link" className="h-4 w-4" /></a>
                      <button onClick={() => remove(p.id)} className="transition hover:text-rose-600" title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })}><Icon name="trash" className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:ring-brand-900";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
        {required && <span className="text-rose-500">*</span>}{label}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder, muted }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; muted?: boolean }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full appearance-none rounded-lg border border-slate-300 px-3.5 pr-9 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:text-slate-100 ${muted ? "bg-slate-50 dark:bg-slate-800/40" : "bg-white dark:bg-slate-800/60"}`}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⇅</span>
    </div>
  );
}
