import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { Forbidden } from "../../_components/ui";
import CourseDetail, { type CourseData } from "./CourseDetail";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

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

  const studentsTotal = program.groups.reduce((n, g) => n + g._count.students, 0);

  let banners: string[] = [];
  if (program.banners) { try { const a = JSON.parse(program.banners); if (Array.isArray(a)) banners = a.filter((x): x is string => typeof x === "string"); } catch { /* ignore */ } }

  const data: CourseData = {
    id: program.id,
    name: program.name,
    description: program.description,
    banners,
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
      id: cl.id, order: cl.order, title: cl.title, topic: cl.topic, videoUrl: cl.videoUrl, materialUrl: cl.materialUrl, assignment: cl.assignment, assignmentFileUrl: cl.assignmentFileUrl, homework: cl.homework, homeworkFileUrl: cl.homeworkFileUrl,
    })),
    canManage: true,
    locale: s.locale,
  };

  return <CourseDetail course={data} />;
}
