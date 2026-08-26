"use client";

import { useState, useTransition } from "react";
import { tr } from "@/lib/tr";
import { formatMoney, type Locale } from "@/lib/constants";
import { Icon } from "../_components/Icon";
import { saveDefaultMonthlyFee } from "./actions";

const fmtDigits = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * Qarzdorlik sozlamalari — markazning umumiy oylik to'lovi.
 * O'quvchi tizimga qo'shilgan oydan boshlab qarz avtomatik hisoblanadi;
 * guruhda bo'lmagan oylar uchun aynan shu summa olinadi.
 */
export default function DebtSettings({ locale, defaultFee }: { locale: Locale; defaultFee: number }) {
  const [value, setValue] = useState(defaultFee ? String(defaultFee) : "");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const L = (uz: string, ru: string, en: string) => tr(locale, { uz, ru, en });

  const save = () => start(async () => {
    setErr(null);
    const r = await saveDefaultMonthlyFee(Number(value || 0));
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2200); }
    else setErr(r.error === "forbidden"
      ? L("Saqlanmadi — bu sozlama faqat direktor va o'rinbosariga.", "Не сохранено — только директор и заместитель.", "Not saved — director and deputy only.")
      : L("Saqlanmadi.", "Не сохранено.", "Not saved."));
  });

  const input = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100";

  return (
    <div className="max-w-xl">
      <h2 className="mb-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
        {L("Qarzdorlik", "Задолженность", "Debt")}
      </h2>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        {L(
          "O'quvchi tizimga qo'shilgan oydan boshlab qarz avtomatik hisoblanadi.",
          "Долг начисляется автоматически с месяца добавления ученика в систему.",
          "Debt accrues automatically from the month the student is added to the system.",
        )}
      </p>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          {L("Umumiy oylik to'lov (so'm)", "Общая ежемесячная оплата (сум)", "Default monthly fee (UZS)")}
        </label>
        <div className="relative">
          <input
            value={value ? fmtDigits(value) : ""}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 12))}
            inputMode="numeric"
            placeholder="0"
            className={`${input} pr-12 tabular-nums`}
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">so&apos;m</span>
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {L(
              "Bu summa o'quvchi hech qaysi guruhda bo'lmagan oylar uchun ishlatiladi. Guruhda bo'lsa — guruh narxi, u bo'lmasa kurs narxi olinadi. 0 qo'yilsa, guruhsiz oylar hisoblanmaydi.",
              "Эта сумма применяется за месяцы, когда ученик не состоит ни в одной группе. Если состоит — берётся цена группы, иначе цена курса. При 0 месяцы без группы не начисляются.",
              "Used for months when the student is in no group. Otherwise the group price applies, else the course price. Set 0 to skip group-less months.",
            )}
          </span>
        </div>

        {value && Number(value) > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {L("Yiliga", "В год", "Per year")}: <b className="text-slate-600 dark:text-slate-300">{formatMoney(Number(value) * 12, locale)}</b>
          </p>
        )}

        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{err}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? L("Saqlanmoqda...", "Сохранение...", "Saving...") : L("Saqlash", "Сохранить", "Save")}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Icon name="check" className="h-4 w-4" /> {L("Saqlandi", "Сохранено", "Saved")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
