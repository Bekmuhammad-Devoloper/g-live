import type { Metadata } from "next";
import { publicTestSets, LEVEL_TEST_LEVELS, LEVEL_COLORS, LEVEL_NAMES } from "@/lib/levelTest";
import LevelTestForm from "./LevelTestForm";
import { getBrand } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: `Daraja aniqlash testi — ${brand.name}`,
    description: "Nemis tili darajangizni tekshiring: A1, A2, B1, B2",
  };
}

export default async function LevelTestPage() {
  const sets = publicTestSets();
  const brand = await getBrand();
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#f3f5fb] text-slate-900 dark:bg-[#0b1220] dark:text-slate-100">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
      <div className="pointer-events-none absolute -right-24 top-56 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/15" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:justify-center sm:py-10">
        <LevelTestForm sets={sets} levels={[...LEVEL_TEST_LEVELS]} colors={LEVEL_COLORS} names={LEVEL_NAMES} brand={{ name: brand.name, logo: brand.logo, logoDark: brand.logoDark }} />
      </div>
    </div>
  );
}
