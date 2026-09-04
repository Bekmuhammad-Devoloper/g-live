"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CARD, NAVY, TEAL } from "../_ui";
import type { StudentStrings } from "../_i18n";
import { createNote } from "./actions";
import { NOTE_KINDS, kindColor, parseLinks } from "./parse";
import KindIcon from "./KindIcon";

// Yozuvlar ro'yxati: qidiruv, teg bo'yicha saralash va yangi yozuv qo'shish.

export interface VNote {
  id: string;
  title: string;
  content: string;
  kind: string;
  pinned: boolean;
  updatedAt: string; // ISO
  tags: string[];
}

function fmtShort(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Ro'yxatdagi qisqa ko'rinish uchun matnni belgilaridan tozalaydi. */
function preview(content: string) {
  return content
    .replace(/\[\[([^\][|]+?)(?:\|([^\][]*?))?\]\]/g, (_m, a, b) => (b || a))
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function NotesView({
  notes, tags, linkCount, t,
}: {
  notes: VNote[];
  tags: string[];
  linkCount: number;
  t: StudentStrings;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes.filter((n) => {
      if (tag && !n.tags.some((x) => x.toLowerCase() === tag.toLowerCase())) return false;
      if (!needle) return true;
      return n.title.toLowerCase().includes(needle) || n.content.toLowerCase().includes(needle);
    });
  }, [notes, q, tag]);

  const tiles = [
    { label: t.notes, value: String(notes.length) },
    { label: t.links, value: String(linkCount) },
    { label: t.allTags, value: String(tags.length) },
  ];

  return (
    <>
      {/* ── Yig'ma ko'rsatkichlar ── */}
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className={`${CARD} flex flex-col items-center gap-1.5 px-1 pb-4 pt-4`}>
            <span className="text-[22px] font-extrabold leading-none" style={{ color: NAVY }}>{x.value}</span>
            <span className="truncate text-[11.5px] font-medium text-slate-600">{x.label}</span>
          </div>
        ))}
      </div>

      {/* ── Birinchi marta: nima uchun kerakligini tushuntiramiz ── */}
      {notes.length === 0 && (
        <div className={`${CARD} px-5 py-5`}>
          <p className="text-[13.5px] leading-relaxed text-slate-600">{t.brainHint}</p>
        </div>
      )}

      {/* ── Qidiruv ── */}
      {notes.length > 0 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchNotes}
          className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-[16px] text-slate-800 shadow-[0_6px_16px_rgba(19,78,94,0.08)] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#0e7490]/40"
        />
      )}

      {/* ── Teglar ── */}
      {tags.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {tags.map((x) => {
            const on = tag?.toLowerCase() === x.toLowerCase();
            return (
              <button
                key={x}
                onClick={() => setTag(on ? null : x)}
                className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition"
                style={on ? { background: TEAL, color: "white" } : { background: "white", color: "#475569" }}
              >
                #{x}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Ro'yxat ── */}
      {shown.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
          <span className="text-3xl">🧠</span>
          <div className="text-[16px] font-extrabold text-slate-900">
            {notes.length === 0 ? t.noBrainNotes : t.nothingFound}
          </div>
          {notes.length === 0 && <p className="text-[13px] text-slate-600">{t.brainStart}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((n) => {
            const links = parseLinks(n.content).length;
            const text = preview(n.content);
            return (
              <Link key={n.id} href={`/student/gehirn/${n.id}`} className={`${CARD} flex items-start gap-3 p-4`}>
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
                  style={{ background: `${kindColor(n.kind)}1f` }}
                >
                  <KindIcon kind={n.kind} s={19} c={kindColor(n.kind)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {n.pinned && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={TEAL} className="shrink-0">
                        <path d="M14 3.5 20.5 10l-2.4.6-3 3 .5 4.6-2-2-3.9 3.9-1.4-1.4 3.9-3.9-2-2 4.6.5 3-3L14 3.5Z" />
                      </svg>
                    )}
                    <div className="truncate text-[14.5px] font-bold text-slate-800">{n.title}</div>
                  </div>
                  {text && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-slate-600">{text}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span>{fmtShort(n.updatedAt)}</span>
                    {links > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.3 1.3" />
                          <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" />
                        </svg>
                        {links}
                      </span>
                    )}
                    {n.tags.slice(0, 3).map((x) => (
                      <span key={x} className="rounded-full bg-white/60 px-1.5 py-0.5 font-semibold text-slate-600">#{x}</span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Yangi yozuv tugmasi ──
          Pastki menyu bilan bir xil usulda joylashtiriladi: butun kenglikdagi
          fixed qatlam + mx-auto max-w-md — shunda keng ekranda ham ustun
          chetiga tegib turadi, o'rtaga qochib ketmaydi. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(104px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-end px-4">
        <button
          onClick={() => setAdding(true)}
          aria-label={t.newNote}
          className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_10px_24px_rgba(14,116,144,0.45)] transition active:scale-95"
          style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5.5v13M5.5 12h13" />
          </svg>
        </button>
      </div>

      {adding && <NewNoteSheet t={t} onClose={() => setAdding(false)} onCreated={(id) => router.push(`/student/gehirn/${id}`)} />}
    </>
  );
}

// ───────────── Yangi yozuv oynasi (pastdan chiqadi) ─────────────

function NewNoteSheet({ t, onClose, onCreated }: { t: StudentStrings; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("NOTE");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const kindLabel: Record<string, string> = {
    NOTE: t.kindNOTE, IDEA: t.kindIDEA, GOAL: t.kindGOAL, BOOK: t.kindBOOK, PERSON: t.kindPERSON, DAILY: t.kindDAILY,
  };

  const submit = () => {
    if (!title.trim()) { setErr(t.emptyTitle); return; }
    setErr(null);
    start(async () => {
      try {
        const r = await createNote({ title, kind });
        if (r.error || !r.id) { setErr(r.error === "limit" ? t.noteLimit : t.saveFailed); return; }
        onCreated(r.id);
      } catch {
        setErr(t.saveFailed);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      {/* Oyna SHISHA emas — ostida ixtiyoriy matn turadi, fon quyuq qolsin */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-t-[26px] bg-white px-5 pb-7 pt-4 shadow-[0_-10px_30px_rgba(19,78,94,0.2)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        <div className="mb-3 text-[17px] font-extrabold text-slate-900">{t.newNote}</div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={t.noteTitle}
          className="w-full rounded-2xl border-0 bg-[#eef6fa] px-4 py-3 text-[15px] font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {NOTE_KINDS.map((k) => {
            const on = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition"
                style={on
                  ? { background: kindColor(k), color: "white" }
                  : { background: `${kindColor(k)}14`, color: kindColor(k) }}
              >
                <KindIcon kind={k} s={14} c={on ? "white" : kindColor(k)} />
                {kindLabel[k]}
              </button>
            );
          })}
        </div>

        {err && <p className="mt-2 text-[12.5px] font-semibold text-rose-600">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-2xl py-3 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)] transition active:scale-[.99] disabled:opacity-60"
            style={{ background: TEAL }}
          >
            {busy ? t.loading : t.createIt}
          </button>
          <button onClick={onClose} className="rounded-2xl bg-slate-100 px-5 py-3 text-[14px] font-bold text-slate-500">
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
