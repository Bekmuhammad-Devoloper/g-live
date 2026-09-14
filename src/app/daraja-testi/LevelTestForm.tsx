"use client";

import { useState, useTransition } from "react";
import { fmtUzPhoneInput } from "@/lib/phone";
import type { PublicQuestion, TestLevel } from "@/lib/levelTest";
import { submitLevelTest, type LevelTestOutcome } from "./actions";

/**
 * Daraja aniqlash testi — 3 bosqich:
 *   1) ism + telefon (+ yosh, ixtiyoriy)
 *   2) savollar bittadan, progress chizig'i bilan
 *   3) natija (daraja, ballar) — CRM'ga serverda yozilgan bo'ladi
 */
export default function LevelTestForm({ questions, perLevel, levels }: {
  questions: PublicQuestion[];
  perLevel: number;
  levels: TestLevel[];
}) {
  const [step, setStep] = useState<"intro" | "quiz" | "done">("intro");
  const [fullName, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LevelTestOutcome | null>(null);
  const [pending, start] = useTransition();

  const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-brand-500";

  const begin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) { setError("Ismingizni kiriting"); return; }
    if (phone.replace(/\D/g, "").length !== 9) { setError("Telefon raqamini to'liq kiriting: +998 XX XXX XX XX"); return; }
    setStep("quiz");
  };

  const finish = (all: Record<string, number>) => {
    setError(null);
    start(async () => {
      const r = await submitLevelTest(fullName, `+998 ${phone}`, all, { age });
      setResult(r);
      if (r.ok) setStep("done");
      else setError(r.error);
    });
  };

  const choose = (qid: number, opt: number) => {
    const next = { ...answers, [String(qid)]: opt };
    setAnswers(next);
    // Kichik pauza — tanlangan variant ko'rinib ulgursin
    setTimeout(() => {
      if (idx + 1 < questions.length) setIdx(idx + 1);
      else finish(next);
    }, 180);
  };

  // ── 1) Kirish ──
  if (step === "intro") {
    return (
      <form onSubmit={begin} className="space-y-3">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">Darajangizni aniqlang</h1>
          <p className="mt-1 text-sm text-slate-500">
            {questions.length} ta savol · A1 dan B2 gacha · taxminan 10 daqiqa. Har savolda bitta to&apos;g&apos;ri variant.
            Bilmasangiz — taxmin qiling, ortga qaytib bo&apos;lmaydi.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Ism va familiya</span>
          <input value={fullName} onChange={(e) => setName(e.target.value)} required placeholder="Ism Familiya" className={inp} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Telefon raqami</span>
          {/* +998 doimiy prefiks, maska 9 xonadan ortiq yozishga yo'l qo'ymaydi */}
          <div className="flex items-center rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
            <span className="select-none font-medium text-slate-500">+998</span>
            <input
              value={phone}
              onChange={(e) => setPhone(fmtUzPhoneInput(e.target.value))}
              required
              placeholder="90 123 45 67"
              inputMode="numeric"
              autoComplete="tel-national"
              className="ml-2 w-full flex-1 bg-transparent outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Yosh <span className="font-normal text-slate-400">(ixtiyoriy)</span></span>
          <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="18" className={inp} />
        </label>
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button type="submit" className="mt-2 h-11 w-full rounded-lg bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700">
          Testni boshlash →
        </button>
      </form>
    );
  }

  // ── 3) Natija ──
  if (step === "done" && result?.ok) {
    const color = result.color ?? "#64748b";
    return (
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sizning darajangiz</div>
        <div className="mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-black text-white shadow-lg" style={{ background: color }}>
          {result.level ?? "A0"}
        </div>
        <div className="mt-3 text-lg font-bold text-slate-900">{result.label}</div>
        <div className="mt-1 text-sm text-slate-500">{result.correct} / {result.total} to&apos;g&apos;ri javob</div>

        {/* Daraja bo'yicha ballar */}
        <div className="mt-5 space-y-2 text-left">
          {levels.map((l) => {
            const p = result.perLevel[l];
            const pct = Math.round((p.correct / p.total) * 100);
            return (
              <div key={l} className="flex items-center gap-3 text-xs">
                <span className="w-7 font-bold text-slate-600">{l}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: l === result.level ? color : "#94a3b8" }} />
                </div>
                <span className="w-8 text-right tabular-nums text-slate-500">{p.correct}/{p.total}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Natijangiz saqlandi — tez orada siz bilan bog&apos;lanib, mos guruhni taklif qilamiz.
        </div>
      </div>
    );
  }

  // ── 2) Savollar ──
  const q = questions[idx];
  const pct = Math.round((idx / questions.length) * 100);
  const chosen = answers[String(q.id)];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>Savol {idx + 1} / {questions.length}</span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500">{q.level}</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <p className="text-lg font-semibold leading-snug text-slate-900">{q.q}</p>

      <div className="mt-4 space-y-2">
        {q.options.map((o, i) => (
          <button
            key={i}
            type="button"
            disabled={pending}
            onClick={() => choose(q.id, i)}
            className={
              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition " +
              (chosen === i ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-slate-50")
            }
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{String.fromCharCode(65 + i)}</span>
            {o}
          </button>
        ))}
      </div>

      {pending && <p className="mt-4 text-center text-sm text-slate-400">Natija hisoblanmoqda...</p>}
      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-rose-500">{error}</p>
          <button type="button" onClick={() => finish(answers)} className="mt-2 text-sm font-semibold text-brand-600 hover:underline">Qayta yuborish</button>
        </div>
      )}
      <p className="mt-4 text-center text-[11px] text-slate-400">Har darajada {perLevel} ta savol</p>
    </div>
  );
}
