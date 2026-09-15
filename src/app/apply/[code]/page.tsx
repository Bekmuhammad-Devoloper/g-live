import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getLevelCodes } from "@/lib/studyLevels";
import { branchHasImage } from "@/lib/branchImage";
import { getAppRelease } from "@/lib/appRelease";
import ApplyForm from "./ApplyForm";
import ApplyShell from "./ApplyShell";
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
  // + Android ilovasi — pastdagi "Ilovani yuklab oling" kartasi (serverdagi eng oxirgi APK)
  const [allLevels, branches, app] = await Promise.all([
    getLevelCodes(),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true, imageUrl: true }, orderBy: { name: "asc" } }),
    getAppRelease(),
  ]);

  const APPLY_LEVELS = ["A1", "A2", "B1", "B2"];
  const levelCodes = allLevels.filter((c) => APPLY_LEVELS.includes(c.toUpperCase()));

  const v = link?.vacancy ?? null;
  // Chiplar: daraja (graduation) va narx (wallet) — ikonkali
  const chips: { icon: string; text: string }[] = v
    ? [v.jobTitle && { icon: "graduation", text: fmtLevel(v.jobTitle) }, v.salary && { icon: "wallet", text: fmtPrice(v.salary) }].filter((x): x is { icon: string; text: string } => !!x)
    : [];

  return (
    // ApplyShell — sahifa foni (filial tanlanganda uning surati) va bezak dog'lari
    <ApplyShell>
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
                  // (yuklangan rasm yoki public/branches/<nom>.jpg tayyor fayl)
                  branches={branches.map((b) => ({ id: b.id, name: b.name, address: b.address, image: branchHasImage(b) ? `/api/branches/${b.id}/image` : null }))}
                />
              </>
            )}
          </>
        )}

        {/* Ilovani yuklab olish — har doim eng oxirgi versiya (/api/app/android serverdagi faylni beradi) */}
        {app.available && (
          <a
            href={app.href}
            className="mt-6 flex items-center gap-3 rounded-3xl border border-white/70 bg-white/55 p-3.5 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl transition active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.06]"
          >
            {/* Ilovaning o'z ikonkasi — telefonda o'rnatilganda shu ko'rinadi */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="Germaniya Live" width={52} height={52} className="shrink-0 rounded-2xl shadow-md ring-1 ring-black/10" style={{ width: 52, height: 52 }} />
            {/* Matn kesilmaydi — tor ekranda o'raladi; tugma kichik, dumaloq */}
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[15px] font-bold leading-tight text-slate-900 dark:text-white">Germaniya Live</span>
              <span className="mt-1 block break-words text-[12px] leading-tight text-slate-500 dark:text-slate-400">
                Ilovani yuklab oling{app.version ? ` · ${app.version.replace(/\s*\(\d+\)$/, "")}` : ""}{app.sizeMb ? ` · ${app.sizeMb} MB` : ""}
              </span>
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(65,72,239,0.8)]" aria-label="Yuklab olish">
              <Icon name="arrowDownToLine" className="h-5 w-5" strokeWidth={2.4} />
            </span>
          </a>
        )}

        <div className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">© 2026 Germaniya Live</div>
      </div>
    </ApplyShell>
  );
}

function Notice({ icon, title, text, tone = "slate" }: { icon: string; title: string; text: string; tone?: "slate" | "amber" }) {
  return (
    <div className={`mt-6 rounded-3xl border p-6 text-center backdrop-blur ${tone === "amber"
      ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10"
      : "border-white/70 bg-white/55 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"}`}>
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${tone === "amber" ? "bg-amber-500/15 text-amber-600" : "bg-slate-500/10 text-slate-500"}`}>
        <Icon name={icon} className="h-7 w-7" strokeWidth={1.8} />
      </div>
      <div className={`mt-2 text-lg font-bold ${tone === "amber" ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-white"}`}>{title}</div>
      <p className={`mt-1 text-sm ${tone === "amber" ? "text-amber-600 dark:text-amber-300/80" : "text-slate-500 dark:text-slate-400"}`}>{text}</p>
    </div>
  );
}
