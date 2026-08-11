"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { gradeSubmission, submitAssignment } from "../actions";

export function GradeControl({
  submissionId,
  maxScore,
  currentScore,
  currentNote,
  locale,
}: {
  submissionId: string;
  maxScore: number;
  currentScore: number | null;
  currentNote: string | null;
  locale: Locale;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [score, setScore] = useState(currentScore?.toString() ?? "");
  const [note, setNote] = useState(currentNote ?? "");
  const [err, setErr] = useState<string | null>(null);

  const low = score !== "" && Number(score) < maxScore * 0.6;

  return (
    <div className="flex flex-wrap items-start gap-2">
      <input
        type="number"
        min="0"
        max={maxScore}
        value={score}
        onChange={(e) => setScore(e.target.value)}
        placeholder={tr(locale, { uz: "ball", ru: "балл", en: "score" })}
        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <span className="pt-1.5 text-xs text-slate-400">/ {maxScore}</span>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={low ? tr(locale, { uz: "Izoh (past baho — majburiy)", ru: "Комментарий (низкая оценка — обязательно)", en: "Note (low score — required)" }) : tr(locale, { uz: "Izoh", ru: "Комментарий", en: "Note" })}
        className={`min-w-[160px] flex-1 rounded border px-2 py-1 text-sm ${low && !note ? "border-red-300" : "border-slate-300"}`}
      />
      <button
        disabled={pending || score === ""}
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await gradeSubmission(submissionId, Number(score), note);
            if (r.error === "note_required") setErr(tr(locale, { uz: "Past baho uchun izoh majburiy", ru: "Для низкой оценки комментарий обязателен", en: "A note is required for a low score" }));
            else router.refresh();
          })
        }
        className="rounded bg-brand-600 px-3 py-1 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "..." : tr(locale, { uz: "Baholash", ru: "Оценить", en: "Grade" })}
      </button>
      {err && <span className="w-full text-xs text-red-600">{err}</span>}
    </div>
  );
}

export function SubmitForm({ assignmentId, locale }: { assignmentId: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [content, setContent] = useState("");

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder={tr(locale, { uz: "Javobingizni yozing...", ru: "Напишите ваш ответ...", en: "Write your answer..." })}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      <button
        disabled={pending || content.trim().length < 1}
        onClick={() => start(async () => { await submitAssignment(assignmentId, content); setContent(""); router.refresh(); })}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "..." : tr(locale, { uz: "Topshirish", ru: "Сдать", en: "Submit" })}
      </button>
    </div>
  );
}
