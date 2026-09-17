import { plannedLessonDays } from "@/lib/attendanceWindow";

/**
 * O'quvchining dars kunlari — guruh jadvalidan (haftalik kunlar, "oyiga N
 * dars" chegarasi, boshlanish/tugash sanasi). Bosh sahifadagi "Keyingi dars"
 * va profildagi kalendar BIR xil ro'yxatdan foydalanadi.
 */
export type LessonDay = {
  iso: string;
  group: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
};

export type ScheduleGroup = {
  name: string;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  startDate: Date | null;
  endDate: Date | null;
  lessonsPerMonth: number | null;
  program: { lessonsPerMonth: number | null };
};

/** Bugundan `before` oy oldin → `after` oy keyin oralig'idagi dars kunlari (sana bo'yicha tartiblangan). */
export function buildLessonDays(groups: ScheduleGroup[], now: Date, before = 1, after = 2): LessonDay[] {
  const map = new Map<string, LessonDay>();
  const y0 = now.getFullYear(), m0 = now.getMonth();
  for (const g of groups) {
    if (!g.weekdays) continue;
    const limit = g.lessonsPerMonth ?? g.program.lessonsPerMonth;
    // Tugash sanasi o'tib ketgan, lekin o'quvchi hali ham faol — demak guruh
    // davom etyapti (sana yangilanmagan). Bunday sana jadvalni yashirmasin.
    const endDate = g.endDate && g.endDate.getTime() >= now.getTime() - 86_400_000 ? g.endDate : null;
    for (let k = -before; k <= after; k++) {
      const d = new Date(y0, m0 + k, 1);
      for (const iso of plannedLessonDays(d.getFullYear(), d.getMonth(), g.weekdays, limit, g.startDate, endDate)) {
        if (!map.has(iso)) map.set(iso, { iso, group: g.name, startTime: g.startTime, endTime: g.endTime, room: g.room });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.iso.localeCompare(b.iso));
}

/** Keyingi dars: bugungi dars hali tugamagan bo'lsa — bugun, aks holda keyingi kun. */
export function nextLessonDay(days: LessonDay[], todayISO: string, now: Date): LessonDay | null {
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return days.find((d) => d.iso > todayISO || (d.iso === todayISO && (!d.endTime || d.endTime > hhmm))) ?? null;
}
