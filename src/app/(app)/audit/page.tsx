import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, type Locale } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import { Icon } from "../_components/Icon";
import LicenseBanner from "../_components/LicenseBanner";
import UserAvatar from "../_components/UserAvatar";
import AuditExport from "./AuditExport";
import type { Prisma } from "@prisma/client";

const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];

type Tr = { uz: string; ru: string; en: string };

// Holat filtri chiplari → entityType(lar)
const FILTERS: { key: string; label: Tr; entity: string[] | "other" }[] = [
  { key: "user", label: { uz: "User", ru: "Ученик", en: "User" }, entity: ["Student"] },
  { key: "kurs", label: { uz: "Kurs", ru: "Курс", en: "Course" }, entity: ["Program"] },
  { key: "guruh", label: { uz: "Guruh", ru: "Группа", en: "Group" }, entity: ["Group"] },
  { key: "xona", label: { uz: "Xona", ru: "Кабинет", en: "Room" }, entity: ["Room"] },
  { key: "tolov", label: { uz: "To'lov", ru: "Платёж", en: "Payment" }, entity: ["Payment"] },
  { key: "xodim", label: { uz: "Xodim", ru: "Сотрудник", en: "Staff" }, entity: ["User"] },
  { key: "boshqa", label: { uz: "Boshqa", ru: "Другое", en: "Other" }, entity: "other" },
];
const KNOWN = ["Student", "Program", "Group", "Room", "Payment", "User"];

