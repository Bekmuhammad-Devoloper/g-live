"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { fmtUzPhoneInput } from "@/lib/phone";
import type { PublicQuestion, TestLevel } from "@/lib/levelTest";
import { submitLevelTest, type LevelTestOutcome } from "./actions";

/**
 * Daraja aniqlash testi — telefon uchun. 3 bosqich:
 *   1) ism + telefon (+ yosh, ixtiyoriy)
 *   2) savollar bittadan: daraja rangli progress, variant bosilishi bilan
 *      keyingisiga o'tadi (ortga yo'q)
 *   3) natija: daraja, ballar — CRM'ga serverda yozilgan bo'ladi
 *
 * Variantlar aralashtirilgan holda keladi; javob `perm[j]` (asl indeks)
 * bilan yuboriladi — baholash serverda bank bo'yicha.
 */
export default function LevelTestForm({ questions, perLevel, levels, colors }: {
  questions: PublicQuestion[];
  perLevel: number;
  levels: TestLevel[];
  colors: Record<TestLevel, string>;
}) {
  const [step, setStep] = useState<"intro" | "quiz" | "done">("intro");
  const [fullName, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [idx, setIdx] = useState(0);
  /** savol id → ASL variant indeksi (serverga boradi) */
  const [answers, setAnswers] = useState<Record<string, number>>({});
  /** savol id → ko'rsatilgan indeks (faqat belgilash uchun) */
  const [shown, setShown] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LevelTestOutcome | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const begin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) { setError("Ismingizni kiriting"); return; }
    if (phone.replace(/\D/g, "").length !== 9) { setError("Telefon raqamini to'liq kiriting: +998 XX XXX XX XX"); return; }
    setStep("quiz");
    window.scrollTo({ top: 0 });
  };

  const finish = (all: Record<string, number>) => {
    setError(null);
    start(async () => {
      const r = await submitLevelTest(fullName, `+998 ${phone}`, all, { age });
      setResult(r);
      if (r.ok) { setStep("done"); window.scrollTo({ top: 0 }); }
      else setError(r.error);
    });
  };

  const choose = (q: PublicQuestion, j: number) => {
    if (pending || shown[String(q.id)] !== undefined) return; // ikki marta bosilmasin
    const next = { ...answers, [String(q.id)]: q.perm[j] };
    setAnswers(next);
    setShown((s) => ({ ...s, [String(q.id)]: j }));
    // Tanlangan variant ko'rinib ulgursin, keyin keyingi savol
    timer.current = setTimeout(() => {
      if (idx + 1 < questions.length) { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else finish(next);
    }, 260);
  };

  // ── 1) Kirish ──
  if (step === "intro") {
    return (
      <div className="animate-pop-in">
        <Header />

        <div className="mt-6">
          <h1 className="text-[28px] font-black leading-[1.15] tracking-tight text-slate-900 dark:text-white">
            Nemis tili darajangizni <span className="bg-gradient-to-r from-brand-600 to-cyan-500 bg-clip-text text-transparent">aniqlang</span>
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
            Qisqa test — natija darhol chiqadi, mos guruhni biz taklif qilamiz.
          </p>
        </div>

        {/* Qisqa ma'lumot plitkalari */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Fact big={String(questions.length)} small="savol" />
          <Fact big="~10" small="daqiqa" />
          <Fact big="A1–B2" small="daraja" />
        </div>

        {/* Daraja yo'li */}
        <div className="mt-3 flex items-center gap-1.5">
          {levels.map((l, i) => (
            <Fragment key={l}>
              <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: colors[l] }}>{l}</span>
              {i < levels.length - 1 && <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />}
            </Fragment>
          ))}
        </div>

        <form onSubmit={begin} className="mt-5 rounded-3xl border border-white/60 bg-white/85 p-4 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
          <Field label="Ism va familiya">
            <input
              value={fullName}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Ism Familiya"
              className={INPUT}
            />
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
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="18"
              className={cn(INPUT, "w-28")}
            />
          </Field>

          {error && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

          <button
            type="submit"
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-[16px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(65,72,239,0.7)] transition active:scale-[0.98]"
          >
            Testni boshlash
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
        </form>

        <p className="mt-4 flex items-start gap-2 px-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9.3" /><path d="M12 11v5" /><path d="M12 7.8h.01" /></svg>
          Har savolda bitta to&apos;g&apos;ri variant. Bilmasangiz — taxmin qiling, ortga qaytib bo&apos;lmaydi.
        </p>

        <Footer />
      </div>
    );
  }

  // ── 3) Natija ──
  if (step === "done" && result?.ok) {
    const color = result.color ?? (result.level ? colors[result.level] : "#64748b");
    const pct = Math.round((result.correct / result.total) * 100);
    return (
      <div className="animate-pop-in">
        <Header />

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
          {/* Daraja — katta rangli blok */}
          <div className="relative px-5 pb-6 pt-7 text-center text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
            <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">Sizning darajangiz</div>
            <div className="relative mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-full bg-white text-[34px] font-black shadow-lg" style={{ color }}>
              {result.level ?? "A0"}
            </div>
            <div className="relative mt-3 text-lg font-bold">{result.label}</div>
            <div className="relative mt-1 text-sm text-white/85">
              {result.correct} / {result.total} to&apos;g&apos;ri · {pct}%
            </div>
          </div>

          {/* Daraja bo'yicha ballar */}
          <div className="space-y-2.5 px-5 py-5">
            {levels.map((l) => {
              const p = result.perLevel[l];
              const w = Math.round((p.correct / p.total) * 100);
              const passed = p.correct >= Math.ceil(p.total * 0.67);
              return (
                <div key={l} className="flex items-center gap-3">
                  <span className="w-8 rounded-md py-0.5 text-center text-[11px] font-bold text-white" style={{ background: colors[l] }}>{l}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, background: passed ? colors[l] : "#cbd5e1" }} />
                  </div>
                  <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{p.correct}/{p.total}</span>
                </div>
              );
            })}
          </div>

          <div className="mx-5 mb-5 flex items-start gap-2.5 rounded-2xl bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            Natijangiz saqlandi — tez orada siz bilan bog&apos;lanib, mos guruhni taklif qilamiz.
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-12 w-full rounded-2xl border border-slate-200 bg-white/70 text-sm font-semibold text-slate-600 transition active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
        >
          Qayta topshirish
        </button>

        <Footer />
      </div>
    );
  }

  // ── 2) Savollar ──
  const q = questions[idx];
  const color = colors[q.level];
  const picked = shown[String(q.id)];
  const levelStart = levels.indexOf(q.level) * perLevel;
  const inLevel = idx - levelStart + 1;

  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col sm:min-h-0">
      {/* Yuqori qism: daraja + hisob */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: color }}>{q.level}</span>
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{inLevel} / {perLevel}</span>
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          Savol {idx + 1} <span className="text-slate-300 dark:text-slate-600">/ {questions.length}</span>
        </span>
      </div>

      {/* Progress — har daraja o'z rangida */}
      <div className="mt-2.5 flex gap-1.5">
        {levels.map((l, k) => {
          const done = Math.min(perLevel, Math.max(0, idx - k * perLevel));
          return (
            <div key={l} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(done / perLevel) * 100}%`, background: colors[l] }} />
            </div>
          );
        })}
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
                  {on ? "✓" : String.fromCharCode(65 + j)}
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

      <p className="mt-4 text-center text-[11.5px] text-slate-400 dark:text-slate-500">Har darajada {perLevel} ta savol · ortga qaytib bo&apos;lmaydi</p>
    </div>
  );
}

// ───────────── Yordamchi qismlar ─────────────

const INPUT =
  "h-13 min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-600";

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

function Fact({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2.5 text-center backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
      <div className="text-[17px] font-black tabular-nums text-slate-900 dark:text-white">{big}</div>
      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{small}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block last:mb-0">
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
