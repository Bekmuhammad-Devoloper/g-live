"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAssignment } from "../../../../(app)/homework/actions";

// Dars vazifasi — muddat, shart, biriktirilgan fayl, o'quvchining
// jo'natmalari va o'qituvchining izohi. Ketma-ketlik maketdagidek:
// muddat → vazifa → mening jo'natmalarim → o'qituvchi izohi.

export type VSub = {
  id: string;
  attempt: number;
  content: string | null;
  fileUrl: string | null;
  score: number | null;
  status: string;
  teacherNote: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
  createdAt: string;
};

export type VTask = {
  id: string;
  title: string;
  type: string;
  maxScore: number;
  dueAt: string | null;
  note: string | null;
  createdAt: string;
  subs: VSub[];
  /** Guruhda shu vazifani topshirganlar soni */
  passed: number;
};

const dt = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const fileName = (u: string) => decodeURIComponent(u.split("/").pop() ?? "fayl");

function IcoAlert({ s = 17 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.4v.2" />
    </svg>
  );
}
function IcoFile({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z" />
      <path d="M13.5 3.5v5h5" />
    </svg>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  GRADED: { label: "Vazifa qabul qilindi", cls: "text-emerald-600" },
  RETURNED: { label: "Qayta ishlash kerak", cls: "text-amber-600" },
  SUBMITTED: { label: "Tekshirilmoqda", cls: "text-slate-400" },
};

export default function LessonTasks({ tasks }: { tasks: VTask[] }) {
  if (tasks.length === 0) return null;

  const totalScore = tasks.reduce((n, t) => n + (t.subs.find((s) => s.score !== null)?.score ?? 0), 0);
  const hasScore = tasks.some((t) => t.subs.some((s) => s.score !== null));

  return (
    <section className="overflow-hidden rounded-[26px] bg-white shadow-[0_16px_38px_-22px_rgba(15,60,80,0.55)] ring-1 ring-slate-900/[0.04]">
      {/* Sarlavha qatori — chapda bo'lim nomi, o'ngda ball */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 pt-3.5">
        <span className="border-b-2 border-[#c08a4a] pb-2.5 text-[15px] font-bold text-[#a5713a]">Vazifalar</span>
        {hasScore && <span className="pb-2.5 text-[14px] font-bold text-[#a5713a]">Ball: {totalScore}</span>}
      </div>

      <div className="space-y-3 p-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}

function TaskCard({ task }: { task: VTask }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const graded = task.subs.find((s) => s.status === "GRADED" || s.teacherNote);
  const overdue = task.dueAt ? new Date(task.dueAt) < new Date() : false;

  const upload = async (f: File) => {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error();
      setFileUrl(j.url);
    } catch {
      setErr("Faylni yuklab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (!text.trim() && !fileUrl) return;
    setErr(null);
    start(async () => {
      const r = await submitAssignment(task.id, text, fileUrl);
      if (r.error) setErr(r.error === "invalid" ? "Matn yoki fayl qo'shing" : "Yuborib bo'lmadi");
      else {
        setText("");
        setFileUrl(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3 rounded-[20px] bg-[#faf6f2] p-3">
      {/* ── Muddat ── */}
      {task.dueAt && (
        <div
          className={
            "flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-white " +
            (overdue ? "bg-[#e8442a]" : "bg-[#0e7490]")
          }
        >
          <span className="mt-[1px] shrink-0"><IcoAlert /></span>
          <div className="text-[14px] font-bold leading-snug">
            {task.type === "EXAM" ? "Imtihon muddati:" : "Topshirish muddati:"}
            <br />
            {dt(task.dueAt)}
          </div>
        </div>
      )}

      {/* ── Vazifa ── */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[16.5px] font-bold text-slate-800">{task.title}</h3>
          <span className="text-[13px] text-slate-500">Maks. ball: {task.maxScore}</span>
        </div>
        {task.note && <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-slate-500">{task.note}</p>}
        <div className="mt-2 text-right text-[12px] text-slate-400">{dt(task.createdAt)}</div>
      </div>

      {/* ── Mening jo'natmalarim ── */}
      <div className="rounded-2xl bg-white p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[15px] font-bold text-slate-800">Mening jo&apos;natmalarim</h4>
          <span className="text-[12.5px] text-slate-500">Fayllar soni: {task.subs.filter((s) => s.fileUrl).length}</span>
        </div>

        {task.subs.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-slate-400">Hali hech narsa yuborilmagan.</p>
        ) : (
          <div className="mt-2.5 space-y-2.5">
            {task.subs.map((s) => (
              <div key={s.id} className="rounded-xl bg-slate-50 p-2.5">
                {s.fileUrl && (
                  <a
                    href={s.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2.5 shadow-sm"
                  >
                    <span className="text-slate-400"><IcoFile /></span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-slate-700">{fileName(s.fileUrl)}</span>
                  </a>
                )}
                {s.content && (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-600">{s.content}</p>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className={"text-[12px] font-semibold " + (STATUS[s.status]?.cls ?? "text-slate-400")}>
                    {STATUS[s.status]?.label ?? s.status}
                    {s.score !== null ? ` · ${s.score}/${task.maxScore}` : ""}
                  </span>
                  <span className="text-[11.5px] text-slate-400">{dt(s.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Yuborish ── */}
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 4000))}
            rows={2}
            placeholder="Javobingiz yoki havola (masalan github.com/...)"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-800 outline-none focus:border-[#0e7490]"
          />

          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2.5 text-[13px] font-bold text-slate-600 disabled:opacity-50"
            >
              <IcoFile s={15} />
              {busy ? "…" : fileUrl ? "Fayl tanlandi" : "Fayl qo'shish"}
            </button>
            {fileUrl && (
              <button type="button" onClick={() => setFileUrl(null)} className="rounded-xl bg-rose-50 px-3 py-2.5 text-[13px] font-bold text-rose-600">
                Olib tashlash
              </button>
            )}
            <button
              type="button"
              onClick={send}
              disabled={pending || (!text.trim() && !fileUrl)}
              className="ml-auto rounded-xl bg-[#0e7490] px-5 py-2.5 text-[13.5px] font-bold text-white disabled:bg-slate-300"
            >
              {pending ? "…" : "Yuborish"}
            </button>
          </div>

          {err && <p className="text-[12.5px] font-semibold text-rose-600">{err}</p>}
        </div>
      </div>

      {/* ── O'qituvchi izohi ── */}
      {graded && (
        <div className="rounded-2xl bg-white p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[15px] font-bold text-slate-800">O&apos;qituvchi izohi</h4>
            <span className={"text-[13px] font-bold " + (STATUS[graded.status]?.cls ?? "text-slate-400")}>
              {STATUS[graded.status]?.label ?? graded.status}
            </span>
          </div>

          {graded.teacherNote && (
            <p className="mt-2.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-slate-600">{graded.teacherNote}</p>
          )}

          {graded.score !== null && (
            <div className="mt-2.5 inline-block rounded-lg bg-emerald-50 px-2.5 py-1 text-[13px] font-bold text-emerald-700">
              {graded.score} / {task.maxScore}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            {graded.gradedBy && <span className="text-[12.5px] text-slate-500">Tekshiruvchi: {graded.gradedBy}</span>}
            {graded.gradedAt && <span className="text-[11.5px] text-slate-400">{dt(graded.gradedAt)}</span>}
          </div>
        </div>
      )}

      {task.passed > 0 && (
        <div className="text-[13px] font-semibold text-emerald-600">O&apos;tganlar: {task.passed} nafar</div>
      )}
    </div>
  );
}
