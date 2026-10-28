import "server-only";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { getDefaultMonthlyFee } from "./debt";
import { ROLES } from "./constants";

export const SALARY_TYPES = [
  "fixed",
  "by_student_fixed",
  "by_student_percentage",
  "percentage_by_student_payment",
  "per_lesson_fixed",
  "per_lesson_percentage",
] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

export function normalizeSalaryType(t: string): SalaryType {
  if (t === "FIXED") return "fixed";
  if (t === "PERCENT") return "percentage_by_student_payment";
  return (SALARY_TYPES as readonly string[]).includes(t) ? (t as SalaryType) : "fixed";
}

export const isPercentSalaryType = (t: string) => normalizeSalaryType(t).includes("percentage");

export const SALARY_SETTING_KEYS = [
  "use_student_discount_price",
  "use_archived_students",
  "hide_zero_amount_students",
  "belongs_to_attendance",
  "get_only_teachers_attendance",
  "get_only_came_attendance",
  "use_trial_students",
  "use_frozen_students",
] as const;
export type SalarySettingKey = (typeof SALARY_SETTING_KEYS)[number];
export type SalarySettings = Record<SalarySettingKey, boolean>;
export const salarySettingKey = (k: SalarySettingKey) => `salary_settings.${k}`;

export async function getSalarySettings(): Promise<SalarySettings> {
  const raw = await getSettings(SALARY_SETTING_KEYS.map(salarySettingKey));
  return Object.fromEntries(SALARY_SETTING_KEYS.map((k) => [k, raw[salarySettingKey(k)] === "1"])) as SalarySettings;
}

const CAME = new Set(["PRESENT", "LATE", "ONLINE", "MAKEUP"]);
const NOT_CAME = new Set(["ABSENT", "EXCUSED"]);
const ARCHIVED = new Set(["ARCHIVED", "EXPELLED"]);

export interface SalaryDetailRow {
  groupId: string | null;
  groupName: string | null;
  programId: string | null;
  programName: string | null;
  studentId: string | null;
  studentName: string | null;
  studentStatus: string | null;
  lessons: number;
  came: number;
  notCame: number;
  notMarked: number;
  paid: number | null;
  assigned: number;
  amount: number;
  ruleScope: string | null;
  ruleType: SalaryType | null;
  ruleAmount: number | null;
}

export interface TeacherSalaryCalc {
  teacherId: string;
  teacherName: string;
  total: number;
  lessons: number;
  students: number;
  rows: SalaryDetailRow[];
}

export interface SalaryCalcResult {
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  total: number;
  teachers: TeacherSalaryCalc[];
}

