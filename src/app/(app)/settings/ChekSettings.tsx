"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/tr";
import type { Locale } from "@/lib/constants";
import {
  RECEIPT_MODES, RECEIPT_MODE_LABELS, RECEIPT_MODE_HINTS, type ReceiptMode,
} from "@/lib/receiptMode";
import { saveReceiptMode } from "./actions";
import { Icon } from "../_components/Icon";

const STORAGE_KEY = "gl-chek-settings";

type L = { uz: string; ru: string; en: string };

// Chek qatorlari (tartib skrinshotdagidek). value — namunaviy ko'rinish uchun.
const ROWS: { key: string; label: L; value: (c: string) => string }[] = [
  { key: "checkNumber", label: { uz: "Tekshirish raqami", ru: "Номер чека", en: "Check number" }, value: () => "№12345" },
  { key: "company", label: { uz: "Kompaniya", ru: "Компания", en: "Company" }, value: (c) => c },
  { key: "branch", label: { uz: "Filial", ru: "Филиал", en: "Branch" }, value: (c) => c },
  { key: "student", label: { uz: "Talaba", ru: "Ученик", en: "Student" }, value: () => "Aziz Karimov" },
  { key: "phone", label: { uz: "Telefon", ru: "Телефон", en: "Phone" }, value: () => "+998 90 123 45 67" },
  { key: "balance", label: { uz: "Balans", ru: "Баланс", en: "Balance" }, value: () => "1 000 UZS" },
  { key: "group", label: { uz: "Guruh", ru: "Группа", en: "Group" }, value: () => "A1 ertalabki" },
  { key: "coursePrice", label: { uz: "Kurs narxi", ru: "Стоимость курса", en: "Course price" }, value: () => "200 000 UZS" },
  { key: "teacher", label: { uz: "O'qituvchi", ru: "Преподаватель", en: "Teacher" }, value: () => "Nigora Rashidova" },
  { key: "type", label: { uz: "Turi", ru: "Тип", en: "Type" }, value: () => "Naqd pul" },
  { key: "amount", label: { uz: "To'lov miqdori", ru: "Сумма платежа", en: "Payment amount" }, value: () => "200 000 UZS" },
  { key: "date", label: { uz: "Sana", ru: "Дата", en: "Date" }, value: () => "01.01.2025" },
];
const FOOTER: { key: string; label: L; value: string }[] = [
  { key: "staff", label: { uz: "Xodim", ru: "Сотрудник", en: "Staff" }, value: "Admin" },
  { key: "time", label: { uz: "Vaqt", ru: "Время", en: "Time" }, value: "01.01.2025 10:00" },
];
// Chap ustundagi barcha "Yashirish:" tartibi
const TOGGLES = ["logo", "image", "text", ...ROWS.map((r) => r.key), ...FOOTER.map((f) => f.key)];
const LABELS: Record<string, L> = {
  logo: { uz: "Logotip", ru: "Логотип", en: "Logo" },
  image: { uz: "Image fild", ru: "Поле изображения", en: "Image field" },
  text: { uz: "Text fild", ru: "Текстовое поле", en: "Text field" },
  ...Object.fromEntries(ROWS.map((r) => [r.key, r.label])),
  ...Object.fromEntries(FOOTER.map((f) => [f.key, f.label])),
};

