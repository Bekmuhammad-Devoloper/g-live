"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { ROADMAP, ALL_QUESTIONS, TARGET_MAX } from "./roadmap-data";
import { saveRoadmap } from "./actions";

const OPTS: { v: number; label: { uz: string; ru: string; en: string }; c: string }[] = [
  { v: 10, label: { uz: "Ha", ru: "Да", en: "Yes" }, c: "#10b981" },
  { v: 5, label: { uz: "Yarim", ru: "Частично", en: "Partly" }, c: "#f59e0b" },
  { v: 0, label: { uz: "Yo'q", ru: "Нет", en: "No" }, c: "#94a3b8" },
];

export default function RoadmapView({ locale, initialScores }: { locale: Locale; initialScores: Record<string, number> }) {
  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const maxSum = ALL_QUESTIONS.length * 10;
  const sum = useMemo(() => ALL_QUESTIONS.reduce((n, q) => n + (scores[q.id] ?? 0), 0), [scores]);
  const your = maxSum > 0 ? (sum / maxSum) * TARGET_MAX : 0;
  const pct = maxSum > 0 ? Math.round((sum / maxSum) * 100) : 0;
  const answered = ALL_QUESTIONS.filter((q) => scores[q.id] != null).length;

  const setScore = (id: string, v: number) => { setScores((s) => ({ ...s, [id]: v })); setDirty(true); setSaved(false); };
  const save = () => start(async () => { const r = await saveRoadmap(scores); if (r.ok) { setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2500); } });

  const sectionScore = (secQ: { id: string }[]) => {
    const smax = secQ.length * 10;
    const ssum = secQ.reduce((n, q) => n + (scores[q.id] ?? 0), 0);
    return smax > 0 ? Math.round((ssum / smax) * 100) : 0;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">Roadmap</h1>
          <p className="text-sm text-slate-400">{tr(locale, { uz: `Biznes yetukligini o'zini-o'zi baholash — ${answered}/${ALL_QUESTIONS.length} savol belgilangan`, ru: `Самооценка зрелости бизнеса — отмечено ${answered}/${ALL_QUESTIONS.length} вопросов`, en: `Business maturity self-assessment — ${answered}/${ALL_QUESTIONS.length} questions marked` })}</p>
        </div>
        <button onClick={save} disabled={pending || !dirty} className="flex h-10 items-center gap-1.5 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-50">
          <Icon name="check" className="h-4 w-4" /> {pending ? tr(locale, { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." }) : saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
        </button>
      </div>

      {/* Umumiy ball */}
      <div className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/70 shadow-card dark:border-blue-500/30 dark:bg-blue-500/10">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Umumiy ball", ru: "Общий балл", en: "Total score" })}</div>
          <div className="flex items-center gap-8">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Maximal ball", ru: "Максимальный балл", en: "Maximum score" })}</div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{TARGET_MAX}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{tr(locale, { uz: "Sizning ballingiz", ru: "Ваш балл", en: "Your score" })}</div>
              <div className="rounded-lg bg-amber-200/80 px-4 py-1 text-2xl font-extrabold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">{your.toFixed(1)}</div>
            </div>
            <div className="w-40">
              <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>{tr(locale, { uz: "Yetuklik", ru: "Зрелость", en: "Maturity" })}</span><span className="font-semibold">{pct}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/70 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
        </div>
        {/* Bo'limlar bo'yicha */}
        <div className="grid grid-cols-2 gap-px bg-blue-100 dark:bg-blue-500/20 sm:grid-cols-3 lg:grid-cols-6">
          {ROADMAP.map((s) => (
            <div key={s.key} className="bg-white p-2.5 text-center dark:bg-slate-900">
              <div className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400" title={tr(locale, s.title)}>{tr(locale, s.title)}</div>
              <div className="text-lg font-bold" style={{ color: s.hex }}>{sectionScore(s.questions)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200/70 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-white/[0.02]">
              <tr>
                <th className="w-10 px-2 py-3 text-center">{tr(locale, { uz: "Bo'lim", ru: "Раздел", en: "Section" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Savol", ru: "Вопрос", en: "Question" })}</th>
                <th className="w-[220px] px-4 py-3 text-center">{tr(locale, { uz: "Ball (maksimal 10)", ru: "Балл (максимум 10)", en: "Score (max 10)" })}</th>
                <th className="w-[160px] px-4 py-3">{tr(locale, { uz: "Natija", ru: "Результат", en: "Result" })}</th>
                <th className="px-4 py-3">{tr(locale, { uz: "Yo'riqnoma", ru: "Инструкция", en: "Guidance" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ROADMAP.map((sec) => sec.questions.map((q, i) => (
                <tr key={q.id} style={{ background: `${sec.hex}14` }}>
                  {i === 0 && (
                    <td rowSpan={sec.questions.length} className="px-1 py-2 align-middle text-center" style={{ background: `${sec.hex}38` }}>
                      <div className="mx-auto font-semibold text-slate-600 dark:text-slate-300" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: sec.hex }}>{tr(locale, sec.title)}</div>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{tr(locale, q.text)}</td>
                  <td className="px-4 py-2.5">
                    <div className="mx-auto flex w-fit overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                      {OPTS.map((o) => {
                        const active = scores[q.id] === o.v;
                        return (
                          <button key={o.v} onClick={() => setScore(q.id, o.v)} className={cn("px-3 py-1.5 text-xs font-semibold transition", active ? "text-white" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800")} style={active ? { background: o.c } : undefined}>
                            {tr(locale, o.label)}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5" style={{ background: `${sec.hex}22` }}>
                    {scores[q.id] != null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/70 dark:bg-slate-800"><div className="h-full rounded-full" style={{ width: `${(scores[q.id] / 10) * 100}%`, background: sec.hex }} /></div>
                        <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{scores[q.id]}/10</span>
                      </div>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{q.hint ? tr(locale, q.hint) : ""}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">{tr(locale, { uz: `Har bir savol 0–10 ball. Umumiy ball ${TARGET_MAX} ballik shkalaga keltiriladi. O'zgartirishlardan so'ng`, ru: `Каждый вопрос — 0–10 баллов. Общий балл приводится к шкале из ${TARGET_MAX} баллов. После изменений нажмите`, en: `Each question is 0–10 points. The total is normalized to a ${TARGET_MAX}-point scale. After changes, click` })} <b>{tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}</b>{tr(locale, { uz: "ni bosing.", ru: ".", en: "." })}</p>
    </div>
  );
}
