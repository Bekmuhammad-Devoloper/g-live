import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRead, MODULES } from "@/lib/rbac";
import { ROLES } from "@/lib/constants";
import { branchWhere } from "@/lib/branchScope";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import RoomsView, { type VRoom, type RoomStatus } from "./RoomsView";

const MANAGE_ROLES = [ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

export default async function RoomsPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.GROUPS)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Bu bo'lim uchun ruxsat yo'q.", ru: "Нет доступа к этому разделу.", en: "You do not have access to this section." })} />;
  }

  const [rooms, groups] = await Promise.all([
    prisma.room.findMany({ where: { AND: [{ isActive: true }, branchWhere(s)] }, orderBy: { name: "asc" } }),
    prisma.group.findMany({
      where: { AND: [{ room: { not: null }, status: { in: ["ACTIVE", "PLANNED"] } }, branchWhere(s)] },
      select: { room: true, name: true, weekdays: true, startTime: true, endTime: true, program: { select: { name: true } } },
    }),
  ]);

  // Hozirgi holat (band/bo'sh) — server vaqti bo'yicha (Du=1..Ya=7)
  const now = new Date();
  const dow = now.getDay() === 0 ? 7 : now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string | null) => { const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t) : null; return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const hasDay = (wd: string | null) => (wd ?? "").split(",").map(Number).includes(dow);

  function roomStatus(name: string): RoomStatus {
    const rg = groups.filter((g) => g.room === name && hasDay(g.weekdays));
    for (const g of rg) {
      const st = toMin(g.startTime), en = toMin(g.endTime);
      if (st != null && en != null && st <= nowMin && nowMin < en) {
        return { busy: true, group: g.name, course: g.program?.name ?? null, until: g.endTime, freeMin: null };
      }
    }
    let next: number | null = null;
    let nextTime: string | null = null;
    for (const g of rg) {
      const st = toMin(g.startTime);
      if (st != null && st > nowMin && (next == null || st < next)) { next = st; nextTime = g.startTime; }
    }
    // Bo'sh: `until` = keyingi dars boshlanish vaqti (shu vaqtgacha bo'sh), `freeMin` = qancha bo'sh
    return { busy: false, group: null, course: null, until: nextTime, freeMin: next == null ? null : next - nowMin };
  }

  const vrooms: VRoom[] = rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, note: r.note, status: roomStatus(r.name) }));
  const canManage = MANAGE_ROLES.includes(s.role as never);

  return <RoomsView locale={s.locale} rooms={vrooms} canManage={canManage} />;
}
