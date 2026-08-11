import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { StatCard, Badge, Forbidden } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import CoursesTable, { type CourseRow } from "./CoursesTable";
import AddCourseButton from "./AddCourseButton";

const ALLOWED = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];

const WD = ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const daysLabel = (raw: string | null) =>
  raw
    ? raw.split(",").map(Number).filter((n) => n >= 1 && n <= 7).map((d) => WD[d]).join(", ") || "—"
    : "—";

const statusTone: Record<string, "green" | "amber" | "slate" | "red"> = {
  ACTIVE: "green",
  PLANNED: "amber",
  FINISHED: "slate",
  CANCELLED: "red",
};

// Onlayn yoki offline kurslar (guruhlar) ro'yxati — o'quv shakli (format) bo'yicha.
export default async function CoursesSection({ mode }: { mode: "ONLINE" | "OFFLINE" }) {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim o'quv bo'limi uchun.", ru: "Этот раздел для учебного отдела.", en: "This section is for the education department." })} />;
  }

  const formats = mode === "ONLINE" ? ["ONLINE", "HYBRID"] : ["OFFLINE", "HYBRID"];
  let where: Prisma.GroupWhereInput = { format: { in: formats } };
  // O'qituvchi faqat o'z guruhlarini ko'radi
  if (s.role === ROLES.TEACHER) where = { ...where, teacherId: s.userId };

  const groups = await prisma.group.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      teacher: { select: { fullName: true } },
      program: { select: { name: true } },
      _count: { select: { students: true } },
    },
  });

  const activeCount = groups.filter((g) => g.status === "ACTIVE").length;
  const studentsTotal = groups.reduce((n, g) => n + g._count.students, 0);
  const isOnline = mode === "ONLINE";
  const canAddCourse = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN].includes(s.role as never);

  const rows: CourseRow[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    isHybrid: g.format === "HYBRID",
    programName: g.program.name,
    levelCode: g.levelCode ?? "—",
    daysLabel: daysLabel(g.weekdays),
    timeLabel: g.startTime ? `${g.startTime}${g.endTime ? "–" + g.endTime : ""}` : "—",
    studentsCount: g._count.students,
    capacity: g.capacity,
    teacherName: g.teacher?.fullName ?? "—",
    status: g.status,
    onlineLink: g.onlineLink ?? null,
    room: g.room ?? "—",
  }));

  return (
    <>
      {/* Kurs qo'shish paneli */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Icon name="layers" className="h-5 w-5" /></span>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{tr(s.locale, { uz: "Kurslar (dasturlar)", ru: "Курсы (программы)", en: "Courses (programs)" })}</h2>
            <p className="text-xs text-slate-400">{tr(s.locale, { uz: "Yangi kurs qo'shing yoki barcha kurslarni boshqaring", ru: "Добавьте новый курс или управляйте всеми курсами", en: "Add a new course or manage all courses" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/courses" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            <Icon name="listView" className="h-4 w-4" /> {tr(s.locale, { uz: "Barcha kurslar", ru: "Все курсы", en: "All courses" })}
          </Link>
          {canAddCourse && <AddCourseButton locale={s.locale} />}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={isOnline ? tr(s.locale, { uz: "Onlayn kurslar", ru: "Онлайн-курсы", en: "Online courses" }) : tr(s.locale, { uz: "Offline kurslar", ru: "Офлайн-курсы", en: "Offline courses" })} value={groups.length} tone="brand" icon={isOnline ? "video" : "building"} />
        <StatCard label={tr(s.locale, { uz: "Faol", ru: "Активные", en: "Active" })} value={activeCount} tone="green" icon="check" />
        <StatCard label={tr(s.locale, { uz: "O'quvchilar", ru: "Ученики", en: "Students" })} value={studentsTotal} icon="graduation" />
        <StatCard label={tr(s.locale, { uz: "O'quv shakli", ru: "Форма обучения", en: "Study format" })} value={isOnline ? tr(s.locale, { uz: "Masofaviy", ru: "Дистанционно", en: "Remote" }) : tr(s.locale, { uz: "Auditoriya", ru: "Аудитория", en: "Classroom" })} icon="layers" />
      </div>

      <CoursesTable rows={rows} isOnline={isOnline} locale={s.locale} />

      <p className="mt-4 text-xs text-slate-400">
        ℹ️ {tr(s.locale, { uz: "O'quv shakli (onlayn/offline/aralash) guruh yaratishda belgilanadi.", ru: "Форма обучения (онлайн/офлайн/смешанная) задаётся при создании группы.", en: "The study format (online/offline/hybrid) is set when creating a group." })}{" "}
        <span className="text-slate-500">{tr(s.locale, { uz: "Holat bo'yicha:", ru: "По статусу:", en: "By status:" })} <Badge tone={statusTone.ACTIVE}>{tr(s.locale, { uz: "Faol", ru: "Активные", en: "Active" })}</Badge> — {activeCount} {tr(s.locale, { uz: "ta, jami —", ru: "шт., всего —", en: ", total —" })} {groups.length} {tr(s.locale, { uz: "ta.", ru: "шт.", en: "." })}</span>
      </p>
    </>
  );
}
