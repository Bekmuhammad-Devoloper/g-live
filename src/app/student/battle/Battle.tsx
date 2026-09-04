"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createDuel, joinGroupGame, saveGameResult, submitChallenge } from "./actions";
import type { StudentStrings } from "../_i18n";
import { CARD, ICON_GRADIENT, TEAL, PageHeader } from "../_ui";

// Jang (Battle) — BITTA sahifa: sozlash → o'yin → natija.
// Sahifa almashmaydi, faqat holat o'zgaradi (view: setup | play | result).
//
// Uch xil jang bor:
//   ai    — sun'iy raqibga qarshi, darhol o'ynaladi
//   duel  — guruhdoshga chaqiruv; ikkalasi BIR XIL savollarni oladi, lekin
//           bir vaqtda o'ynashi shart emas (kim qachon ulgursa)
//   group — guruh chempionati; bir hafta ochiq turadi, hamma o'ynaydi

export interface WordPair { de: string; hint: string; g?: string }
export interface Rival { id: string; name: string; imageUrl: string | null }
export interface Invite {
  id: string;
  kind: "DUEL" | "GROUP";
  lobby: string;
  seed: number;
  fromMe: boolean;
  from: string;
  to: string;
  played: number;
}

type Mode = "ai" | "duel" | "group";
type Lobby = "vocabulary" | "wordgame" | "crossword" | "grammar";
type View = "setup" | "play" | "result";

const ROUNDS = 8;
const ARTICLES = ["der", "die", "das"];
const ART: Record<string, string> = { m: "der", f: "die", n: "das" };

const MODES: { key: Mode; title: string; sub: string }[] = [
  { key: "ai", title: "AI ga qarshi", sub: "Sun'iy intellekt bilan bellashing" },
  { key: "duel", title: "Duel", sub: "Guruhdoshingizni jangga chaqiring" },
  { key: "group", title: "Guruhli o'yin", sub: "Butun guruh bitta savollar bilan" },
];

const LOBBIES: { key: Lobby; title: string; sub: string }[] = [
  { key: "vocabulary", title: "Lug'at", sub: "To'g'ri so'zni tanlang" },
  { key: "wordgame", title: "So'z o'yini", sub: "Harflardan tuzing" },
  { key: "crossword", title: "Krossvord", sub: "Ta'rif bo'yicha yozing" },
  { key: "grammar", title: "Grammatika", sub: "der, die yoki das" },
];

const TASK_TITLE: Record<Lobby, string> = {
  vocabulary: "To'g'ri so'zni tanlang",
  wordgame: "Harflardan so'z tuzing",
  crossword: "Ta'rif bo'yicha yozing",
  grammar: "Artiklni tanlang",
};

// Barqaror (urug'li) aralashtirish — ikkala o'yinchi bir xil savol oladi
function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = Math.abs(seed) || 1;
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
      <path d="M9.5 16.2h5" />
    </svg>
  );
}
function GlyphSwords({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <path d="M4 4.5h3l10 10.5M20 4.5h-3L7 15" />
      <path d="M4.5 19.5 8 16M19.5 19.5 16 16" />
    </svg>
  );
}
function GlyphGroup({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <circle cx="9" cy="8.5" r="3.1" />
      <path d="M3.5 19c.7-3 3-4.6 5.5-4.6S13.8 16 14.5 19" />
      <circle cx="17" cy="7.6" r="2.4" />
      <path d="M16 13.2c2 .3 3.6 1.8 4.2 4" />
    </svg>
  );
}
function GlyphChat({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <path d="M20 11.8c0 3.6-3.6 6.6-8 6.6-.9 0-1.8-.13-2.6-.37L4.6 19.5l1.3-3.3A6.3 6.3 0 0 1 4 11.8C4 8.2 7.6 5.2 12 5.2s8 3 8 6.6Z" />
    </svg>
  );
}
function GlyphTiles({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <rect x="3.5" y="8" width="6" height="8" rx="1.6" />
      <rect x="11" y="5.5" width="6" height="8" rx="1.6" />
      <rect x="15" y="12" width="5.5" height="7" rx="1.6" />
    </svg>
  );
}
function GlyphGrid({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <rect x="4" y="4" width="16" height="16" rx="2.4" />
      <path d="M4 9.4h16M4 14.7h16M9.4 4v16M14.7 4v16" />
    </svg>
  );
}
function GlyphBook({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...GLYPH}>
      <path d="M12 6.6C10.5 5.1 8.5 4.5 4.8 4.6v13c3.7-.1 5.7.5 7.2 2 1.5-1.5 3.5-2.1 7.2-2v-13c-3.7-.1-5.7.5-7.2 2Z" />
      <path d="M12 6.6v13" />
    </svg>
  );
}