type RuleRow = { id: string; scope: string; amountType: string; amount: number; isDefault: boolean; targetId: string | null; groupId: string | null };

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export async function computeSalaries(opts: { year: number; month: number; branchId: string | null }): Promise<SalaryCalcResult> {
  const { year, month, branchId } = opts;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const bw = branchId ? { branchId } : {};

  const [rules, settings, defaultFee, groups, branchTeachers] = await Promise.all([
    prisma.salaryRule.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, scope: true, amountType: true, amount: true, isDefault: true, targetId: true, groupId: true },
    }),
    getSalarySettings(),
    getDefaultMonthlyFee(),
    prisma.group.findMany({
      where: { ...bw, teacherId: { not: null }, status: { not: "CANCELLED" } },
      select: {
        id: true, name: true, status: true, teacherId: true, monthlyFee: true, lessonsPerMonth: true, programId: true,
        program: { select: { name: true, monthlyFee: true, lessonsPerMonth: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        role: ROLES.TEACHER, isActive: true,
        ...(branchId ? { OR: [{ branchId }, { branches: { some: { branchId } } }] } : {}),
      },
      select: { id: true, fullName: true },
    }),
  ]);

  const studentRules = new Map<string, RuleRow>();
  const groupRules = new Map<string, RuleRow>();
  const courseRules = new Map<string, RuleRow>();
  const teacherRules = new Map<string, RuleRow>();
  let defRule: RuleRow | null = null;
  for (const r of rules) {
    if (r.isDefault || r.scope === "ALL") { if (!defRule || (r.isDefault && !defRule.isDefault)) defRule = r; continue; }
    if (!r.targetId) continue;
    const map = r.scope === "STUDENT" ? studentRules : r.scope === "GROUP" ? groupRules : r.scope === "COURSE" ? courseRules : r.scope === "TEACHER" ? teacherRules : null;
    const key = r.scope === "STUDENT" ? `${r.targetId}|${r.groupId ?? ""}` : r.targetId;
    if (map && !map.has(key)) map.set(key, r);
  }
  const resolve = (teacherId: string, programId: string | null, groupId: string | null, studentId: string | null): RuleRow | null =>
    (studentId && groupId ? studentRules.get(`${studentId}|${groupId}`) : undefined) ??
    (studentId ? studentRules.get(`${studentId}|`) : undefined) ??
    (groupId ? groupRules.get(groupId) : undefined) ??
    (programId ? courseRules.get(programId) : undefined) ??
    teacherRules.get(teacherId) ??
    defRule;

  const groupIds = groups.map((g) => g.id);
  const [enrollRaw, lessons] = await Promise.all([
    groupIds.length
      ? prisma.groupStudent.findMany({
          where: { groupId: { in: groupIds }, joinedAt: { lt: monthEnd }, OR: [{ leftAt: null }, { leftAt: { gte: monthStart } }] },
          select: { groupId: true, studentId: true, joinedAt: true, leftAt: true, isActive: true, student: { select: { fullName: true, eduStatus: true } } },
        })
      : Promise.resolve([]),
    groupIds.length
      ? prisma.lesson.findMany({ where: { groupId: { in: groupIds }, startsAt: { gte: monthStart, lt: monthEnd } }, select: { id: true, groupId: true, startsAt: true } })
      : Promise.resolve([]),
  ]);

  const enrollments = enrollRaw.filter((e) => {
    if (!e.isActive && !e.leftAt && e.joinedAt < monthStart) return false;
    const st = e.student.eduStatus;
    if (ARCHIVED.has(st) && !settings.use_archived_students) return false;
    if (st === "FROZEN" && !settings.use_frozen_students) return false;
    return true;
  });

  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const lessonIds = lessons.map((l) => l.id);
  const [attendance, payments, allEnroll] = await Promise.all([
    lessonIds.length && studentIds.length
      ? prisma.attendance.findMany({ where: { lessonId: { in: lessonIds }, studentId: { in: studentIds } }, select: { lessonId: true, studentId: true, status: true, confirmed: true } })
      : Promise.resolve([]),
    studentIds.length
      ? prisma.payment.findMany({ where: { studentId: { in: studentIds }, status: "PAID", createdAt: { gte: monthStart, lt: monthEnd } }, select: { studentId: true, amount: true, discount: true } })
      : Promise.resolve([]),
    studentIds.length
      ? prisma.groupStudent.findMany({
          where: { studentId: { in: studentIds }, joinedAt: { lt: monthEnd }, OR: [{ leftAt: null }, { leftAt: { gte: monthStart } }] },
          select: { studentId: true, groupId: true, joinedAt: true, leftAt: true, isActive: true, group: { select: { monthlyFee: true, program: { select: { monthlyFee: true } } } } },
        })
      : Promise.resolve([]),
  ]);

  const feeOf = (g: { monthlyFee: number | null; program: { monthlyFee: number | null } }) => g.monthlyFee ?? g.program.monthlyFee ?? defaultFee;

  const shares = new Map<string, Map<string, number>>();
  {
    const byStudent = new Map<string, { groupId: string; fee: number }[]>();
    for (const e of allEnroll) {
      if (!e.isActive && !e.leftAt && e.joinedAt < monthStart) continue;
      const arr = byStudent.get(e.studentId) ?? [];
      if (!arr.some((x) => x.groupId === e.groupId)) arr.push({ groupId: e.groupId, fee: feeOf(e.group) });
      byStudent.set(e.studentId, arr);
    }
    for (const [sid, arr] of byStudent) {
      const sum = arr.reduce((a, x) => a + x.fee, 0);
      shares.set(sid, new Map(arr.map((x) => [x.groupId, sum > 0 ? x.fee / sum : 1 / arr.length])));
    }
  }
  const paidBy = new Map<string, { paid: number; discount: number }>();
  for (const p of payments) {
    const cur = paidBy.get(p.studentId) ?? { paid: 0, discount: 0 };
    cur.paid += p.amount;
    cur.discount += p.discount;
    paidBy.set(p.studentId, cur);
  }

  const lessonsByGroup = new Map<string, { id: string; startsAt: Date }[]>();
  for (const l of lessons) {
    const arr = lessonsByGroup.get(l.groupId) ?? [];
    arr.push(l);
    lessonsByGroup.set(l.groupId, arr);
  }
  const att = new Map<string, { status: string; confirmed: boolean }>();
  for (const a of attendance) att.set(`${a.lessonId}|${a.studentId}`, a);

  const enrollByGroup = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const arr = enrollByGroup.get(e.groupId) ?? [];
    arr.push(e);
    enrollByGroup.set(e.groupId, arr);
  }

  const teacherIds = new Set<string>(branchTeachers.map((t) => t.id));
  for (const g of groups) if (g.teacherId) teacherIds.add(g.teacherId);
  const extra = [...teacherIds].filter((id) => !branchTeachers.some((t) => t.id === id));
  const extraTeachers = extra.length ? await prisma.user.findMany({ where: { id: { in: extra } }, select: { id: true, fullName: true } }) : [];
  const teacherName = new Map([...branchTeachers, ...extraTeachers].map((t) => [t.id, t.fullName]));

  const attendanceLinked = settings.belongs_to_attendance || settings.get_only_came_attendance;
  const out: TeacherSalaryCalc[] = [];

  for (const tid of teacherIds) {
    const tGroups = groups.filter((g) => g.teacherId === tid);
    const rows: SalaryDetailRow[] = [];
    const fixedApplied = new Set<string>();
    const studentsSeen = new Set<string>();
    let lessonCount = 0;

    const addFixed = (rule: RuleRow, g: (typeof groups)[number] | null) => {
      if (fixedApplied.has(rule.id)) return;
      fixedApplied.add(rule.id);
      const scoped = rule.scope === "GROUP" || rule.scope === "COURSE";
      rows.push({
        groupId: scoped && g ? g.id : null, groupName: scoped && g ? g.name : null,
        programId: scoped && g ? g.programId : null, programName: scoped && g ? g.program.name : null,
        studentId: null, studentName: null, studentStatus: null,
        lessons: 0, came: 0, notCame: 0, notMarked: 0, paid: null,
        assigned: rule.amount, amount: rule.amount,
        ruleScope: rule.isDefault ? "ALL" : rule.scope, ruleType: "fixed", ruleAmount: rule.amount,
      });
    };

    for (const g of tGroups) {
      const gLessons = lessonsByGroup.get(g.id) ?? [];
      const gEnroll = enrollByGroup.get(g.id) ?? [];
      if (g.status === "PLANNED" && gLessons.length === 0) continue;
      lessonCount += gLessons.length;
      const lessonsPerMonth = g.lessonsPerMonth ?? g.program.lessonsPerMonth ?? 12;
      const fee = feeOf(g);

      if (gEnroll.length === 0) {
        const r = resolve(tid, g.programId, g.id, null);
        if (r && normalizeSalaryType(r.amountType) === "fixed") addFixed(r, g);
        continue;
      }

      for (const e of gEnroll) {
        studentsSeen.add(e.studentId);
        const from = dayStart(e.joinedAt);
        const sLessons = gLessons.filter((l) => l.startsAt >= from && (!e.leftAt || l.startsAt <= e.leftAt));
        let came = 0, notCame = 0;
        for (const l of sLessons) {
          const a = att.get(`${l.id}|${e.studentId}`);
          if (!a) continue;
          if (settings.get_only_teachers_attendance && !a.confirmed) continue;
          if (CAME.has(a.status)) came++;
          else if (NOT_CAME.has(a.status)) notCame++;
        }
        const nLessons = sLessons.length;
        const notMarked = Math.max(0, nLessons - came - notCame);
        const counted = settings.get_only_came_attendance ? came : came + notCame;

        const rule = resolve(tid, g.programId, g.id, e.studentId);
        const type = rule ? normalizeSalaryType(rule.amountType) : null;
        if (rule && type === "fixed") { addFixed(rule, g); continue; }

        const share = shares.get(e.studentId)?.get(g.id) ?? 1;
        const pay = paidBy.get(e.studentId) ?? { paid: 0, discount: 0 };
        const price = Math.max(0, fee - (settings.use_student_discount_price ? pay.discount * share : 0));
        const factor = attendanceLinked ? (nLessons > 0 ? counted / nLessons : 0) : 1;
        const units = attendanceLinked ? counted : nLessons;

        let assigned = 0, amount = 0;
        if (rule) {
          switch (type) {
            case "by_student_fixed": assigned = rule.amount; amount = assigned * factor; break;
            case "by_student_percentage": assigned = (price * rule.amount) / 100; amount = assigned * factor; break;
            case "percentage_by_student_payment": assigned = (pay.paid * share * rule.amount) / 100; amount = assigned; break;
            case "per_lesson_fixed": assigned = rule.amount; amount = assigned * units; break;
            case "per_lesson_percentage": assigned = ((price / lessonsPerMonth) * rule.amount) / 100; amount = assigned * units; break;
          }
        }
        amount = Math.round(amount);
        if (amount === 0 && settings.hide_zero_amount_students) continue;
        rows.push({
          groupId: g.id, groupName: g.name, programId: g.programId, programName: g.program.name,
          studentId: e.studentId, studentName: e.student.fullName, studentStatus: e.student.eduStatus,
          lessons: nLessons, came, notCame, notMarked,
          paid: Math.round(pay.paid * share),
          assigned: Math.round(assigned), amount,
          ruleScope: rule ? (rule.isDefault ? "ALL" : rule.scope) : null, ruleType: type, ruleAmount: rule?.amount ?? null,
        });
      }
    }

    if (tGroups.length === 0) {
      const r = resolve(tid, null, null, null);
      if (r && normalizeSalaryType(r.amountType) === "fixed") addFixed(r, null);
    }

    if (rows.length === 0) continue;
    const total = rows.reduce((a, r) => a + r.amount, 0);
    out.push({ teacherId: tid, teacherName: teacherName.get(tid) ?? "—", total, lessons: lessonCount, students: studentsSeen.size, rows });
  }

  out.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  return {
    year, month,
    periodStart: ymd(monthStart),
    periodEnd: ymd(new Date(year, month, 0)),
    total: out.reduce((a, t) => a + t.total, 0),
    teachers: out,
  };
}
