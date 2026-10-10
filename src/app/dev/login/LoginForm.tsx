"use client";

import { useActionState, useState } from "react";
import { loginAction } from "../actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<{ error?: string }, FormData>(loginAction, {});
  const [show, setShow] = useState(false);
  const fld = "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white placeholder:text-slate-500 outline-none transition focus:border-orange-400/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-orange-500/10";
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-white/10 bg-[#0d1424]/80 p-7 shadow-2xl shadow-black/40 backdrop-blur">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
        <input name="email" type="email" required autoComplete="username" placeholder="dev@germaniya.live" className={fld} autoFocus />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Parol</label>
        <div className="relative">
          <input name="password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••" className={`${fld} pr-14`} />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
            title={show ? "Parolni yashirish" : "Parolni ko'rsatish"}
            className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-orange-300"
          >
            {show ? (
              // Ko'z (yopilgan) — parol ko'rinib turibdi, bosilsa yashiriladi
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.2 9.6 6.2a1.6 1.6 0 0 1 0 1.6 15.6 15.6 0 0 1-3 3.6" />
                <path d="M6.6 6.6C4.6 7.9 3.2 9.9 2.4 11.2a1.6 1.6 0 0 0 0 1.6C3.5 14.8 7 19 12 19a9.6 9.6 0 0 0 5.4-1.6" />
              </svg>
            ) : (
              // Ko'z (ochiq) — bosilsa parol ko'rsatiladi
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.4 12.8a1.6 1.6 0 0 1 0-1.6C3.5 9.2 7 5 12 5s8.5 4.2 9.6 6.2a1.6 1.6 0 0 1 0 1.6C20.5 14.8 17 19 12 19S3.5 14.8 2.4 12.8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {state.error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] text-[15px] font-bold text-white shadow-lg shadow-orange-600/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Tekshirilmoqda..." : "Kirish"}
      </button>
    </form>
  );
}
