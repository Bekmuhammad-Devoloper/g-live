"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { fmtUzPhoneInput } from "@/lib/phone";
import type { PublicQuestion, PublicSet, TestLevel, TestSetId } from "@/lib/levelTest";
import { submitLevelTest, type LevelTestOutcome } from "./actions";

/**
 * Daraja aniqlash testi — telefon uchun. 3 bosqich:
 *   1) ism + telefon (+ yosh) va DARAJA / TEST tanlovi (A1 → A1.1 yoki A1.2)
 *   2) tanlangan to'plam savollari asl tartibda, bittadan; variant bosilishi
 *      bilan keyingisiga o'tadi (ortga yo'q)
 *   3) natija: ball, foiz, o'tdi/o'tmadi, natijaviy daraja — CRM'ga
 *      serverda yozilgan bo'ladi
 */
export default function LevelTestForm({ sets, levels, colors, names }: {
  sets: PublicSet[];
  levels: TestLevel[];
  colors: Record<TestLevel, string>;
  names: Record<TestLevel, string>;
}) {
  const [step, setStep] = useState<"intro" | "quiz" | "done">("intro");
  const [fullName, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [level, setLevel] = useState<TestLevel | null>(null);
  const [setId, setSetId] = useState<TestSetId | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LevelTestOutcome | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const setsOfLevel = useMemo(() => (level ? sets.filter((s) => s.level === level) : []), [sets, level]);
  const active = useMemo(() => sets.find((s) => s.id === setId) ?? null, [sets, setId]);
  const questions: PublicQuestion[] = active?.questions ?? [];

  const pickLevel = (l: TestLevel) => {
    setLevel(l);
    // Darajada bitta test bo'lsa o'zi tanlanadi; ikkita bo'lsa — mijoz tanlaydi
    const list = sets.filter((s) => s.level === l);
    setSetId(list.length === 1 ? list[0].id : null);
    setError(null);
  };

  const begin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) { setError("Ismingizni kiriting"); return; }
    if (phone.replace(/\D/g, "").length !== 9) { setError("Telefon raqamini to'liq kiriting: +998 XX XXX XX XX"); return; }
    if (!level) { setError("Darajangizni tanlang"); return; }
    if (!setId) { setError("Testni tanlang"); return; }
    setStep("quiz");
    window.scrollTo({ top: 0 });
  };

  const finish = (all: Record<string, number>) => {
    if (!setId) return;
    setError(null);
    start(async () => {
      const r = await submitLevelTest(fullName, `+998 ${phone}`, setId, all, { age });
      setResult(r);
      if (r.ok) { setStep("done"); window.scrollTo({ top: 0 }); }
      else setError(r.error);
    });
  };

  const choose = (q: PublicQuestion, j: number) => {
    if (pending || answers[String(q.id)] !== undefined) return; // ikki marta bosilmasin
    const next = { ...answers, [String(q.id)]: j };
    setAnswers(next);
    // Tanlangan variant ko'rinib ulgursin, keyin keyingi savol
    timer.current = setTimeout(() => {
      if (idx + 1 < questions.length) { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else finish(next);
    }, 260);
  };

  const restart = () => {
    setStep("intro");
    setIdx(0);
    setAnswers({});
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  // ── 1) Kirish ──
  if (step === "intro") {
    return (
      <div className="animate-pop-in">
        <Header />

        <div className="mt-6">
          <h1 className="text-[28px] font-black leading-[1.15] tracking-tight text-slate-900 dark:text-white">
            Nemis tili darajangizni <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-transparent">tekshiring</span>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
            Darajangizni tanlang — 25 ta savol, ~10 daqiqa. Natija darhol chiqadi, mos guruhni biz taklif qilamiz.
          </p>
        </div>

        <form onSubmit={begin} className="mt-5 rounded-3xl border border-white/60 bg-white/85 p-4 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
          <Field label="Ism va familiya">
            <input value={fullName} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Ism Familiya" className={INPUT} />
          </Field>
          <Field label="Telefon raqami">
            <div className={cn(INPUT, "flex items-center gap-2 px-3.5 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15")}>
              <span className="select-none font-semibold text-slate-500 dark:text-slate-400">+998</span>
              <input
                value={phone}
                onChange={(e) => setPhone(fmtUzPhoneInput(e.target.value))}
                required
                placeholder="90 123 45 67"
                inputMode="numeric"
                autoComplete="tel-national"
                className="w-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
          </Field>
          <Field label="Yosh" hint="ixtiyoriy">
            <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="18" className={cn(INPUT, "w-28")} />
          </Field>

          {/* Daraja tanlovi */}
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] font-bold text-slate-600 dark:text-slate-300">Qaysi darajadasiz?</div>
            <div className="grid grid-cols-4 gap-2">
              {levels.map((l) => {
                const on = level === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => pickLevel(l)}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center rounded-2xl border-2 py-2 transition active:scale-[0.97]",
                      on ? "text-white shadow-md" : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200",
                    )}
                    style={on ? { background: colors[l], borderColor: colors[l] } : undefined}
                  >
                    <span className="text-[17px] font-black leading-none">{l}</span>
                    <span className={cn("mt-1 text-[10px] font-medium leading-none", on ? "text-white/85" : "text-slate-400")}>{names[l]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test tanlovi — daraja ichida ikkita */}
          {level && setsOfLevel.length > 1 && (
            <div className="mt-3 animate-pop-in">
              <div className="mb-1.5 text-[12px] font-bold text-slate-600 dark:text-slate-300">Qaysi testni topshirasiz?</div>
              <div className="grid grid-cols-2 gap-2">
                {setsOfLevel.map((s) => {
                  const on = setId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSetId(s.id); setError(null); }}
                      className={cn(
                        "flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition active:scale-[0.98]",
                        on ? "bg-white dark:bg-white/[0.08]" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]",
                      )}
                      style={on ? { borderColor: colors[level] } : undefined}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-white" style={{ background: colors[level], opacity: on ? 1 : 0.55 }}>
                        {s.id.slice(-1)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold text-slate-800 dark:text-slate-100">{s.id}</span>
                        <span className="block text-[11px] text-slate-400">{s.hint} · {s.questions.length} savol</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

          <button
            type="submit"
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(65,72,239,0.7)] transition active:scale-[0.98] disabled:opacity-60"
            style={{ background: level ? `linear-gradient(90deg, ${colors[level]}, ${colors[level]}cc)` : "linear-gradient(90deg, #4148ef, #5b6ffb)" }}
          >
            {active ? `${active.id} testini boshlash` : "Testni boshlash"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
        </form>

        <p className="mt-4 flex items-start gap-2 px-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9.3" /><path d="M12 11v5" /><path d="M12 7.8h.01" /></svg>
          Har savolda bitta to&apos;g&apos;ri variant. Bilmasangiz — taxmin qiling, ortga qaytib bo&apos;lmaydi. Darajani o&apos;tish uchun kamida 70% to&apos;g&apos;ri javob kerak.
        </p>

        <Footer />
      </div>
    );
  }

  // ── 3) Natija ──
  if (step === "done" && result?.ok) {
    const lvlColor = colors[result.level];
    const color = result.passed ? lvlColor : "#64748b";
    const shownLevel = result.resultLevel ?? "A0";
    return (
      <div className="animate-pop-in">
        <Header />

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
          {/* Natija — katta rangli blok */}
          <div className="relative px-5 pb-6 pt-7 text-center text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
            <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">{result.set} testi</div>
            <div className="relative mx-auto mt-3 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-lg" style={{ color }}>
              <span className="text-[30px] font-black leading-none">{result.pct}%</span>
              <span className="mt-1 text-[11px] font-semibold text-slate-500">{result.correct} / {result.total}</span>
            </div>
            <div className="relative mt-3 text-lg font-bold">
              {result.passed ? `${result.level} darajasi — o'tdingiz! 🎉` : `${result.level} hali o'tilmadi`}
            </div>
            <div className="relative mt-1 text-sm text-white/85">
              {result.passed
                ? (result.nextLevel ? `Keyingi bosqich: ${result.nextLevel} — ${names[result.nextLevel]}` : "Bu eng yuqori daraja — ajoyib natija!")
                : `Kamida 70% kerak edi · sizga mos daraja: ${shownLevel}`}
            </div>
          </div>

          <div className="px-5 py-5">
            {/* Natijaviy daraja */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[17px] font-black text-white" style={{ background: result.resultLevel ? colors[result.resultLevel] : "#94a3b8" }}>
                {shownLevel}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sizning darajangiz</div>
                <div className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{result.label}</div>
              </div>
            </div>

            {/* Ball chizig'i */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>To&apos;g&apos;ri javoblar</span>
                <span className="tabular-nums">{result.correct} / {result.total}</span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.pct}%`, background: color }} />
                {/* 70% chegara belgisi */}
                <span className="absolute top-0 h-full w-0.5 bg-slate-400/70" style={{ left: "70%" }} title="O'tish chegarasi 70%" />
              </div>
              <div className="mt-1 text-right text-[10.5px] text-slate-400">o&apos;tish chegarasi — 70%</div>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Natijangiz saqlandi — tez orada siz bilan bog&apos;lanib, mos guruhni taklif qilamiz.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={restart}
          className="mt-4 h-12 w-full rounded-2xl border border-slate-200 bg-white/70 text-sm font-semibold text-slate-600 transition active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
        >
          Boshqa test topshirish
        </button>

        <Footer />
      </div>
    );
  }

  // ── 2) Savollar ──
  const q = questions[idx];
  if (!q || !active) return null;
  const color = colors[active.level];
  const picked = answers[String(q.id)];
  const pct = Math.round((idx / questions.length) * 100);

  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col sm:min-h-0">
      {/* Yuqori qism: test nomi + hisob */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: color }}>{active.id}</span>
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{names[active.level]}</span>
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          Savol {idx + 1} <span className="text-slate-300 dark:text-slate-600">/ {questions.length}</span>
        </span>
      </div>

      {/* Progress */}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>

      {/* Savol kartasi */}
      <div key={q.id} className="animate-pop-in mt-4 flex-1">
        <div className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
          {q.topic && (
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>{q.topic}</div>
          )}
          <p className="text-[21px] font-bold leading-snug text-slate-900 dark:text-white">
            <Blanks text={q.q} color={color} />
          </p>
        </div>

        <div className="mt-3 space-y-2.5">
          {q.options.map((o, j) => {
            const on = picked === j;
            return (
              <button
                key={j}
                type="button"
                disabled={pending || picked !== undefined}
                onClick={() => choose(q, j)}
                className={cn(
                  "flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left text-[15px] font-medium transition active:scale-[0.985]",
                  on
                    ? "text-slate-900 dark:text-white"
                    : "border-transparent bg-white/85 text-slate-700 shadow-sm dark:bg-white/[0.06] dark:text-slate-200",
                )}
                style={on ? { borderColor: color, background: `${color}1a` } : undefined}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[12px] font-black transition",
                    on ? "text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
                  )}
                  style={on ? { background: color } : undefined}
                >
                  {on ? "✓" : String.fromCharCode(97 + j)}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{o}</span>
              </button>
            );
          })}
        </div>

        {pending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            Natija hisoblanmoqda…
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-center dark:bg-rose-500/10">
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
            <button type="button" onClick={() => finish(answers)} className="mt-1.5 text-sm font-bold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300">
              Qayta yuborish
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11.5px] text-slate-400 dark:text-slate-500">{active.id} · {questions.length} ta savol · ortga qaytib bo&apos;lmaydi</p>
    </div>
  );
}

// ───────────── Yordamchi qismlar ─────────────

const INPUT =
  "min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-600";

function Header() {
  return (
    <div className="flex items-center justify-between">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Germaniya Live" className="h-9 w-auto object-contain dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-dark.png" alt="Germaniya Live" className="hidden h-9 w-auto object-contain dark:block" />
      <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
        Daraja testi
      </span>
    </div>
  );
}

function Footer() {
  return <div className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">© 2026 Germaniya Live</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[12px] font-bold text-slate-600 dark:text-slate-300">
        {label} {hint && <span className="font-medium text-slate-400">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

/** "___" bo'sh joyini ko'zga tashlanadigan katak qilib chizadi */
function Blanks({ text, color }: { text: string; color: string }) {
  const parts = text.split("___");
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <span
              className="mx-1 inline-block h-[1.15em] w-14 translate-y-[0.2em] rounded-md border-b-[3px] align-baseline"
              style={{ borderColor: color, background: `${color}14` }}
            />
          )}
        </Fragment>
      ))}
    </>
  );
}