function Badge({ children, muted, s = 52 }: { children: React.ReactNode; muted?: boolean; s?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{ width: s, height: s, background: muted ? "linear-gradient(135deg,#cbd5e1,#94a3b8)" : ICON_GRADIENT }}
    >
      {children}
    </span>
  );
}

function Tick({ on }: { on: boolean }) {
  return on ? (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: TEAL }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m4.5 12.5 5 5 10-11" />
      </svg>
    </span>
  ) : (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-200" />
  );
}

type Round = { prompt: string; sub?: string; answer: string; options?: string[] };

export default function Battle({
  words, nouns, rivals, invites, groupName, badges, t,
}: {
  words: WordPair[];
  nouns: WordPair[];
  rivals: Rival[];
  invites: Invite[];
  groupName: string | null;
  badges?: React.ReactNode;
  t: StudentStrings;
}) {
  const [view, setView] = useState<View>("setup");
  const [mode, setMode] = useState<Mode>("ai");
  const [lobby, setLobby] = useState<Lobby>("vocabulary");
  const [rivalId, setRivalId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // O'yin holati
  const [seed, setSeed] = useState(1);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [me, setMe] = useState(0);
  const [ai, setAi] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const pool = lobby === "grammar" ? nouns : words;
  const enough = lobby === "grammar" ? nouns.length >= 4 : words.length >= 4;

  // ── Savollar ── seed bir xil bo'lsa savollar ham bir xil
  const rounds = useMemo<Round[]>(() => {
    if (pool.length < 4) return [];
    const picks = shuffled(pool, seed).slice(0, ROUNDS);

    return picks.map((w, i) => {
      if (lobby === "grammar") {
        return { prompt: w.de, sub: w.hint, answer: ART[w.g ?? "m"] ?? "der", options: ARTICLES };
      }
      if (lobby === "vocabulary") {
        const others = shuffled(pool.filter((x) => x.de !== w.de), seed + i * 7).slice(0, 3);
        return {
          prompt: w.hint,
          answer: w.de,
          options: shuffled([w, ...others], seed + i * 13).map((x) => x.de),
        };
      }
      return { prompt: w.hint, answer: w.de };
    });
  }, [pool, lobby, seed]);

  const r = rounds[step];
  const target = r?.answer ?? "";
  const scrambled = useMemo(
    () => shuffled(target.replace(/\s+/g, "").split(""), seed + step * 31).join(" "),
    [target, seed, step],
  );

  const canStart = enough && (mode !== "duel" || !!rivalId) && !starting;

  // ── Boshlash ──
  const begin = (s: number, chId: string | null) => {
    setSeed(s);
    setChallengeId(chId);
    setStep(0); setMe(0); setAi(0); setPicked(null); setTyped("");
    setView("play");
  };

  const startGame = async () => {
    if (!canStart) return;
    setErr(null);

    if (mode === "ai") {
      begin(Math.floor(Math.random() * 1e9), null);
      return;
    }

    setStarting(true);
    const res = mode === "duel" ? await createDuel(rivalId!, lobby) : await joinGroupGame(lobby);
    setStarting(false);
    if (res.error || !res.id || res.seed === undefined) {
      setErr(res.error ?? "Chaqiruvni ochib bo'lmadi");
      return;
    }
    begin(res.seed, res.id);
  };

  // Kelgan chaqiruvni ochish
  const acceptInvite = (inv: Invite) => {
    setErr(null);
    setMode(inv.kind === "DUEL" ? "duel" : "group");
    setLobby(inv.lobby as Lobby);
    begin(inv.seed, inv.id);
  };

  const nextRound = (correct: boolean) => {
    if (correct) setMe((n) => n + 1);
    if (((seed + step * 17) % 100) < 65) setAi((n) => n + 1); // AI ~65% aniqlik
    setTimeout(() => {
      if (step + 1 >= rounds.length) setView("result");
      else { setStep((s) => s + 1); setPicked(null); setTyped(""); }
    }, 850);
  };

  // ── Natija bir marta yoziladi ──
  const sent = useRef<string>("");
  useEffect(() => {
    if (view !== "result") return;
    const key = `${seed}-${challengeId ?? "ai"}`;
    if (sent.current === key) return;
    sent.current = key;

    void saveGameResult({ game: lobby, mode, score: me, total: rounds.length, won: me > ai });
    if (challengeId) void submitChallenge(challengeId, me, rounds.length);
  }, [view, seed, challengeId, lobby, mode, me, ai, rounds.length]);

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
    const waiting = invites.filter((i) => !i.fromMe || i.kind === "GROUP");

    return (
      <div className="space-y-6 pb-[92px]">
        <PageHeader title={t.gamesAndBattle} subtitle={t.testKnowledge} backLabel={t.back} back="/student/uben" right={badges} />

        {/* ── Kutayotgan chaqiruvlar ── */}
        {waiting.length > 0 && (
          <section>
            <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Sizni kutmoqda
            </p>
            <div className="space-y-2.5">
              {waiting.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => acceptInvite(inv)}
                  className={`${CARD} flex w-full items-center gap-3.5 px-4 py-3.5 text-left outline outline-2 -outline-offset-2 outline-amber-300`}
                >
                  <Badge>{inv.kind === "DUEL" ? <GlyphSwords /> : <GlyphGroup />}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-extrabold leading-tight text-slate-900">
                      {inv.kind === "DUEL" ? `${inv.from} chaqirdi` : "Guruh chempionati"}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-slate-600">
                      {LOBBIES.find((l) => l.key === inv.lobby)?.title}
                      {inv.kind === "GROUP" && inv.played > 0 ? ` · ${inv.played} kishi o'ynadi` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ background: TEAL }}>
                    O&apos;ynash
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Jang turi ── */}
        <section>
          <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Jang turi</p>
          <div className="space-y-2.5">
            {MODES.map((m) => {
              const on = mode === m.key;
              const Icon = MODE_ICON[m.key];
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { setMode(m.key); setErr(null); }}
                  aria-pressed={on}
                  className={`${CARD} flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition ${on ? "outline outline-2 -outline-offset-2 outline-[#0e7490]" : ""}`}
                >
                  <Badge><Icon /></Badge>
                  <div className="min-w-0 flex-1">
                    <span className="text-[17px] font-extrabold leading-tight text-slate-900">{m.title}</span>
                    <div className="mt-0.5 text-[12.5px] leading-snug text-slate-600">
                      {m.key === "group" && groupName ? groupName : m.sub}
                    </div>
                  </div>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Raqib tanlash (duel) ── */}
        {mode === "duel" && (
          <section>
            <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Raqibingiz</p>
            {rivals.length === 0 ? (
              <div className={`${CARD} px-5 py-8 text-center`}>
                <div className="text-[14.5px] font-semibold text-slate-700">Guruhingizda ilovaga ulangan boshqa o&apos;quvchi yo&apos;q</div>
                <p className="mt-1 text-[13px] text-slate-500">Ular ilovaga kirgach shu yerda chiqadi.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rivals.map((v) => {
                  const on = rivalId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setRivalId(v.id)}
                      aria-pressed={on}
                      className={`${CARD} flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition ${on ? "outline outline-2 -outline-offset-2 outline-[#0e7490]" : ""}`}
                    >
                      {v.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white" style={{ background: ICON_GRADIENT }}>
                          {v.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-slate-800">{v.name}</span>
                      <Tick on={on} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── O'yin turi ── */}
        <section>
          <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">O&apos;yin turi</p>
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
                  className={`${CARD} relative flex flex-col items-start gap-2.5 p-4 text-left transition ${on ? "outline outline-2 -outline-offset-2 outline-[#0e7490]" : ""}`}
                >
                  {on && <span className="absolute right-3 top-3"><Tick on /></span>}
                  <Badge s={46}><Icon s={23} /></Badge>
                  <div>
                    <div className="text-[15.5px] font-extrabold leading-tight text-slate-900">{l.title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{l.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {err && <p className="px-1 text-[13.5px] font-semibold text-rose-600">{err}</p>}

        {/* ── Boshlash ── */}
        <div className="fixed inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md px-4">
          <div className="pointer-events-none absolute inset-x-0 -top-8 bottom-[-20px] bg-gradient-to-b from-transparent to-white/70" />
          <button
            type="button"
            onClick={startGame}
            disabled={!canStart}
            style={canStart ? { background: ICON_GRADIENT } : undefined}
            className="relative w-full rounded-2xl py-3.5 text-[17px] font-extrabold text-white shadow-[0_10px_24px_rgba(14,116,144,0.35)] transition active:translate-y-[2px] disabled:bg-slate-300 disabled:shadow-none"
          >
            {starting
              ? "…"
              : !enough
                ? "So'zlar yetarli emas"
                : mode === "duel" && !rivalId
                  ? "Raqibingizni tanlang"
                  : mode === "duel"
                    ? "Chaqiruv yuborish"
                    : "Jangni boshlang"}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════ NATIJA ═══════════
  if (view === "result") {
    const solo = mode === "ai";
    const win = me > ai;
    const draw = me === ai;
    const pct = rounds.length ? Math.round((me / rounds.length) * 100) : 0;

    return (
      <div className="space-y-4 pb-6">
        <div className={`${CARD} mt-6 p-6 text-center`}>
          <div className="text-[52px] leading-none">{solo ? (win ? "🏆" : draw ? "🤝" : "💪") : "📤"}</div>
          <div className="mt-3 text-[24px] font-extrabold text-slate-900">
            {solo ? (win ? "Siz yutdingiz!" : draw ? "Durrang" : "Keyingi safar!") : "Natijangiz yozildi"}
          </div>
          <div className="mt-1 text-[13px] text-slate-600">{LOBBIES.find((l) => l.key === lobby)?.title}</div>

          {solo ? (
            <div className="mt-5 flex items-center justify-center gap-7">
              <div>
                <div className="text-[13px] font-semibold text-slate-600">Siz</div>
                <div className="text-[34px] font-extrabold" style={{ color: TEAL }}>{me}</div>
              </div>
              <div className="text-[22px] font-bold text-slate-300">:</div>
              <div>
                <div className="text-[13px] font-semibold text-slate-600">AI</div>
                <div className="text-[34px] font-extrabold text-slate-600">{ai}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <div className="text-[40px] font-extrabold leading-none" style={{ color: TEAL }}>
                  {me}<span className="text-[22px] text-slate-500">/{rounds.length}</span>
                </div>
                <div className="mt-1 text-[13px] font-semibold text-slate-600">{pct}% to&apos;g&apos;ri</div>
              </div>
              <p className="mx-auto mt-4 max-w-[280px] text-[13px] leading-relaxed text-slate-500">
                {mode === "duel"
                  ? "Raqibingiz ham o'ynagach, natija bildirishnoma bo'lib keladi."
                  : "Guruhdoshlaringiz o'ynagach, kim oldinda ekani ko'rinadi."}
              </p>
            </>
          )}

          <div className="mt-6 flex gap-2.5">
            <button
              type="button"
              onClick={() => { setChallengeId(null); setView("setup"); }}
              className="flex-1 rounded-2xl border-2 border-slate-200 py-3 text-[15px] font-bold text-slate-600"
            >
              Orqaga
            </button>
            {solo && (
              <button
                type="button"
                onClick={() => begin(Math.floor(Math.random() * 1e9), null)}
                style={{ background: ICON_GRADIENT }}
                className="flex-[1.3] rounded-2xl py-3 text-[15px] font-extrabold text-white shadow-[0_8px_18px_rgba(14,116,144,0.3)]"
              >
                Yana o&apos;ynash
              </button>
            )}
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
          className="gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5.5 8.5 12l6.5 6.5" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-extrabold tracking-tight text-slate-900">
          {LOBBIES.find((l) => l.key === lobby)?.title}
        </h1>
        <span className="gl-glass rounded-full px-3 py-1.5 text-[14px] font-extrabold" style={{ color: TEAL }}>
          {me}
        </span>
        {mode === "ai" && (
          <span className="gl-glass flex items-center gap-1 rounded-full px-2.5 py-1.5">
            <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: "linear-gradient(135deg,#94a3b8,#64748b)" }}>
              <GlyphRobot s={14} />
            </span>
            <span className="text-[14px] font-extrabold text-slate-600">{ai}</span>
          </span>
        )}
      </div>

      {/* Jarayon — yo'lakcha shisha EMAS: ingichka element uchun backdrop-filter
          faqat GPU yeydi, shu sabab oddiy yarim tiniq oq to'ldirish. */}
      <div className="flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]">
          <div className="h-full rounded-full transition-all" style={{ width: `${((step + 1) / rounds.length) * 100}%`, background: ICON_GRADIENT }} />
        </div>
        <span className="text-[12px] font-bold text-slate-600">{step + 1}/{rounds.length}</span>
      </div>

      {/* Savol */}
      <div className={`${CARD} p-5`}>
        <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-500">{TASK_TITLE[lobby]}</div>

        {r?.options ? (
          <>
            <div className="mt-2 text-[22px] font-extrabold leading-snug text-slate-900">{r.prompt}</div>
            {r.sub && <p className="mt-0.5 text-[13.5px] text-slate-500">{r.sub}</p>}

            <div className={"mt-4 " + (lobby === "grammar" ? "grid grid-cols-3 gap-2.5" : "space-y-2.5")}>
              {r.options.map((opt) => {
                const isPicked = picked === opt;
                const isRight = picked && opt === target;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!!picked}
                    onClick={() => { setPicked(opt); nextRound(opt === target); }}
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-[16px] font-bold transition ${
                      lobby === "grammar" ? "text-center" : "text-left"
                    } ${
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
            <div className="mt-2 text-[15px] font-semibold text-slate-600">{r?.prompt}</div>

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
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
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
              className="mt-3 w-full rounded-2xl py-3 text-[15.5px] font-extrabold text-white transition disabled:bg-slate-300"
            >
              Tekshirish
            </button>
          </>
        )}
      </div>
    </div>
  );
}
