"use client";

import { useActionState, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale, LocaleText } from "@/lib/constants";
import { login, type LoginState } from "./actions";

const demoAccounts: [string, LocaleText][] = [
  ["director@gl.uz", { uz: "Direktor", ru: "Директор", en: "Director", de: "Direktor" }],
  ["deputy@gl.uz", { uz: "Dir. o'rinbosari", ru: "Зам. директора", en: "Deputy director", de: "Stellv. Direktor" }],
  ["manager@gl.uz", { uz: "Menejer", ru: "Менеджер", en: "Manager", de: "Manager" }],
  ["teacher@gl.uz", { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher", de: "Lehrer" }],
  ["student@gl.uz", { uz: "O'quvchi", ru: "Ученик", en: "Student", de: "Schüler" }],
  ["parent@gl.uz", { uz: "Ota-ona", ru: "Родитель", en: "Parent", de: "Eltern" }],
  ["admin@gl.uz", { uz: "Administrator", ru: "Администратор", en: "Administrator", de: "Administrator" }],
];

// Kirish sahifasida sessiya yo'q — `locale` brauzer tilidan (page.tsx) keladi.
export default function LoginForm({ locale }: { locale: Locale }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("director@gl.uz");
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div>
      <form action={formAction} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">{T("E-mail yoki login", "E-mail или логин", "E-mail or login", "E-Mail oder Login")}</label>
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
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">{T("Parol", "Пароль", "Password", "Passwort")}</label>
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
            {T("Login yoki parol noto'g'ri", "Неверный логин или пароль", "Invalid login or password", "Login oder Passwort falsch")}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
          {pending ? T("Kirilmoqda...", "Вход...", "Signing in...", "Anmeldung...") : T("Kirish", "Войти", "Sign in", "Anmelden")}
        </button>
      </form>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setShowDemo((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <span>
            {T("Demo hisoblar", "Демо-аккаунты", "Demo accounts", "Demo-Konten")}{" "}
            <span className="font-normal text-slate-400">{T("(parol: 12345678)", "(пароль: 12345678)", "(password: 12345678)", "(Passwort: 12345678)")}</span>
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
                <span className="text-slate-400">{tr(locale, role)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
