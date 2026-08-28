"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAssignment } from "../../(app)/homework/actions";
import { CARD, TEAL, Pill, IcoDoc } from "../_ui";

// Üben ro'yxati — har topshiriq karta bo'lib ochiladi, matn yozib topshiriladi.
// Server tomonda submitAssignment o'z-o'zini himoya qiladi (Student.userId orqali).

export interface VAssignment {
  id: string;
  title: string;
  type: string;
  skill: string | null;
  maxScore: number;
  dueAt: string | null; // ISO
  note: string | null;
  groupName: string;
  createdAt: string; // ISO
  // O'quvchining oxirgi urinishi (attempt bo'yicha eng kattasi)
  last: {
    attempt: number;
    score: number | null;
    status: string; // SUBMITTED | GRADED | RETURNED
    teacherNote: string | null;
    content: string | null;
    createdAt: string;
  } | null;
}

const SKILL_LABEL: Record<string, string> = {
  SPEAKING: "Sprechen", WRITING: "Schreiben", READING: "Lesen", LISTENING: "Hören", GRAMMAR: "Grammatik",
};

function fmt(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function StatusPill({ a }: { a: VAssignment }) {
  if (!a.last) {
    const overdue = a.dueAt && new Date(a.dueAt).getTime() < Date.now();
    return overdue ? <Pill tone="bad">Frist abgelaufen</Pill> : <Pill tone="warn">Neu</Pill>;
  }
  if (a.last.status === "GRADED") return <Pill tone="ok">{a.last.score ?? 0}/{a.maxScore}</Pill>;
  if (a.last.status === "RETURNED") return <Pill tone="warn">Zurückgegeben</Pill>;
  return <Pill tone="muted">Abgegeben</Pill>;
}

function SubmitBox({ assignmentId, again, onDone }: { assignmentId: string; again: boolean; onDone: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const submit = () => {
    if (text.trim().length < 1) { setErr("Bitte zuerst eine Antwort schreiben"); return; }
    setErr(null);
    start(async () => {
      try {
        const r = await submitAssignment(assignmentId, text.trim());
        if (r?.error) { setErr("Fehler — bitte erneut versuchen"); return; }
      } catch {
        // server action kutilmagan xato bilan yiqilsa foydalanuvchi xabarsiz qolmasin
        setErr("Fehler — bitte erneut versuchen");
        return;
      }
      setText("");
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={again ? "Neue Antwort schreiben…" : "Deine Antwort…"}
        className="w-full resize-y rounded-2xl border-0 bg-[#eef6fa] px-3.5 py-3 text-[14px] text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:bg-[#e6f1f7]"
      />
      {err && <p className="text-[12px] font-semibold text-rose-600">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-2xl py-3 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)] transition active:scale-[.99] disabled:opacity-60"
        style={{ background: TEAL }}
      >
        {busy ? "Wird gesendet…" : "Abgeben"}
      </button>
    </div>
  );
}

export default function UebenList({ items }: { items: VAssignment[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className={`${CARD} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
        <span className="text-4xl">🎉</span>
        <div className="text-[17px] font-extrabold text-slate-900">Keine Aufgaben</div>
        <p className="text-[13px] text-slate-500">Hozircha uy vazifasi yo&apos;q. Dam oling!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((a) => {
        const isOpen = open === a.id;
        // Qayta topshirish: baholangan/qaytarilgan bo'lsa ham yangi urinishga ruxsat
        const canSubmit = !a.last || a.last.status !== "SUBMITTED";
        return (
          <div key={a.id} className={`${CARD} p-4`}>
            <button onClick={() => setOpen(isOpen ? null : a.id)} className="flex w-full items-center gap-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef6fa]">
                <IcoDoc s={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-slate-800">{a.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-slate-400">
                  {a.skill && <span className="font-semibold" style={{ color: TEAL }}>{SKILL_LABEL[a.skill] ?? a.skill}</span>}
                  <span>{a.groupName}</span>
                  {a.dueAt && <span>Frist: {fmt(a.dueAt)}</span>}
                </div>
              </div>
              <StatusPill a={a} />
            </button>

            {isOpen && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                {a.note && <p className="whitespace-pre-wrap rounded-2xl bg-[#eef6fa] px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700">{a.note}</p>}

                {/* Oxirgi urinish */}
                {a.last && (
                  <div className="mt-3 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                    <div className="flex items-center justify-between text-[11.5px] font-semibold text-slate-400">
                      <span>Versuch {a.last.attempt} · {fmt(a.last.createdAt)}</span>
                      {a.last.status === "GRADED" && <span className="font-extrabold" style={{ color: TEAL }}>{a.last.score ?? 0}/{a.maxScore}</span>}
                    </div>
                    {a.last.content && <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">{a.last.content}</p>}
                    {a.last.teacherNote && (
                      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-800">
                        <span className="font-bold">Lehrer: </span>{a.last.teacherNote}
                      </p>
                    )}
                  </div>
                )}

                {a.last?.status === "SUBMITTED" && (
                  <p className="mt-3 text-center text-[12.5px] font-semibold text-slate-400">Deine Antwort wird geprüft…</p>
                )}

                {canSubmit && <SubmitBox assignmentId={a.id} again={!!a.last} onDone={() => setOpen(null)} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
