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
  { key: "group", title: "Guruhli o'yin", sub: "4 va undan ortiq o'yinchi", ready: false },
];

const LOBBIES: { key: Lobby; title: string; sub: string; ready: boolean }[] = [
  { key: "vocabulary", title: "Lug'at", sub: "To'g'ri so'zni tanlang", ready: true },
  { key: "wordgame", title: "So'z o'yini", sub: "Harflardan tuzing", ready: true },
  { key: "crossword", title: "Krossvord", sub: "Ta'rif bo'yicha yozing", ready: true },
  { key: "grammar", title: "Grammatika", sub: "Qoidalar bo'yicha", ready: false },
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

// ── Ikonkalar: bitta rangli, geometrik gliflar (gradient doira ustida oq) ──
const GLYPH = { fill: "none", stroke: "white", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function GlyphRobot({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <rect x="4" y="8" width="16" height="11" rx="3.5" />
      <path d="M12 4.4V8" />
      <circle cx="12" cy="3.4" r="1.4" fill="white" stroke="none" />
      <circle cx="9" cy="13" r="1.5" fill="white" stroke="none" />
      <circle cx="15" cy="13" r="1.5" fill="white" stroke="none" />
      <path d="M2 12.5v3M22 12.5v3" />
    </svg>
  );
}
function GlyphSwords({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <path d="M4 4.5 14.5 15M19.5 4.5 9 15" />
      <path d="M4 4.5h2.6M4 4.5v2.6M19.5 4.5h-2.6M19.5 4.5v2.6" />
      <path d="M13 16.4 15.4 18.8M11 16.4 8.6 18.8" />
    </svg>
  );
}
function GlyphGroup({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <circle cx="9" cy="8.4" r="3.1" />
      <path d="M3.4 19c.6-3.1 2.9-4.8 5.6-4.8s5 1.7 5.6 4.8" />
      <circle cx="17.4" cy="9.4" r="2.4" />
      <path d="M16 14.6c2.3.2 3.9 1.8 4.4 4.4" />
    </svg>
  );
}
function GlyphChat({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <path d="M4 5.5h16v10H9.5L5.5 19v-3.5H4z" />
      <path d="M8.5 10.5h7M8.5 13h4" />
    </svg>
  );
}
function GlyphTiles({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <rect x="2.6" y="7" width="6" height="10" rx="1.8" />
      <rect x="9.4" y="4.6" width="6" height="14.8" rx="1.8" />
      <rect x="16.2" y="7" width="5.2" height="10" rx="1.8" />
    </svg>
  );
}
function GlyphGrid({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.6" />
      <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" />
      <rect x="9.2" y="9.2" width="5.6" height="5.6" fill="white" stroke="none" opacity="0.9" />
    </svg>
  );
}
function GlyphBook({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <path d="M4 4.8h9.2a2.8 2.8 0 0 1 2.8 2.8V20H6.8A2.8 2.8 0 0 1 4 17.2z" />
      <path d="M16 7.6h4V20h-4" />
      <path d="M7.4 9.2h5.4M7.4 12.2h3.6" />
    </svg>
  );
}

// Gradient doira ichidagi ikonka
function Badge({ children, muted = false, s = 52 }: { children: React.ReactNode; muted?: boolean; s?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{
        width: s,
        height: s,
        background: muted ? "linear-gradient(135deg,#cbd5e1,#94a3b8)" : ICON_GRADIENT,
        boxShadow: muted ? "none" : "0 8px 16px rgba(14,116,144,0.28)",
      }}
    >
      {children}
    </span>
  );
}

// Tanlangan kartadagi belgi
function Tick({ on }: { on: boolean }) {
  return on ? (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: ICON_GRADIENT }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  ) : (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-200" />
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
    const MODE_ICON = { ai: GlyphRobot, duel: GlyphSwords, group: GlyphGroup } as const;
    const LOBBY_ICON = { vocabulary: GlyphChat, wordgame: GlyphTiles, crossword: GlyphGrid, grammar: GlyphBook } as const;

    return (
      <div className="space-y-6 pb-[92px]">
        <PageHeader title="Jang va o'yinlar" subtitle="Bilimingizni sinab ko'ring" back="/student/uben" />

        {/* ── Jang turi ── */}
        <section>
          <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Jang turi
          </p>
          <div className="space-y-2.5">
            {MODES.map((m) => {
              const on = mode === m.key;
              const Icon = MODE_ICON[m.key];
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  aria-pressed={on}
                  className={`${CARD} flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition ${
                    on ? "ring-2 ring-[#0e7490]" : m.ready ? "" : "opacity-70"
                  }`}
                >
                  <Badge muted={!m.ready}><Icon /></Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[17px] font-extrabold leading-tight text-slate-900">{m.title}</span>
                      {!m.ready && SOON}
                    </div>
                    <div className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{m.sub}</div>
                  </div>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        </section>

        {/* ── O'yin turi ── */}
        <section>
          <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            O&apos;yin turi
          </p>
          <div className="grid grid-cols-2 gap-3">
            {LOBBIES.map((l) => {
              const on = lobby === l.key;
              const Icon = LOBBY_ICON[l.key];
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLobby(l.key)}
                  aria-pressed={on}
                  className={`${CARD} relative flex flex-col items-start gap-2.5 p-4 text-left transition ${
                    on ? "ring-2 ring-[#0e7490]" : l.ready ? "" : "opacity-70"
                  }`}
                >
                  {on && (
                    <span className="absolute right-3 top-3">
                      <Tick on />
                    </span>
                  )}
                  <Badge muted={!l.ready} s={46}><Icon s={23} /></Badge>
                  <div>
                    <div className="text-[15.5px] font-extrabold leading-tight text-slate-900">{l.title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{l.sub}</div>
                  </div>
                  {!l.ready && <span className="mt-0.5">{SOON}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Boshlash ── */}
        <div className="fixed inset-x-0 bottom-5 z-30 mx-auto max-w-md px-4">
          {/* fon ostidagi kontent tugma ostida "kesilib" ko'rinmasin */}
          <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-[#e4edf3]" />
          <button
            type="button"
            onClick={startGame}
            disabled={!canStart}
            style={canStart ? { background: ICON_GRADIENT } : undefined}
            className="relative w-full rounded-2xl py-3.5 text-[17px] font-extrabold text-white shadow-[0_10px_24px_rgba(14,116,144,0.35)] transition active:translate-y-[2px] disabled:bg-slate-300 disabled:shadow-none"
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
      <div className="space-y-4 pb-6">
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
    <div className="space-y-4 pb-6">
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
          <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: "linear-gradient(135deg,#94a3b8,#64748b)" }}><GlyphRobot s={14} /></span>
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
