"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "./Icon";
import { askAndSave, listAiChats, getAiChat, deleteAiChat, type AiChatMessage, type AiChatSummary } from "../ai/actions";
import { confirmDelete } from "./dialogs";

const STORE_KEY = "gl-ai-chat";

type Msg = AiChatMessage & { at?: number };
type T4 = { uz: string; ru: string; en: string; de: string };

const SUGGEST: { icon: string; text: T4 }[] = [
  { icon: "💰", text: { uz: "Bugun qancha tushum bo'ldi?", ru: "Какая выручка сегодня?", en: "What is today's revenue?", de: "Wie hoch ist der Umsatz heute?" } },
  { icon: "📥", text: { uz: "Shu oy nechta lid tushdi, qaysi manbadan?", ru: "Сколько лидов в этом месяце и откуда?", en: "How many leads this month and from where?", de: "Wie viele Leads diesen Monat und woher?" } },
  { icon: "📊", text: { uz: "Qaysi filialda qancha qarzdor bor?", ru: "Сколько должников в каждом филиале?", en: "How many debtors per branch?", de: "Wie viele Schuldner pro Filiale?" } },
  { icon: "🎓", text: { uz: "Yangi o'quvchini qanday qabul qilaman?", ru: "Как принять нового ученика?", en: "How do I enroll a new student?", de: "Wie nehme ich einen neuen Schüler auf?" } },
];

const THINKING: T4[] = [
  { uz: "Savolni tahlil qilyapman…", ru: "Анализирую вопрос…", en: "Analyzing the question…", de: "Analysiere die Frage…" },
  { uz: "Ma'lumotlarni yig'yapman…", ru: "Собираю данные…", en: "Gathering data…", de: "Sammle Daten…" },
  { uz: "Javobni tayyorlayapman…", ru: "Готовлю ответ…", en: "Preparing the answer…", de: "Bereite Antwort vor…" },
];

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i} className="text-slate-500 dark:text-slate-400">{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="rounded bg-slate-200/70 px-1 py-0.5 text-[12px] dark:bg-white/10">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Javob matni: sarlavha, ro'yxat, jadval, qalin, kod */
function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimEnd();
    // Jadval bloki
    if (/^\s*\|.*\|\s*$/.test(t)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const r = lines[i].trim();
        if (!/^\|[\s:|-]+\|$/.test(r)) rows.push(r.slice(1, -1).split("|").map((c) => c.trim()));
        i++;
      }
      i--;
      const [head, ...body] = rows;
      out.push(
        <div key={`t${i}`} className="my-1.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-left text-[13px]">
            {head && <thead className="bg-slate-100/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400"><tr>{head.map((c, j) => <th key={j} className="whitespace-nowrap px-3 py-2">{inline(c)}</th>)}</tr></thead>}
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className={cn("px-3 py-1.5", j > 0 && /\d/.test(c) && "whitespace-nowrap tabular-nums")}>{inline(c)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (!t.trim()) { out.push(<div key={i} className="h-1.5" />); continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) { out.push(<div key={i} className="pt-1 text-[13px] font-bold text-slate-900 dark:text-white">{inline(h[2])}</div>); continue; }
    const li = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(t);
    if (li) {
      const num = /\d/.test(li[2]);
      out.push(
        <div key={i} className={cn("flex gap-2", li[1].length >= 2 ? "pl-5" : "pl-0.5")}>
          {num
            ? <span className="mt-px shrink-0 text-[12px] font-semibold tabular-nums text-violet-500">{li[2]}</span>
            : <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />}
          <span className="min-w-0">{inline(li[3])}</span>
        </div>,
      );
      continue;
    }
    out.push(<p key={i}>{inline(t)}</p>);
  }
  return <div className="space-y-1">{out}</div>;
}

function CopyBtn({ text, locale }: { text: string; locale: Locale }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
    >
      {ok ? <Icon name="check" className="h-3 w-3" /> : <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}
      {ok ? tr(locale, { uz: "Nusxalandi", ru: "Скопировано", en: "Copied", de: "Kopiert" }) : tr(locale, { uz: "Nusxa", ru: "Копировать", en: "Copy", de: "Kopieren" })}
    </button>
  );
}

