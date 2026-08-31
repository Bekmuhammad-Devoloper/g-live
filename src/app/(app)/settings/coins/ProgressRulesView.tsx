"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { saveProgressRules } from "./actions";

// Seriya (yulduzcha) va reyting — o'quvchi bosh sahifasidagi ikkinchi va
// uchinchi kartochka. Tanga qoidalaridan farqli: bular ball emas, o'lchov.

export type ProgressForm = {
  streakExcusedBreaks: boolean;
  streakStep: number;
  rankScope: string;
  rankBasis: string;
};

export default function ProgressRulesView({
  initial, locale, streakBonus,
}: {
  initial: ProgressForm;
  locale: Locale;
  /** Seriya to'lganda beriladigan tanga — Tanga qoidalaridan */
  streakBonus: number;
}) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [f, setF] = useState<ProgressForm>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof ProgressForm>(k: K, v: ProgressForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await saveProgressRules(f);
      if (r.error) setMsg({ ok: false, text: r.error });
      else setMsg({ ok: true, text: T("Saqlandi", "Сохранено", "Saved", "Gespeichert") });
    });
  };

  const SCOPES = [
    { v: "group", label: T("Guruh ichida", "Внутри группы", "Within the group", "In der Gruppe"), desc: T("Guruhdoshlari bilan", "С одногруппниками", "Against classmates", "Mit Gruppenmitgliedern") },
    { v: "branch", label: T("Filial bo'yicha", "По филиалу", "Across the branch", "Nach Filiale"), desc: T("Bitta filial o'quvchilari", "Ученики одного филиала", "Students of one branch", "Schüler einer Filiale") },
    { v: "center", label: T("Butun markaz", "Весь центр", "Whole centre", "Ganzes Zentrum"), desc: T("Barcha o'quvchilar", "Все ученики", "All students", "Alle Schüler") },
  ];

  const BASES = [
    { v: "attendance", label: T("Davomat", "Посещаемость", "Attendance", "Anwesenheit"), desc: T("Qatnashgan darslar soni", "Количество посещённых уроков", "Number of attended lessons", "Anzahl besuchter Lektionen") },
    { v: "coins", label: T("Tanga", "Монеты", "Coins", "Münzen"), desc: T("Yuqoridagi qoidalar bo'yicha yig'ilgan tanga", "Монеты по правилам выше", "Coins earned by the rules above", "Münzen nach den obigen Regeln") },
    { v: "score", label: T("O'rtacha ball", "Средний балл", "Average score", "Durchschnittsnote"), desc: T("Baholangan vazifalarning o'rtacha foizi", "Средний процент по проверенным заданиям", "Average percentage of graded tasks", "Durchschnitt der bewerteten Aufgaben") },
  ];

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
        {T("Seriya va reyting", "Серия и рейтинг", "Streak and rank", "Serie und Rangliste")}
      </h2>

      {/* ── Seriya ── */}
      <section className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/15">
            <Icon name="history" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
              {T("Seriya", "Серия", "Streak", "Serie")}
            </div>
            <p className="text-[13px] text-slate-500">
              {T(
                "Oxirgi darsdan orqaga qarab, uzluksiz qatnashgan darslar soni. Qoldirilgan dars seriyani noldan boshlaydi.",
                "Число уроков подряд без пропусков, считая от последнего. Пропуск обнуляет серию.",
                "Lessons attended in a row, counting back from the latest. A miss resets it to zero.",
                "Lektionen in Folge, rückwärts ab der letzten. Eine Fehlzeit setzt zurück.",
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-slate-50 px-3.5 py-3 dark:bg-slate-800/60">
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-slate-700 dark:text-slate-200">
                {T("Sababli qoldirish seriyani uzsin", "Уважительный пропуск обнуляет серию", "An excused absence breaks the streak", "Entschuldigtes Fehlen unterbricht die Serie")}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-slate-500">
                {f.streakExcusedBreaks
                  ? T("Hozir: sababli qoldirish ham seriyani noldan boshlaydi.", "Сейчас: уважительный пропуск тоже обнуляет серию.", "Now: an excused absence resets the streak too.", "Aktuell: Auch entschuldigtes Fehlen setzt zurück.")
                  : T("Hozir: sababli qoldirish o'tkazib yuboriladi — seriya uzilmaydi.", "Сейчас: уважительный пропуск пропускается — серия не рвётся.", "Now: an excused absence is skipped — the streak holds.", "Aktuell: Entschuldigtes Fehlen wird übersprungen.")}
              </span>
            </span>
            <input
              type="checkbox"
              checked={f.streakExcusedBreaks}
              onChange={(e) => set("streakExcusedBreaks", e.target.checked)}
              className="h-5 w-5 shrink-0 accent-brand-600"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3.5 py-3 dark:bg-slate-800/60">
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-slate-700 dark:text-slate-200">
                {T("Bonus har nechta darsda", "Бонус каждые N уроков", "Bonus every N lessons", "Bonus alle N Lektionen")}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-slate-500">
                {T(
                  `Seriya shu songa yetganda o'quvchiga ${streakBonus} tanga beriladi.`,
                  `Когда серия достигает этого числа, ученик получает ${streakBonus} монет.`,
                  `When the streak reaches this number the student gets ${streakBonus} coins.`,
                  `Erreicht die Serie diese Zahl, erhält der Schüler ${streakBonus} Münzen.`,
                )}
              </span>
            </span>
            <input
              type="number"
              min={2}
              max={100}
              value={f.streakStep}
              onChange={(e) => set("streakStep", Math.max(2, Math.min(100, Math.round(Number(e.target.value) || 2))))}
              className="h-10 w-[74px] shrink-0 rounded-lg border border-slate-200 bg-white text-center text-[15px] font-bold text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* ── Reyting ── */}
      <section className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/15">
            <Icon name="trophy" className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
              {T("Reyting", "Рейтинг", "Rank", "Rangliste")}
            </div>
            <p className="text-[13px] text-slate-500">
              {T(
                "O'quvchining o'rni. Teng natijalilar bir xil o'rinda turadi.",
                "Место ученика. Одинаковые результаты делят место.",
                "The student's place. Equal results share a place.",
                "Der Platz des Schülers. Gleiche Ergebnisse teilen sich den Platz.",
              )}
            </p>
          </div>
        </div>

        <Choice
          title={T("Kim bilan taqqoslanadi", "С кем сравнивается", "Compared against", "Verglichen mit")}
          options={SCOPES}
          value={f.rankScope}
          onPick={(v) => set("rankScope", v)}
        />
        <Choice
          title={T("Nima bo'yicha", "По какому показателю", "Ranked by", "Wonach")}
          options={BASES}
          value={f.rankBasis}
          onPick={(v) => set("rankBasis", v)}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "…" : T("Saqlash", "Сохранить", "Save", "Speichern")}
        </button>
        {dirty && !pending ? (
          <button type="button" onClick={() => { setF(initial); setMsg(null); }} className="h-11 rounded-xl px-4 text-sm font-semibold text-slate-500">
            {T("Bekor", "Отмена", "Cancel", "Abbrechen")}
          </button>
        ) : null}
        {msg ? <span className={cn("text-sm font-semibold", msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.text}</span> : null}
      </div>
    </div>
  );
}

function Choice({
  title, options, value, onPick,
}: {
  title: string;
  options: { v: string; label: string; desc: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onPick(o.v)}
            className={cn(
              "rounded-lg border-2 p-3 text-left transition",
              value === o.v
                ? "border-brand-500 bg-brand-50/60 dark:bg-brand-500/10"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700",
            )}
          >
            <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{o.label}</div>
            <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
