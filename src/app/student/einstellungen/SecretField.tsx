"use client";

import { useState } from "react";

// Parolni ko'rsatish/yashirish — o'quvchi o'z hisobining parolini unutgan
// bo'lsa qaraydi. Qiymat faqat shu foydalanuvchining o'ziga yuboriladi.

export default function SecretField({ value, show, hide }: { value: string; show: string; hide: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[13.5px] font-semibold text-slate-700">
        {open ? value : "•".repeat(Math.min(value.length, 10))}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-slate-100 px-2 py-[3px] text-[11px] font-bold text-slate-500"
      >
        {open ? hide : show}
      </button>
    </div>
  );
}
