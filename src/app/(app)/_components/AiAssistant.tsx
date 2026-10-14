"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";
import { askAssistant, type AiChatMessage } from "../ai/actions";

const STORE_KEY = "gl-ai-chat";

const SUGGEST: { uz: string; ru: string; en: string; de: string }[] = [
  { uz: "Bugun qancha tushum bo'ldi?", ru: "Какая выручка сегодня?", en: "What is today's revenue?", de: "Wie hoch ist der Umsatz heute?" },
  { uz: "Bugun nechta lid tushdi?", ru: "Сколько лидов пришло сегодня?", en: "How many leads came in today?", de: "Wie viele Leads kamen heute?" },
  { uz: "Qaysi filialda qancha qarzdor bor?", ru: "Сколько должников в каждом филиале?", en: "How many debtors per branch?", de: "Wie viele Schuldner pro Filiale?" },
  { uz: "Yangi o'quvchini qanday qabul qilaman?", ru: "Как принять нового ученика?", en: "How do I enroll a new student?", de: "Wie nehme ich einen neuen Schüler auf?" },
];

/** Oddiy formatlash: **qalin**, ro'yxat qatorlari, bo'sh qator — paragraf */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
  return (
    <div className="space-y-1">
      {lines.map((l, i) => {
        const t = l.trimEnd();
        if (!t.trim()) return <div key={i} className="h-1" />;
        if (/^#{1,4}\s/.test(t)) return <div key={i} className="pt-1 font-semibold">{inline(t.replace(/^#{1,4}\s/, ""))}</div>;
        const li = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(t);
        if (li) return <div key={i} className="flex gap-2 pl-1"><span className="shrink-0 text-slate-400">{/\d/.test(li[1]) ? li[1] : "•"}</span><span>{inline(li[2])}</span></div>;
        if (/^\|.*\|$/.test(t.trim())) {
          if (/^\|[\s:-]+\|/.test(t.trim()) && !/[a-zA-Z0-9]/.test(t)) return null;
          const cells = t.trim().slice(1, -1).split("|").map((c) => c.trim());
          return <div key={i} className="grid gap-2 border-b border-slate-200/60 py-0.5 text-[13px] dark:border-white/10" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>{cells.map((c, j) => <span key={j} className="truncate">{inline(c)}</span>)}</div>;
        }
        return <p key={i}>{inline(t)}</p>;
      })}
    </div>
  );
}

export default function AiAssistant({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { const raw = sessionStorage.getItem(STORE_KEY); if (raw) setMsgs(JSON.parse(raw)); } catch { /* bo'sh */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-40))); } catch { /* bo'sh */ }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, pending]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    const next: AiChatMessage[] = [...msgs, { role: "user", text: q }];
    setMsgs(next);
    setInput("");
    setErr(null);
    start(async () => {
      const r = await askAssistant(next);
      if (r.ok && r.text) setMsgs((m) => [...m, { role: "assistant", text: r.text! }]);
      else setErr(
        r.error === "not_configured" ? tr(locale, { uz: "AI hali sozlanmagan (API kaliti kiritilmagan).", ru: "AI ещё не настроен (нет API-ключа).", en: "AI is not configured yet (no API key).", de: "KI ist noch nicht eingerichtet (kein API-Schlüssel)." })
        : r.error === "forbidden" ? tr(locale, { uz: "AI yordamchi faqat rahbariyat uchun.", ru: "AI-помощник только для руководства.", en: "The AI assistant is for management only.", de: "Der KI-Assistent ist nur für die Leitung." })
        : r.error === "refusal" ? tr(locale, { uz: "Bu so'rovga javob berib bo'lmadi. Savolni boshqacha yozib ko'ring.", ru: "Не удалось ответить на этот запрос. Переформулируйте вопрос.", en: "Could not answer this request. Try rephrasing.", de: "Konnte nicht antworten. Bitte anders formulieren." })
        : tr(locale, { uz: "Javob olishda xatolik. Qayta urinib ko'ring.", ru: "Ошибка при получении ответа. Попробуйте ещё раз.", en: "Failed to get a reply. Please try again.", de: "Antwort fehlgeschlagen. Bitte erneut versuchen." }),
      );
    });
  };

  const title = tr(locale, { uz: "AI yordamchi", ru: "AI-помощник", en: "AI assistant", de: "KI-Assistent" });

  const sparkle = (cls: string) => (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );

  const panel = open && typeof document !== "undefined" ? createPortal(
    <div className="animate-dialog-fade fixed inset-0 z-[120] flex justify-end bg-slate-900/40" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="animate-slide-in-right flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl dark:bg-[#0d1b38]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white shadow-sm">{sparkle("h-5 w-5")}</span>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
              <div className="text-[11px] text-slate-400">{tr(locale, { uz: "Ma'lumotlar va platforma bo'yicha savollar", ru: "Вопросы по данным и платформе", en: "Questions about data and the platform", de: "Fragen zu Daten und Plattform" })}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {msgs.length > 0 && (
              <button type="button" onClick={() => { setMsgs([]); setErr(null); }} title={tr(locale, { uz: "Yangi suhbat", ru: "Новый чат", en: "New chat", de: "Neuer Chat" })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">
                <Icon name="refresh" className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {tr(locale, {
                  uz: "Salom! Men markazingiz ma'lumotlari bo'yicha savollarga javob beraman, platformadan foydalanishni o'rgataman va xodimlaringizga topshiriq bera olaman.",
                  ru: "Здравствуйте! Я отвечаю на вопросы по данным центра, обучаю работе с платформой и могу ставить задачи сотрудникам.",
                  en: "Hi! I answer questions about your center's data, teach how to use the platform and can assign tasks to your staff.",
                  de: "Hallo! Ich beantworte Fragen zu Ihren Daten, erkläre die Plattform und kann Aufgaben an Mitarbeiter vergeben.",
                })}
              </p>
              <div className="grid gap-2">
                {SUGGEST.map((sg) => (
                  <button key={sg.uz} type="button" onClick={() => send(tr(locale, sg))} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                    {tr(locale, sg)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "rounded-br-md bg-brand-600 text-white"
                  : "rounded-bl-md border border-slate-200/70 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
              )}>
                {m.role === "user" ? <span className="whitespace-pre-wrap">{m.text}</span> : <RichText text={m.text} />}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${d * 150}ms` }} />)}
              </div>
            </div>
          )}
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="shrink-0 border-t border-slate-200/70 p-3 dark:border-white/10"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 focus-within:border-brand-400 dark:border-white/10 dark:bg-white/[0.03]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder={tr(locale, { uz: "Savol yozing…", ru: "Напишите вопрос…", en: "Ask a question…", de: "Frage stellen…" })}
              className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            <button type="submit" disabled={pending || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-slate-400">{tr(locale, { uz: "AI faqat ma'lumotni o'qiydi va topshiriq bera oladi — tizim sozlamalarini o'zgartirmaydi.", ru: "AI только читает данные и может ставить задачи — настройки системы не меняет.", en: "AI only reads data and can assign tasks — it never changes system settings.", de: "KI liest nur Daten und kann Aufgaben vergeben — keine Systemänderungen." })}</p>
        </form>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-gradient-to-r from-violet-50 to-brand-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:border-violet-300 hover:shadow-sm dark:border-violet-500/30 dark:from-violet-500/10 dark:to-brand-500/10 dark:text-violet-300"
      >
        {sparkle("h-3.5 w-3.5")}
        <span className="hidden sm:inline">AI</span>
      </button>
      {panel}
    </>
  );
}
