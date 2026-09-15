import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getLevelCodes } from "@/lib/studyLevels";
import ApplyForm from "./ApplyForm";
import { parseQuestions } from "../../(app)/links/questions";
import { Icon } from "../../(app)/_components/Icon";

export const metadata: Metadata = {
  title: "Kursga yozilish — Germaniya Live",
  description: "Nemis tili kursiga ariza qoldiring — tez orada bog'lanamiz",
};

/** "500000" → "500 000 so'm"; matn bo'lsa (masalan "500 000 so'm/oy") o'zgarmaydi */
function fmtPrice(raw: string): string {
  const d = raw.replace(/\s/g, "");
  return /^\d{3,}$/.test(d) ? `${Number(d).toLocaleString("ru-RU")} so'm` : raw;
}

/** "a1" → "A1"; boshqa matn o'zgarmaydi */
function fmtLevel(raw: string): string {
  return /^[abc][12](\.\d)?$/i.test(raw.trim()) ? raw.trim().toUpperCase() : raw.trim();
}

// Ochiq sahifa (login talab qilmaydi) — kursga yozilish arizasi.
// Ko'rish har ochilganda hisoblanadi (?preview=1 bundan mustasno).
// Telefon uchun mo'ljallangan: /daraja-testi bilan bir xil brend uslub.
export default async function ApplyPage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { code } = await params;
  const preview = (await searchParams).preview === "1";

  const link = await prisma.vacancyLink.findUnique({ where: { code }, include: { vacancy: true } });

  const expired = !!link?.expiresAt && link.expiresAt.getTime() < Date.now();
  const capReached = !!link && link.maxSubmissions != null && link.submissions >= link.maxSubmissions;
  const closed = !!link && (!link.isActive || expired || capReached);

  if (link && !closed && !preview) {
    await prisma.vacancyLink.update({ where: { id: link.id }, data: { views: { increment: 1 }, lastViewedAt: new Date() } });
  }

  // Daraja tugmalari (Sozlamalar > Darajalar, faqat A1–B2 — arizada C1 shart emas)
  // va oflayn uchun faol filiallar
  const [allLevels, branches] = await Promise.all([
    getLevelCodes(),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true, imageUrl: true }, orderBy: { name: "asc" } }),
  ]);

  const APPLY_LEVELS = ["A1", "A2", "B1", "B2"];
  const levelCodes = allLevels.filter((c) => APPLY_LEVELS.includes(c.toUpperCase()));

  const v = link?.vacancy ?? null;
  // Chiplar: daraja (graduation) va narx (wallet) — ikonkali
  const chips: { icon: string; text: string }[] = v
    ? [v.jobTitle && { icon: "graduation", text: fmtLevel(v.jobTitle) }, v.salary && { icon: "wallet", text: fmtPrice(v.salary) }].filter((x): x is { icon: string; text: string } => !!x)
    : [];

  return (
    // `isolate` — forma qo'yadigan filial rasmi (-z-10) shu fon ustida, kontent ostida turadi
    <div className="relative isolate min-h-[100dvh] overflow-hidden bg-[#f3f5fb] text-slate-900 dark:bg-[#0b1220] dark:text-slate-100">
      {/* Fon bezagi — yumshoq rangli dog'lar */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
      <div className="pointer-events-none absolute -right-24 top-56 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/15" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:justify-center sm:py-10">
        {/* Sarlavha: logotip + yorliq */}
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Germaniya Live" className="h-9 w-auto object-contain dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Germaniya Live" className="hidden h-9 w-auto object-contain dark:block" />
          <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            Kursga yozilish
          </span>
        </div>

        {!link ? (
          <Notice icon="link" title="Havola topilmadi" text="Bunday havola mavjud emas yoki o'chirilgan." />
        ) : (
          <>
            {/* Kurs haqida */}
            <div className="mt-6">
              <h1 className="text-[26px] font-black leading-[1.15] tracking-tight text-slate-900 dark:text-white">{v!.title}</h1>
              {chips.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span key={c.text} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 backdrop-blur dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/10">
                      <Icon name={c.icon} className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" strokeWidth={1.8} /> {c.text}
                    </span>
                  ))}
                </div>
              )}
              {v!.description && <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-slate-500 dark:text-slate-400">{v!.description}</p>}
            </div>

            {closed ? (
              <Notice
                icon="alert"
                title={expired ? "Muddati o'tgan" : capReached ? "Arizalar to'ldi" : "Vaqtincha yopiq"}
                text="Bu kurs hozircha ariza qabul qilmayapti."
                tone="amber"
              />
            ) : (
              <>
                {preview && (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-center text-xs font-medium text-slate-500 backdrop-blur dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-400">
                    Ko&apos;rib chiqish rejimi — ariza yuborilmaydi
                  </div>
                )}
                <ApplyForm
                  code={link.code}
                  preview={preview}
                  questions={parseQuestions(v!.questions)}
                  levels={levelCodes}
                  // Rasm data URL'ni HTML'ga qo'ymaymiz — /api/branches/[id]/image orqali
                  branches={branches.map((b) => ({ id: b.id, name: b.name, address: b.address, image: b.imageUrl ? `/api/branches/${b.id}/image` : null }))}
                />
              </>
            )}
          </>
        )}

        <div className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">© 2026 Germaniya Live</div>
      </div>
    </div>
  );
}

function Notice({ icon, title, text, tone = "slate" }: { icon: string; title: string; text: string; tone?: "slate" | "amber" }) {
  return (
    <div className={`mt-6 rounded-3xl border p-6 text-center backdrop-blur ${tone === "amber"
      ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10"
      : "border-white/60 bg-white/85 dark:border-white/10 dark:bg-white/[0.06]"}`}>
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${tone === "amber" ? "bg-amber-500/15 text-amber-600" : "bg-slate-500/10 text-slate-500"}`}>
        <Icon name={icon} className="h-7 w-7" strokeWidth={1.8} />
      </div>
      <div className={`mt-2 text-lg font-bold ${tone === "amber" ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-white"}`}>{title}</div>
      <p className={`mt-1 text-sm ${tone === "amber" ? "text-amber-600 dark:text-amber-300/80" : "text-slate-500 dark:text-slate-400"}`}>{text}</p>
    </div>
  );
}
