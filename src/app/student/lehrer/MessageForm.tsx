"use client";

import { useState, useTransition } from "react";
import type { StudentStrings } from "../_i18n";
import { CARD, ICON_GRADIENT } from "../_ui";
import { sendToTeacher } from "./actions";

const MAX = 1000;

export default function MessageForm({ disabled, t }: { disabled?: boolean; t: StudentStrings }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setMsg(null);
    start(async () => {
      const r = await sendToTeacher(text);
      setMsg(r);
      if (r.ok) setText("");
    });
  };

  return (
    <div className={`${CARD} space-y-3 p-4`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={4}
        disabled={disabled || pending}
        placeholder={t.writeQuestion}
        className="w-full resize-none rounded-2xl bg-slate-50 p-3.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60"
      />
      <div className="flex items-center gap-3">
        <span className="text-[11.5px] text-slate-400">{text.length}/{MAX}</span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || pending || text.trim().length < 2}
          className="ml-auto flex h-11 items-center gap-2 rounded-2xl px-5 text-[15px] font-extrabold text-white shadow-[0_8px_18px_rgba(14,116,144,0.28)] transition active:translate-y-[1px] disabled:opacity-45 disabled:shadow-none"
          style={{ background: ICON_GRADIENT }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" />
          </svg>
          {pending ? t.sending : t.send}
        </button>
      </div>
      {msg?.error && <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700">{msg.error}</div>}
      {msg?.ok && <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-700">{t.sentToTeacher}</div>}
    </div>
  );
}