const ENTITY_LABEL: Record<string, Tr> = {
  Payment: { uz: "To'lov", ru: "Платёж", en: "Payment" }, Lead: { uz: "Lid", ru: "Лид", en: "Lead" }, Group: { uz: "Guruh", ru: "Группа", en: "Group" }, Student: { uz: "O'quvchi", ru: "Ученик", en: "Student" }, User: { uz: "Xodim", ru: "Сотрудник", en: "Staff" }, Room: { uz: "Xona", ru: "Кабинет", en: "Room" },
  Branch: { uz: "Filial", ru: "Филиал", en: "Branch" }, StaffRole: { uz: "Rol", ru: "Роль", en: "Role" }, Tag: { uz: "Teg", ru: "Тег", en: "Tag" }, Assignment: { uz: "Vazifa", ru: "Задача", en: "Task" }, BlockTest: { uz: "Blok test", ru: "Блок-тест", en: "Block test" },
  TestType: { uz: "Test turi", ru: "Тип теста", en: "Test type" }, TeacherSalary: { uz: "Maosh", ru: "Зарплата", en: "Salary" }, TeacherSchedule: { uz: "Ish jadvali", ru: "Расписание", en: "Schedule" }, Program: { uz: "Kurs", ru: "Курс", en: "Course" }, Lesson: { uz: "Dars", ru: "Урок", en: "Lesson" },
  Attendance: { uz: "Davomat", ru: "Посещаемость", en: "Attendance" }, Certificate: { uz: "Sertifikat", ru: "Сертификат", en: "Certificate" }, Call: { uz: "Qo'ng'iroq", ru: "Звонок", en: "Call" }, Notification: { uz: "Bildirishnoma", ru: "Уведомление", en: "Notification" },
};
const ACTION_LABEL: Record<string, Tr> = {
  CREATE: { uz: "Yaratildi", ru: "Создано", en: "Created" }, UPDATE: { uz: "O'zgartirildi", ru: "Изменено", en: "Updated" }, DELETE: { uz: "O'chirildi", ru: "Удалено", en: "Deleted" }, CANCEL: { uz: "Bekor qilindi", ru: "Отменено", en: "Cancelled" }, LOGIN: { uz: "Tizimga kirdi", ru: "Вход в систему", en: "Logged in" },
};
const entityLabel = (locale: Locale, t: string) => (ENTITY_LABEL[t] ? tr(locale, ENTITY_LABEL[t]) : t);
const actionLabel = (locale: Locale, a: string) => (ACTION_LABEL[a] ? tr(locale, ACTION_LABEL[a]) : a);
// Amal turi bo'yicha rang (yaratish=yashil, o'zgartirish=ko'k, o'chirish/bekor=qizil)
const ACTION_TONE: Record<string, string> = {
  CREATE: "text-emerald-600 dark:text-emerald-400",
  UPDATE: "text-brand-600 dark:text-brand-300",
  DELETE: "text-red-600 dark:text-red-400",
  CANCEL: "text-red-600 dark:text-red-400",
  LOGIN: "text-slate-500 dark:text-slate-400",
};
const p2 = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession();
  if (!CAN.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Audit jurnali faqat rahbariyat uchun.", ru: "Журнал аудита только для руководства.", en: "The audit log is for management only." })} />;
  }
  const sp = await searchParams;
  const type = sp.type || "";
  const q = (sp.q || "").trim();
  const fromStr = sp.from || "";
  const toStr = sp.to || "";
  const limit = Math.min(500, Math.max(20, Number(sp.limit) || 30));

  const f = FILTERS.find((x) => x.key === type);
  const typeWhere: Prisma.AuditLogWhereInput = f
    ? f.entity === "other" ? { entityType: { notIn: KNOWN } } : { entityType: { in: f.entity } }
    : {};

  const dateWhere: Prisma.AuditLogWhereInput = {};
  if (fromStr || toStr) {
    dateWhere.createdAt = {
      ...(fromStr ? { gte: new Date(fromStr + "T00:00:00") } : {}),
      ...(toStr ? { lte: new Date(toStr + "T23:59:59") } : {}),
    };
  }

  const searchWhere: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { reason: { contains: q } },
          { entityType: { contains: q } },
          { entityId: { contains: q } },
          { action: { contains: q } },
          { actor: { is: { fullName: { contains: q } } } },
          { actor: { is: { phone: { contains: q } } } },
        ],
      }
    : {};

  // AuditLog'da branchId yo'q — faol filial xodimlari (muallif) orqali cheklaymiz
  const branchStaff = s.branchId ? await prisma.user.findMany({ where: branchWhere(s), select: { id: true } }) : null;
  const branchScope: Prisma.AuditLogWhereInput = branchStaff ? { actorId: { in: branchStaff.map((x) => x.id) } } : {};

  const where: Prisma.AuditLogWhereInput = { AND: [typeWhere, dateWhere, searchWhere, branchScope] };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, include: { actor: { select: { fullName: true, phone: true } } } }),
    prisma.auditLog.count({ where }),
  ]);

  const exportData = logs.map((l) => ({
    date: fmt(l.createdAt),
    entity: entityLabel(s.locale, l.entityType),
    action: actionLabel(s.locale, l.action),
    actor: l.actor?.fullName ?? tr(s.locale, { uz: "Tizim", ru: "Система", en: "System" }),
    phone: l.actor?.phone ?? "",
    reason: l.reason ?? "",
  }));

  const baseParams = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (fromStr) params.set("from", fromStr);
    if (toStr) params.set("to", toStr);
    return params;
  };
  const chipHref = (key: string) => {
    const params = baseParams();
    if (key !== type) params.set("type", key);
    const qs = params.toString();
    return qs ? `/audit?${qs}` : "/audit";
  };
  const moreHref = () => {
    const params = baseParams();
    if (type) params.set("type", type);
    params.set("limit", String(limit + 30));
    return `/audit?${params.toString()}`;
  };
  const hasFilter = Boolean(type || q || fromStr || toStr);

  return (
    <div>
      <LicenseBanner />
      <div className="flex flex-col gap-5 lg:flex-row">
      {/* Chap: jurnallar ro'yxati */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{tr(s.locale, { uz: "Jurnallar", ru: "Журналы", en: "Logs" })}</h1>
            <span className="text-xs font-medium text-slate-400">{total} {tr(s.locale, { uz: "ta yozuv", ru: "записей", en: "records" })}</span>
          </div>
          <div className="flex items-center gap-3">
            <AuditExport rows={exportData} locale={s.locale} />
            <UserAvatar name={s.fullName} role={s.role} size="sm" className="!h-9 !w-9 !rounded-full" />
          </div>
        </div>

        {/* Qidiruv va sana filtri */}
        <form method="GET" className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          {type && <input type="hidden" name="type" value={type} />}
          <div className="relative flex-1 min-w-[180px]">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} placeholder={tr(s.locale, { uz: "Qidiruv (xodim, izoh, obyekt)", ru: "Поиск (сотрудник, комментарий, объект)", en: "Search (staff, comment, object)" })} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div className="relative">
            <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="date" name="from" defaultValue={fromStr} className="h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-2 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <span className="text-slate-300">–</span>
          <div className="relative">
            <Icon name="calendar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="date" name="to" defaultValue={toStr} className="h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-2 text-sm text-slate-700 outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <button type="submit" className="h-10 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700">{tr(s.locale, { uz: "Filtr", ru: "Фильтр", en: "Filter" })}</button>
          {hasFilter && <Link href="/audit" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700" title={tr(s.locale, { uz: "Tozalash", ru: "Очистить", en: "Clear" })}><Icon name="refresh" className="h-4 w-4" /></Link>}
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">{tr(s.locale, { uz: "Jurnal bo'sh", ru: "Журнал пуст", en: "Log is empty" })}</div>
          ) : logs.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
              <div className="min-w-0 flex-1">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{entityLabel(s.locale, l.entityType)}</span>
                <div className={`mt-1 truncate text-sm font-medium ${ACTION_TONE[l.action] ?? "text-slate-500"}`}>
                  {actionLabel(s.locale, l.action)}{l.reason ? ` · ${l.reason}` : ""}
                </div>
              </div>
              <div className="hidden min-w-0 items-center gap-1.5 text-sm text-slate-500 md:flex">
                <Icon name="user" className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{l.actor?.fullName ?? tr(s.locale, { uz: "Tizim", ru: "Система", en: "System" })}</span>
                {l.actor?.phone && <span className="text-slate-400">· {l.actor.phone}</span>}
              </div>
              <div className="shrink-0 whitespace-nowrap text-sm tabular-nums text-slate-400">{fmt(l.createdAt)}</div>
            </div>
          ))}
        </div>

        {logs.length < total && (
          <div className="flex justify-center border-t border-slate-100 py-4 dark:border-slate-800">
            <Link href={moreHref()} className="rounded-full bg-brand-600 px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">{tr(s.locale, { uz: "Ko'proq ...", ru: "Ещё ...", en: "More ..." })}</Link>
          </div>
        )}
      </div>

      {/* O'ng: Holat filtri */}
      <div className="w-full shrink-0 lg:w-72">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">{tr(s.locale, { uz: "Holat filtri", ru: "Фильтр по статусу", en: "Status filter" })}</h3>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((c) => {
              const active = type === c.key;
              return (
                <Link key={c.key} href={chipHref(c.key)}
                  className={active
                    ? "rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm"
                    : "rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300"}>
                  {tr(s.locale, c.label)}
                </Link>
              );
            })}
          </div>
          {type && <Link href="/audit" className="mt-3 inline-block text-xs text-slate-400 hover:text-slate-600">✕ {tr(s.locale, { uz: "Filtrni tozalash", ru: "Очистить фильтр", en: "Clear filter" })}</Link>}
        </div>
      </div>
      </div>
    </div>
  );
}
