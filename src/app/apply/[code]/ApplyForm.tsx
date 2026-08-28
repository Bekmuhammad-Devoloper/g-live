"use client";

import { useState, useTransition } from "react";
import { submitApplication } from "./actions";
import type { ApplyQuestion } from "../../(app)/links/questions";
import { fmtUzPhoneInput } from "@/lib/phone";

// Ariza formasida taklif etiladigan darajalar
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function ApplyForm({ code, preview, questions = [] }: {
  code: string;
  preview: boolean;
  /** Havola yaratishda belgilangan qo'shimcha savollar (bo'lmasa — faqat ism/telefon) */
  questions?: ApplyQuestion[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fullName, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [level, setLevel] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));

  const setAnswer = (i: number, v: string) => setAnswers((a) => a.map((x, k) => (k === i ? v : x)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setError(null);

    // Telefon — aynan 9 xona bo'lishi shart (serverda ham qayta tekshiriladi)
    if (phone.replace(/\D/g, "").length !== 9) {
      setError("Telefon raqamini to'liq kiriting: +998 XX XXX XX XX");
      return;
    }

    // Majburiy savollar tekshiruvi (serverda ham qayta tekshiriladi)
    const missing = questions.findIndex((q, i) => q.required && !answers[i]?.trim());
    if (missing >= 0) {
      setError(`"${questions[missing].q}" — javob berilishi shart`);
      return;
    }

    start(async () => {
      const r = await submitApplication(code, fullName, `+998 ${phone}`, answers, { age, level });
      if (r.ok) setDone(true);
      else setError(r.error ?? "Xatolik");
    });
  };

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mb-1 text-4xl">✅</div>
        <div className="text-lg font-bold text-emerald-700">Arizangiz qabul qilindi!</div>
        <p className="mt-1 text-sm text-emerald-600">Tez orada siz bilan bog&apos;lanamiz.</p>
      </div>
    );
  }

  const inp = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-brand-500";

  return (
    <form onSubmit={submit} className="space-y-3">
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

      {/* Yosh va daraja — ixtiyoriy, lekin operatorga juda foydali */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Yosh</span>
          <input
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="18"
            className={inp}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Daraja</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={inp}>
            <option value="">Bilmayman</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>

      {/* Qo'shimcha savollar — yoziladigan yoki variantli */}
      {questions.map((q, i) => (
        <div key={i} className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            {q.q}
            {q.required && <span className="text-rose-500"> *</span>}
          </span>

          {q.type === "choice" ? (
            <div className="space-y-1.5">
              {(q.options ?? []).map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${
                    answers[i] === opt
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q${i}`}
                    checked={answers[i] === opt}
                    onChange={() => setAnswer(i, opt)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            <input
              value={answers[i] ?? ""}
              onChange={(e) => setAnswer(i, e.target.value)}
              required={q.required}
              placeholder="Javobingiz"
              className={inp}
            />
          )}
        </div>
      ))}

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
      <button type="submit" disabled={pending || preview} className="h-11 w-full rounded-lg bg-brand-600 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60">
        {preview ? "Ko'rib chiqish rejimi" : pending ? "Yuborilmoqda..." : "Ariza yuborish"}
      </button>
    </form>
  );
}
