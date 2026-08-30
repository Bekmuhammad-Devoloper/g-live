"use client";

import { useState, useTransition } from "react";
import { ICON_GRADIENT } from "../_ui";
import { setLocale } from "./actions";

// Ilova tili — tanlangani darhol saqlanadi (User.locale).

const OPTIONS = [
  { code: "uz", label: "O'zbekcha", native: "Uzbek" },
  { code: "ru", label: "Ruscha", native: "Русский" },
  { code: "en", label: "Inglizcha", native: "English" },
  { code: "de", label: "Nemischa", native: "Deutsch" },
];

export default function LocalePicker({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const choose = (code: string) => {
    if (code === value || pending) return;
    const prev = value;
    setValue(code);
    setErr(null);
    start(async () => {
      const r = await setLocale(code);
      if (r.error) {
        setValue(prev);
        setErr(r.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const on = value === o.code;
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => choose(o.code)}
              className={
                "flex items-center justify-between rounded-2xl px-3.5 py-3 text-left transition " +
                (on ? "text-white shadow-[0_8px_18px_rgba(14,116,144,0.25)]" : "bg-slate-50 text-slate-700")
              }
              style={on ? { background: ICON_GRADIENT } : undefined}
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold">{o.native}</span>
                <span className={"block truncate text-[11.5px] " + (on ? "text-white/75" : "text-slate-400")}>{o.label}</span>
              </span>
              {on ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 13 4.5 4.5L19 7" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>
      {err ? <div className="rounded-xl bg-rose-50 px-3.5 py-2 text-[12.5px] font-semibold text-rose-700">{err}</div> : null}
    </div>
  );
}
