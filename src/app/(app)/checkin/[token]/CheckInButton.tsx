"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { tr } from "@/lib/tr";
import type { Locale, LocaleText } from "@/lib/constants";
import { checkIn, type CheckInResult } from "./actions";

const MESSAGES: Record<CheckInResult, { text: LocaleText; tone: string }> = {
  ok: {
    text: { uz: "✅ Davomat qabul qilindi. Rahmat!", ru: "✅ Посещение принято. Спасибо!", en: "✅ Attendance recorded. Thank you!", de: "✅ Anwesenheit erfasst. Danke!" },
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  already: {
    text: { uz: "ℹ️ Siz allaqachon belgilangansiz.", ru: "ℹ️ Вы уже отмечены.", en: "ℹ️ You are already marked.", de: "ℹ️ Sie sind bereits erfasst." },
    tone: "text-blue-700 bg-blue-50 border-blue-200",
  },
  expired: {
    text: { uz: "⛔ QR-kod muddati tugagan. O'qituvchidan yangi QR so'rang.", ru: "⛔ Срок действия QR-кода истёк. Попросите у преподавателя новый QR.", en: "⛔ The QR code has expired. Ask your teacher for a new QR.", de: "⛔ Der QR-Code ist abgelaufen. Bitten Sie den Lehrer um einen neuen QR." },
    tone: "text-red-700 bg-red-50 border-red-200",
  },
  invalid: {
    text: { uz: "⛔ QR-kod noto'g'ri yoki topilmadi.", ru: "⛔ QR-код неверный или не найден.", en: "⛔ The QR code is invalid or not found.", de: "⛔ Der QR-Code ist ungültig oder wurde nicht gefunden." },
    tone: "text-red-700 bg-red-50 border-red-200",
  },
  anomaly: {
    text: { uz: "⚠️ Siz bu guruhga biriktirilmagansiz — anomaliya sifatida belgilandi.", ru: "⚠️ Вы не прикреплены к этой группе — отмечено как аномалия.", en: "⚠️ You are not assigned to this group — recorded as an anomaly.", de: "⚠️ Sie sind dieser Gruppe nicht zugeordnet — als Anomalie erfasst." },
    tone: "text-amber-700 bg-amber-50 border-amber-200",
  },
  notstudent: {
    text: { uz: "⛔ Bu amal faqat o'quvchilar uchun.", ru: "⛔ Это действие только для учеников.", en: "⛔ This action is for students only.", de: "⛔ Diese Aktion ist nur für Schüler." },
    tone: "text-red-700 bg-red-50 border-red-200",
  },
};

export default function CheckInButton({ token, locale }: { token: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CheckInResult | null>(null);

  if (result) {
    const m = MESSAGES[result];
    return (
      <div className="space-y-4">
        <div className={`rounded-lg border p-4 text-sm font-medium ${m.tone}`}>{tr(locale, m.text)}</div>
        <Link href="/dashboard" className="block text-center text-sm text-brand-600 hover:underline">
          {tr(locale, { uz: "Bosh sahifaga qaytish", ru: "Вернуться на главную", en: "Back to home", de: "Zurück zur Startseite" })}
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
      {pending
        ? tr(locale, { uz: "Belgilanmoqda...", ru: "Отмечаем...", en: "Marking...", de: "Wird erfasst..." })
        : tr(locale, { uz: "Davomatni tasdiqlash", ru: "Подтвердить посещение", en: "Confirm attendance", de: "Anwesenheit bestätigen" })}
    </button>
  );
}
