import { ROLES, type Role } from "./constants";

export type Permission = "FULL" | "OWN" | "READ" | "NONE";

export const MODULES = {
  CRM: "CRM",
  GROUPS: "GROUPS",
  ATTENDANCE: "ATTENDANCE",
  HOMEWORK: "HOMEWORK",
  PAYMENTS: "PAYMENTS",
  EXPENSES: "EXPENSES",
  CERTIFICATES: "CERTIFICATES",
  SALARY: "SALARY",
  REPORTS: "REPORTS",
  USERS: "USERS",
  MARKET: "MARKET",
  CHAT: "CHAT",
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

const M: Record<ModuleKey, Partial<Record<Role, Permission>>> = {
  CHAT: {
    STUDENT: "OWN",
    TEACHER: "OWN",
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "FULL",
  },
  MARKET: {
    STUDENT: "READ",
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "FULL",
  },
  CRM: {
    OPERATOR: "FULL",
    ROP: "FULL",
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "FULL",
  },
  GROUPS: {
    STUDENT: "READ",
    PARENT: "READ",
    TEACHER: "OWN",
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "FULL",
  },
  ATTENDANCE: {
    STUDENT: "OWN",
    PARENT: "READ",
    TEACHER: "OWN",
    MANAGER: "READ",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "READ",
    ADMIN: "READ",
  },
  HOMEWORK: {
    STUDENT: "READ",
    PARENT: "READ",
    TEACHER: "OWN",
    DEPUTY_DIRECTOR: "READ",
    DIRECTOR: "READ",
    ADMIN: "READ",
  },
  PAYMENTS: {
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "READ",
    ADMIN: "FULL",
    ACCOUNTANT: "FULL",
  },
  EXPENSES: {
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ACCOUNTANT: "FULL",
  },
  CERTIFICATES: {
    STUDENT: "READ",
    PARENT: "READ",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "READ",
  },
  SALARY: {
    TEACHER: "OWN",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ACCOUNTANT: "FULL",
  },
  REPORTS: {
    TEACHER: "OWN",
    OPERATOR: "OWN",
    ROP: "FULL",
    MANAGER: "OWN",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "READ",
  },
  USERS: {
    DIRECTOR: "FULL",
    ADMIN: "FULL",
  },
};

export function getPermission(role: string, module: ModuleKey): Permission {
  return M[module]?.[role as Role] ?? "NONE";
}

export function canRead(role: string, module: ModuleKey): boolean {
  return getPermission(role, module) !== "NONE";
}

export function canWrite(role: string, module: ModuleKey): boolean {
  const p = getPermission(role, module);
  return p === "FULL" || p === "OWN";
}

export function canSeeTeamReports(role: string): boolean {
  const p = getPermission(role, MODULES.REPORTS);
  return p === "FULL" || p === "READ";
}

export function isScopedToOwn(role: string, module: ModuleKey): boolean {
  return getPermission(role, module) === "OWN";
}

export function homeModule(role: string): ModuleKey {
  switch (role) {
    case ROLES.OPERATOR:
    case ROLES.ROP:
    case ROLES.MANAGER:
      return MODULES.CRM;
    case ROLES.TEACHER:
      return MODULES.GROUPS;
    case ROLES.DEPUTY_DIRECTOR:
    case ROLES.DIRECTOR:
      return MODULES.REPORTS;
    case ROLES.ADMIN:
      return MODULES.USERS;
    case ROLES.ACCOUNTANT:
      return MODULES.PAYMENTS;
    default:
      return MODULES.GROUPS;
  }
}
