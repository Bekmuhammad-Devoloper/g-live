"use client";

import { useState } from "react";

/** "800000" → "800 000" (faqat raqamlar qoladi, 12 xonagacha) */
export const fmtMoneyDigits = (v: string | number | null | undefined): string => {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 12);
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
};

/**
 * Pul maydoni — yozayotganda minglik bo'laklarga bo'linadi ("800 000").
 * Formaga (FormData) esa `name` ostida faqat raqamlar ketadi (yashirin input),
 * shuning uchun server tomonda Number(fd.get(name)) avvalgidek ishlaydi.
 *
 * Ikki rejim:
 *   • uncontrolled — defaultValue (raqam yoki satr);
 *   • controlled  — value (faqat raqamlar) + onChange(digits).
 */
export default function MoneyInput({
  name, value, defaultValue, onChange, className, placeholder = "0", required, disabled, id, autoFocus, suffix,
}: {
  name?: string;
  value?: string;
  defaultValue?: string | number | null;
  onChange?: (digits: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
  /** o'ng tomonda ko'rsatiladigan birlik, masalan "so'm" */
  suffix?: string;
}) {
  const [inner, setInner] = useState(() => String(defaultValue ?? "").replace(/\D/g, ""));
  const digits = value !== undefined ? value.replace(/\D/g, "") : inner;

  const set = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 12);
    if (value === undefined) setInner(d);
    onChange?.(d);
  };

  const field = (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      value={fmtMoneyDigits(digits)}
      onChange={(e) => set(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
    />
  );

  return (
    <>
      {suffix ? (
        <span className="relative block">
          {field}
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-medium text-slate-400">{suffix}</span>
        </span>
      ) : field}
      {name && <input type="hidden" name={name} value={digits} />}
    </>
  );
}
