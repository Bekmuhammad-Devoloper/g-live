"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import { listPromoOptions } from "../students/actions";

type Opt = { code: string; discount: number; minCourses: number | null; note: string | null };

const money = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

/** To'lov formalaridagi promokod tanlovi. `name` berilsa oddiy form maydoni sifatida ham ishlaydi. */
export default function PromoSelect({ locale, value, onChange, name, className }: {
  locale: Locale;
  value?: string;
  onChange?: (code: string) => void;
  name?: string;
  className?: string;
}) {
  const [opts, setOpts] = useState<Opt[] | null>(null);
  const [inner, setInner] = useState("");
  const cur = value ?? inner;

  useEffect(() => {
    let alive = true;
    listPromoOptions().then((o) => { if (alive) setOpts(o); }).catch(() => { if (alive) setOpts([]); });
    return () => { alive = false; };
  }, []);

  if (opts && opts.length === 0) return null; // kod yo'q — maydon ko'rsatilmaydi
  const sel = opts?.find((o) => o.code === cur);
  const cond = (o: Opt) => (o.minCourses && o.minCourses > 1 ? tr(locale, { uz: `${o.minCourses}+ kurs`, ru: `${o.minCourses}+ курса`, en: `${o.minCourses}+ courses`, de: `${o.minCourses}+ Kurse` }) : "");

  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-slate-500">
        {tr(locale, { uz: "Promokod", ru: "Промокод", en: "Promo code", de: "Promo-Code" })}{" "}
        <span className="font-normal text-slate-400">({tr(locale, { uz: "ixtiyoriy", ru: "необязательно", en: "optional", de: "optional" })})</span>
      </label>
      <select
        name={name}
        value={cur}
        onChange={(e) => { setInner(e.target.value); onChange?.(e.target.value); }}
        className={className}
        disabled={!opts}
      >
        <option value="">{opts ? tr(locale, { uz: "— promokodsiz —", ru: "— без промокода —", en: "— no promo code —", de: "— ohne Promo-Code —" }) : "..."}</option>
        {opts?.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} — −{money(o.discount)} {tr(locale, { uz: "so'm", ru: "сум", en: "UZS", de: "UZS" })}{cond(o) ? ` (${cond(o)})` : ""}
          </option>
        ))}
      </select>
      {sel && (
        <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          {tr(locale, { uz: "Chegirma", ru: "Скидка", en: "Discount", de: "Rabatt" })}: −{money(sel.discount)} {tr(locale, { uz: "so'm", ru: "сум", en: "UZS", de: "UZS" })}
          {sel.note ? ` · ${sel.note}` : ""}
        </p>
      )}
    </div>
  );
}

/** Promokod xatosi uchun tushunarli matn (server qaytargan kod bo'yicha); boshqa xato bo'lsa null */
export function promoErrorText(locale: Locale, error?: string, need?: number, have?: number): string | null {
  if (error === "promo_not_found") return tr(locale, { uz: "Bunday promokod topilmadi", ru: "Промокод не найден", en: "Promo code not found", de: "Promo-Code nicht gefunden" });
  if (error === "promo_inactive") return tr(locale, { uz: "Bu promokod o'chirilgan", ru: "Промокод отключён", en: "This promo code is disabled", de: "Dieser Promo-Code ist deaktiviert" });
  if (error === "promo_courses") return tr(locale, {
    uz: `Bu promokod kamida ${need} ta kursda o'qiydigan o'quvchi uchun. O'quvchi hozir ${have ?? 0} ta kursda o'qiydi.`,
    ru: `Промокод для учеников минимум на ${need} курсах. Сейчас ученик на ${have ?? 0}.`,
    en: `This promo code requires at least ${need} courses. The student is in ${have ?? 0}.`,
    de: `Dieser Code erfordert mindestens ${need} Kurse. Der Schüler hat ${have ?? 0}.`,
  });
  return null;
}
