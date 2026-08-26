import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../../_components/ui";
import StudentProfile, { type SProfile } from "./StudentProfile";

// O'quvchi profili — jadvaldagi qatordan bosilganda shu sahifa ochiladi.
// Ruxsat ro'yxatlari /students bilan bir xil; o'qituvchi faqat o'z
// guruhidagi o'quvchini ko'radi (aks holda notFound).
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.TEACHER, ROLES.ACCOUNTANT];

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();

  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(s.locale, { uz: "Bu bo'lim xodimlar uchun.", ru: "Этот раздел для сотрудников.", en: "This section is for staff." })}
      />
    );
  }

  const student = await prisma.student.findFirst({
    // Filial doirasi ro'yxatdagi bilan bir xil — boshqa filial o'quvchisi ochilmaydi
    where: { AND: [{ id }, branchWhere(s)] },
    include: {
      branch: { select: { name: true } },
      enrollments: {
        orderBy: { joinedAt: "desc" },
        include: {
          group: {
            select: {
              id: true, name: true, room: true, status: true, weekdays: true,
              startTime: true, endTime: true,
              program: { select: { name: true } },
              teacher: { select: { fullName: true } },
            },
          },
        },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
      examResults: { orderBy: { takenAt: "desc" }, take: 10, include: { exam: { select: { title: true, passScore: true } } } },
      attendances: { orderBy: { markedAt: "desc" }, take: 60, include: { lesson: { select: { startsAt: true, group: { select: { name: true } } } } } },
      parents: { include: { parent: { select: { fullName: true, phone: true } } } },
      lead: { select: { id: true, source: true, stage: true, manager: { select: { fullName: true } } } },
    },
  });

  if (!student) notFound();

  // O'qituvchi faqat o'z guruhidagi o'quvchini ko'radi
  if (s.role === ROLES.TEACHER) {
    const mine = await prisma.groupStudent.findFirst({
      where: { studentId: id, group: { teacherId: s.userId } },
      select: { id: true },
    });
    if (!mine) notFound();
  }

  const paid = student.payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amount, 0);
  const debt = student.payments.filter((p) => p.status === "PENDING").reduce((n, p) => n + p.amount, 0);

  const att = student.attendances;
  const present = att.filter((a) => ["PRESENT", "LATE", "ONLINE", "MAKEUP"].includes(a.status)).length;
  const attendancePct = att.length ? Math.round((present / att.length) * 100) : null;

  const profile: SProfile = {
    id: student.id,
    fullName: student.fullName,
    phone: student.phone,
    imageUrl: student.imageUrl,
    birthDate: iso(student.birthDate),
    currentLevel: student.currentLevel,
    eduStatus: student.eduStatus,
    branchName: student.branch?.name ?? null,
    note: student.note,
    joined: iso(student.createdAt)!,
    paid,
    debt,
    attendancePct,
    lessonsCounted: att.length,
    groups: student.enrollments.map((e) => ({
      id: e.group.id,
      name: e.group.name,
      course: e.group.program.name,
      teacher: e.group.teacher?.fullName ?? null,
      room: e.group.room,
      status: e.group.status,
      weekdays: e.group.weekdays,
      startTime: e.group.startTime,
      endTime: e.group.endTime,
      joinedAt: iso(e.joinedAt)!,
      isActive: e.isActive,
    })),
    payments: student.payments.map((p) => ({
      id: p.id, amount: p.amount, method: p.method, status: p.status,
      purpose: p.purpose, createdAt: iso(p.createdAt)!,
    })),
    exams: student.examResults.map((r) => ({
      id: r.id, title: r.exam.title, score: r.score, passScore: r.exam.passScore,
      status: r.status, takenAt: iso(r.takenAt)!,
    })),
    attendance: att.slice(0, 20).map((a) => ({
      id: a.id, status: a.status, group: a.lesson.group.name, date: iso(a.lesson.startsAt)!,
    })),
    parents: student.parents.map((sp) => ({
      name: sp.parent.fullName, phone: sp.parent.phone, relation: sp.relation,
    })),
    lead: student.lead
      ? { id: student.lead.id, source: student.lead.source, stage: student.lead.stage, manager: student.lead.manager?.fullName ?? null }
      : null,
  };

  return <StudentProfile profile={profile} locale={s.locale as Locale} />;
}

export const dynamic = "force-dynamic";
