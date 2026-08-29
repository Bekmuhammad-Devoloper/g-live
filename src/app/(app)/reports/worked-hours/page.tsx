import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { branchViaGroup } from "@/lib/branchScope";
import { Forbidden } from "../../_components/ui";
import LicenseBanner from "../../_components/LicenseBanner";
import WorkedHoursView, { type WLesson } from "./WorkedHoursView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER, ROLES.TEACHER];

const p2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// O'quv markazga ishlab berilgan soatlar — o'tilgan darslar soatlari
// (o'qituvchi / xona / kurs kesimida, davr bo'yicha).
export default async function WorkedHoursPage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })} body={tr(s.locale, { uz: "Bu hisobot rahbariyat uchun.", ru: "Этот отчёт для руководства.", en: "This report is for management.", de: "Dieser Bericht ist für die Geschäftsleitung." })} />;
  }

  // O'qituvchi bo'lsa — faqat o'z darslari (o'ziga mos ma'lumot)
  const isTeacher = s.role === ROLES.TEACHER;
  const lessons = await prisma.lesson.findMany({
    where: { AND: [isTeacher ? { group: { teacherId: s.userId } } : {}, branchViaGroup(s)] }, // faol filial doirasida
    select: {
      startsAt: true,
      endsAt: true,
      group: { select: { room: true, teacher: { select: { fullName: true } }, program: { select: { name: true } } } },
    },
  });

  const wlessons: WLesson[] = lessons.map((l) => ({
    teacher: l.group.teacher?.fullName ?? tr(s.locale, { uz: "Belgilanmagan", ru: "Не указано", en: "Unassigned", de: "Nicht zugewiesen" }),
    room: l.group.room ?? tr(s.locale, { uz: "Belgilanmagan", ru: "Не указано", en: "Unassigned", de: "Nicht zugewiesen" }),
    course: l.group.program.name,
    startsAt: l.startsAt.toISOString(),
    hours: l.endsAt ? Math.round(((l.endsAt.getTime() - l.startsAt.getTime()) / 3600000) * 10) / 10 : 1.5,
  }));

  const now = new Date();
  const defaultFrom = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = isoDay(now);

  return (
    <div>
      <LicenseBanner />
      <WorkedHoursView lessons={wlessons} defaultFrom={defaultFrom} defaultTo={defaultTo} locale={s.locale} />
    </div>
  );
}
