"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";

// Yengil WYSIWYG muharrir — contentEditable + execCommand asosida (tashqi kutubxonasiz).
export default function RichEditor({ locale, value, onChange, placeholder }: { locale: Locale; value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Boshlang'ich HTML — faqat mount paytida (kursor sakramasligi uchun controlled emas)
  useEffect(() => {
    if (ref.current && value && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const btn = "flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/70 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
        <select onChange={(e) => exec("formatBlock", e.target.value)} defaultValue="P"
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <option value="P">{tr(locale, { uz: "Normal", ru: "Обычный", en: "Normal", de: "Normal" })}</option>
          <option value="H1">{tr(locale, { uz: "Sarlavha 1", ru: "Заголовок 1", en: "Heading 1", de: "Überschrift 1" })}</option>
          <option value="H2">{tr(locale, { uz: "Sarlavha 2", ru: "Заголовок 2", en: "Heading 2", de: "Überschrift 2" })}</option>
          <option value="H3">{tr(locale, { uz: "Sarlavha 3", ru: "Заголовок 3", en: "Heading 3", de: "Überschrift 3" })}</option>
        </select>
        <select onChange={(e) => exec("fontName", e.target.value)} defaultValue="sans-serif"
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <option value="sans-serif">Sans Serif</option>
          <option value="serif">Serif</option>
          <option value="monospace">Monospace</option>
        </select>

        <Sep />
        <button type="button" title={tr(locale, { uz: "Chapga", ru: "По левому краю", en: "Align left", de: "Linksbündig" })} className={btn} onClick={() => exec("justifyLeft")}><Icon name="alignLeft" className="h-4 w-4" /></button>
        <button type="button" title={tr(locale, { uz: "Raqamli ro'yxat", ru: "Нумерованный список", en: "Numbered list", de: "Nummerierte Liste" })} className={btn} onClick={() => exec("insertOrderedList")}><Icon name="listOrdered" className="h-4 w-4" /></button>
        <button type="button" title={tr(locale, { uz: "Nuqtali ro'yxat", ru: "Маркированный список", en: "Bulleted list", de: "Aufzählungsliste" })} className={btn} onClick={() => exec("insertUnorderedList")}><Icon name="listView" className="h-4 w-4" /></button>

        <Sep />
        <button type="button" title={tr(locale, { uz: "Havola", ru: "Ссылка", en: "Link", de: "Link" })} className={btn} onClick={() => { const u = prompt(tr(locale, { uz: "Havola (URL):", ru: "Ссылка (URL):", en: "Link (URL):", de: "Link (URL):" })); if (u) exec("createLink", u); }}><Icon name="link" className="h-4 w-4" /></button>
        <button type="button" title={tr(locale, { uz: "Rasm", ru: "Изображение", en: "Image", de: "Bild" })} className={btn} onClick={() => { const u = prompt(tr(locale, { uz: "Rasm URL:", ru: "URL изображения:", en: "Image URL:", de: "Bild-URL:" })); if (u) exec("insertImage", u); }}><Icon name="image" className="h-4 w-4" /></button>
        <button type="button" title={tr(locale, { uz: "Video (havola)", ru: "Видео (ссылка)", en: "Video (link)", de: "Video (Link)" })} className={btn} onClick={() => { const u = prompt(tr(locale, { uz: "Video havolasi:", ru: "Ссылка на видео:", en: "Video link:", de: "Video-Link:" })); if (u) exec("createLink", u); }}><Icon name="video" className="h-4 w-4" /></button>

        <Sep />
        <label className={cn(btn, "cursor-pointer")} title={tr(locale, { uz: "Matn rangi", ru: "Цвет текста", en: "Text color", de: "Textfarbe" })}>
          <span className="text-sm font-bold underline decoration-2">A</span>
          <input type="color" className="absolute h-0 w-0 opacity-0" onChange={(e) => exec("foreColor", e.target.value)} />
        </label>
        <button type="button" title={tr(locale, { uz: "Formatni tozalash", ru: "Очистить формат", en: "Clear formatting", de: "Formatierung löschen" })} className={btn} onClick={() => exec("removeFormat")}><Icon name="eraser" className="h-4 w-4" /></button>
      </div>

      {/* Kontent */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder ?? tr(locale, { uz: "Matn kiriting ...", ru: "Введите текст ...", en: "Enter text ...", de: "Text eingeben ..." })}
        className="rte min-h-[160px] px-3.5 py-3 text-sm leading-relaxed text-slate-700 outline-none dark:text-slate-100"
      />
      <style>{`.rte:empty:before{content:attr(data-placeholder);color:#94a3b8;font-style:italic}.rte h1{font-size:1.5rem;font-weight:700;margin:.4em 0}.rte h2{font-size:1.25rem;font-weight:700;margin:.4em 0}.rte h3{font-size:1.1rem;font-weight:600;margin:.3em 0}.rte ul{list-style:disc;padding-left:1.4em}.rte ol{list-style:decimal;padding-left:1.4em}.rte a{color:#4148ef;text-decoration:underline}`}</style>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />;
}
