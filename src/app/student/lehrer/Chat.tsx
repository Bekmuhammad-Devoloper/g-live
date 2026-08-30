"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StudentStrings } from "../_i18n";
import { ICON_GRADIENT, TEAL } from "../_ui";
import { markRead, sendMessage } from "./actions";

// Ustoz bilan yozishma. Xabarlar serverdan keladi, bu komponent yuborish,
// o'qilgan deb belgilash va yangilanishni ko'zatadi (har 15 soniyada).

export type VMsg = { id: string; mine: boolean; text: string; at: string; author: string | null };

const MAX = 1000;

const clock = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

const dayKey = (iso: string) => new Date(iso).toDateString();

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export default function Chat({
  messages,
  disabled,
  t,
  hasUnread,
}: {
  messages: VMsg[];
  disabled?: boolean;
  t: StudentStrings;
  hasUnread: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Oxirgi xabarga tushamiz
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Ochilganda ustozning xabarlari o'qilgan bo'ladi
  useEffect(() => {
    if (hasUnread) void markRead().then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread]);

  // Yangi javob kelganini ko'rish uchun sekin yangilanish
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    setErr(null);
    start(async () => {
      const r = await sendMessage(body);
      if (r.error) setErr(r.error);
      else {
        setText("");
        router.refresh();
      }
    });
  };

  let lastDay = "";

  return (
    <div className="flex flex-col gap-3">
      {/* Yozishma */}
      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="rounded-2xl bg-white/70 px-5 py-10 text-center">
            <div className="text-[14px] font-semibold text-slate-700">{t.chatEmpty}</div>
            <p className="mt-1 text-[12.5px] text-slate-400">{t.chatEmptyHint}</p>
          </div>
        ) : (
          messages.map((m) => {
            const k = dayKey(m.at);
            const showDay = k !== lastDay;
            lastDay = k;
            const label = showDay ? dayLabel(m.at) : null;
            return (
              <div key={m.id}>
                {label ? (
                  <div className="my-3 text-center">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-400">{label}</span>
                  </div>
                ) : null}
                <div className={"flex " + (m.mine ? "justify-end" : "justify-start")}>
                  <div
                    className={
                      "max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-[0_4px_12px_rgba(19,78,94,0.08)] " +
                      (m.mine ? "rounded-br-md text-white" : "rounded-bl-md bg-white text-slate-800")
                    }
                    style={m.mine ? { background: ICON_GRADIENT } : undefined}
                  >
                    {!m.mine && m.author ? (
                      <div className="mb-0.5 text-[11px] font-bold" style={{ color: TEAL }}>
                        {m.author}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words text-[14px] leading-snug">{m.text}</div>
                    <div className={"mt-0.5 text-right text-[10.5px] " + (m.mine ? "text-white/70" : "text-slate-400")}>
                      {clock(m.at)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {err ? <div className="rounded-xl bg-rose-50 px-3.5 py-2 text-[12.5px] font-semibold text-rose-700">{err}</div> : null}

      {/* Yozish maydoni */}
      <div className="sticky bottom-[86px] flex items-end gap-2 rounded-3xl bg-white p-2 shadow-[0_8px_22px_rgba(19,78,94,0.14)]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          disabled={disabled || pending}
          placeholder={t.writeQuestion}
          className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || pending || text.trim().length === 0}
          aria-label={t.send}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-40"
          style={{ background: ICON_GRADIENT }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
