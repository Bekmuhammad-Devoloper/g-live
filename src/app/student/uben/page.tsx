import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CARD, NAVY, PageHeader, SectionTitle } from "../_ui";
import MissingStudent from "../MissingStudent";
import UebenList, { type VAssignment } from "./UebenList";

// "Üben" — o'quvchining uy vazifalari sahifasi (Start ekrani uslubida).
// Topshiriqlar o'quvchi a'zo bo'lgan guruhlardan olinadi; topshirish
// submitAssignment server action orqali (o'zini o'zi himoyalaydi).

export default async function StudentUebenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return <MissingStudent />; // redirect("/dashboard") aylanish hosil qilardi

  const assignments = await prisma.assignment.findMany({
    where: { group: { students: { some: { studentId: student.id, isActive: true } } } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true, title: true, type: true, skill: true, maxScore: true, dueAt: true, note: true, createdAt: true,
      group: { select: { name: true } },
      submissions: {
        where: { studentId: student.id },
        orderBy: { attempt: "desc" },
        take: 1,
        select: { attempt: true, score: true, status: true, teacherNote: true, content: true, createdAt: true },
      },
    },
  });

  const items: VAssignment[] = assignments.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    skill: a.skill,
    maxScore: a.maxScore,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    note: a.note,
    groupName: a.group.name,
    createdAt: a.createdAt.toISOString(),
    last: a.submissions[0]
      ? {
          attempt: a.submissions[0].attempt,
          score: a.submissions[0].score,
          status: a.submissions[0].status,
          teacherNote: a.submissions[0].teacherNote,
          content: a.submissions[0].content,
          createdAt: a.submissions[0].createdAt.toISOString(),
        }
      : null,
  }));

  // ── Yig'ma ko'rsatkichlar ──
  const neu = items.filter((i) => !i.last).length;
  const waiting = items.filter((i) => i.last?.status === "SUBMITTED").length;
  const graded = items.filter((i) => i.last?.status === "GRADED");
  const avg = graded.length
    ? Math.round(graded.reduce((n, i) => n + ((i.last?.score ?? 0) / (i.maxScore || 100)) * 100, 0) / graded.length)
    : null;

  const tiles = [
    { label: "Neu", value: String(neu) },
    { label: "Wartet", value: String(waiting) },
    { label: "Ø Note", value: avg === null ? "—" : `${avg}%` },
  ];

  return (
    <div className="space-y-[18px]">
      <PageHeader title="Üben" subtitle="Deine Hausaufgaben" />

      {/* ── Jang / o'yinlar ── */}
      <Link
        href="/student/battle"
        className="relative flex items-center gap-3 overflow-hidden rounded-[24px] p-5 text-white shadow-[0_14px_28px_rgba(29,78,216,0.3)]"
        style={{ background: "linear-gradient(120deg, #1d4ed8 0%, #3b82f6 55%, #60a5fa 100%)" }}
      >
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3.5 19 17.5M19 3.5 5 17.5" />
            <path d="M3.5 19.5h5M15.5 19.5h5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-extrabold leading-tight">Jang va o'yinlar</div>
          <div className="mt-0.5 text-[13px] text-white/80">Vocabulary · So'z o'yini · Krossvord</div>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>

      {/* ── Yig'ma kartalar ── */}
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`${CARD} flex flex-col items-center gap-1.5 px-1.5 pb-4 pt-4`}>
            <span className="text-[22px] font-extrabold leading-none" style={{ color: NAVY }}>{t.value}</span>
            <span className="text-[12px] font-medium text-slate-500">{t.label}</span>
          </div>
        ))}
      </div>

      <SectionTitle>Aufgaben</SectionTitle>
      <UebenList items={items} />
    </div>
  );
}
