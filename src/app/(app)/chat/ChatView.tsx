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
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const open = threads.find((t) => t.studentId === active) ?? null;

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
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Suhbatlar */}
      <div className={"rounded-xl border border-slate-200 bg-white " + (active ? "hidden lg:block" : "")}>
        {threads.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-500">Hozircha yozishma yo&apos;q</div>
        ) : (
          <ul className="max-h-[70vh] overflow-y-auto">
            {threads.map((th) => (
              <li key={th.studentId}>
                <button
                  type="button"
                  onClick={() => select(th.studentId)}
                  className={
                    "flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 " +
                    (th.studentId === active ? "bg-cyan-50/60" : "")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{th.student}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{clock(th.lastAt)}</span>
                    </div>
                    {th.group ? <div className="truncate text-[11.5px] text-slate-400">{th.group}</div> : null}
                    <div className="mt-0.5 truncate text-[12.5px] text-slate-500">{th.last}</div>
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
      <div className={"flex flex-col rounded-xl border border-slate-200 bg-white " + (active ? "" : "hidden lg:flex")}>
        {!open ? (
          <div className="grid flex-1 place-items-center px-6 py-20 text-center text-sm text-slate-400">
            Suhbatni tanlang
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => router.replace("/chat", { scroll: false })}
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 lg:hidden"
              >
                ← Ro&apos;yxat
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-800">{open.student}</div>
                {open.group ? <div className="truncate text-[11.5px] text-slate-400">{open.group}</div> : null}
              </div>
            </div>

            <div className="max-h-[56vh] flex-1 space-y-2 overflow-y-auto bg-slate-50/60 px-4 py-3">
              {messages.map((m) => (
                <div key={m.id} className={"flex " + (m.fromStudent ? "justify-start" : "justify-end")}>
                  <div
                    className={
                      "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm " +
                      (m.fromStudent ? "rounded-bl-md bg-white text-slate-800" : "rounded-br-md bg-cyan-600 text-white")
                    }
                  >
                    {!m.fromStudent && m.author ? (
                      <div className="mb-0.5 text-[11px] font-semibold text-white/80">{m.author}</div>
                    ) : null}
                    <div className="whitespace-pre-wrap break-words leading-snug">{m.text}</div>
                    <div className={"mt-0.5 text-right text-[10.5px] " + (m.fromStudent ? "text-slate-400" : "text-white/70")}>
                      {clock(m.at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {canWrite ? (
              <div className="border-t border-slate-100 p-3">
                {err ? <div className="mb-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{err}</div> : null}
                <div className="flex items-end gap-2">
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
                    className="max-h-28 min-h-[40px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={pending || text.trim().length === 0}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pending ? "…" : "Yuborish"}
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
