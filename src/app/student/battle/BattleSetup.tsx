"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CARD, ICON_GRADIENT, PageHeader } from "../_ui";

// Jang (Battle) sozlash ekrani — maketdagidek:
// 1) jang turi (AI ga qarshi · Duel · Guruhli o'yin)
// 2) lobbi turi (Grammatik · Vocabulary · Krossvord · So'z o'yini)
// 3) pastda "Jangni boshlang" tugmasi

export interface WordPair { de: string; hint: string }

type Mode = "ai" | "duel" | "group";
type Lobby = "grammar" | "vocabulary" | "crossword" | "wordgame";

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

// ── Illyustratsiyalar (SVG) ──
function Robot({ s = 62 }: { s?: number }) {
  return (
    <svg width={s} height={s * 0.8} viewBox="0 0 80 64">
      <rect x="14" y="16" width="52" height="34" rx="12" fill="#5b6craf" />
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
function Duelists({ s = 62 }: { s?: number }) {
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
      {/* qilichlar */}
      <path d="M32 44 L44 18" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M48 44 L36 18" stroke="#cbd5e1" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
function Crowd({ s = 62 }: { s?: number }) {
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
      <svg width="72" height="60" viewBox="0 0 72 60">
        <rect x="14" y="8" width="44" height="44" rx="5" fill="#a3714b" />
        <rect x="18" y="12" width="36" height="36" rx="3" fill="#c08a5e" />
        <rect x="24" y="20" width="24" height="4" rx="2" fill="#7a5233" />
        <rect x="24" y="28" width="18" height="4" rx="2" fill="#7a5233" />
      </svg>
    );
  }
  if (kind === "vocabulary") {
    return (
      <svg width="72" height="60" viewBox="0 0 72 60">
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
      <svg width="72" height="60" viewBox="0 0 72 60">
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => {
            const filled = (r + c) % 3 === 0;
            return (
              <rect key={`${r}-${c}`} x={12 + c * 12} y={10 + r * 12} width="11" height="11" rx="2"
                fill={filled ? "#334155" : "#f1f5f9"} stroke="#94a3b8" strokeWidth="1" />
            );
          }),
        )}
      </svg>
    );
  }
  // so'z o'yini — harf kublari
  return (
    <svg width="72" height="60" viewBox="0 0 72 60">
      {["W", "O", "R", "T"].map((ch, i) => (
        <g key={ch}>
          <rect x={8 + i * 14} y={20} width="12" height="14" rx="2.5" fill="#fde68a" stroke="#d97706" strokeWidth="1.3" />
          <text x={14 + i * 14} y={30.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#92400e">{ch}</text>
        </g>
      ))}
    </svg>
  );
}

export default function BattleSetup({ words }: { words: WordPair[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ai");
  const [lobby, setLobby] = useState<Lobby>("vocabulary");

  const modeReady = MODES.find((m) => m.key === mode)?.ready ?? false;
  const lobbyReady = LOBBIES.find((l) => l.key === lobby)?.ready ?? false;
  const canStart = modeReady && lobbyReady && words.length >= 4;

  const start = () => {
    if (!canStart) return;
    router.push(`/student/battle/spiel?lobby=${lobby}`);
  };

  return (
    <div className="space-y-[18px] pb-24">
      <PageHeader title="Jang va o'yinlar" subtitle="Bilimingizni sinab ko'ring" back="/student/uben" />

      {/* ── Jang turi ── */}
      <div>
        <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Jang turini tanlang
        </p>
        <div className="space-y-3">
          {MODES.map((m) => {
            const on = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`${CARD} flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${on ? "ring-2 ring-[#0e7490]" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[19px] font-extrabold text-slate-900">{m.title}</span>
                    {!m.ready && (
                      <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                        tez orada
                      </span>
                    )}
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
      </div>

      {/* ── O'yin turi ── */}
      <div>
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
                className={`${CARD} overflow-hidden pb-4 pt-4 transition ${on ? "ring-2 ring-[#0e7490]" : ""}`}
              >
                <div className="grid h-[62px] place-items-center">
                  <LobbyArt kind={l.key} />
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 px-2">
                  <span className="text-[16px] font-extrabold text-slate-900">{l.title}</span>
                  {!l.ready && (
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                      tez orada
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Boshlash ── */}
      <div className="fixed inset-x-0 bottom-[92px] z-30 mx-auto max-w-md px-4">
        <button
          type="button"
          onClick={start}
          disabled={!canStart}
          style={canStart ? { background: ICON_GRADIENT } : undefined}
          className="w-full rounded-2xl py-3.5 text-[17px] font-extrabold text-white shadow-[0_10px_22px_rgba(14,116,144,0.35)] transition active:translate-y-[2px] disabled:bg-slate-300 disabled:shadow-none"
        >
          {words.length < 4 ? "So'zlar yetarli emas" : canStart ? "Jangni boshlang" : "Bu rejim tez orada"}
        </button>
      </div>
    </div>
  );
}
