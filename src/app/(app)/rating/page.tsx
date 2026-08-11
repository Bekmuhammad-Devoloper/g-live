import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import RatingView, { type VRatingStudent } from "./RatingView";
import type { Prisma } from "@prisma/client";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.TEACHER];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function RatingPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(s.locale, { uz: "Bu bo'lim xodimlar uchun.", ru: "Этот раздел для сотрудников.", en: "This section is for staff." })}
      />
    );
  }

  // O'qituvchi faqat o'z guruhlaridagi o'quvchilarni ko'radi
  let where: Prisma.StudentWhereInput = {};
  if (s.role === ROLES.TEACHER) where = { enrollments: { some: { group: { teacherId: s.userId } } } };

  const students = await prisma.student.findMany({
    where,
    include: {
      submissions: {
        where: { score: { not: null } },
        select: { score: true, gradedAt: true, createdAt: true, assignment: { select: { maxScore: true } } },
      },
      enrollments: { include: { group: { select: { name: true } } } },
    },
  });

  const rows: VRatingStudent[] = students.map((st) => ({
    id: st.id,
    name: st.fullName,
    group: st.enrollments[0]?.group.name ?? null,
    marks: st.submissions.map((x) => ({
      date: (x.gradedAt ?? x.createdAt).toISOString(),
      pct: Math.round(((x.score ?? 0) / (x.assignment.maxScore || 100)) * 100),
    })),
  }));

  const now = new Date();
  const from = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = iso(now);

  return <RatingView students={rows} defaultFrom={from} defaultTo={to} locale={s.locale} />;
}
