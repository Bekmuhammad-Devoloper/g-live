import { prisma } from "@/lib/db";

const toMin = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

const DAY_UZ: Record<string, string> = { "1": "Du", "2": "Se", "3": "Ch", "4": "Pa", "5": "Ju", "6": "Sh", "7": "Ya" };
const daysLabel = (weekdays: string | null) =>
  (weekdays ?? "").split(",").filter(Boolean).map((d) => DAY_UZ[d] ?? d).join(", ");

export interface ConflictInput {
  room: string | null;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  branchId: string | null;
  excludeId?: string;
}

export interface ConflictGroup {
  name: string;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
}

export async function findRoomConflict(inp: ConflictInput): Promise<ConflictGroup | null> {
  const { room, weekdays, startTime, endTime, branchId, excludeId } = inp;
  if (!room || !weekdays || !startTime || !endTime) return null;
  const sMin = toMin(startTime);
  const eMin = toMin(endTime);
  if (sMin === null || eMin === null || eMin <= sMin) return null;

  const days = new Set(weekdays.split(","));
  const candidates = await prisma.group.findMany({
    where: {
      room,
      branchId,
      status: { not: "CANCELLED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { name: true, weekdays: true, startTime: true, endTime: true },
  });

  for (const c of candidates) {
    if (!c.weekdays || !c.startTime || !c.endTime) continue;
    if (!c.weekdays.split(",").some((d) => days.has(d))) continue;
    const cs = toMin(c.startTime);
    const ce = toMin(c.endTime);
    if (cs === null || ce === null) continue;
    if (sMin < ce && cs < eMin) return c;
  }
  return null;
}

export function conflictLabel(c: ConflictGroup): string {
  const dl = daysLabel(c.weekdays);
  const tl = c.startTime && c.endTime ? `${c.startTime}–${c.endTime}` : "";
  const meta = [dl, tl].filter(Boolean).join(" · ");
  return meta ? `${c.name} (${meta})` : c.name;
}
