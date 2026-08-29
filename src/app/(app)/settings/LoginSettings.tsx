"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import RichEditor from "./RichEditor";

const STORAGE_KEY = "gl-login-settings";

interface Form {
  image: string | null;
  formText: string;
  css: string;
}

export default function LoginSettings({ locale }: { locale: Locale }) {
  const [f, setF] = useState<Form>({ image: null, formText: "", css: "" });
  const [saved, setSaved] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setF((cur) => ({ ...cur, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const readImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxW = 610, scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) { ctx.drawImage(img, 0, 0, w, h); set("image", c.toDataURL("image/jpeg", 0.85)); }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Sistemaga kirish", ru: "Вход в систему", en: "System login", de: "Systemanmeldung" })}</h2>

      {/* Shakl rasm */}
      <h3 className="mb-2.5 text-lg font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Shakl rasm", ru: "Изображение формы", en: "Form image", de: "Formularbild" })}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const file = e.dataTransfer.files?.[0]; if (file) readImage(file); }}
          className={cn(
            "flex h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition",
            drag ? "border-brand-400 bg-brand-50/50 dark:bg-brand-950/30" : "border-slate-300 hover:border-brand-400 dark:border-slate-700"
          )}
        >
          <Icon name="uploadCloud" className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {tr(locale, { uz: "Faylni bu yerga suring yoki", ru: "Перетащите файл сюда или", en: "Drag the file here or", de: "Datei hierher ziehen oder" })} <span className="font-medium text-brand-600 dark:text-brand-400">{tr(locale, { uz: "yuklash uchun bosing", ru: "нажмите для загрузки", en: "click to upload", de: "zum Hochladen klicken" })}</span>
          </p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file); }} />
        </div>

        <div className="flex h-[200px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
          {f.image ? (
            <span className="h-full w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${f.image})` }} />
          ) : (
            <span className="text-sm text-slate-400">{tr(locale, { uz: "Rasm oldindan ko'rish", ru: "Предпросмотр изображения", en: "Image preview", de: "Bildvorschau" })}</span>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-400">{tr(locale, { uz: "Rasm o'lchami 610x160px bo'lishini tavsiya etamiz", ru: "Рекомендуем размер изображения 610x160px", en: "We recommend an image size of 610x160px", de: "Wir empfehlen eine Bildgröße von 610x160px" })}</p>

      {/* Forma matni */}
      <h3 className="mb-2.5 mt-7 text-lg font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Forma matni", ru: "Текст формы", en: "Form text", de: "Formulartext" })}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <RichEditor locale={locale} value={f.formText} onChange={(html) => set("formText", html)} placeholder={tr(locale, { uz: "Matnni bu yerga kiriting ...", ru: "Введите текст здесь ...", en: "Insert text here ...", de: "Text hier eingeben ..." })} />
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tr(locale, { uz: "Oldindan ko'rish", ru: "Предпросмотр", en: "Preview", de: "Vorschau" })}</div>
          {f.formText ? (
            <div className="prose-sm text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: f.formText }} />
          ) : (
            <p className="text-slate-400">{tr(locale, { uz: "Matn shu yerda ko'rinadi", ru: "Текст появится здесь", en: "Text will appear here", de: "Der Text erscheint hier" })}</p>
          )}
        </div>
      </div>

      {/* Shaxsiy CSS */}
      <h3 className="mb-2.5 mt-7 text-lg font-semibold text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Shaxsiy CSS", ru: "Пользовательский CSS", en: "Custom CSS", de: "Eigenes CSS" })}</h3>
      <textarea
        value={f.css}
        onChange={(e) => set("css", e.target.value)}
        rows={5}
        placeholder={tr(locale, { uz: "Formaga shaxsiy CSS qo'shish uchun bu yerga CSS kodini yozing", ru: "Напишите здесь CSS-код, чтобы добавить свой стиль в форму", en: "Write CSS code here to add custom styling to the form", de: "Schreiben Sie hier CSS-Code, um dem Formular einen eigenen Stil hinzuzufügen" })}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-mono text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:ring-brand-900"
      />

      <button onClick={save} className="mt-6 rounded-lg bg-sky-500 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600">
        {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓", de: "Gespeichert ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save", de: "Speichern" })}
      </button>
    </div>
  );
}
