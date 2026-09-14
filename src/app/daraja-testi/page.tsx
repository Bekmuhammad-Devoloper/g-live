import type { Metadata } from "next";
import { publicLevelTestQuestions, PER_LEVEL, LEVEL_TEST_LEVELS } from "@/lib/levelTest";
import LevelTestForm from "./LevelTestForm";

export const metadata: Metadata = {
  title: "Daraja aniqlash testi — Germaniya Live",
  description: "Nemis tili darajangizni 10 daqiqada aniqlang",
};

// Ochiq sahifa (login talab qilmaydi) — nemis tili darajasini aniqlash testi.
// CRM'dagi "Daraja testi" ustunidagi QR shu sahifaga olib keladi.
// Javob kaliti mijozga yuborilmaydi — baholash serverda (actions.ts).
export default function LevelTestPage() {
  const questions = publicLevelTestQuestions();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-brand-600 px-5 py-4 text-white">
          {/* To'q fon uchun mo'ljallangan logotip (oq yozuvli) */}
          <img src="/logo-dark.png" alt="Germaniya Live" className="h-8 w-auto object-contain" />
          <div className="mt-1.5 text-[11px] text-white/70">Nemis tili — daraja aniqlash testi</div>
        </div>
        <div className="p-6">
          <LevelTestForm questions={questions} perLevel={PER_LEVEL} levels={[...LEVEL_TEST_LEVELS]} />
        </div>
        <div className="border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-400">© 2026 Germaniya Live</div>
      </div>
    </div>
  );
}
