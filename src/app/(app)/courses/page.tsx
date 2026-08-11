import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { Forbidden } from "../_components/ui";
import CoursesView, { type VCourse } from "./CoursesView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

export default async function CoursesPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title="Kirish taqiqlangan" body="Bu bo'lim rahbariyat uchun." />;
  }

  const programs = await prisma.program.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { levels: true, groups: true } } },
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
  }));

  return <CoursesView courses={courses} />;
}
