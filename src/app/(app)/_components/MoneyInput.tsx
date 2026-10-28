"use client";

import { useState } from "react";

export const fmtMoneyDigits = (v: string | number | null | undefined): string => {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 12);
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
};

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
