"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CARD, TEAL, PageHeader } from "../../_ui";
import type { StudentStrings } from "../../_i18n";
import { NOTE_KINDS, kindColor } from "../parse";
import KindIcon from "../KindIcon";
import NoteText from "../NoteText";
import { deleteNote, updateNote } from "../actions";

// Yozuv sahifasi: ko'rish va tahrirlash bitta joyda (mobil uchun qulayroq).

export interface LinkRef {
  id: string | null; // null — hali yaratilmagan yozuv
  title: string;
  kind: string;
}

export interface VNoteFull {
  id: string;
  title: string;
  content: string;
  kind: string;
  tags: string;
  pinned: boolean;
  updatedAt: string;
  shownTags: string[];
}

export default function NoteDetail({
  t, note, ids, outgoing, incoming,
}: {
  t: StudentStrings;
  note: VNoteFull;
  ids: Record<string, string>;
  outgoing: LinkRef[];
  incoming: LinkRef[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [kind, setKind] = useState(note.kind);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, start] = useTransition();

  const kindLabel: Record<string, string> = {
    NOTE: t.kindNOTE, IDEA: t.kindIDEA, GOAL: t.kindGOAL, BOOK: t.kindBOOK, PERSON: t.kindPERSON, DAILY: t.kindDAILY,
  };

  const save = () => {
    if (!title.trim()) { setErr(t.emptyTitle); return; }
    setErr(null);
    start(async () => {
      try {
        const r = await updateNote(note.id, { title, content, kind });
        if (r.error) { setErr(r.error === "title_taken" ? t.titleTaken : t.saveFailed); return; }
        setEdit(false);
        router.refresh();
      } catch {
        setErr(t.saveFailed);
      }
    });
  };

  const togglePin = () => start(async () => {
    await updateNote(note.id, { pinned: !note.pinned });
    router.refresh();
  });

  const remove = () => start(async () => {
    const r = await deleteNote(note.id);
    if (r.ok) router.push("/student/gehirn");
  });

  return (
    <div className="space-y-[18px]">
      <PageHeader
        title={edit ? t.noteText : note.title}
        subtitle={kindLabel[note.kind] ?? t.kindNOTE}
        back="/student/gehirn"
        right={
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={togglePin}
              aria-label={t.pin}
              title={t.pin}
              className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={note.pinned ? TEAL : "none"} stroke={TEAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3.5 20.5 10l-2.4.6-3 3 .5 4.6-2-2-3.9 3.9-1.4-1.4 3.9-3.9-2-2 4.6.5 3-3L14 3.5Z" />
              </svg>
            </button>
            <button
              onClick={() => { setEdit(!edit); setErr(null); }}
              aria-label={t.save}
              className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]"
            >
              {edit ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20.2h4.2L19 9.4a2.1 2.1 0 0 0 0-3l-1.4-1.4a2.1 2.1 0 0 0-3 0L3.8 15.8V20Z" />
                  <path d="M13.8 6.2 17.8 10.2" />
                </svg>
              )}
            </button>
          </div>
        }
      />

      {edit ? (
        /* ── Tahrirlash ── */
        <div className={`${CARD} space-y-3 p-5`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.noteTitle}
            className="w-full rounded-2xl border-0 bg-[#eef6fa] px-4 py-3 text-[15px] font-semibold text-slate-800 outline-none"
          />

          <div className="flex flex-wrap gap-2">
            {NOTE_KINDS.map((k) => {
              const on = kind === k;
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition"
                  style={on ? { background: kindColor(k), color: "white" } : { background: `${kindColor(k)}14`, color: kindColor(k) }}
                >
                  <KindIcon kind={k} s={14} c={on ? "white" : kindColor(k)} />
                  {kindLabel[k]}
                </button>
              );
            })}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            placeholder={t.brainHint}
            className="w-full resize-y rounded-2xl border-0 bg-[#eef6fa] px-4 py-3 font-mono text-[13.5px] leading-relaxed text-slate-800 outline-none placeholder:font-sans placeholder:text-slate-400"
          />

          {/* Sintaksis eslatmasi */}
          <p className="text-[11.5px] leading-relaxed text-slate-400">
            <code className="rounded bg-slate-100 px-1">[[Sarlavha]]</code> · <code className="rounded bg-slate-100 px-1">#teg</code> ·{" "}
            <code className="rounded bg-slate-100 px-1"># bo&apos;lim</code> · <code className="rounded bg-slate-100 px-1">- ro&apos;yxat</code> ·{" "}
            <code className="rounded bg-slate-100 px-1">- [ ] belgi</code>
          </p>

          {err && <p className="text-[12.5px] font-semibold text-rose-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-2xl py-3 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)] transition active:scale-[.99] disabled:opacity-60"
              style={{ background: TEAL }}
            >
              {busy ? t.loading : t.save}
            </button>
            <button
              onClick={() => { setEdit(false); setTitle(note.title); setContent(note.content); setKind(note.kind); setErr(null); }}
              className="rounded-2xl bg-slate-100 px-5 py-3 text-[14px] font-bold text-slate-500"
            >
              {t.cancel}
            </button>
          </div>

          {/* O'chirish */}
          <div className="border-t border-slate-100 pt-3">
            {confirmDel ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[13px] font-semibold text-rose-600">{t.deleteConfirm}</span>
                <button onClick={remove} disabled={busy} className="rounded-xl bg-rose-600 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
                  {t.deleteNote}
                </button>
                <button onClick={() => setConfirmDel(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-[13px] font-bold text-slate-500">
                  {t.cancel}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="text-[13px] font-semibold text-rose-500">
                {t.deleteNote}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Ko'rish ── */}
          <div className={`${CARD} p-5`}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                style={{ background: `${kindColor(note.kind)}1a`, color: kindColor(note.kind) }}
              >
                <KindIcon kind={note.kind} s={13} c={kindColor(note.kind)} />
                {kindLabel[note.kind] ?? t.kindNOTE}
              </span>
              {note.shownTags.map((x) => (
                <span key={x} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-500">#{x}</span>
              ))}
            </div>
            <h1 className="mb-2 text-[19px] font-extrabold leading-tight text-slate-900">{note.title}</h1>
            <NoteText content={note.content} ids={ids} empty={t.brainStart} />
          </div>

          {/* ── Bu yozuvdagi havolalar ── */}
          {outgoing.length > 0 && <LinkList title={t.outlinks} items={outgoing} t={t} />}

          {/* ── Bu yozuvga havolalar (backlinks) ── */}
          {incoming.length > 0 && <LinkList title={t.backlinks} items={incoming} t={t} />}
        </>
      )}
    </div>
  );
}

// ───────────── Havolalar ro'yxati ─────────────

function LinkList({ title, items, t }: { title: string; items: LinkRef[]; t: StudentStrings }) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <div>
      <div className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: TEAL }}>{title}</div>
      <div className={`${CARD} divide-y divide-slate-100 px-5 py-1`}>
        {items.map((l, i) => {
          const inner = (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl" style={{ background: `${kindColor(l.kind)}1a` }}>
                <KindIcon kind={l.kind} s={17} c={l.id ? kindColor(l.kind) : "#94a3b8"} />
              </span>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[13.5px] font-semibold ${l.id ? "text-slate-800" : "text-slate-400"}`}>{l.title}</div>
                {!l.id && <div className="text-[11px] text-slate-400">{t.notCreatedYet}</div>}
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            </>
          );
          return l.id ? (
            <Link key={l.id} href={`/student/gehirn/${l.id}`} className="flex items-center gap-3 py-3">{inner}</Link>
          ) : (
            <button
              key={`missing-${i}`}
              onClick={() => start(async () => {
                const { createFromLink } = await import("../actions");
                const r = await createFromLink(l.title);
                if (r.id) router.push(`/student/gehirn/${r.id}`);
              })}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
