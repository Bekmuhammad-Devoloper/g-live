import type { Metadata } from "next";
import { publicTestSets, LEVEL_TEST_LEVELS, LEVEL_COLORS, LEVEL_NAMES } from "@/lib/levelTest";
import LevelTestForm from "./LevelTestForm";

export const metadata: Metadata = {
  title: "Daraja aniqlash testi — Germaniya Live",
  description: "Nemis tili darajangizni tekshiring: A1, A2, B1, B2",
};

// Ochiq sahifa (login talab qilmaydi) — nemis tili darajasini aniqlash testi.
// CRM'dagi "Daraja testi" ustunidagi QR shu sahifaga olib keladi.
// Mijoz darajani (A1–B2) va testni (masalan A1.1 / A1.2) o'zi tanlaydi;
// savollar to'plamdagi asl tartibda. Javob kaliti mijozga yuborilmaydi —
// baholash serverda (actions.ts). Telefon uchun mo'ljallangan.
export default function LevelTestPage() {
  const sets = publicTestSets();
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#f3f5fb] text-slate-900 dark:bg-[#0b1220] dark:text-slate-100">
      {/* Fon bezagi — yumshoq rangli dog'lar */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
      <div className="pointer-events-none absolute -right-24 top-56 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/15" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:justify-center sm:py-10">
        <LevelTestForm sets={sets} levels={[...LEVEL_TEST_LEVELS]} colors={LEVEL_COLORS} names={LEVEL_NAMES} />
      </div>
    </div>
  );
}
