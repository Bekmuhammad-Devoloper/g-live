import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import StaffRatingView, { type VRating } from "./StaffRatingView";

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const fmtDate = (d: Date | null) => (d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}` : "—");
const fmtDT = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export default async function StaffRatingPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You don't have access to this section.", de: "Sie haben keine Berechtigung für diesen Bereich." })} />;
  }

  const [feedback, teachersDb, studentsDb, groupsDb, programsDb] = await Promise.all([
    // Feedback modelida branchId ham, relation ham yo'q — filial bo'yicha
    // quyida o'qituvchi ro'yxati orqali filtrlanadi.
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.user.findMany({ where: { AND: [{ role: ROLES.TEACHER }, branchWhere(s)] }, select: { id: true, fullName: true } }), // faol filial doirasida
    prisma.student.findMany({ where: branchWhere(s), select: { id: true, fullName: true } }), // faol filial doirasida
    prisma.group.findMany({ where: branchWhere(s), select: { id: true, name: true, program: { select: { name: true } } } }), // faol filial doirasida
    prisma.program.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const tMap = new Map(teachersDb.map((x) => [x.id, x.fullName]));
  const stMap = new Map(studentsDb.map((x) => [x.id, x.fullName]));
  const gMap = new Map(groupsDb.map((x) => [x.id, { name: x.name, course: x.program?.name ?? null }]));

  // faol filial doirasida: faqat shu filial o'qituvchilariga tegishli baholar
  const scopedFeedback = s.branchId ? feedback.filter((f) => tMap.has(f.teacherId)) : feedback;

  const rows: VRating[] = scopedFeedback.map((f) => {
    const g = f.groupId ? gMap.get(f.groupId) : null;
    return {
      id: f.id,
      teacher: tMap.get(f.teacherId) ?? "—",
      student: f.studentId ? stMap.get(f.studentId) ?? null : null,
      course: g?.course ?? null,
      group: g?.name ?? null,
      lessonDate: fmtDate(f.lessonDate),
      comment: f.comment,
      dateIso: isoDay(f.createdAt),
      dateLabel: fmtDT(f.createdAt),
      rating: f.rating,
    };
  });

  const opts = {
    groups: groupsDb.map((x) => x.name).sort(),
    courses: programsDb.map((x) => x.name),
    teachers: teachersDb.map((x) => x.fullName).sort(),
    students: studentsDb.map((x) => x.fullName).sort(),
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Xodimlar reytingi", ru: "Рейтинг сотрудников", en: "Staff rating", de: "Mitarbeiterbewertung" })}</h1>
      <StaffRatingView rows={rows} opts={opts} locale={s.locale} />
    </div>
  );
}
