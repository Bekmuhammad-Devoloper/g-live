import "server-only";
import { prisma } from "./db";
import { ATTENDED } from "./coins";
import { getCoinRules } from "./coinRules";
import { getProgressRules, type RankBasis, type RankScope } from "./progressRules";

// Reyting o'rni — BITTA joyda hisoblanadi.
// Ilgari bosh sahifa guruhdoshlar orasida, yuqoridagi belgi esa hamma
// o'quvchi orasida hisoblardi va ikkalasi har xil raqam ko'rsatardi.

export type Rank = { place: number; total: number; scope: RankScope; basis: RankBasis };

/** Taqqoslash doirasidagi o'quvchilar ro'yxati */
async function scopeIds(studentId: string, scope: RankScope): Promise<string[]> {
  if (scope === "center") {
    const all = await prisma.student.findMany({ select: { id: true } });
    return all.map((s) => s.id);
  }

  const me = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      branchId: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { groupId: true },
        take: 1,
      },
    },
  });

  if (scope === "group") {
    const groupId = me?.enrollments[0]?.groupId;
    if (!groupId) return [studentId];
    const mates = await prisma.groupStudent.findMany({
      where: { groupId, isActive: true },
      select: { studentId: true },
    });
    return mates.map((m) => m.studentId);
  }

  // branch
  const rows = await prisma.student.findMany({
    where: me?.branchId ? { branchId: me.branchId } : {},
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Har o'quvchi uchun taqqoslash qiymati */
async function scores(ids: string[], basis: RankBasis): Promise<Map<string, number>> {
  const out = new Map<string, number>(ids.map((id) => [id, 0]));

  if (basis === "attendance") {
    const rows = await prisma.attendance.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, status: { in: ATTENDED } },
      _count: { _all: true },
    });
    for (const r of rows) out.set(r.studentId, r._count._all);
    return out;
  }

  if (basis === "score") {
    // Baholangan vazifalarning o'rtacha foizi (vazifalarning maksimal balli har xil)
    const subs = await prisma.submission.findMany({
      where: { studentId: { in: ids }, status: "GRADED" },
      select: { studentId: true, score: true, assignment: { select: { maxScore: true } } },
    });
    const acc = new Map<string, { sum: number; n: number }>();
    for (const s of subs) {
      const max = s.assignment?.maxScore || 0;
      if (max <= 0) continue;
      const pct = Math.min(100, ((s.score ?? 0) / max) * 100);
      const a = acc.get(s.studentId) ?? { sum: 0, n: 0 };
      a.sum += pct;
      a.n++;
      acc.set(s.studentId, a);
    }
    for (const [id, a] of acc) out.set(id, a.n ? Math.round(a.sum / a.n) : 0);
    return out;
  }

  // coins — tanga qoidalari bo'yicha yig'ilgan (seriya bonusisiz: u o'quvchiga xos)
  const rules = await getCoinRules();
  const [att, graded, wins, ups] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, status: { in: ATTENDED } },
      _count: { _all: true },
    }),
    prisma.submission.findMany({
      where: { studentId: { in: ids }, status: "GRADED" },
      select: { studentId: true, score: true, assignment: { select: { maxScore: true } } },
    }),
    prisma.gameResult.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, won: true },
      _count: { _all: true },
    }),
    prisma.studentLevelUp.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const add = (id: string, n: number) => out.set(id, (out.get(id) ?? 0) + n);
  for (const r of att) add(r.studentId, r._count._all * rules.lesson);
  for (const s of graded) {
    add(s.studentId, rules.homework);
    const max = s.assignment?.maxScore || 0;
    if (max > 0 && (s.score ?? 0) >= max) add(s.studentId, rules.perfect);
  }
  for (const r of wins) add(r.studentId, r._count._all * rules.gameWin);
  for (const r of ups) add(r.studentId, r._count._all * rules.levelUp);
  return out;
}

export async function studentRank(studentId: string): Promise<Rank> {
  const { rankScope, rankBasis } = await getProgressRules();
  const ids = await scopeIds(studentId, rankScope);
  if (!ids.includes(studentId)) ids.push(studentId);

  const map = await scores(ids, rankBasis);
  const mine = map.get(studentId) ?? 0;
  // Undan yuqori natijalilar soni + 1 = o'rin (teng natijalar bir xil o'rinda)
  let better = 0;
  for (const [id, v] of map) if (id !== studentId && v > mine) better++;

  return { place: better + 1, total: ids.length, scope: rankScope, basis: rankBasis };
}
