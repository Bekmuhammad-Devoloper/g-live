"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { Icon } from "../../_components/Icon";
import { savePointRules } from "./actions";

// Tanga qoidalari — nima uchun necha tanga beriladi.

export type RuleRow = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  /** Qoida tizimda avtomatik ishlaydimi yoki hali kuzatilmaydimi */
  auto: boolean;
  value: number;
  /** Hozirgacha shu qoida bo'yicha berilgan umumiy tanga */
  issued: number;
  /** Nechta hodisa sanalgan (dars, vazifa, o'yin ...) */
  events: number;
};

export default function CoinRulesView({
  kind, rows, locale, stats, unit,
}: {
  /** "coin" — sarflanadigan tanga, "star" — yig'iladigan yulduz */
  kind: "coin" | "star";
  rows: RuleRow[];
  locale: Locale;
  stats: { earned: number; spent: number; balance: number; students: number };
  /** Ball nomi — "tanga" yoki "yulduz" */
  unit: string;
}) {
  const T = (uz: string, ru: string, en: string, de: string) => tr(locale, { uz, ru, en, de });
  const [vals, setVals] = useState<Record<string, number>>(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const dirty = rows.some((r) => vals[r.key] !== r.value);

  const save = () => {
    setMsg(null);
    start(async () => {
      const res = await savePointRules(kind, vals);
      if (res.error) setMsg({ ok: false, text: res.error });
      else setMsg({ ok: true, text: T("Saqlandi", "Сохранено", "Saved", "Gespeichert") });
    });
  };

  const nf = new Intl.NumberFormat("ru-RU");

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
        {kind === "coin"
          ? T(
              "Tanga Market'da sovg'aga almashtiriladi. Alohida saqlanmaydi — har safar shu qoidalar bo'yicha qayta hisoblanadi, ya'ni qiymatni o'zgartirsangiz barcha o'quvchining balansi darhol yangilanadi.",
              "Монеты обмениваются на призы в Маркете. Не хранятся отдельно — пересчитываются по этим правилам, поэтому изменение сразу меняет баланс всех учеников.",
              "Coins are exchanged for rewards in the Market. They are not stored — they are recomputed from these rules, so a change updates every balance instantly.",
              "Münzen werden im Markt gegen Preise getauscht. Sie werden nicht gespeichert, sondern neu berechnet — eine Änderung wirkt sofort.",
            )
          : T(
              "Yulduz sarflanmaydi — u o'quvchining umumiy yutug'i bo'lib yig'ilib boradi. Tanga bilan bir xil hodisalardan beriladi, faqat miqdori boshqa.",
              "Звёзды не тратятся — это общий счёт достижений ученика. Начисляются за те же события, что и монеты, но в другом размере.",
              "Stars are never spent — they are the student's lifetime achievement score. Awarded for the same events as coins, in different amounts.",
              "Sterne werden nie ausgegeben — sie sind der Gesamterfolg des Schülers. Für dieselben Ereignisse wie Münzen, aber in anderer Höhe.",
            )}
      </div>

      {/* ── Umumiy holat ── */}
      <div className={cn("grid gap-3", kind === "coin" ? "sm:grid-cols-4" : "sm:grid-cols-2")}>
        <Stat label={T("O'quvchilar", "Ученики", "Students", "Schüler")} value={nf.format(stats.students)} icon="users" tone="text-slate-500" />
        <Stat label={T("Yig'ilgan", "Начислено", "Earned", "Verdient")} value={nf.format(stats.earned)} icon={kind === "coin" ? "coins" : "trophy"} tone={kind === "coin" ? "text-emerald-500" : "text-amber-500"} />
        {kind === "coin" ? (
          <>
            <Stat label={T("Sarflangan", "Потрачено", "Spent", "Ausgegeben")} value={nf.format(stats.spent)} icon="card" tone="text-violet-500" />
            <Stat label={T("Qoldiq", "Остаток", "Balance", "Guthaben")} value={nf.format(stats.balance)} icon="wallet" tone="text-brand-500" />
          </>
        ) : null}
      </div>

      {/* ── Qoidalar ── */}
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex flex-wrap items-center gap-3.5 rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
          >
            <span className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
              r.auto ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                     : "bg-slate-100 text-slate-400 dark:bg-slate-800",
            )}>
              <Icon name={r.icon} className="h-5 w-5" />
            </span>

            <div className="min-w-[180px] flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{r.title}</span>
                {!r.auto && (
                  <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10.5px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {T("kuzatilmaydi", "не отслеживается", "not tracked", "nicht erfasst")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{r.desc}</p>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {nf.format(r.events)} {T("marta", "раз", "times", "mal")} · {nf.format(r.issued)} {unit} {T("berilgan", "начислено", "issued", "vergeben")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="−"
                onClick={() => setVals((v) => ({ ...v, [r.key]: Math.max(0, (v[r.key] ?? 0) - 1) }))}
                className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-lg font-bold text-slate-500 dark:bg-slate-800"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                max={1000}
                value={vals[r.key] ?? 0}
                onChange={(e) => setVals((v) => ({ ...v, [r.key]: Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))) }))}
                className="h-10 w-[74px] rounded-lg border border-slate-200 bg-white text-center text-[15px] font-bold text-slate-800 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                aria-label="+"
                onClick={() => setVals((v) => ({ ...v, [r.key]: Math.min(1000, (v[r.key] ?? 0) + 1) }))}
                className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-lg font-bold text-slate-500 dark:bg-slate-800"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

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
          <button
            type="button"
            onClick={() => { setVals(Object.fromEntries(rows.map((r) => [r.key, r.value]))); setMsg(null); }}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-slate-500"
          >
            {T("Bekor", "Отмена", "Cancel", "Abbrechen")}
          </button>
        ) : null}
        {msg ? (
          <span className={cn("text-sm font-semibold", msg.ok ? "text-emerald-600" : "text-rose-600")}>{msg.text}</span>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon name={icon} className={cn("h-4 w-4", tone)} />
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <div className="mt-1 text-[22px] font-bold text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );
}
