import "server-only";
import { prisma } from "./db";

export interface RoomLesson {
  group: string;
  course: string | null;
  teacher: string | null;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
}

export interface RoomSchedule {
  id: string;
  name: string;
  capacity: number;
  note: string | null;
  branch: string | null;
  responsible: string | null;
  days: RoomLesson[][];
}

export const toMin = (t: string | null | undefined): number | null => {
  const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export async function getRoomSchedule(id: string): Promise<RoomSchedule | null> {
  const room = await prisma.room.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      capacity: true,
      note: true,
      branchId: true,
      responsible: { select: { fullName: true } },
    },
  });
  if (!room) return null;

  const [branch, groups] = await Promise.all([
    room.branchId ? prisma.branch.findUnique({ where: { id: room.branchId }, select: { name: true } }) : Promise.resolve(null),
    prisma.group.findMany({
      where: {
        status: { in: ["ACTIVE", "PLANNED"] },
        room: { not: null },
        ...(room.branchId ? { branchId: room.branchId } : {}),
      },
      select: {
        name: true,
        room: true,
        weekdays: true,
        startTime: true,
        endTime: true,
        teacher: { select: { fullName: true } },
        program: { select: { name: true } },
      },
    }),
  ]);

  const key = room.name.trim().toLowerCase();
  const days: RoomLesson[][] = Array.from({ length: 8 }, () => []);
  for (const g of groups) {
    if ((g.room ?? "").trim().toLowerCase() !== key) continue;
    const startMin = toMin(g.startTime);
    if (startMin === null) continue;
    const endMin = toMin(g.endTime) ?? startMin + 90;
    const lesson: RoomLesson = {
      group: g.name,
      course: g.program?.name ?? null,
      teacher: g.teacher?.fullName ?? null,
      start: hhmm(startMin),
      end: hhmm(endMin),
      startMin,
      endMin,
    };
    for (const d of (g.weekdays ?? "").split(",").map(Number)) {
      if (d >= 1 && d <= 7) days[d].push(lesson);
    }
  }
  for (const list of days) list.sort((a, b) => a.startMin - b.startMin);

  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    note: room.note,
    branch: branch?.name ?? null,
    responsible: room.responsible?.fullName ?? null,
    days,
  };
}
