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
