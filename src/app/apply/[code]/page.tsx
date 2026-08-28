import { prisma } from "@/lib/db";
import { platform, flagOf } from "../../(app)/links/platforms";
import ApplyForm from "./ApplyForm";
import { parseQuestions } from "../../(app)/links/questions";

// Ochiq sahifa (login talab qilmaydi) — vakansiyaga ariza topshirish.
// Ko'rish har ochilganda hisoblanadi (?preview=1 bundan mustasno).
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

  const p = link ? platform(link.platform) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-brand-600 px-5 py-4 text-white">
          {/* To'q fon uchun mo'ljallangan logotip (oq yozuvli) */}
          <img src="/logo-dark.png" alt="Germaniya Live" className="h-8 w-auto object-contain" />
          <div className="mt-1.5 text-[11px] text-white/70">Vakansiyaga ariza topshirish</div>
        </div>

        <div className="p-6">
          {!link ? (
            <div className="text-center">
              <div className="mb-2 text-4xl">🔗</div>
              <h1 className="text-lg font-bold text-slate-800">Havola topilmadi</h1>
              <p className="mt-1 text-sm text-slate-500">Bunday havola mavjud emas yoki o&apos;chirilgan.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{link.vacancy.title}</h1>
                  {p && <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: `${p.color}1a`, color: p.color }}>{p.label}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                  {link.vacancy.country && <span>{flagOf(link.vacancy.countryCode, link.vacancy.country)} {link.vacancy.country}</span>}
                  {link.vacancy.jobTitle && <span>· {link.vacancy.jobTitle}</span>}
                  {link.vacancy.salary && <span className="font-semibold text-emerald-600">· {link.vacancy.salary}</span>}
                </div>
                {link.vacancy.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{link.vacancy.description}</p>}
              </div>

              {closed ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
                  <div className="mb-1 text-3xl">⛔</div>
                  <div className="font-bold text-amber-700">{expired ? "Muddati o'tgan" : capReached ? "Arizalar to'ldi" : "Vaqtincha yopiq"}</div>
                  <p className="mt-1 text-sm text-amber-600">Bu vakansiya hozircha ariza qabul qilmayapti.</p>
                </div>
              ) : (
                <>
                  {preview && <div className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-500">Ko&apos;rib chiqish rejimi — ariza yuborilmaydi</div>}
                  <ApplyForm code={link.code} preview={preview} questions={parseQuestions(link.vacancy.questions)} />
                </>
              )}
            </>
          )}
        </div>
        <div className="border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-400">© 2026 Germaniya Live</div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
