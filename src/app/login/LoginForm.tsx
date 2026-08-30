"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

const demoAccounts: [string, string][] = [
  ["director@gl.uz", "Direktor"],
  ["deputy@gl.uz", "Dir. o'rinbosari"],
  ["manager@gl.uz", "Menejer"],
  ["teacher@gl.uz", "O'qituvchi"],
  ["student@gl.uz", "O'quvchi"],
  ["parent@gl.uz", "Ota-ona"],
  ["admin@gl.uz", "Administrator"],
];

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("director@gl.uz");
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">E-mail yoki login</label>
          <input
            name="email"
            type="text"
            inputMode="email"
            spellCheck={false}
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Parol</label>
          <input
            name="password"
            type="password"
            required
            defaultValue="12345678"
            autoComplete="current-password"
            className="input"
          />
        </div>

        {state.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Login yoki parol noto&apos;g&apos;ri
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
          {pending ? "Kirilmoqda..." : "Kirish"}
        </button>
      </form>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setShowDemo((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <span>
            Demo hisoblar <span className="font-normal text-slate-400">(parol: 12345678)</span>
          </span>
          <span className="text-slate-400">{showDemo ? "▲" : "▼"}</span>
        </button>

        {showDemo && (
          <div className="mt-3 grid gap-1">
            {demoAccounts.map(([mail, role]) => (
              <button
                key={mail}
                type="button"
                onClick={() => setEmail(mail)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                  email === mail
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="font-mono">{mail}</span>
                <span className="text-slate-400">{role}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
