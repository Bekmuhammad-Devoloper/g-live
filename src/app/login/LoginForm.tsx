"use client";

import { useActionState, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { login, type LoginState } from "./actions";

// Kirish sahifasida sessiya yo'q — `locale` brauzer tilidan (page.tsx) keladi.
export default function LoginForm({ locale }: { locale: Locale }) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  // Ilova (TWA/PWA) ichida eski deploy'ning sahifasi ochiq qolsa, server action
  // ID'si topilmay "Failed to find Server Action" xatosi chiqadi. `login` odatda
  // hech qachon throw qilmaydi ({error} qaytaradi) — shuning uchun har qanday
  // istisno = eskirgan sahifa: bir marta o'zini yangilaydi (sessionStorage bilan
  // takror aylanishning oldi olinadi).
  const [state, formAction, pending] = useActionState<LoginState, FormData>(async (prev, fd) => {
    try {
      return await login(prev, fd);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      // Next'ning redirect'i ham istisno orqali ishlaydi — unga tegmaymiz
      if (/NEXT_REDIRECT/.test(msg)) throw e;
      const flag = "gl-login-reloaded";
      if (typeof window !== "undefined" && !sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        window.location.reload();
        return prev;
      }
      throw e;
    }
  }, {});
  const [email, setEmail] = useState("");

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
    </div>
  );
}
