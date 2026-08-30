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

// Telegram (yorug' mavzu) ranglari — chat ekrani shu uslubda
const TG = {
  wall: "#d9e4ec", // fon
  out: "#effdde", // o'z xabari
  in: "#ffffff", // kelgan xabar
  outTime: "#5eb35a",
  inTime: "#a1aab3",
  text: "#0f1419",
};
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
      <header className="flex shrink-0 items-center gap-2 border-b border-black/5 bg-white px-1.5 py-2">
        <button
          type="button"
          onClick={() => router.push("/student/kurse")}
          aria-label={t.back}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#707579] transition active:bg-black/5"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5.5 8.5 12l6.5 6.5" />
          </svg>
        </button>

        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={title} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#17a2bf] to-[#0e7490] text-[15px] font-semibold text-white">
            {initials}
          </span>
        )}

        <div className="ml-0.5 min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold leading-tight text-black">{title}</div>
          <div className="truncate text-[13px] leading-tight text-[#707579]">{subtitle}</div>
        </div>
      </header>

      {/* ── Xabarlar ── */}
      <div
        className="flex-1 overflow-y-auto px-2.5 py-3"
        style={{
          backgroundColor: TG.wall,
          backgroundImage:
            "radial-gradient(circle at 12px 12px, rgba(255,255,255,0.55) 2.5px, transparent 3px)," +
            "radial-gradient(circle at 36px 36px, rgba(255,255,255,0.35) 2px, transparent 2.5px)",
          backgroundSize: "48px 48px, 48px 48px",
        }}
      >
        {messages.length === 0 ? (
          <div className="mx-auto mt-8 max-w-[85%] rounded-2xl bg-black/15 px-4 py-3 text-center backdrop-blur-sm">
            <div className="text-[13.5px] font-semibold text-white">{t.chatEmpty}</div>
            <p className="mt-0.5 text-[12px] leading-snug text-white/80">{t.chatEmptyHint}</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const k = dayKey(m.at);
            const newDay = k !== lastDay;
            lastDay = k;

            // Ketma-ket xabarlar guruhlanadi: dumcha faqat oxirgisida
            const next = messages[i + 1];
            const runEnd = !next || next.mine !== m.mine || dayKey(next.at) !== k;
            const runStart = newDay || i === 0 || messages[i - 1].mine !== m.mine;

            return (
              <div key={m.id}>
                {newDay ? (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-black/20 px-2.5 py-[3px] text-[12px] font-medium text-white backdrop-blur-sm">
                      {dayLabel(m.at, t)}
                    </span>
                  </div>
                ) : null}

                <div className={"flex " + (m.mine ? "justify-end" : "justify-start") + (runEnd ? " mb-2" : " mb-[2px]")}>
                  <div
                    className="relative max-w-[78%] px-2.5 pb-[5px] pt-[5px] text-[15px] leading-[19px] shadow-[0_1px_1px_rgba(0,0,0,0.10)]"
                    style={{
                      background: m.mine ? TG.out : TG.in,
                      color: TG.text,
                      borderRadius: 12,
                      borderBottomRightRadius: m.mine && runEnd ? 2 : 12,
                      borderBottomLeftRadius: !m.mine && runEnd ? 2 : 12,
                    }}
                  >
                    {!m.mine && m.author && runStart ? (
                      <div className="mb-[1px] text-[13.5px] font-semibold text-[#0e7490]">{m.author}</div>
                    ) : null}

                    {/* Oxirgi qatorga vaqt sig'ishi uchun bo'sh joy qoldiramiz */}
                    <span className="whitespace-pre-wrap break-words align-top">{m.text}</span>
                    <span className="inline-block w-[54px] select-none align-top" aria-hidden />

                    <span
                      className="absolute bottom-[4px] right-[7px] flex items-center gap-[2px] text-[11px] leading-none"
                      style={{ color: m.mine ? TG.outTime : TG.inTime }}
                    >
                      {clock(m.at)}
                      {m.mine ? (
                        <svg width="16" height="11" viewBox="0 0 17 11" fill="none" stroke={m.read ? TG.outTime : "#9fc6a0"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 6.2 4 9.2 9.6 2.2" />
                          <path d="M7.4 8.4 8.2 9.2 15.8 2.2" />
                        </svg>
                      ) : null}
                    </span>

                    {/* Telegramdagi dumcha */}
                    {runEnd ? (
                      <svg
                        width="9"
                        height="17"
                        viewBox="0 0 9 17"
                        className={"absolute bottom-0 " + (m.mine ? "-right-[7px]" : "-left-[7px] -scale-x-100")}
                        style={{ color: m.mine ? TG.out : TG.in }}
                      >
                        <path d="M0 17V0c0 6.5 1.6 12.4 9 17H0Z" fill="currentColor" />
                      </svg>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* ── Yozish paneli ── */}
      <div className="shrink-0 bg-white px-2 pb-[calc(env(safe-area-inset-bottom)+7px)] pt-[7px]">
        {err ? <div className="mb-1.5 px-3 text-[12px] font-semibold text-rose-600">{err}</div> : null}
        <div className="flex items-end gap-1.5">
          <div className="flex flex-1 items-end rounded-[20px] bg-[#f1f3f4] px-3 py-[6px]">
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
              className="max-h-[120px] min-h-[26px] flex-1 resize-none bg-transparent text-[16px] leading-[26px] text-black outline-none placeholder:text-[#8d9499] disabled:opacity-60"
            />
          </div>

          <button
            type="button"
            onClick={send}
            disabled={disabled || pending || text.trim().length === 0}
            aria-label={t.send}
            className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#17a2bf] to-[#0e7490] text-white transition active:scale-95 disabled:opacity-35"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M3.4 20.4 21.9 12 3.4 3.6 3.4 10.1l13.2 1.9-13.2 1.9z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
