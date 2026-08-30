"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEAL } from "../_ui";
import { linkKey } from "./parse";
import { createFromLink } from "./actions";

// Yozuv matnini ko'rsatish. Obsidian sintaksisining kerakli qismi:
//   # sarlavha · - ro'yxat · - [ ] belgilash · > iqtibos
//   [[Havola]] / [[Havola|matn]] · #teg · **qalin**
// Havola mavjud yozuvga bo'lsa — bosiladi; yo'q bo'lsa — yaratish taklif etiladi.

const INLINE = /(\[\[[^\][]+?\]\])|(\*\*[^*]+\*\*)|((?:^|\s)#[\p{L}\p{N}_-]{2,32})/gu;

function Inline({ text, ids, onTag }: { text: string; ids: Record<string, string>; onTag?: (t: string) => void }) {
  const router = useRouter();
  const [, start] = useTransition();
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE.source, INLINE.flags);
  let k = 0;

  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    last = m.index + m[0].length;

    if (m[1]) {
      // [[Havola]] yoki [[Havola|ko'rinadigan matn]]
      const inner = m[1].slice(2, -2);
      const [rawTitle, alias] = inner.split("|");
      const title = rawTitle.trim();
      const shown = (alias ?? rawTitle).trim();
      const id = ids[linkKey(title)];
      out.push(
        id ? (
          <Link
            key={k++}
            href={`/student/gehirn/${id}`}
            className="rounded px-0.5 font-semibold underline decoration-dotted underline-offset-2"
            style={{ color: TEAL }}
          >
            {shown}
          </Link>
        ) : (
          <button
            key={k++}
            onClick={() => start(async () => {
              const r = await createFromLink(title);
              if (r.id) router.push(`/student/gehirn/${r.id}`);
            })}
            className="rounded px-0.5 font-semibold text-slate-400 underline decoration-dashed underline-offset-2"
            title={title}
          >
            {shown}
          </button>
        ),
      );
    } else if (m[2]) {
      out.push(<b key={k++} className="font-bold text-slate-900">{m[2].slice(2, -2)}</b>);
    } else if (m[3]) {
      const lead = m[3].startsWith("#") ? "" : m[3][0];
      const tag = m[3].trim().slice(1);
      if (lead) out.push(lead);
      out.push(
        <button
          key={k++}
          onClick={() => onTag?.(tag)}
          className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[12px] font-semibold text-slate-500"
        >
          #{tag}
        </button>,
      );
    }
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export default function NoteText({
  content, ids, empty,
}: {
  content: string;
  ids: Record<string, string>;
  empty: string;
}) {
  const lines = content.split("\n");
  if (!content.trim()) return <p className="py-2 text-[13.5px] italic text-slate-400">{empty}</p>;

  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (!trimmed) { out.push(<div key={i} className="h-2.5" />); return; }

    // Sarlavhalar
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      const size = h[1].length === 1 ? "text-[17px]" : h[1].length === 2 ? "text-[15.5px]" : "text-[14px]";
      out.push(
        <div key={i} className={`mt-2 font-extrabold text-slate-900 ${size}`}>
          <Inline text={h[2]} ids={ids} />
        </div>,
      );
      return;
    }

    // Belgilanadigan ro'yxat: - [ ] / - [x]
    const c = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(trimmed);
    if (c) {
      const done = c[1].toLowerCase() === "x";
      out.push(
        <div key={i} className="flex items-start gap-2 py-0.5">
          <span
            className="mt-[3px] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] border-2"
            style={done ? { background: TEAL, borderColor: TEAL } : { borderColor: "#cbd5e1" }}
          >
            {done && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            )}
          </span>
          <span className={done ? "text-[13.5px] leading-relaxed text-slate-400 line-through" : "text-[13.5px] leading-relaxed text-slate-700"}>
            <Inline text={c[2]} ids={ids} />
          </span>
        </div>,
      );
      return;
    }

    // Oddiy ro'yxat
    const b = /^[-*]\s+(.*)$/.exec(trimmed);
    if (b) {
      out.push(
        <div key={i} className="flex items-start gap-2 py-0.5">
          <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TEAL }} />
          <span className="text-[13.5px] leading-relaxed text-slate-700"><Inline text={b[1]} ids={ids} /></span>
        </div>,
      );
      return;
    }

    // Iqtibos
    const q = /^>\s?(.*)$/.exec(trimmed);
    if (q) {
      out.push(
        <div key={i} className="my-1 border-l-[3px] pl-3 text-[13.5px] italic leading-relaxed text-slate-500" style={{ borderColor: `${TEAL}55` }}>
          <Inline text={q[1]} ids={ids} />
        </div>,
      );
      return;
    }

    out.push(
      <p key={i} className="text-[13.5px] leading-relaxed text-slate-700">
        <Inline text={line} ids={ids} />
      </p>,
    );
  });

  return <div>{out}</div>;
}
