import { ROLES } from "@/lib/constants";

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