const hhmm = (ms?: number) => { if (!ms) return ""; const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export default function AiAssistant({ locale, userName }: { locale: Locale; userName?: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [chats, setChats] = useState<AiChatSummary[] | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) setMsgs(v);
        else { setMsgs(v.msgs ?? []); setChatId(v.chatId ?? null); }
      }
    } catch { /* bo'sh */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ chatId, msgs: msgs.slice(-40) })); } catch { /* bo'sh */ }
  }, [msgs, chatId]);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, pending, err, open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    const f = setTimeout(() => inputRef.current?.focus(), 80);
    return () => { window.removeEventListener("keydown", k); clearTimeout(f); };
  }, [open]);
  // "O'ylayapti" bosqichlari
  useEffect(() => {
    if (!pending) { setPhase(0); return; }
    const id = setInterval(() => setPhase((p) => Math.min(p + 1, THINKING.length - 1)), 2200);
    return () => clearInterval(id);
  }, [pending]);
  // Kiritish maydoni balandligi matnga moslashadi
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input, open]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    const next: Msg[] = [...msgs, { role: "user", text: q, at: Date.now() }];
    setMsgs(next);
    setInput("");
    setErr(null);
    start(async () => {
      const r = await askAndSave(next, chatId);
      if (r.ok && r.text) {
        setMsgs((m) => [...m, { role: "assistant", text: r.text!, at: Date.now() }]);
        if (r.chatId) setChatId(r.chatId);
        setChats(null); // tarix keyingi ochilishda yangilanadi
      }
      else setErr(
        r.error === "not_configured" ? tr(locale, { uz: "AI hali sozlanmagan (API kaliti kiritilmagan).", ru: "AI ещё не настроен (нет API-ключа).", en: "AI is not configured yet (no API key).", de: "KI ist noch nicht eingerichtet (kein API-Schlüssel)." })
        : r.error === "forbidden" ? tr(locale, { uz: "AI yordamchi faqat rahbariyat uchun.", ru: "AI-помощник только для руководства.", en: "The AI assistant is for management only.", de: "Der KI-Assistent ist nur für die Leitung." })
        : r.error === "refusal" ? tr(locale, { uz: "Bu so'rovga javob berib bo'lmadi. Savolni boshqacha yozib ko'ring.", ru: "Не удалось ответить на этот запрос. Переформулируйте вопрос.", en: "Could not answer this request. Try rephrasing.", de: "Konnte nicht antworten. Bitte anders formulieren." })
        : tr(locale, { uz: "Javob olishda xatolik. Qayta urinib ko'ring.", ru: "Ошибка при получении ответа. Попробуйте ещё раз.", en: "Failed to get a reply. Please try again.", de: "Antwort fehlgeschlagen. Bitte erneut versuchen." }),
      );
    });
  };
  const retry = () => {
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser || pending) return;
    // Oxirgi savol javobsiz qolgan — uni olib tashlab qayta yuboramiz
    setMsgs((m) => (m[m.length - 1]?.role === "user" ? m.slice(0, -1) : m));
    setTimeout(() => send(lastUser.text), 0);
  };

  const newChat = () => { setMsgs([]); setChatId(null); setErr(null); setView("chat"); setTimeout(() => inputRef.current?.focus(), 50); };
  const openHistory = async () => {
    setView("history");
    setChats(await listAiChats());
  };
  const openChat = async (id: string) => {
    setLoadingChat(true);
    const m = await getAiChat(id);
    setLoadingChat(false);
    if (!m) return;
    setMsgs(m); setChatId(id); setErr(null); setView("chat");
  };
  const removeChat = async (c: AiChatSummary) => {
    const ok = await confirmDelete(tr(locale, { uz: `"${c.title}" suhbatini o'chirasizmi?`, ru: `Удалить чат «${c.title}»?`, en: `Delete chat "${c.title}"?`, de: `Chat "${c.title}" löschen?` }));
    if (!ok) return;
    await deleteAiChat(c.id);
    setChats((l) => (l ?? []).filter((x) => x.id !== c.id));
    if (c.id === chatId) { setMsgs([]); setChatId(null); }
  };
  const groupLabel = (iso: string) => {
    const d = new Date(iso), now = new Date();
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86_400_000);
    if (diff === 0) return tr(locale, { uz: "Bugun", ru: "Сегодня", en: "Today", de: "Heute" });
    if (diff === 1) return tr(locale, { uz: "Kecha", ru: "Вчера", en: "Yesterday", de: "Gestern" });
    if (diff < 7) return tr(locale, { uz: "Shu hafta", ru: "На этой неделе", en: "This week", de: "Diese Woche" });
    if (diff < 31) return tr(locale, { uz: "Shu oy", ru: "В этом месяце", en: "This month", de: "Diesen Monat" });
    return tr(locale, { uz: "Avvalroq", ru: "Ранее", en: "Earlier", de: "Früher" });
  };

  const title = tr(locale, { uz: "AI yordamchi", ru: "AI-помощник", en: "AI assistant", de: "KI-Assistent" });
  const first = userName?.split(" ")[0];

  const panel = open && typeof document !== "undefined" ? createPortal(
    <div className="animate-dialog-fade fixed inset-0 z-[120] flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="animate-slide-in-right flex h-full w-full max-w-[520px] flex-col bg-slate-50 shadow-2xl dark:bg-[#0b1630]">
        {/* Sarlavha */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-brand-600 px-5 pb-4 pt-4 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"><Sparkle className="h-6 w-6" /></span>
              <div>
                <div className="text-base font-bold leading-tight">{title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/75">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.25)]" />
                  {tr(locale, { uz: "Onlayn · markaz ma'lumotlari bilan ishlaydi", ru: "Онлайн · работает с данными центра", en: "Online · works with your center's data", de: "Online · arbeitet mit Ihren Daten" })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => (view === "history" ? setView("chat") : openHistory())}
                title={tr(locale, { uz: "Suhbatlar tarixi", ru: "История чатов", en: "Chat history", de: "Chatverlauf" })}
                className={cn("flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition hover:bg-white/15 hover:text-white", view === "history" ? "bg-white/20 text-white" : "text-white/85")}
              >
                <Icon name="history" className="h-4 w-4" /><span className="hidden sm:inline">{tr(locale, { uz: "Tarix", ru: "История", en: "History", de: "Verlauf" })}</span>
              </button>
              <button type="button" onClick={newChat} title={tr(locale, { uz: "Yangi suhbat", ru: "Новый чат", en: "New chat", de: "Neuer Chat" })} className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-white/85 transition hover:bg-white/15 hover:text-white">
                <Icon name="plus" className="h-4 w-4" /><span className="hidden sm:inline">{tr(locale, { uz: "Yangi chat", ru: "Новый чат", en: "New chat", de: "Neuer Chat" })}</span>
              </button>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-white/85 transition hover:bg-white/15 hover:text-white">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Suhbat */}
        {view === "history" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <button type="button" onClick={newChat} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 py-2.5 text-sm font-semibold text-violet-600 transition hover:border-violet-400 hover:bg-violet-50 dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10">
              <Icon name="plus" className="h-4 w-4" /> {tr(locale, { uz: "Yangi suhbat boshlash", ru: "Начать новый чат", en: "Start a new chat", de: "Neuen Chat starten" })}
            </button>
            {chats === null || loadingChat ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((k) => <div key={k} className="h-14 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-white/5" />)}</div>
            ) : chats.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5"><Icon name="history" className="h-6 w-6" /></div>
                <p className="text-sm text-slate-500">{tr(locale, { uz: "Hali suhbatlar yo'q", ru: "Чатов пока нет", en: "No chats yet", de: "Noch keine Chats" })}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {chats.map((c, i) => {
                  const g = groupLabel(c.updatedAt);
                  const showG = i === 0 || groupLabel(chats[i - 1].updatedAt) !== g;
                  return (
                    <Fragment key={c.id}>
                      {showG && <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g}</div>}
                      <div className={cn("group flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition", c.id === chatId ? "border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10" : "border-transparent hover:border-slate-200 hover:bg-white dark:hover:border-white/10 dark:hover:bg-white/[0.04]")}>
                        <button type="button" onClick={() => openChat(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/15 to-brand-500/15 text-violet-600 dark:text-violet-300"><Sparkle className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{c.title}</span>
                            <span className="block text-[11px] text-slate-400">{new Date(c.updatedAt).toLocaleDateString("ru-RU")} · {hhmm(new Date(c.updatedAt).getTime())} · {tr(locale, { uz: `${c.count} ta xabar`, ru: `${c.count} сообщ.`, en: `${c.count} messages`, de: `${c.count} Nachrichten` })}</span>
                          </span>
                        </button>
                        <button type="button" onClick={() => removeChat(c)} title={tr(locale, { uz: "O'chirish", ru: "Удалить", en: "Delete", de: "Löschen" })} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-500/10">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {msgs.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center pb-6">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-brand-600 text-white shadow-lg shadow-violet-500/25">
                <Sparkle className="h-8 w-8" />
              </div>
              <h3 className="text-center text-lg font-bold text-slate-800 dark:text-white">
                {first ? tr(locale, { uz: `Salom, ${first}!`, ru: `Здравствуйте, ${first}!`, en: `Hi, ${first}!`, de: `Hallo, ${first}!` }) : tr(locale, { uz: "Salom!", ru: "Здравствуйте!", en: "Hi!", de: "Hallo!" })}
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {tr(locale, {
                  uz: "Markazingiz ma'lumotlari bo'yicha savollarga javob beraman, platformadan foydalanishni o'rgataman va xodimlaringizga topshiriq bera olaman.",
                  ru: "Отвечаю на вопросы по данным центра, обучаю работе с платформой и могу ставить задачи сотрудникам.",
                  en: "I answer questions about your center's data, teach how to use the platform and can assign tasks to your staff.",
                  de: "Ich beantworte Fragen zu Ihren Daten, erkläre die Plattform und kann Aufgaben an Mitarbeiter vergeben.",
                })}
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGEST.map((sg) => (
                  <button
                    key={sg.text.uz}
                    type="button"
                    onClick={() => send(tr(locale, sg.text))}
                    className="group flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left text-[13px] leading-snug text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-violet-500/40"
                  >
                    <span className="text-base leading-none">{sg.icon}</span>
                    <span className="group-hover:text-slate-900 dark:group-hover:text-white">{tr(locale, sg.text)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {msgs.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex flex-col items-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm shadow-brand-600/20">
                    {m.text}
                  </div>
                  {m.at && <span className="mt-1 pr-1 text-[10px] text-slate-400">{hhmm(m.at)}</span>}
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white shadow-sm"><Sparkle className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                      <RichText text={m.text} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-1">
                      {m.at && <span className="text-[10px] text-slate-400">{hhmm(m.at)}</span>}
                      <CopyBtn text={m.text} locale={locale} />
                    </div>
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 animate-pulse place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white"><Sparkle className="h-4 w-4" /></span>
                  <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-[13px] text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                    <span className="flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: `${d * 150}ms` }} />)}</span>
                    {tr(locale, THINKING[phase])}
                  </div>
                </div>
              )}
              {err && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <span>{err}</span>
                  <button type="button" onClick={retry} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-100 dark:bg-white/10 dark:text-rose-200">
                    {tr(locale, { uz: "Qayta urinish", ru: "Повторить", en: "Retry", de: "Erneut" })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Kiritish */}
        <form onSubmit={(e) => { e.preventDefault(); setView("chat"); send(input); }} className="shrink-0 border-t border-slate-200/70 bg-white px-4 pb-3 pt-3 dark:border-white/10 dark:bg-[#0d1b38]">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 transition focus-within:border-violet-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:focus-within:bg-white/[0.05]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder={tr(locale, { uz: "Savolingizni yozing…", ru: "Напишите вопрос…", en: "Ask a question…", de: "Frage stellen…" })}
              className="min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-brand-600 text-white shadow-sm transition hover:brightness-110 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none dark:disabled:from-white/10 dark:disabled:to-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><Icon name="shield" className="h-3 w-3" />{tr(locale, { uz: "Faqat o'qiydi va topshiriq beradi — sozlamalarni o'zgartirmaydi", ru: "Только читает и ставит задачи — настройки не меняет", en: "Read-only plus tasks — never changes settings", de: "Nur lesen und Aufgaben — keine Änderungen" })}</span>
            <span className="hidden shrink-0 sm:inline"><kbd className="rounded border border-slate-200 px-1 dark:border-white/10">Enter</kbd> {tr(locale, { uz: "yuborish", ru: "отправить", en: "send", de: "senden" })}</span>
          </div>
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
        className="group relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-r from-violet-600 to-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-violet-500/30 transition hover:shadow-md hover:shadow-violet-500/40 hover:brightness-110"
      >
        <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-8 w-6 -skew-x-12 bg-white/30 transition-all duration-700 group-hover:left-[120%]" />
        <Sparkle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">AI</span>
      </button>
      {panel}
    </>
  );
}
