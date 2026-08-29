"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { WordPair } from "../BattleSetup";
import { CARD, TEAL, ICON_GRADIENT } from "../../_ui";

// Uch xil o'yin — hammasi kurs so'zlaridan tuziladi:
//   vocabulary — 4 variantli viktorina (AI raqib ham javob beradi)
//   wordgame   — aralashtirilgan harflardan so'zni tiklash
//   crossword  — kichik krossvord: ta'rif bo'yicha so'zni yozish
//
// Barchasi brauzerda ishlaydi — server so'rovi kerak emas.

type Lobby = "vocabulary" | "wordgame" | "crossword" | "grammar";

const ROUNDS = 8;

// Barqaror aralashtirish (SSR/CSR farq qilmasligi uchun urug'li)
function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function IcoBack({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}
function IcoRobot({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <rect x="4" y="7" width="16" height="11" rx="4" fill="#64748b" />
      <rect x="6.5" y="10" width="11" height="4.6" rx="2.3" fill="#1e293b" />
      <circle cx="14.6" cy="12.3" r="1.3" fill="#ef4444" />
      <rect x="11" y="3.5" width="2" height="3.5" rx="1" fill="#94a3b8" />
      <circle cx="12" cy="3" r="1.6" fill="#cbd5e1" />
    </svg>
  );
}

const TITLES: Record<Lobby, string> = {
  vocabulary: "Vocabulary",
  wordgame: "So'z o'yini",
  crossword: "Krossvord",
  grammar: "Grammatika",
};

export default function GamePlay({ words, lobby, seed }: { words: WordPair[]; lobby: Lobby; seed: number }) {
  const rounds = useMemo(() => {
    const pool = shuffled(words, seed).slice(0, ROUNDS);
    return pool.map((w, i) => {
      // Noto'g'ri variantlar — boshqa so'zlardan
      const others = shuffled(words.filter((x) => x.de !== w.de), seed + i * 7).slice(0, 3);
      const options = shuffled([w, ...others], seed + i * 13).map((x) => x.de);
      return { word: w, options };
    });
  }, [words, seed]);

  const [step, setStep] = useState(0);
  const [me, setMe] = useState(0);
  const [ai, setAi] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  const r = rounds[step];
  if (!r) return null;

  const target = r.word.de;

  // Aralashtirilgan harflar (so'z o'yini / krossvord uchun)
  const scrambled = useMemo(
    () => shuffled(target.replace(/\s+/g, "").split(""), seed + step * 31).join(" "),
    [target, seed, step],
  );

  const finish = (correct: boolean) => {
    if (correct) setMe((n) => n + 1);
    // AI raqib: 65% ehtimol bilan to'g'ri javob beradi (urug'li, tasodifsiz)
    const aiRight = ((seed + step * 17) % 100) < 65;
    if (aiRight) setAi((n) => n + 1);

    setTimeout(() => {
      if (step + 1 >= rounds.length) setDone(true);
      else {
        setStep((s) => s + 1);
        setPicked(null);
        setTyped("");
      }
    }, 850);
  };

  const check = () => {
    if (!typed.trim()) return;
    const ok = typed.trim().toLowerCase() === target.toLowerCase();
    setPicked(ok ? target : typed);
    finish(ok);
  };

  // ── Natija ekrani ──
  if (done) {
    const win = me > ai;
    const draw = me === ai;
    return (
      <div className="space-y-4 pb-24">
        <div className={`${CARD} mt-8 p-6 text-center`}>
          <div className="text-[52px] leading-none">{win ? "🏆" : draw ? "🤝" : "💪"}</div>
          <div className="mt-3 text-[24px] font-extrabold text-slate-900">
            {win ? "Siz yutdingiz!" : draw ? "Durrang" : "Keyingi safar!"}
          </div>
          <div className="mt-5 flex items-center justify-center gap-6">
            <div>
              <div className="text-[13px] font-semibold text-slate-500">Siz</div>
              <div className="text-[32px] font-extrabold text-[#0e7490]">{me}</div>
            </div>
            <div className="text-[22px] font-bold text-slate-300">:</div>
            <div>
              <div className="text-[13px] font-semibold text-slate-500">AI</div>
              <div className="text-[32px] font-extrabold text-slate-500">{ai}</div>
            </div>
          </div>
          <div className="mt-6 flex gap-2.5">
            <Link href="/student/battle" className="flex-1 rounded-2xl border-2 border-slate-200 py-3 text-[15px] font-bold text-slate-600">
              Orqaga
            </Link>
            <Link href={`/student/battle/spiel?lobby=${lobby}`} style={{ background: ICON_GRADIENT }}
              className="flex-[1.3] rounded-2xl py-3 text-[15px] font-extrabold text-white shadow-[0_8px_18px_rgba(14,116,144,0.3)]">
              Yana o'ynash
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Sarlavha + hisob */}
      <div className="flex items-center gap-3">
        <Link href="/student/battle" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoBack />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-extrabold tracking-tight text-[#0e7490]">
          {TITLES[lobby]}
        </h1>
        <span className="rounded-full bg-white px-3 py-1.5 text-[14px] font-extrabold text-[#0e7490] shadow-sm">{me}</span>
        <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 shadow-sm">
          <IcoRobot s={20} />
          <span className="text-[14px] font-extrabold text-slate-600">{ai}</span>
        </span>
      </div>

      {/* Jarayon */}
      <div className="mt-4 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[#0e7490]" style={{ width: `${((step + 1) / rounds.length) * 100}%` }} />
        </div>
        <span className="text-[12px] font-bold text-slate-500">{step + 1}/{rounds.length}</span>
      </div>

      {/* Savol */}
      <div className={`${CARD} p-5`}>
        <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {lobby === "vocabulary" ? "To'g'ri so'zni tanlang" : lobby === "wordgame" ? "Harflardan so'z tuzing" : "Ta'rif bo'yicha yozing"}
        </div>

        {lobby === "vocabulary" ? (
          <>
            <div className="mt-2 text-[20px] font-extrabold leading-snug text-slate-900">{r.word.hint}</div>
            <p className="mt-1 text-[13px] text-slate-400">Shu darsdagi so'zni toping</p>
            <div className="mt-4 space-y-2.5">
              {r.options.map((opt) => {
                const isPicked = picked === opt;
                const isRight = picked && opt === target;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!!picked}
                    onClick={() => { setPicked(opt); finish(opt === target); }}
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-[16px] font-bold transition ${
                      isRight
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : isPicked
                          ? "border-rose-400 bg-rose-50 text-rose-600"
                          : "border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mt-2 text-[15px] font-semibold text-slate-500">{r.word.hint}</div>
            {lobby === "wordgame" ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {scrambled.split(" ").map((ch, i) => (
                  <span key={i} className="grid h-11 w-9 place-items-center rounded-xl border-2 border-amber-300 bg-amber-100 text-[18px] font-extrabold text-amber-800">
                    {ch}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {target.replace(/\s+/g, "").split("").map((ch, i) => (
                  <span key={i} className="grid h-10 w-8 place-items-center rounded-md border-2 border-slate-300 bg-slate-50 text-[16px] font-extrabold text-slate-400">
                    {i === 0 ? ch : ""}
                  </span>
                ))}
              </div>
            )}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") check(); }}
              disabled={!!picked}
              placeholder="Javobingiz…"
              className="mt-4 h-12 w-full rounded-2xl border-2 border-slate-200 px-4 text-[16px] font-semibold text-slate-800 outline-none focus:border-[#0e7490]"
            />
            {picked && (
              <p className={`mt-2 text-[14px] font-bold ${picked.toLowerCase() === target.toLowerCase() ? "text-emerald-600" : "text-rose-600"}`}>
                {picked.toLowerCase() === target.toLowerCase() ? "To'g'ri!" : `To'g'ri javob: ${target}`}
              </p>
            )}
            <button
              type="button"
              onClick={check}
              disabled={!!picked || !typed.trim()}
              style={{ background: typed.trim() && !picked ? ICON_GRADIENT : undefined }}
              className="mt-3 w-full rounded-2xl bg-slate-300 py-3 text-[16px] font-extrabold text-white shadow-[0_8px_18px_rgba(14,116,144,0.3)] disabled:shadow-none"
            >
              Tekshirish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
