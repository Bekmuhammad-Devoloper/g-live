"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateQr, markAttendance, confirmAttendance } from "./actions";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";

export function GenerateQrButton({ lessonId, hasQr, locale }: { lessonId: string; hasQr: boolean; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => start(async () => { await generateQr(lessonId); router.refresh(); })}
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "..." : hasQr
        ? tr(locale, { uz: "QR yangilash (15 daq)", ru: "Обновить QR (15 мин)", en: "Refresh QR (15 min)", de: "QR aktualisieren (15 Min.)" })
        : tr(locale, { uz: "QR yaratish (15 daq)", ru: "Создать QR (15 мин)", en: "Generate QR (15 min)", de: "QR erstellen (15 Min.)" })}
    </button>
  );
}

const statusList = (locale: Locale): { key: string; label: string; tone: string }[] => [
  { key: "PRESENT", label: tr(locale, { uz: "Keldi", ru: "Пришёл", en: "Present", de: "Anwesend" }), tone: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { key: "LATE", label: tr(locale, { uz: "Kechikdi", ru: "Опоздал", en: "Late", de: "Verspätet" }), tone: "bg-amber-100 text-amber-700 border-amber-300" },
  { key: "ABSENT", label: tr(locale, { uz: "Kelmadi", ru: "Отсутствовал", en: "Absent", de: "Abwesend" }), tone: "bg-red-100 text-red-700 border-red-300" },
  { key: "EXCUSED", label: tr(locale, { uz: "Uzrli", ru: "По уважительной", en: "Excused", de: "Entschuldigt" }), tone: "bg-blue-100 text-blue-700 border-blue-300" },
];

export function AttendanceControls({ lessonId, studentId, current, locale }: { lessonId: string; studentId: string; current: string | null; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-1">
      {statusList(locale).map((st) => (
        <button
          key={st.key}
          disabled={pending}
          onClick={() => start(async () => { await markAttendance(lessonId, studentId, st.key); router.refresh(); })}
          className={cn(
            "rounded border px-2 py-1 text-xs font-medium transition disabled:opacity-50",
            current === st.key ? st.tone : "border-slate-200 text-slate-500 hover:bg-slate-50"
          )}
        >
          {st.label}
        </button>
      ))}
    </div>
  );
}

export function ConfirmButton({ lessonId, locale }: { lessonId: string; locale: Locale }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => start(async () => { await confirmAttendance(lessonId); router.refresh(); })}
      disabled={pending}
      className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
    >
      {pending ? "..." : tr(locale, { uz: "Yakuniy ro'yxatni tasdiqlash", ru: "Подтвердить итоговый список", en: "Confirm final list", de: "Endgültige Liste bestätigen" })}
    </button>
  );
}
