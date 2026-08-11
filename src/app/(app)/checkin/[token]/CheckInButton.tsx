"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { checkIn, type CheckInResult } from "./actions";

const MESSAGES: Record<CheckInResult, { text: string; tone: string }> = {
  ok: { text: "✅ Davomat qabul qilindi. Rahmat!", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  already: { text: "ℹ️ Siz allaqachon belgilangansiz.", tone: "text-blue-700 bg-blue-50 border-blue-200" },
  expired: { text: "⛔ QR-kod muddati tugagan. O'qituvchidan yangi QR so'rang.", tone: "text-red-700 bg-red-50 border-red-200" },
  invalid: { text: "⛔ QR-kod noto'g'ri yoki topilmadi.", tone: "text-red-700 bg-red-50 border-red-200" },
  anomaly: { text: "⚠️ Siz bu guruhga biriktirilmagansiz — anomaliya sifatida belgilandi.", tone: "text-amber-700 bg-amber-50 border-amber-200" },
  notstudent: { text: "⛔ Bu amal faqat o'quvchilar uchun.", tone: "text-red-700 bg-red-50 border-red-200" },
};

export default function CheckInButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CheckInResult | null>(null);

  if (result) {
    const m = MESSAGES[result];
    return (
      <div className="space-y-4">
        <div className={`rounded-lg border p-4 text-sm font-medium ${m.tone}`}>{m.text}</div>
        <Link href="/dashboard" className="block text-center text-sm text-brand-600 hover:underline">
          Bosh sahifaga qaytish
        </Link>
      </div>
    );
  }

  return (
    <button
      onClick={() => start(async () => setResult(await checkIn(token)))}
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Belgilanmoqda..." : "Davomatni tasdiqlash"}
    </button>
  );
}
