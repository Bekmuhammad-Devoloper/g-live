import { ROLES, isRopPosition } from "@/lib/constants";

export const MANAGEMENT_DEPT = "Boshqaruv";

export const MANAGEMENT_POSITIONS = ["Direktor", "Direktor o'rinbosari"] as const;

export const MANAGEMENT_ROLES: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];

const DEFAULT_POSITION: Record<string, string> = {
  [ROLES.DIRECTOR]: "Direktor",
  [ROLES.DEPUTY_DIRECTOR]: "Direktor o'rinbosari",
  [ROLES.ADMIN]: "Administrator",
  [ROLES.TEACHER]: "O'qituvchi",
  [ROLES.OPERATOR]: "Operator",
  [ROLES.ROP]: "Sotuv bo'limi rahbari (ROP)",
  [ROLES.ACCOUNTANT]: "Moliyachi",
  [ROLES.MANAGER]: "Menejer",
};
export const defaultPositionFor = (role: string): string | null => DEFAULT_POSITION[role] ?? null;

export function roleForPosition(position: string): string {
  const p = position.toLowerCase();
  if (p.includes("administr")) return ROLES.ADMIN;
  if (p.includes("filial")) return ROLES.DEPUTY_DIRECTOR;
  if (p.includes("o'rinbosar") || p.includes("o‘rinbosar") || p.includes("orinbosar")) return ROLES.DEPUTY_DIRECTOR;
  if (p.includes("direktor")) return ROLES.DIRECTOR;
  if (p.includes("o'qituvchi") || p.includes("o‘qituvchi") || p.includes("ustoz") || p.includes("teacher")) return ROLES.TEACHER;
  if (p.includes("moliya") || p.includes("hisobchi") || p.includes("buxgalter") || p.includes("bugalter") || p.includes("accountant")) return ROLES.ACCOUNTANT;
  if (isRopPosition(p)) return ROLES.ROP;
  return ROLES.OPERATOR;
}

export const isSalesPosition = (position: string | null | undefined): boolean => {
  if (!position) return false;
  const r = roleForPosition(position);
  return r === ROLES.OPERATOR || r === ROLES.ROP;
};

export const isAdminPosition = (position: string | null | undefined): boolean => !!position && roleForPosition(position) === ROLES.ADMIN;
