import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { Forbidden } from "../_components/ui";
import CoursesView, { type VCourse } from "./CoursesView";

// Kurslarni boshqarish: rahbariyat + menejer. O'qituvchi ham kiradi, lekin
// faqat O'Z guruhlari foydalanadigan kurslarni ko'radi (dars yuklash uchun).
const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER, ROLES.TEACHER];

export default async function CoursesPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title="Kirish taqiqlangan" body="Bu bo'lim rahbariyat uchun." />;
  }

  // Kurs katalogi hamma filialda umumiy, lekin guruhlar soni faol filial bo'yicha
  // O'qituvchi — faqat o'zi dars beradigan guruhlarning kurslari
  const scope = s.role === ROLES.TEACHER ? { groups: { some: { teacherId: s.userId } } } : {};

  const programs = await prisma.program.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { levels: true, groups: { where: branchWhere(s) } } } },
  });

  const firstBanner = (raw: string | null): string | null => {
    if (!raw) return null;
    try { const a = JSON.parse(raw); return Array.isArray(a) && typeof a[0] === "string" ? a[0] : null; } catch { return null; }
  };

  const courses: VCourse[] = programs.map((p) => ({
    id: p.id,
    name: p.name,
    levels: p._count.levels,
    groups: p._count.groups,
    banner: firstBanner(p.banners),
    monthlyFee: p.monthlyFee,
  }));

  return <CoursesView courses={courses} />;
}
