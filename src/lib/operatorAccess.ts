import "server-only";
import { prisma } from "./db";
import { ROLES, isRopPosition } from "./constants";
import { canWrite, MODULES } from "./rbac";

export async function canManageOperators(role: string, userId: string): Promise<boolean> {
  if (canWrite(role, MODULES.USERS)) return true;
  if (role === ROLES.ROP) return true;
  if (role !== ROLES.MANAGER) return false;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { position: true } });
  return isRopPosition(me?.position);
}

const ADMIN_TEAM_ROLES: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ROP];
export const canSeeAdminTeam = (role: string): boolean => ADMIN_TEAM_ROLES.includes(role);
export const canManageAdminTeam = (role: string): boolean => ADMIN_TEAM_ROLES.includes(role);
