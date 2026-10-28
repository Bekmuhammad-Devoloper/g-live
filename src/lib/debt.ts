import "server-only";
import { prisma } from "./db";
import { getSetting } from "./settings";

export const DEFAULT_FEE_KEY = "finance.defaultMonthlyFee";

export async function getDefaultMonthlyFee(): Promise<number> {
  const raw = await getSetting(DEFAULT_FEE_KEY);
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface StudentDebt {
  accrued: number;
  paid: number;
  manual: number;
  discount: number;
  debt: number;
  credit: number;
  months: number;
  since: Date | null;
  overdueMonths: number;
}

const EMPTY: StudentDebt = { accrued: 0, paid: 0, manual: 0, discount: 0, debt: 0, credit: 0, months: 0, since: null, overdueMonths: 0 };

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export const PRORATE_FROM = new Date(2026, 9, 28);

export interface FeeGroup {
  monthlyFee: number | null;
  weekdays: string | null;
  lessonsPerMonth: number | null;
  program: { monthlyFee: number | null; lessonsPerMonth: number | null };
}
const FEE_GROUP_SELECT = {
  monthlyFee: true, weekdays: true, lessonsPerMonth: true,
  program: { select: { monthlyFee: true, lessonsPerMonth: true } },
} as const;

export function monthLessonDays(g: FeeGroup, mIdx: number): number[] | null {
  const days = new Set((g.weekdays ?? "").split(",").map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7));
  if (days.size === 0) return null;
  const y = Math.floor(mIdx / 12), mo = mIdx % 12;
  const dim = new Date(y, mo + 1, 0).getDate();
  const out: number[] = [];
  for (let d = 1; d <= dim; d++) {
    const wd = ((new Date(y, mo, d).getDay() + 6) % 7) + 1;
    if (days.has(wd)) out.push(d);
  }
  const cap = g.lessonsPerMonth ?? g.program.lessonsPerMonth ?? 0;
  return cap > 0 ? out.slice(0, cap) : out;
}

export function enrollmentMonthFee(g: FeeGroup, joinedAt: Date, mIdx: number): number {
  const fee = g.monthlyFee ?? g.program.monthlyFee ?? 0;
  if (fee <= 0 || monthIndex(joinedAt) !== mIdx) return fee;
  if (joinedAt.getTime() < PRORATE_FROM.getTime()) return fee;
  const joinDay = joinedAt.getDate();
  const lessons = monthLessonDays(g, mIdx);
  let share: number;
  if (lessons && lessons.length > 0) {
    share = lessons.filter((d) => d >= joinDay).length / lessons.length;
  } else {
    const dim = new Date(Math.floor(mIdx / 12), (mIdx % 12) + 1, 0).getDate();
    share = (dim - joinDay + 1) / dim;
  }
  return Math.round((fee * share) / 1000) * 1000;
}

export function billedMonths(from: Date, now: Date, until?: Date | null): number {
  const end = until && until.getTime() < now.getTime() ? until : now;
  return Math.max(0, monthIndex(end) - monthIndex(from) + 1);
}

function enrolledWithFee(enr: { joinedAt: Date; leftAt: Date | null; isActive: boolean; group: FeeGroup }[], m: number): boolean {
  return enr.some((e) => {
    const from = monthIndex(e.joinedAt);
    const until = e.leftAt ? monthIndex(e.leftAt) : (e.isActive ? Infinity : from);
    return m >= from && m <= until && (e.group.monthlyFee ?? e.group.program.monthlyFee ?? 0) > 0;
  });
}

