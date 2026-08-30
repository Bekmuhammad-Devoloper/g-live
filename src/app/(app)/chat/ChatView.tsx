"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markThreadRead, replyToStudent } from "./actions";

// O'quvchilar bilan yozishma: chapda suhbatlar, o'ngda tanlangan suhbat.
// Telefon ekranida ro'yxat va suhbat navbat bilan ko'rinadi.

export type VThread = {
  studentId: string;
  student: string;
  group: string | null;
  last: string;
  lastAt: string;
  unread: number;
};

export type VMsg = { id: string; fromStudent: boolean; text: string; at: string; author: string | null };

// Telegram (yorug' mavzu) ranglari — o'quvchi ilovasidagi chat bilan bir xil
const TG = {
  wall: "#d9e4ec",
  out: "#effdde", // xodim xabari
  in: "#ffffff", // o'quvchi xabari
  outTime: "#5eb35a",
  inTime: "#a1aab3",
  text: "#0f1419",
};

const dayKey = (iso: string) => new Date(iso).toDateString();

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Bugun";
  if (d.toDateString() === yest.toDateString()) return "Kecha";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const clock = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const today = new Date().toDateString() === d.toDateString();
  return today ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getDate())}.${p(d.getMonth() + 1)}`;
};

export default function ChatView({
  threads,
  active,
  messages,
  canWrite,
}: {
  threads: VThread[];
  active: string | null;
  messages: VMsg[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const open = threads.find((t) => t.studentId === active) ?? null;

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? threads.filter((t) => t.student.toLowerCase().includes(needle) || (t.group ?? "").toLowerCase().includes(needle))
    : threads;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active]);

  // Ochilgan suhbat o'qilgan bo'ladi
  useEffect(() => {
    if (active && open && open.unread > 0) void markThreadRead(active).then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open?.unread]);

  // Yangi xabarni ko'rish uchun sekin yangilanish
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  const send = () => {
    const body = text.trim();
    if (!body || !active || pending) return;
    setErr(null);
    start(async () => {
      const r = await replyToStudent(active, body);
      if (r.error) setErr(r.error);
      else {
        setText("");
        router.refresh();
      }
    });
  };

  const select = (id: string) => {
    const p = new URLSearchParams(window.location.search);
    p.set("s", id);
    router.replace(`/chat?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="grid h-[calc(100dvh-240px)] min-h-[420px] gap-4 lg:grid-cols-[340px_1fr]">
      {/* Suhbatlar */}
      <div className={"flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white " + (active ? "hidden lg:flex" : "")}>
        <div className="border-b border-slate-100 p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="O'quvchi qidirish…"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-cyan-500"
          />
        </div>

        {shown.length === 0 ? (
          <div className="grid flex-1 place-items-center px-5 text-center text-sm text-slate-500">
            {threads.length === 0 ? "Ilovaga ulangan o'quvchi yo'q" : "Topilmadi"}
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {shown.map((th) => (
              <li key={th.studentId}>
                <button
                  type="button"
                  onClick={() => select(th.studentId)}
                  className={
                    "flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 " +
                    (th.studentId === active ? "bg-cyan-50/60" : "")
                  }
                >
                  <span
                    className={
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold " +
                      (th.lastAt ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-400")
                    }
                  >
                    {initials(th.student)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{th.student}</span>
                      {th.lastAt ? <span className="shrink-0 text-[11px] text-slate-400">{clock(th.lastAt)}</span> : null}
                    </div>
                    {th.group ? <div className="truncate text-[11.5px] text-slate-400">{th.group}</div> : null}
                    <div className={"mt-0.5 truncate text-[12.5px] " + (th.lastAt ? "text-slate-500" : "text-slate-300")}>
                      {th.lastAt ? th.last : "yozishma yo'q"}
                    </div>
                  </div>
                  {th.unread > 0 ? (
                    <span className="mt-1 shrink-0 rounded-full bg-cyan-600 px-1.5 py-[1px] text-[11px] font-bold text-white">
                      {th.unread}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Suhbat */}
      <div className={"flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white " + (active ? "" : "hidden lg:flex")}>
        {!open ? (
          <div className="grid flex-1 place-items-center px-6 py-20 text-center text-sm text-slate-400">
            Suhbatni tanlang
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-black/5 bg-white px-3 py-2.5">
              <button
                type="button"
                onClick={() => router.replace("/chat", { scroll: false })}
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 lg:hidden"
              >
                &larr; Ro&apos;yxat
              </button>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-100 text-[13px] font-semibold text-cyan-700">
                {initials(open.student)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[15.5px] font-semibold leading-tight text-black">{open.student}</div>
                {open.group ? <div className="truncate text-[13px] leading-tight text-[#707579]">{open.group}</div> : null}
              </div>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
              style={{
                backgroundColor: TG.wall,
                backgroundImage:
                  "radial-gradient(circle at 12px 12px, rgba(255,255,255,0.55) 2.5px, transparent 3px)," +
                  "radial-gradient(circle at 36px 36px, rgba(255,255,255,0.35) 2px, transparent 2.5px)",
                backgroundSize: "48px 48px, 48px 48px",
              }}
            >
              {messages.length === 0 ? (
                <div className="mx-auto mt-6 w-fit rounded-2xl bg-black/15 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm">
                  Yozishma hali boshlanmagan &mdash; birinchi bo&apos;lib yozing
                </div>
              ) : null}

              {messages.map((m, i) => {
                const mine = !m.fromStudent; // xodim xabari o'ngda
                const k = dayKey(m.at);
                const newDay = i === 0 || dayKey(messages[i - 1].at) !== k;
                const next = messages[i + 1];
                const runEnd = !next || next.fromStudent !== m.fromStudent || dayKey(next.at) !== k;
                const runStart = newDay || i === 0 || messages[i - 1].fromStudent !== m.fromStudent;

                return (
                  <div key={m.id}>
                    {newDay ? (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-full bg-black/20 px-2.5 py-[3px] text-[12px] font-medium text-white backdrop-blur-sm">
                          {dayLabel(m.at)}
                        </span>
                      </div>
                    ) : null}

                    <div className={"flex " + (mine ? "justify-end" : "justify-start") + (runEnd ? " mb-2" : " mb-[2px]")}>
                      <div
                        className="relative max-w-[70%] px-2.5 py-[5px] text-[15px] leading-[19px] shadow-[0_1px_1px_rgba(0,0,0,0.10)]"
                        style={{
                          background: mine ? TG.out : TG.in,
                          color: TG.text,
                          borderRadius: 12,
                          borderBottomRightRadius: mine && runEnd ? 2 : 12,
                          borderBottomLeftRadius: !mine && runEnd ? 2 : 12,
                        }}
                      >
                        {mine && m.author && runStart ? (
                          <div className="mb-[1px] text-[13.5px] font-semibold text-[#0e7490]">{m.author}</div>
                        ) : null}

                        <span className="whitespace-pre-wrap break-words align-top">{m.text}</span>
                        <span className="inline-block w-[44px] select-none align-top" aria-hidden />

                        <span
                          className="absolute bottom-[4px] right-[7px] text-[11px] leading-none"
                          style={{ color: mine ? TG.outTime : TG.inTime }}
                        >
                          {hhmm(m.at)}
                        </span>

                        {runEnd ? (
                          <svg
                            width="9"
                            height="17"
                            viewBox="0 0 9 17"
                            className={"absolute bottom-0 " + (mine ? "-right-[7px]" : "-left-[7px] -scale-x-100")}
                            style={{ color: mine ? TG.out : TG.in }}
                          >
                            <path d="M0 17V0c0 6.5 1.6 12.4 9 17H0Z" fill="currentColor" />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {canWrite ? (
              <div className="border-t border-black/5 bg-white px-2.5 py-2">
                {err ? <div className="mb-1.5 px-2 text-xs font-medium text-rose-600">{err}</div> : null}
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 items-end rounded-[20px] bg-[#f1f3f4] px-3.5 py-[7px]">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value.slice(0, 1000))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={1}
                      placeholder="Javob yozing…"
                      className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-[24px] text-black outline-none placeholder:text-[#8d9499]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={send}
                    disabled={pending || text.trim().length === 0}
                    aria-label="Yuborish"
                    className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#17a2bf] to-[#0e7490] text-white transition active:scale-95 disabled:opacity-35"
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="white">
                      <path d="M3.4 20.4 21.9 12 3.4 3.6 3.4 10.1l13.2 1.9-13.2 1.9z" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
