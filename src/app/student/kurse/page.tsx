import Link from "next/link";
import { cn } from "@/lib/cn";
import { S } from "../_i18n";
import KurseActions from "./KurseActions";
import { getPortalFlags } from "@/lib/portalFeatures";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "../_ui";
import MissingStudent from "../MissingStudent";
import { getActiveLevels, levelTitle, matchLevel } from "@/lib/studyLevels";
import { levelGradient } from "@/lib/levelColor";
import { getStudentProgress } from "@/lib/studentProgress";

// "Kurse" — umumiy darajalar ro'yxati (A1 · A2 · B1 · B2 · C1 · C2).
// Har daraja kartasi: nom, darslar soni, o'tilgan foiz.
// Darajaga bosilsa — o'sha darajaning unitlari ochiladi (maket ko'rinishida).

function IcoChevron({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// Tog' siluetti — karta foniga hajm beradi (maketdagidek)
function Mountains() {
  return (
    <svg viewBox="0 0 340 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[64%] w-full opacity-[0.28]">
      <path d="M0 90 L58 34 L96 62 L150 18 L206 66 L252 40 L300 74 L340 46 L340 90 Z" fill="white" />
      <path d="M0 90 L40 58 L86 80 L140 50 L188 84 L240 62 L292 88 L340 70 L340 90 Z" fill="white" opacity="0.55" />
    </svg>
  );
}

export default async function StudentKursePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);
  // Sarlavhadagi tugmalar o'chirilgan bo'limga olib bormasin
  const flags = await getPortalFlags();

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { id: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  // Jarayon YAGONA joyda hisoblanadi (src/lib/studentProgress.ts): o'qituvchi
  // o'tgani + o'quvchi ko'rgani + topshirgani. Ilgari bu yerda faqat
  // "o'qituvchi o'tdi" sanalardi, shu sabab darslarni ko'rib chiqqan
  // o'quvchida ham 0% turardi.
  const [levels, prog] = await Promise.all([getActiveLevels(), getStudentProgress(student.id, group)]);

  // Darajaga biriktirilmagan darslar guruhning o'z darajasiga (yoki birinchisiga) qo'shiladi
  const fallback = matchLevel(group?.levelCode ?? student.currentLevel, levels) ?? levels[0] ?? null;
  const byLevel = new Map<string, { total: number; done: number; sum: number }>();
  for (const l of levels) byLevel.set(l.code, { total: 0, done: 0, sum: 0 });
  for (const l of prog.lessons) {
    const lvl = matchLevel(l.levelCode, levels) ?? fallback;
    const bucket = lvl ? byLevel.get(lvl.code) : undefined;
    if (!bucket) continue;
    const p = prog.pctOf(l.id);
    bucket.total++;
    bucket.sum += p;
    if (p >= 100) bucket.done++;
  }

  const currentLevel = matchLevel(group?.levelCode ?? student.currentLevel, levels)?.code ?? "";

  return (
    <div className="space-y-4">
      <PageHeader title={t.courses} subtitle={group?.program.name ?? "Deutsch"} backLabel={t.back} right={<KurseActions t={t} showDict={flags.worterbuch} showTeacher={flags.lehrer} />} />

      <div className="space-y-3.5">
        {levels.map((lvl) => {
          const code = lvl.code;
          const st = byLevel.get(code)!;
          // Foiz — darslarning O'RTACHA to'lishi (faqat tugallanganlar emas)
          const pct = st.total ? Math.round(st.sum / st.total) : 0;
          const active = code === currentLevel;
          // Ma'muriyat banner yuklagan bo'lsa — kartochka foni o'sha rasm
          const banner = lvl.bannerUrl;
          return (
            <Link
              key={code}
              href={`/student/kurse/${code}`}
              className="relative block overflow-hidden rounded-[26px] text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)]"
              style={{ background: levelGradient(lvl.color) }}
            >
              {/* Banner — TO'LIQ ko'rinadi va ustiga yozuv tushmaydi.
                  Ilgari rasm butun kartochkaga cho'zilib qirqilardi, yozuvlar
                  esa uning ustida turib o'qilmasdi. Endi rasm o'z nisbatida
                  yuqorida, matn esa ostidagi rangli yo'lakda. */}
              {banner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner} alt="" className="block max-h-[280px] w-full object-cover" />
              ) : null}

              <div className={cn(
                "relative flex flex-col justify-between p-6",
                banner ? "min-h-[112px]" : "min-h-[168px]",
              )}>
              {banner ? null : <Mountains />}
              <div className="relative flex items-start gap-4">
                {/* daraja belgisi */}
                <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl bg-white/20 text-[21px] font-extrabold backdrop-blur-sm">
                  {code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {/* Qo'lda yozilgan shrift (Caveat) — nozikroq, shu sabab
                        kattaroq o'lchamda beriladi. Kesilmasin: eng ko'pi 2 qator. */}
                    <span className="font-hand line-clamp-2 text-[30px] font-bold leading-[1.05]">
                      {levelTitle(lvl, session.locale)}
                    </span>
                    {active && (
                      <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        aktuell
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[14px] text-white/75">
                    {st.total > 0 ? `${st.total} ${t.lessons}` : t.comingSoonBadge}
                  </div>
                </div>
                <span className="mt-1.5 shrink-0"><IcoChevron /></span>
              </div>

              {/* jarayon chizig'i */}
              <div className="relative mt-4 flex items-center gap-3">
                <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[17px] font-extrabold">{pct}%</span>
              </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
