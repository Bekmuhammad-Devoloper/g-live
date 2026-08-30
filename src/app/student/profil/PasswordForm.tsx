"use client";

import { useState, useTransition } from "react";
import { changePassword } from "../../(app)/profile/actions";
import { TEAL, IcoKey } from "../_ui";

// Parolni almashtirish — (app)/profile dagi changePassword action qayta ishlatiladi
// (joriy parolni tasdiqlaydi, faqat o'z hisobini o'zgartiradi).

export default function PasswordForm({ label = "Passwort ändern" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const submit = (fd: FormData) => {
    setMsg(null);
    start(async () => {
      const r = await changePassword(fd);
      if (r.error) setMsg({ ok: false, text: r.error });
      else { setMsg({ ok: true, text: "Passwort geändert ✓" }); setOpen(false); }
    });
  };

  return (
    <div>
      <button onClick={() => { setOpen(!open); setMsg(null); }} className="flex w-full items-center gap-3 py-3.5 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]">
          <IcoKey s={20} />
        </span>
        <span className="flex-1 text-[14px] font-semibold text-slate-800">{label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-90 transition" : "transition"}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {msg && (
        <p className={`pb-2 text-[12.5px] font-semibold ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>
      )}

      {open && (
        <form action={submit} className="space-y-2 pb-3">
          {[
            { name: "current", ph: "Aktuelles Passwort" },
            { name: "next", ph: "Neues Passwort" },
            { name: "confirm", ph: "Neues Passwort (wiederholen)" },
          ].map((f) => (
            <input
              key={f.name}
              name={f.name}
              type="password"
              placeholder={f.ph}
              autoComplete={f.name === "current" ? "current-password" : "new-password"}
              className="w-full rounded-2xl border-0 bg-[#eef6fa] px-3.5 py-3 text-[14px] text-slate-800 outline-none placeholder:text-slate-400 focus:bg-[#e6f1f7]"
            />
          ))}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl py-3 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)] transition active:scale-[.99] disabled:opacity-60"
            style={{ background: TEAL }}
          >
            {busy ? "Wird gespeichert…" : "Speichern"}
          </button>
        </form>
      )}
    </div>
  );
}
