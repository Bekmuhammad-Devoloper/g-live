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
  const [busy, start] = useTransition();

  const L = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });

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
            <Field label={L("Login", "Логин", "Login", "Anmeldename")} value={acc.login} />
            <Field
              label={L("Parol", "Пароль", "Password", "Passwort")}
              value={acc.password ? (show ? acc.password : "•".repeat(Math.min(acc.password.length, 10))) : "—"}
              onToggle={acc.password ? () => setShow((v) => !v) : undefined}
              toggled={show}
            />
          </div>
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
}: {
  label: string;
  value: string;
  onToggle?: () => void;
  toggled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
        {onToggle ? (
          <button type="button" onClick={onToggle} className="ml-auto shrink-0 text-[11px] font-bold text-brand-600">
            {toggled ? "•••" : "👁"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
