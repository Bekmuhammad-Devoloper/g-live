"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { StudentStrings } from "../_i18n";
import { markRead, sendMessage } from "./actions";

// Ustoz bilan yozishma — messenjer uslubida to'liq ekran: tepada sarlavha,
// o'rtada suriladigan xabarlar, pastda yozish paneli. Pastki menyu bu
// sahifada ko'rinmaydi (BottomNav ni qarang).

export type VMsg = {
  id: string;
  mine: boolean;
  text: string;
  at: string;
  author: string | null;
  read: boolean;
};

const MAX = 1000;
const p2 = (n: number) => String(n).padStart(2, "0");
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const dayKey = (iso: string) => new Date(iso).toDateString();

function dayLabel(iso: string, t: StudentStrings) {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return t.today;
  if (d.toDateString() === yest.toDateString()) return t.yesterday;
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function Chat({
  messages,
  disabled,
  t,
  hasUnread,
  title,
  subtitle,
  avatarUrl,
  initials,
}: {
  messages: VMsg[];
  disabled?: boolean;
  t: StudentStrings;
  hasUnread: boolean;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (hasUnread) void markRead().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  // Yozuv maydoni matnga qarab o'sadi (5 qatorgacha)
  const grow = () => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    setErr(null);
    start(async () => {
      const r = await sendMessage(body);
      if (r.error) setErr(r.error);
      else {
        setText("");
        if (boxRef.current) boxRef.current.style.height = "auto";
        router.refresh();
      }
    });
  };

  let lastDay = "";

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-[#e9eef2]">
      {/* ── Sarlavha ── */}
      <header className="flex shrink-0 items-center gap-3 bg-white px-3 py-2.5 shadow-[0_2px_10px_rgba(19,78,94,0.10)]">
        <button
          type="button"
          onClick={() => router.push("/student/kurse")}
          aria-label={t.back}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition active:bg-slate-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5.5 8.5 12l6.5 6.5" />
          </svg>
        </button>

        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={title} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#17a2bf] to-[#0e7490] text-[14px] font-extrabold text-white">
            {initials}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-extrabold leading-tight text-slate-900">{title}</div>
          <div className="truncate text-[12px] text-slate-400">{subtitle}</div>
        </div>
      </header>

      {/* ── Xabarlar ── */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(14,116,144,0.10) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      >
        {messages.length === 0 ? (
          <div className="mx-auto mt-10 max-w-[80%] rounded-2xl bg-white/85 px-5 py-6 text-center shadow-sm">
            <div className="text-[14px] font-semibold text-slate-700">{t.chatEmpty}</div>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-400">{t.chatEmptyHint}</p>
          </div>
        ) : (
          messages.map((m) => {
            const k = dayKey(m.at);
            const newDay = k !== lastDay;
            lastDay = k;
            return (
              <div key={m.id}>
                {newDay ? (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-slate-900/25 px-3 py-[3px] text-[11px] font-semibold text-white backdrop-blur-sm">
                      {dayLabel(m.at, t)}
                    </span>
                  </div>
                ) : null}

                <div className={"mb-1.5 flex " + (m.mine ? "justify-end" : "justify-start")}>
                  <div
                    className={
                      "relative max-w-[80%] px-3 pb-[18px] pt-2 text-[14.5px] leading-snug shadow-[0_1px_2px_rgba(0,0,0,0.10)] " +
                      (m.mine
                        ? "rounded-[16px] rounded-br-[4px] bg-[#d6f2e4] text-slate-800"
                        : "rounded-[16px] rounded-bl-[4px] bg-white text-slate-800")
                    }
                  >
                    {!m.mine && m.author ? (
                      <div className="mb-0.5 text-[12px] font-bold text-[#0e7490]">{m.author}</div>
                    ) : null}
                    <span className="whitespace-pre-wrap break-words">{m.text}</span>

                    {/* Vaqt va o'qilgan belgisi — pufakcha ichida, pastki o'ngda */}
                    <span className="absolute bottom-[4px] right-[9px] flex items-center gap-[3px] text-[10.5px] text-slate-400">
                      {clock(m.at)}
                      {m.mine ? (
                        <svg width="15" height="10" viewBox="0 0 17 11" fill="none" stroke={m.read ? "#0e7490" : "#94a3b8"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 6.2 4 9.2 9.6 2.2" />
                          <path d="M7.4 8.4 8.2 9.2 15.8 2.2" />
                        </svg>
                      ) : null}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* ── Yozish paneli ── */}
      <div className="shrink-0 bg-white px-2.5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-2px_12px_rgba(19,78,94,0.10)]">
        {err ? <div className="mb-1.5 px-2 text-[12px] font-semibold text-rose-600">{err}</div> : null}
        <div className="flex items-end gap-2">
          <textarea
            ref={boxRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, MAX));
              grow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            disabled={disabled || pending}
            placeholder={t.writeQuestion}
            className="max-h-[120px] min-h-[42px] flex-1 resize-none rounded-3xl bg-slate-100 px-4 py-2.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={disabled || pending || text.trim().length === 0}
            aria-label={t.send}
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#17a2bf] to-[#0e7490] text-white transition active:scale-95 disabled:opacity-40"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
