"use client";

import { useMemo, useState } from "react";
import { CARD, ICON_GRADIENT, TEAL, PageHeader } from "../_ui";

// Jang (Battle) — BITTA sahifa: sozlash → o'yin → natija.
// Sahifa almashmaydi, faqat holat o'zgaradi (view: setup | play | result).

export interface WordPair { de: string; hint: string }

type Mode = "ai" | "duel" | "group";
type Lobby = "vocabulary" | "wordgame" | "crossword" | "grammar";
type View = "setup" | "play" | "result";

const ROUNDS = 8;

const MODES: { key: Mode; title: string; sub: string; ready: boolean }[] = [
  { key: "ai", title: "AI ga qarshi", sub: "Sun'iy intellekt bilan bellashing", ready: true },
  { key: "duel", title: "Duel", sub: "Bir ga bir jang", ready: false },
  { key: "group", title: "Guruhli o'yin", sub: "4 yoki undan ortiq o'yinchi bilan", ready: false },
];

const LOBBIES: { key: Lobby; title: string; ready: boolean }[] = [
  { key: "vocabulary", title: "Vocabulary", ready: true },
  { key: "wordgame", title: "So'z o'yini", ready: true },
  { key: "crossword", title: "Krossvord", ready: true },
  { key: "grammar", title: "Grammatika", ready: false },
];

const TASK_TITLE: Record<Lobby, string> = {
  vocabulary: "To'g'ri so'zni tanlang",
  wordgame: "Harflardan so'z tuzing",
  crossword: "Ta'rif bo'yicha yozing",
  grammar: "Grammatika",
};

// Barqaror (urug'li) aralashtirish — SSR va brauzer bir xil chizadi
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

