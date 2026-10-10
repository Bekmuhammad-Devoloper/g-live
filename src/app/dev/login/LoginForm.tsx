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
          <input name="password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••" className={`${fld} pr-20`} />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-400 hover:text-white">
            {show ? "Yashirish" : "Ko'rsatish"}
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
