"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<{ error?: string }, FormData>(loginAction, {});
  const fld = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-300";
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
        <input name="email" type="email" required autoComplete="username" className={fld} autoFocus />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Parol</label>
        <input name="password" type="password" required autoComplete="current-password" className={fld} />
      </div>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">
        {pending ? "Tekshirilmoqda..." : "Kirish"}
      </button>
    </form>
  );
}
