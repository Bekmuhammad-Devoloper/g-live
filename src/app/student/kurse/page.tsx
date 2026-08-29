import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "../_ui";
import MissingStudent from "../MissingStudent";
import { LEVELS, LEVEL_BG, LEVEL_NAME } from "./levels";

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

  const [lessons, progress] = await Promise.all([
    group
      ? prisma.courseLesson.findMany({
          where: { programId: group.programId },
          orderBy: { order: "asc" },
          select: { id: true, levelCode: true },
        })
      : Promise.resolve([]),
    group
      ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } })
      : Promise.resolve([]),
  ]);

  const taught = new Set(progress.map((p) => p.courseLessonId));

  // Darajaga biriktirilmagan darslar guruhning o'z darajasiga (yoki A1 ga) qo'shiladi
  const fallback = (group?.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const byLevel = new Map<string, { total: number; done: number }>();
  for (const code of LEVELS) byLevel.set(code, { total: 0, done: 0 });
  for (const l of lessons) {
    const code = (l.levelCode ?? fallback).toUpperCase();
    const bucket = byLevel.get(code) ?? byLevel.get("A1")!;
    bucket.total++;
    if (taught.has(l.id)) bucket.done++;
  }

  const currentLevel = (group?.levelCode ?? student.currentLevel ?? "").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      <PageHeader title="Kurse" subtitle={group?.program.name ?? "Deutsch"} />

      <div className="space-y-3.5">
        {LEVELS.map((code) => {
          const st = byLevel.get(code)!;
          const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
          const active = code === currentLevel;
          return (
            <Link
              key={code}
              href={`/student/kurse/${code}`}
              // Bosh sahifadagi "Dein Fortschritt" kartasi bilan bir xil o'lcham
              className="relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-[26px] p-6 text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)]"
              style={{ background: LEVEL_BG[code] }}
            >
              <Mountains />
              <div className="relative flex items-start gap-4">
                {/* daraja belgisi */}
                <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl bg-white/20 text-[21px] font-extrabold backdrop-blur-sm">
                  {code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[24px] font-extrabold leading-tight">{LEVEL_NAME[code]}</span>
                    {active && (
                      <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        aktuell
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[14px] text-white/75">
                    {st.total > 0 ? `${st.total} Lektionen` : "Bald verfügbar"}
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
