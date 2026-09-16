"use client";

// Finance V2 — xatolik chegarasi: foydalanuvchiga texnik (Prisma/stack) matn ko'rsatilmaydi.
import { useEffect } from "react";

export default function FinanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[finance-v2]", error.digest ?? error.message); }, [error]);
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
      <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Xatolik yuz berdi · Произошла ошибка</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Sahifani yangilang. Takrorlansa administratorga xabar bering{error.digest ? ` (kod: ${error.digest})` : ""}.</p>
      <button type="button" className="btn-primary mt-4" onClick={() => reset()}>Qayta urinish · Повторить</button>
    </div>
  );
}
