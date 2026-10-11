// To'lovni guruhga bog'lash: Payment'da groupId yo'q, shu sabab o'quvchining
// to'lov sanasida faol bo'lgan a'zoligi olinadi (qo'shilgan <= sana, chiqmagan
// yoki sanadan keyin chiqqan). Bunday a'zolik bo'lmasa — eng oxirgi a'zolik.
export interface EnrollmentLike<G> {
  joinedAt: Date;
  leftAt: Date | null;
  group: G;
}

export function groupAtDate<G>(enrollments: EnrollmentLike<G>[], at: Date): G | null {
  if (enrollments.length === 0) return null;
  const t = at.getTime();
  let best: EnrollmentLike<G> | null = null;
  let latest: EnrollmentLike<G> = enrollments[0];
  for (const e of enrollments) {
    if (e.joinedAt.getTime() > latest.joinedAt.getTime()) latest = e;
    if (e.joinedAt.getTime() <= t && (!e.leftAt || e.leftAt.getTime() >= t)) {
      if (!best || e.joinedAt.getTime() > best.joinedAt.getTime()) best = e;
    }
  }
  return (best ?? latest).group;
}

const p2 = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Sahifa ?from=&to= parametrlari; bo'lmasa joriy oy (1-kun — oxirgi kun). */
export function monthRange(from?: string, to?: string): { from: string; to: string; gte: Date; lte: Date } {
  const now = new Date();
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const f = from && re.test(from) ? from : isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const t = to && re.test(to) ? to : isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { from: f, to: t, gte: new Date(`${f}T00:00:00`), lte: new Date(`${t}T23:59:59.999`) };
}
