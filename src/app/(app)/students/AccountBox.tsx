"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "../_components/Icon";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { getStudentAccount, resetStudentAccount, saveStudentAccount, toggleStudentAccount, type Account } from "./accountActions";

// O'quvchining ilova hisobi. Sukut bo'yicha login — ismi kichik harflarda,
// parol — telefon raqami; ma'muriyat ikkalasini ham o'zgartira oladi.

export default function AccountBox({
  studentId,
  locale,
  canManage,
}: {
  studentId: string;
  locale: Locale;
  canManage: boolean;
}) {
  const [acc, setAcc] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

  // Nusxalash — HTTPS da Clipboard API, aks holda eski usul
  const copy = async (text: string, tag: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(tag);
      setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1600);
    } catch {
      setMsg({ ok: false, text: L("Nusxalanmadi", "Не скопировано", "Copy failed", "Nicht kopiert") });
    }
  };

  useEffect(() => {
    let alive = true;
    void getStudentAccount(studentId).then((r) => {
      if (!alive) return;
      setAcc(r.account ?? null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [studentId]);

  const apply = (fn: () => Promise<{ ok?: boolean; error?: string; account?: Account }>) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setAcc(r.account ?? null);
        setEdit(false);
        setMsg({ ok: true, text: L("Saqlandi", "Сохранено", "Saved", "Gespeichert") });
      }
    });
  };

  if (!loaded) {
    return <p className="text-sm text-slate-400">{L("Yuklanmoqda…", "Загрузка…", "Loading…", "Wird geladen…")}</p>;
  }

  return (
    <div className="space-y-2">
      {acc ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={L("Login", "Логин", "Login", "Anmeldename")}
              value={acc.login}
              onCopy={() => copy(acc.login, "login")}
              copied={copied === "login"}
            />
            <Field
              label={L("Parol", "Пароль", "Password", "Passwort")}
              value={acc.password ? (show ? acc.password : "•".repeat(Math.min(acc.password.length, 10))) : "—"}
              onToggle={acc.password ? () => setShow((v) => !v) : undefined}
              toggled={show}
              onCopy={acc.password ? () => copy(acc.password!, "pass") : undefined}
              copied={copied === "pass"}
            />
          </div>

          {acc.password ? (
            <button
              type="button"
              onClick={() =>
                copy(
                  `${L("Login", "Логин", "Login", "Anmeldename")}: ${acc.login}
${L("Parol", "Пароль", "Password", "Passwort")}: ${acc.password}
https://germaniya.live`,
                  "both",
                )
              }
              className="w-full rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
            >
              {copied === "both"
                ? L("Nusxalandi ✓", "Скопировано ✓", "Copied ✓", "Kopiert ✓")
                : L("Login va parolni nusxalash", "Скопировать логин и пароль", "Copy login and password", "Login und Passwort kopieren")}
            </button>
          ) : null}
          {!acc.active ? (
            <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              {L("Hisob yopilgan — o'quvchi kira olmaydi", "Аккаунт закрыт — вход невозможен", "Account disabled", "Konto deaktiviert")}
            </p>
          ) : null}
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:bg-white/[0.03]">
          {L("Ilova hisobi yo'q", "Аккаунта нет", "No app account", "Kein Konto")}
        </p>
      )}

      {msg ? (
        <p className={"text-xs font-semibold " + (msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.text}</p>
      ) : null}

      {canManage ? (
        edit ? (
          <div className="space-y-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder={L("Login", "Логин", "Login", "Anmeldename")}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={L("Yangi parol (bo'sh — o'zgarmaydi)", "Новый пароль (пусто — без изменений)", "New password (blank — unchanged)", "Neues Passwort (leer — unverändert)")}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => apply(() => saveStudentAccount(studentId, login, password))}
                className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : L("Saqlash", "Сохранить", "Save", "Speichern")}
              </button>
              <button
                type="button"
                onClick={() => setEdit(false)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {L("Bekor", "Отмена", "Cancel", "Abbrechen")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setLogin(acc?.login ?? "");
                setPassword("");
                setMsg(null);
                setEdit(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
            >
              <Icon name="pencil" className="h-3.5 w-3.5" />
              {acc ? L("O'zgartirish", "Изменить", "Change", "Ändern") : L("Login berish", "Выдать логин", "Create login", "Login vergeben")}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => apply(() => resetStudentAccount(studentId))}
              title={L("Login — ismi, parol — telefon raqami", "Логин — имя, пароль — номер телефона", "Login — name, password — phone", "Login — Name, Passwort — Telefon")}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
            >
              {acc
                ? L("Standartga qaytarish", "Сбросить к стандарту", "Reset to default", "Auf Standard")
                : L("Standart bilan yaratish", "Создать по умолчанию", "Create default", "Standard anlegen")}
            </button>

            {acc ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => apply(() => toggleStudentAccount(studentId, !acc.active))}
                className={
                  "rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 " +
                  (acc.active ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")
                }
              >
                {acc.active ? L("Yopish", "Закрыть", "Disable", "Sperren") : L("Ochish", "Открыть", "Enable", "Entsperren")}
              </button>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onToggle,
  toggled,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onToggle?: () => void;
  toggled?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
        {onToggle ? (
          <button type="button" onClick={onToggle} title="ko'rsatish" className="shrink-0 text-[13px] leading-none text-slate-400">
            {toggled ? "•••" : "👁"}
          </button>
        ) : null}
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            title="nusxalash"
            className={"shrink-0 transition " + (copied ? "text-emerald-600" : "text-slate-400 hover:text-brand-600")}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 13 4.5 4.5L19 7" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
