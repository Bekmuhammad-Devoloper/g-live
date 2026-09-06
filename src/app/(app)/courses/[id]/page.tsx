import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLevelCodes } from "@/lib/studyLevels";
import { ROLES } from "@/lib/constants";
import { Forbidden } from "../../_components/ui";
import CourseDetail, { type CourseData } from "./CourseDetail";

// Kurs sahifasi: rahbariyat + menejer to'liq boshqaradi.
// O'qituvchi kiradi (dars yuklash uchun), lekin kursning o'zini tahrirlay/o'chira olmaydi.
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER, ROLES.TEACHER];
const CAN_EDIT_COURSE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title="Kirish taqiqlangan" body="Bu bo'lim rahbariyat uchun." />;
  }

  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      levels: { orderBy: { order: "asc" } },
      groups: {
        orderBy: { createdAt: "desc" },
        include: { teacher: { select: { fullName: true } }, _count: { select: { students: true } } },
      },
      materials: { orderBy: { createdAt: "desc" } },
      courseLessons: { orderBy: { order: "asc" } },
    },
  });
  if (!program) notFound();

  // O'qituvchi faqat o'z guruhlari foydalanadigan kursga kira oladi
  if (s.role === ROLES.TEACHER && !program.groups.some((g) => g.teacherId === s.userId)) notFound();

  const studentsTotal = program.groups.reduce((n, g) => n + g._count.students, 0);

  let banners: string[] = [];
  if (program.banners) { try { const a = JSON.parse(program.banners); if (Array.isArray(a)) banners = a.filter((x): x is string => typeof x === "string"); } catch { /* ignore */ } }

  const data: CourseData = {
    id: program.id,
    name: program.name,
    description: program.description,
    banners,
    monthlyFee: program.monthlyFee,
    studentsTotal,
    levels: program.levels.map((l) => ({
      id: l.id, code: l.code, name: l.name, weeks: l.weeks, academicHours: l.academicHours, passScore: l.passScore,
    })),
    groups: program.groups.map((g) => ({
      id: g.id, name: g.name, teacher: g.teacher?.fullName ?? null, students: g._count.students, status: g.status,
    })),
    materials: program.materials.map((m) => ({
      id: m.id, title: m.title, kind: m.kind, url: m.url, levelCode: m.levelCode, note: m.note,
    })),
    courseLessons: program.courseLessons.map((cl) => ({
      id: cl.id, order: cl.order, levelCode: cl.levelCode, title: cl.title, topic: cl.topic, videoUrl: cl.videoUrl, vocabFileUrl: cl.vocabFileUrl, materialUrl: cl.materialUrl, assignment: cl.assignment, assignmentFileUrl: cl.assignmentFileUrl, homework: cl.homework, homeworkFileUrl: cl.homeworkFileUrl,
    })),
    levelCodes: await getLevelCodes(),
    canManage: true,
    canEditCourse: CAN_EDIT_COURSE.includes(s.role as never),
    locale: s.locale,
  };

  return <CourseDetail course={data} />;
}
