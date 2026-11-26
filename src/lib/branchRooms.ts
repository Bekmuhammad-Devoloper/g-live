import "server-only";
import { prisma } from "./db";

const numberOf = (name: string) => name.match(/\d+/)?.[0] ?? null;

export interface BranchRooms {
  rooms: string[] | null;
  resolve: (room: string | null | undefined) => string | null;
}

export async function branchRooms(branchId: string | null): Promise<BranchRooms> {
  if (!branchId) return { rooms: null, resolve: (room) => room ?? null };
  const rows = await prisma.room.findMany({ where: { branchId, isActive: true }, select: { name: true } });
  const rooms = rows.map((r) => r.name).sort((a, b) => a.localeCompare(b, "uz", { numeric: true }));
  if (rooms.length === 0) return { rooms: null, resolve: (room) => room ?? null };
  const exact = new Map(rooms.map((n) => [n.trim().toLowerCase(), n]));
  const byNumber = new Map<string, string>();
  for (const n of rooms) {
    const k = numberOf(n);
    if (k && !byNumber.has(k)) byNumber.set(k, n);
  }
  return {
    rooms,
    resolve: (room) => {
      if (!room) return null;
      const hit = exact.get(room.trim().toLowerCase());
      if (hit) return hit;
      const k = numberOf(room);
      return (k && byNumber.get(k)) || null;
    },
  };
}
