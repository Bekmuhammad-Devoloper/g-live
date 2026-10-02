"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";

// Ilovaning o'z tasdiqlash / xabar / matn so'rash oynalari — brauzerning
// `confirm`, `alert`, `prompt` oynalari o'rniga.
//
// Chaqirish imperativ va Promise qaytaradi, shuning uchun mavjud kodga oson tushadi:
//
//   if (!(await confirmDelete("Filialni o'chirasizmi?"))) return;
//   const reason = await promptDialog({ message: "Bekor qilish sababi", minLength: 3 });
//   await alertDialog("Fayl hali yuklanmoqda");
//
// Oyna `DialogHost` da chiziladi (ilova layoutida bir marta turadi). So'rovlar
// navbatga tushadi — ketma-ket chaqirilsa birin-ketin ko'rinadi.

type Tone = "default" | "danger" | "warning";

export interface DialogOptions {
  /** Sarlavha. Berilmasa `message` sarlavha o'rnida ko'rinadi */
  title?: string;
  message?: string;
  /** Ro'yxat (masalan to'ldirilmagan maydonlar) */
  items?: string[];
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface PromptOptions extends DialogOptions {
  placeholder?: string;
  defaultValue?: string;
  /** Ko'p qatorli matn (izoh, xabar) */
  multiline?: boolean;
  /** Kamida shuncha belgi kiritilmaguncha tasdiqlash tugmasi faol bo'lmaydi */
  minLength?: number;
}

type Request =
  | { id: number; kind: "confirm"; opts: DialogOptions; resolve: (v: boolean) => void }
  | { id: number; kind: "alert"; opts: DialogOptions; resolve: () => void }
  | { id: number; kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

const EMPTY: Request[] = [];
let queue: Request[] = EMPTY;
let seq = 0;
let hosts = 0; // sahifada DialogHost bormi — bo'lmasa brauzer oynasiga qaytamiz
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const push = (r: Request) => { queue = [...queue, r]; emit(); };
const drop = (id: number) => { queue = queue.filter((r) => r.id !== id); emit(); };

const norm = <T extends DialogOptions>(o: string | T): T => (typeof o === "string" ? ({ message: o } as T) : o);
const plain = (o: DialogOptions) => [o.title, ...(o.items ?? []).map((i) => `• ${i}`), o.message].filter(Boolean).join("\n");

export function confirmDialog(o: string | DialogOptions): Promise<boolean> {
  const opts = norm(o);
  if (hosts === 0) return Promise.resolve(window.confirm(plain(opts)));
  return new Promise((resolve) => push({ id: ++seq, kind: "confirm", opts, resolve }));
}

/** O'chirish / qaytarib bo'lmaydigan amal uchun tasdiq (qizil tugma) */
export const confirmDelete = (o: string | DialogOptions): Promise<boolean> => confirmDialog({ tone: "danger", ...norm(o) });

export function alertDialog(o: string | DialogOptions): Promise<void> {
  const opts = norm(o);
  if (hosts === 0) { window.alert(plain(opts)); return Promise.resolve(); }
  return new Promise((resolve) => push({ id: ++seq, kind: "alert", opts, resolve }));
}

export function promptDialog(o: string | PromptOptions): Promise<string | null> {
  const opts = norm<PromptOptions>(o);
  if (hosts === 0) return Promise.resolve(window.prompt(plain(opts), opts.defaultValue ?? ""));
  return new Promise((resolve) => push({ id: ++seq, kind: "prompt", opts, resolve }));
}

const TONES: Record<Tone, { icon: string; badge: string; button: string }> = {
  default: { icon: "info", badge: "bg-brand-500/15 text-brand-600 dark:text-brand-300", button: "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-400/50" },
  warning: { icon: "alert", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", button: "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-400/50" },
  danger: { icon: "trash", badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400", button: "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400/50" },
};

/** Ilova layoutida bir marta turadi */
export function DialogHost({ locale }: { locale: Locale }) {
  const items = useSyncExternalStore(subscribe, () => queue, () => EMPTY);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { hosts++; setMounted(true); return () => { hosts--; }; }, []);
  const req = items[0];
  if (!mounted || !req) return null;
  return createPortal(<DialogCard key={req.id} req={req} locale={locale} />, document.body);
}

function DialogCard({ req, locale }: { req: Request; locale: Locale }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const o = req.opts;
  const prompt = req.kind === "prompt" ? req.opts : null;
  const [value, setValue] = useState(prompt?.defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const tone: Tone = o.tone ?? (req.kind === "alert" ? "warning" : "default");
  const style = TONES[tone];
  const minLength = prompt?.minLength ?? (prompt ? 1 : 0);
  const canConfirm = !prompt || value.trim().length >= minLength;

  const finish = (ok: boolean) => {
    if (req.kind === "confirm") req.resolve(ok);
    else if (req.kind === "alert") req.resolve();
    else req.resolve(ok ? valueRef.current : null);
    drop(req.id);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const canRef = useRef(canConfirm);
  canRef.current = canConfirm;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    (inputRef.current ?? okRef.current)?.focus();
    // Ushlash bosqichida: ostidagi yon panel/oynalarning Escape tinglovchilari ishlamasin
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finishRef.current(false); return; }
      if (e.key !== "Enter") return;
      const el = e.target as HTMLElement | null;
      // Ko'p qatorli maydonda Enter — yangi qator; yuborish Ctrl+Enter
      if (el?.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
      // "Bekor qilish" ustida turgan bo'lsa — tugmaning o'z bosilishi ishlaydi
      if (el?.tagName === "BUTTON" && el !== okRef.current) return;
      e.preventDefault(); e.stopPropagation();
      if (canRef.current) finishRef.current(true);
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); before?.focus?.(); };
  }, []);

  // Brauzer oynasidan qolgan "Sabab:" kabi yakuniy ikki nuqta sarlavhada ortiqcha
  const headline = (o.title ?? o.message ?? "").replace(/:\s*$/, "");
  const body = o.title ? o.message : undefined;
  const confirmLabel = o.confirmLabel ?? (
    req.kind === "alert" ? T("Tushunarli", "Понятно", "Got it", "Verstanden")
    : req.kind === "prompt" ? T("Tasdiqlash", "Подтвердить", "Confirm", "Bestätigen")
    : tone === "danger" ? T("Ha, o'chirish", "Да, удалить", "Yes, delete", "Ja, löschen")
    : T("Ha, davom etish", "Да, продолжить", "Yes, continue", "Ja, fortfahren")
  );
  const cancelLabel = o.cancelLabel ?? T("Bekor qilish", "Отмена", "Cancel", "Abbrechen");
  const field = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto px-4 pb-10 pt-[max(1rem,7vh)]" role="presentation" onMouseDown={() => finish(false)}>
      <div className="animate-dialog-fade absolute inset-0 bg-slate-900/45 backdrop-blur-[3px]" />
      <div
        role={req.kind === "alert" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={headline}
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-dialog-drop relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-pop dark:border-white/10 dark:bg-[#15243d]"
      >
        <div className="flex gap-3.5 px-5 pt-5">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", style.badge)}>
            <Icon name={style.icon} className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
            <h2 className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-100">{headline}</h2>
            {o.items && o.items.length > 0 && (
              <ul className="mt-2.5 space-y-1.5 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-white/[0.04]">
                {o.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", tone === "danger" ? "bg-rose-500" : tone === "warning" ? "bg-amber-500" : "bg-brand-500")} />
                    <span className="min-w-0 break-words">{it}</span>
                  </li>
                ))}
              </ul>
            )}
            {body && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>}
            {prompt && (
              <div className="mt-3">
                {prompt.multiline ? (
                  <textarea ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder={prompt.placeholder} className={cn(field, "resize-none")} />
                ) : (
                  <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={prompt.placeholder} className={field} />
                )}
                {minLength > 1 && (
                  <p className={cn("mt-1.5 text-[11px]", canConfirm ? "text-slate-400" : "text-amber-600 dark:text-amber-400")}>
                    {T(`Kamida ${minLength} ta belgi`, `Минимум ${minLength} символа`, `At least ${minLength} characters`, `Mindestens ${minLength} Zeichen`)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:justify-end dark:border-white/10 dark:bg-white/[0.03]">
          {req.kind !== "alert" && (
            <button type="button" onClick={() => finish(false)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/10">
              {cancelLabel}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            disabled={!canConfirm}
            onClick={() => finish(true)}
            className={cn("h-10 rounded-xl px-5 text-sm font-semibold text-white shadow-sm outline-none transition focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50", style.button)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