export default function ChekSettings({ locale, centerName, receiptMode }: { locale: Locale; centerName: string; receiptMode: ReceiptMode }) {
  // Chek yuklash majburiyligi — BAZAGA yoziladi (qolgan sozlamalar localStorage'da)
  const [mode, setMode] = useState<ReceiptMode>(receiptMode);
  const [modeSaved, setModeSaved] = useState(false);
  const [modeErr, setModeErr] = useState<string | null>(null);
  const [savingMode, startSaveMode] = useTransition();

  const pickMode = (m: ReceiptMode) => {
    setMode(m); setModeErr(null);
    startSaveMode(async () => {
      const r = await saveReceiptMode(m);
      if (r.ok) { setModeSaved(true); setTimeout(() => setModeSaved(false), 2200); }
      else { setMode(receiptMode); setModeErr(tr(locale, { uz: "Saqlanmadi — ruxsat yo'q", ru: "Не сохранено — нет доступа", en: "Not saved — no permission" })); }
    });
  };

  const [hide, setHide] = useState<Record<string, boolean>>({});
  const [image, setImage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const d = JSON.parse(raw); setHide(d.hide ?? {}); setImage(d.image ?? null); }
    } catch { /* ignore */ }
  }, []);

  const toggle = (k: string) => setHide((s) => ({ ...s, [k]: !s[k] }));
  const shown = (k: string) => !hide[k];
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ hide, image })); } catch { /* ignore */ }
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  };
  const reset = () => { setHide({}); setImage(null); };

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-slate-800 dark:text-slate-100">{tr(locale, { uz: "Chek", ru: "Чек", en: "Receipt" })}</h2>

      {/* ── Chek yuklash majburiyligi (bazaga saqlanadi) ── */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-1 flex items-center gap-2">
          <Icon name="shieldCheck" className="h-5 w-5 text-brand-500" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {tr(locale, { uz: "To'lovda chek yuklash", ru: "Загрузка чека при оплате", en: "Receipt upload on payment" })}
          </h3>
          {savingMode && <span className="text-xs text-slate-400">{tr(locale, { uz: "saqlanmoqda…", ru: "сохранение…", en: "saving…" })}</span>}
          {modeSaved && <span className="text-xs font-semibold text-emerald-600">{tr(locale, { uz: "saqlandi ✓", ru: "сохранено ✓", en: "saved ✓" })}</span>}
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {tr(locale, {
            uz: "Kassir to'lov qabul qilganda chek (kvitansiya) yuklashi shartmi — shu yerdan boshqariladi.",
            ru: "Обязан ли кассир загружать чек при приёме оплаты — управляется здесь.",
            en: "Controls whether the cashier must attach a receipt when accepting a payment.",
          })}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {RECEIPT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pickMode(m)}
              disabled={savingMode}
              className={cn(
                "rounded-xl border p-3 text-left transition disabled:opacity-60",
                mode === m
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:border-brand-500/50 dark:bg-brand-950/30"
                  : "border-slate-200 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border-2", mode === m ? "border-brand-600" : "border-slate-300 dark:border-slate-600")}>
                  {mode === m && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tr(locale, RECEIPT_MODE_LABELS[m])}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{tr(locale, RECEIPT_MODE_HINTS[m])}</p>
            </button>
          ))}
        </div>
        {modeErr && <p className="mt-2 text-xs font-medium text-rose-600">{modeErr}</p>}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Chap: yashirish belgilashlari */}
        <div className="space-y-5">
          {TOGGLES.map((k) => (
            <div key={k}>
              <label className="mb-2 block text-sm text-slate-700 dark:text-slate-200">{tr(locale, { uz: "Yashirish", ru: "Скрыть", en: "Hide" })}: {tr(locale, LABELS[k])}</label>
              <button type="button" onClick={() => toggle(k)} role="checkbox" aria-checked={!!hide[k]}
                className={cn("flex h-6 w-6 items-center justify-center rounded border-2 transition",
                  hide[k] ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white hover:border-brand-400 dark:border-slate-600 dark:bg-slate-800")}>
                {hide[k] && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m5 12 5 5L20 7" /></svg>}
              </button>
              {k === "image" && (
                <input ref={imgRef} type="file" accept="image/*" onChange={onImage}
                  className="mt-3 block w-full max-w-sm rounded-lg border border-slate-300 bg-white p-1.5 text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300" />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button onClick={save} className="rounded-full bg-brand-800 px-8 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900">
              {saved ? tr(locale, { uz: "Saqlandi ✓", ru: "Сохранено ✓", en: "Saved ✓" }) : tr(locale, { uz: "Saqlash", ru: "Сохранить", en: "Save" })}
            </button>
            <button onClick={reset} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
              {tr(locale, { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" })}
            </button>
          </div>
        </div>

        {/* O'ng: chek ko'rinishi (jonli) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="relative mx-auto w-full max-w-[320px] bg-white px-6 pt-6 text-slate-800 shadow-pop">
            {shown("logo") && (
              <div className="mb-3 flex justify-center">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">GL</div>
                  <span className="text-sm font-extrabold tracking-tight text-slate-800">Germaniya <span className="text-brand-600">Live</span></span>
                </div>
              </div>
            )}
            {shown("image") && (
              <div className="mb-3 flex justify-center">
                {image ? <span className="h-20 w-full rounded bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${image})` }} /> : <div className="grid h-16 w-full place-items-center rounded border border-dashed border-slate-300 text-xs text-slate-400">{tr(locale, { uz: "Rasm", ru: "Изображение", en: "Image" })}</div>}
              </div>
            )}
            {shown("text") && (
              <div className="mb-3 min-h-[44px] rounded border border-slate-300 bg-white" />
            )}

            <dl className="space-y-1.5 text-[13px]">
              {ROWS.filter((r) => shown(r.key)).map((r) => (
                <div key={r.key}><span className="font-bold">{tr(locale, r.label)}:</span> <span className="text-slate-600">{r.value(centerName)}</span></div>
              ))}
            </dl>

            {(shown("staff") || shown("time")) && (
              <dl className="mt-4 space-y-1.5 text-[13px] text-slate-400">
                {FOOTER.filter((f) => shown(f.key)).map((f) => (
                  <div key={f.key}><span className="font-bold text-slate-500">{tr(locale, f.label)}:</span> {f.value}</div>
                ))}
              </dl>
            )}

            {/* Yirtilgan pastki chekka */}
            <div className="mt-5 h-3" style={{
              background: "linear-gradient(-45deg, #fff 6px, transparent 0) 0 6px, linear-gradient(45deg, #fff 6px, transparent 0) 0 6px",
              backgroundSize: "12px 12px", backgroundRepeat: "repeat-x",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
