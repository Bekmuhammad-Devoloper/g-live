import "server-only";
import { prisma } from "./db";
import { ROLES, isRopPosition } from "./constants";
import { canWrite, MODULES } from "./rbac";

/**
 * Operatorlarni boshqarish (yaratish / tahrirlash / arxivlash) huquqi.
 *
 * Ikki yo'l bilan beriladi:
 *  1. `USERS` moduli orqali — Direktor va Administrator (butun xodimlar bazasi);
 *  2. **ROP** (sotuv bo'limi rahbari) — u RBAC'da oddiy MANAGER, lekin operatorlar
 *     uning jamoasi bo'lgani uchun ularni boshqarishi kerak. ROP oddiy operatordan
 *     LAVOZIMI (`User.position`) bilan ajratiladi — shu sabab bazaga so'rov ketadi.
 *
 * Oddiy operator (ROP bo'lmagan MANAGER) hech qachon boshqa operator yarata olmaydi.
 */
export async function canManageOperators(role: string, userId: string): Promise<boolean> {
  if (canWrite(role, MODULES.USERS)) return true;
  if (role === ROLES.ROP) return true;          // ROP — operatorlarning bevosita rahbari
  if (role !== ROLES.MANAGER) return false;
  // Eski MANAGER yozuvlari uchun zaxira: lavozim matnidan aniqlaymiz
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { position: true } });
  return isRopPosition(me?.position);
}
