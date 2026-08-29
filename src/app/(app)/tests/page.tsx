import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import TestsWorkspace, { type VBlockTest, type VTestType } from "./TestsWorkspace";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
const CAN_CREATE = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date | null) => (d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}` : "");
const idsToNames = (raw: string | null, map: Map<string, string>) =>
  (raw ? raw.split(",").map((id) => map.get(id.trim())).filter((x): x is string => !!x) : []);

export default async function TestsPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu bo'lim o'quv bo'limi uchun.", ru: "Этот раздел предназначен для учебного отдела.", en: "This section is for the education department.", de: "Dieser Bereich ist für die Bildungsabteilung." })} />;
  }

  const [blockTests, testTypes, staff, groups, programs] = await Promise.all([
    prisma.blockTest.findMany({ where: branchWhere(s), orderBy: { createdAt: "desc" } }), // faol filial testlari
    prisma.testType.findMany({ orderBy: { createdAt: "desc" } }),
    // xodimlar va guruhlar — faol filial doirasida
    prisma.user.findMany({ where: { AND: [{ role: { notIn: [ROLES.STUDENT, ROLES.PARENT] }, isActive: true }, branchWhere(s)] }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.group.findMany({ where: branchWhere(s), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.program.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const staffMap = new Map(staff.map((x) => [x.id, x.fullName]));
  const groupMap = new Map(groups.map((x) => [x.id, x.name]));
  const programMap = new Map(programs.map((x) => [x.id, x.name]));

  const exams: VBlockTest[] = blockTests.map((b) => ({
    id: b.id,
    title: b.title,
    type: b.type,
    status: b.status,
    date: fmtDate(b.date),
    startTime: b.startTime,
    durationMin: b.durationMin,
    responsible: b.responsibleId ? staffMap.get(b.responsibleId) ?? null : null,
    groups: idsToNames(b.groupIds, groupMap),
  }));

  const types: VTestType[] = testTypes.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    durationMin: t.durationMin,
    courses: idsToNames(t.courseIds, programMap),
    active: t.isActive,
    createdAt: fmtDate(t.createdAt),
  }));

  return (
    <TestsWorkspace
      locale={s.locale}
      exams={exams}
      types={types}
      canCreate={CAN_CREATE.includes(s.role as never)}
      staff={staff.map((x) => ({ id: x.id, name: x.fullName }))}
      groups={groups.map((x) => ({ id: x.id, name: x.name }))}
      programs={programs.map((x) => ({ id: x.id, name: x.name }))}
    />
  );
}
