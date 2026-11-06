import "server-only";
import { prisma } from "./db";
import { computeDebts, FEE_GROUP_SELECT, pauseCredit } from "./debt";
import { writeAudit } from "./audit";

export async function rejoinGroup(params: {
  studentId: string;
  groupId: string;
  actorId: string;
  reason: string;
  now?: Date;
}): Promise<{ credit: number }> {
  const { studentId, groupId, actorId, reason } = params;
  const now = params.now ?? new Date();
  const row = await prisma.groupStudent.findUnique({
    where: { groupId_studentId: { groupId, studentId } },
    select: { id: true, isActive: true, joinedAt: true, leftAt: true, group: { select: { name: true, ...FEE_GROUP_SELECT } } },
  });
  if (!row) {
    await prisma.groupStudent.create({ data: { groupId, studentId, isActive: true, joinedAt: now } });
    return { credit: 0 };
  }
  if (row.isActive) return { credit: 0 };

  const credit = pauseCredit(row.group, row.leftAt ?? row.joinedAt, now);
  await prisma.groupStudent.update({ where: { id: row.id }, data: { isActive: true, leftAt: null } });
  if (credit > 0) {
    await prisma.payment.create({
      data: {
        studentId,
        amount: -credit,
        method: "ADJUST",
        status: "ADJUST",
        isManual: true,
        purpose: "Qarz tuzatish",
        note: `${reason}: ${row.group.name} — tanaffus davri hisobdan chiqarildi`,
        authorId: actorId,
      },
    });
  }
  await writeAudit({
    actorId,
    action: "UPDATE",
    entityType: "GroupStudent",
    entityId: studentId,
    oldValue: { group: row.group.name, leftAt: row.leftAt },
    newValue: { rejoined: true, pauseCredit: credit },
    reason,
  });
  return { credit };
}

export async function leaveGroups(params: {
  studentId: string;
  groupIds?: string[];
  actorId: string;
  reason: string;
  clearDebt?: boolean;
}): Promise<{ closed: number; cleared: number }> {
  const { studentId, actorId, reason, clearDebt = true } = params;
  const active = await prisma.groupStudent.findMany({
    where: { studentId, isActive: true, ...(params.groupIds ? { groupId: { in: params.groupIds } } : {}) },
    select: { id: true, groupId: true, group: { select: { name: true } } },
  });
  if (active.length === 0) return { closed: 0, cleared: 0 };

  await prisma.groupStudent.updateMany({
    where: { id: { in: active.map((a) => a.id) } },
    data: { isActive: false, leftAt: new Date() },
  });

  let cleared = 0;
  if (clearDebt) {
    const groupIds = active.map((a) => a.groupId);
    const [withGroups, withoutGroups] = await Promise.all([
      computeDebts([studentId]),
      computeDebts([studentId], new Date(), { excludeGroupIds: groupIds }),
    ]);
    cleared = Math.max(0, (withGroups.get(studentId)?.debt ?? 0) - (withoutGroups.get(studentId)?.debt ?? 0));
    if (cleared > 0) {
      await prisma.payment.create({
        data: {
          studentId,
          amount: -cleared,
          method: "ADJUST",
          status: "ADJUST",
          isManual: true,
          purpose: "Qarz tuzatish",
          note: `${reason}: ${active.map((a) => a.group.name).join(", ")} — guruh qarzi o'chirildi`,
          authorId: actorId,
        },
      });
    }
  }

  await writeAudit({
    actorId,
    action: "UPDATE",
    entityType: "GroupStudent",
    entityId: studentId,
    oldValue: { groups: active.map((a) => a.group.name) },
    newValue: { left: true, clearedDebt: cleared },
    reason,
  });
  return { closed: active.length, cleared };
}