export async function computeDebts(
  studentIds: string[],
  now = new Date(),
  opts: { excludeGroupIds?: string[] } = {},
): Promise<Map<string, StudentDebt>> {
  const out = new Map<string, StudentDebt>();
  if (studentIds.length === 0) return out;
  const excluded = new Set(opts.excludeGroupIds ?? []);

  const [students, enrollments, payments, defaultFee] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, createdAt: true } }),
    prisma.groupStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        groupId: true,
        joinedAt: true,
        leftAt: true,
        isActive: true,
        group: { select: FEE_GROUP_SELECT },
      },
    }),
    prisma.payment.findMany({
      where: { studentId: { in: studentIds }, status: { in: ["PAID", "PENDING", "ADJUST"] } },
      select: { studentId: true, amount: true, status: true, discount: true },
    }),
    getDefaultMonthlyFee(),
  ]);

  const byStudent = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    if (excluded.has(e.groupId)) continue;
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push(e);
    byStudent.set(e.studentId, arr);
  }

  const nowIdx = monthIndex(now);
  const feesByStudent = new Map<string, number[]>();

  for (const st of students) {
    const enr = byStudent.get(st.id) ?? [];
    let since = st.createdAt;
    for (const e of enr) if (e.joinedAt < since) since = e.joinedAt;

    let accrued = 0;
    let months = 0;
    const fees: number[] = [];
    for (let m = monthIndex(since); m <= nowIdx; m++) {
      months++;
      let monthFee = 0;
      let inGroup = false;
      for (const e of enr) {
        const from = monthIndex(e.joinedAt);
        const until = e.leftAt ? monthIndex(e.leftAt) : (e.isActive ? Infinity : from);
        if (m >= from && m <= until) {
          inGroup = true;
          monthFee += enrollmentMonthFee(e.group, e.joinedAt, m);
        }
      }
      const fee = inGroup && monthFee > 0 ? monthFee : inGroup && enrolledWithFee(enr, m) ? 0 : defaultFee;
      accrued += fee;
      fees.push(fee);
    }

    feesByStudent.set(st.id, fees);
    out.set(st.id, { ...EMPTY, accrued, months, since });
  }

  for (const id of studentIds) if (!out.has(id)) out.set(id, { ...EMPTY });

  for (const p of payments) {
    const cur = out.get(p.studentId);
    if (!cur) continue;
    if (p.status === "PAID") { cur.paid += p.amount; cur.discount += p.discount; }
    else cur.manual += p.amount;
  }

  for (const v of out.values()) {
    v.debt = Math.max(0, v.accrued + v.manual - v.paid - v.discount);
    v.credit = Math.max(0, v.paid + v.discount - v.accrued - v.manual);
  }

  for (const [id, v] of out) {
    if (v.debt <= 0) continue;
    let cover = v.paid + v.discount + (v.manual < 0 ? -v.manual : 0);
    let uncovered = 0;
    for (const fee of feesByStudent.get(id) ?? []) {
      if (fee <= 0) continue;
      if (cover >= fee) cover -= fee;
      else { cover = 0; uncovered++; }
    }
    v.overdueMonths = Math.max(1, uncovered);
  }
  return out;
}

export async function computeDebt(studentId: string, now = new Date()): Promise<StudentDebt> {
  const m = await computeDebts([studentId], now);
  return m.get(studentId) ?? { ...EMPTY };
}

export async function totalDebt(where: object = {}, now = new Date()): Promise<{ total: number; debtors: number }> {
  const ids = (await prisma.student.findMany({ where, select: { id: true } })).map((x) => x.id);
  const map = await computeDebts(ids, now);
  let total = 0, debtors = 0;
  for (const v of map.values()) if (v.debt > 0) { total += v.debt; debtors++; }
  return { total, debtors };
}

export async function monthlyFees(studentIds: string[], month: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (studentIds.length === 0) return out;
  const m = monthIndex(month);
  const [students, enrollments, defaultFee] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, createdAt: true } }),
    prisma.groupStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true, joinedAt: true, leftAt: true, isActive: true,
        group: { select: FEE_GROUP_SELECT },
      },
    }),
    getDefaultMonthlyFee(),
  ]);
  const byStudent = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push(e);
    byStudent.set(e.studentId, arr);
  }
  for (const st of students) {
    const enr = byStudent.get(st.id) ?? [];
    let since = st.createdAt;
    for (const e of enr) if (e.joinedAt < since) since = e.joinedAt;
    if (m < monthIndex(since)) { out.set(st.id, 0); continue; }
    let fee = 0;
    for (const e of enr) {
      const from = monthIndex(e.joinedAt);
      const until = e.leftAt ? monthIndex(e.leftAt) : (e.isActive ? Infinity : from);
      if (m >= from && m <= until) fee += enrollmentMonthFee(e.group, e.joinedAt, m);
    }
    out.set(st.id, fee > 0 ? fee : enrolledWithFee(enr, m) ? 0 : defaultFee);
  }
  return out;
}