// ── Illyustratsiyalar ──
function Robot({ s = 58 }: { s?: number }) {
  return (
    <svg width={s} height={s * 0.8} viewBox="0 0 80 64">
      <rect x="14" y="16" width="52" height="34" rx="12" fill="#64748b" />
      <rect x="20" y="24" width="40" height="15" rx="7.5" fill="#1e293b" />
      <circle cx="49" cy="31.5" r="4" fill="#ef4444" />
      <rect x="36" y="8" width="8" height="9" rx="4" fill="#94a3b8" />
      <circle cx="40" cy="6" r="4" fill="#cbd5e1" />
      <rect x="6" y="28" width="8" height="16" rx="4" fill="#94a3b8" />
      <rect x="66" y="28" width="8" height="16" rx="4" fill="#94a3b8" />
      <rect x="24" y="50" width="32" height="8" rx="4" fill="#475569" />
    </svg>
  );
}
function Duelists({ s = 58 }: { s?: number }) {
  return (
    <svg width={s} height={s * 0.8} viewBox="0 0 80 64">
      {[18, 56].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="26" r="13" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
          <circle cx={cx - 4} cy="24" r="1.8" fill="#334155" />
          <circle cx={cx + 4} cy="24" r="1.8" fill="#334155" />
          <path d={`M${cx - 5} 31 q5 ${i ? -4 : 4} 10 0`} fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M${cx - 10} 40 h20 v14 h-20 z`} fill="#cbd5e1" />
        </g>
      ))}
      <path d="M32 44 L44 18" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M48 44 L36 18" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
function Crowd({ s = 58 }: { s?: number }) {
  return (
    <svg width={s} height={s * 0.8} viewBox="0 0 80 64">
      {[[16, 30], [40, 24], [64, 30], [28, 44], [52, 44]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="9.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.8" />
          <circle cx={cx - 3} cy={cy - 1} r="1.4" fill="#334155" />
          <circle cx={cx + 3} cy={cy - 1} r="1.4" fill="#334155" />
          <path d={`M${cx - 3.5} ${cy + 4} q3.5 3 7 0`} fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
function LobbyArt({ kind }: { kind: Lobby }) {
  if (kind === "grammar") {
    return (
      <svg width="66" height="56" viewBox="0 0 72 60">
        <rect x="14" y="8" width="44" height="44" rx="5" fill="#a3714b" />
        <rect x="18" y="12" width="36" height="36" rx="3" fill="#c08a5e" />
        <rect x="24" y="20" width="24" height="4" rx="2" fill="#7a5233" />
        <rect x="24" y="28" width="18" height="4" rx="2" fill="#7a5233" />
      </svg>
    );
  }
  if (kind === "vocabulary") {
    return (
      <svg width="66" height="56" viewBox="0 0 72 60">
        {[["About", 8, 12, 30], ["Home", 36, 20, 26], ["Teach", 14, 34, 34]].map(([t, x, y, w], i) => (
          <g key={i}>
            <rect x={x as number} y={y as number} width={w as number} height="14" rx="7" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.4" />
            <text x={(x as number) + (w as number) / 2} y={(y as number) + 10} textAnchor="middle" fontSize="7.5" fill="#475569" fontWeight="700">{t as string}</text>
          </g>
        ))}
      </svg>
    );
  }
  if (kind === "crossword") {
    return (
      <svg width="66" height="56" viewBox="0 0 72 60">
        {Array.from({ length: 4 }).map((_, rr) =>
          Array.from({ length: 4 }).map((_, c) => (
            <rect key={`${rr}-${c}`} x={12 + c * 12} y={10 + rr * 12} width="11" height="11" rx="2"
              fill={(rr + c) % 3 === 0 ? "#334155" : "#f1f5f9"} stroke="#94a3b8" strokeWidth="1" />
          )),
        )}
      </svg>
    );
  }
  return (
    <svg width="66" height="56" viewBox="0 0 72 60">
      {["W", "O", "R", "T"].map((ch, i) => (
        <g key={ch}>
          <rect x={8 + i * 14} y={20} width="12" height="14" rx="2.5" fill="#fde68a" stroke="#d97706" strokeWidth="1.3" />
          <text x={14 + i * 14} y={30.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#92400e">{ch}</text>
        </g>
      ))}
    </svg>
  );
}
function IcoRobotSmall({ s = 20 }: { s?: number }) {
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

const SOON = (
  <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
    tez orada
  </span>
);

export default function Battle({ words }: { words: WordPair[] }) {
  const [view, setView] = useState<View>("setup");
  const [mode, setMode] = useState<Mode>("ai");
  const [lobby, setLobby] = useState<Lobby>("vocabulary");

  // O'yin holati
  const [game, setGame] = useState(0); // har yangi o'yinda ortadi → savollar yangilanadi
  const [step, setStep] = useState(0);
  const [me, setMe] = useState(0);
  const [ai, setAi] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const seed = words.length * 7919 + lobby.length * 104729 + game * 31337;

  const rounds = useMemo(() => {
    const pool = shuffled(words, seed).slice(0, ROUNDS);
    return pool.map((w, i) => {
      const others = shuffled(words.filter((x) => x.de !== w.de), seed + i * 7).slice(0, 3);
      return { word: w, options: shuffled([w, ...others], seed + i * 13).map((x) => x.de) };
    });
  }, [words, seed]);

  const modeReady = MODES.find((m) => m.key === mode)?.ready ?? false;
  const lobbyReady = LOBBIES.find((l) => l.key === lobby)?.ready ?? false;
  const canStart = modeReady && lobbyReady && words.length >= 4;

  const startGame = () => {
    if (!canStart) return;
    setGame((g) => g + 1);
    setStep(0); setMe(0); setAi(0); setPicked(null); setTyped("");
    setView("play");
  };

  const r = rounds[step];
  const target = r?.word.de ?? "";
  const scrambled = useMemo(
    () => shuffled(target.replace(/\s+/g, "").split(""), seed + step * 31).join(" "),
    [target, seed, step],
  );

  const nextRound = (correct: boolean) => {
    if (correct) setMe((n) => n + 1);
    if (((seed + step * 17) % 100) < 65) setAi((n) => n + 1); // AI ~65% aniqlik
    setTimeout(() => {
      if (step + 1 >= rounds.length) setView("result");
      else { setStep((s) => s + 1); setPicked(null); setTyped(""); }
    }, 850);
  };

  const check = () => {
    if (!typed.trim() || picked) return;
    const ok = typed.trim().toLowerCase() === target.toLowerCase();
    setPicked(ok ? target : typed);
    nextRound(ok);
  };

  // ═══════════ SOZLASH ═══════════
  if (view === "setup") {
    return (
      <div className="space-y-5 pb-[104px]">
        <PageHeader title="Jang va o'yinlar" subtitle="Bilimingizni sinab ko'ring" back="/student/uben" />

        <section>
          <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Jang turini tanlang
          </p>
          <div className="space-y-2.5">
            {MODES.map((m) => {
              const on = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`${CARD} flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${on ? "ring-2 ring-[#0e7490]" : "opacity-95"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[18px] font-extrabold text-slate-900">{m.title}</span>
                      {!m.ready && SOON}
                    </div>
                    <div className="mt-0.5 text-[13px] leading-snug text-slate-500">{m.sub}</div>
                  </div>
                  <span className="shrink-0">
                    {m.key === "ai" ? <Robot /> : m.key === "duel" ? <Duelists /> : <Crowd />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
            O&apos;yin turini tanlang
          </p>
          <div className="grid grid-cols-2 gap-3">
            {LOBBIES.map((l) => {
              const on = lobby === l.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLobby(l.key)}
                  className={`${CARD} overflow-hidden py-4 transition ${on ? "ring-2 ring-[#0e7490]" : "opacity-95"}`}
                >
                  <div className="grid h-[58px] place-items-center">
                    <LobbyArt kind={l.key} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 px-2">
                    <span className="text-[15.5px] font-extrabold text-slate-900">{l.title}</span>
                    {!l.ready && SOON}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Boshlash — pastda mahkam turadi */}
        <div className="fixed inset-x-0 bottom-[92px] z-30 mx-auto max-w-md px-4">
          <button
            type="button"
            onClick={startGame}
            disabled={!canStart}
            style={canStart ? { background: ICON_GRADIENT } : undefined}
            className="w-full rounded-2xl py-3.5 text-[17px] font-extrabold text-white shadow-[0_10px_24px_rgba(14,116,144,0.35)] transition active:translate-y-[2px] disabled:bg-slate-300 disabled:shadow-none"
          >
            {words.length < 4 ? "So'zlar yetarli emas" : canStart ? "Jangni boshlang" : "Bu rejim tez orada"}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════ NATIJA ═══════════
  if (view === "result") {
    const win = me > ai;
    const draw = me === ai;
    return (
      <div className="space-y-4 pb-24">
        <div className={`${CARD} mt-6 p-6 text-center`}>
          <div className="text-[52px] leading-none">{win ? "🏆" : draw ? "🤝" : "💪"}</div>
          <div className="mt-3 text-[24px] font-extrabold text-slate-900">
            {win ? "Siz yutdingiz!" : draw ? "Durrang" : "Keyingi safar!"}
          </div>
          <div className="mt-1 text-[13px] text-slate-500">{LOBBIES.find((l) => l.key === lobby)?.title}</div>

          <div className="mt-5 flex items-center justify-center gap-7">
            <div>
              <div className="text-[13px] font-semibold text-slate-500">Siz</div>
              <div className="text-[34px] font-extrabold" style={{ color: TEAL }}>{me}</div>
            </div>
            <div className="text-[22px] font-bold text-slate-300">:</div>
            <div>
              <div className="text-[13px] font-semibold text-slate-500">AI</div>
              <div className="text-[34px] font-extrabold text-slate-500">{ai}</div>
            </div>
          </div>

          <div className="mt-6 flex gap-2.5">
            <button
              type="button"
              onClick={() => setView("setup")}
              className="flex-1 rounded-2xl border-2 border-slate-200 py-3 text-[15px] font-bold text-slate-600"
            >
              Orqaga
            </button>
            <button
              type="button"
              onClick={startGame}
              style={{ background: ICON_GRADIENT }}
              className="flex-[1.3] rounded-2xl py-3 text-[15px] font-extrabold text-white shadow-[0_8px_18px_rgba(14,116,144,0.3)]"
            >
              Yana o&apos;ynash
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ O'YIN ═══════════
  return (
    <div className="space-y-4 pb-24">
      {/* Sarlavha + hisob */}
      <div className="flex items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => setView("setup")}
          aria-label="Orqaga"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5.5 8.5 12l6.5 6.5" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-extrabold tracking-tight text-slate-900">
          {LOBBIES.find((l) => l.key === lobby)?.title}
        </h1>
        <span className="rounded-full bg-white px-3 py-1.5 text-[14px] font-extrabold shadow-[0_4px_12px_rgba(19,78,94,0.10)]" style={{ color: TEAL }}>
          {me}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 shadow-[0_4px_12px_rgba(19,78,94,0.10)]">
          <IcoRobotSmall />
          <span className="text-[14px] font-extrabold text-slate-600">{ai}</span>
        </span>
      </div>

      {/* Jarayon */}
      <div className="flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full transition-all" style={{ width: `${((step + 1) / rounds.length) * 100}%`, background: ICON_GRADIENT }} />
        </div>
        <span className="text-[12px] font-bold text-slate-500">{step + 1}/{rounds.length}</span>
      </div>

      {/* Savol */}
      <div className={`${CARD} p-5`}>
        <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{TASK_TITLE[lobby]}</div>

        {lobby === "vocabulary" ? (
          <>
            <div className="mt-2 text-[20px] font-extrabold leading-snug text-slate-900">{r?.word.hint}</div>
            <p className="mt-1 text-[13px] text-slate-400">Shu darsdagi so&apos;zni toping</p>
            <div className="mt-4 space-y-2.5">
              {r?.options.map((opt) => {
                const isPicked = picked === opt;
                const isRight = picked && opt === target;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!!picked}
                    onClick={() => { setPicked(opt); nextRound(opt === target); }}
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
            <div className="mt-2 text-[15px] font-semibold text-slate-500">{r?.word.hint}</div>

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
              style={!picked && typed.trim() ? { background: ICON_GRADIENT } : undefined}
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
