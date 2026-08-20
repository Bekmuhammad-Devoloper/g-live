// Rolga asoslangan kirish nazorati (RBAC) — TZ 2.3 "Ruxsatlar matritsasi".
// Serverning HAR bir so'rovida tekshiriladi (faqat interfeys darajasida emas).
//
// Ruxsat darajalari:
//   FULL — to'liq (yaratish/tahrirlash/ko'rish)
//   OWN  — faqat o'ziga tegishli resurslar (masalan o'qituvchi o'z guruhi)
//   READ — faqat ko'rish
//   NONE — kirish yo'q

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
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

// Matritsa: [module][role] => Permission
const M: Record<ModuleKey, Partial<Record<Role, Permission>>> = {
  CRM: {
    OPERATOR: "FULL",  // o'ziga biriktirilgan lidlar bilan ishlaydi
    ROP: "FULL",
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "FULL", // qabul bo'limi: lid qo'shadi va bosqichdan bosqichga ko'chiradi (2026-08-21 talab)
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
    // Qo'lda to'lov: Menejer, Dir. o'rinbosari, Administrator (kassir) va Hisobchi.
    // Operator va ROP kiritilmagan — eski loyihada ham sotuv bo'limida
    // moliya moduli yo'q (faqat CEO da 'view_financial_reports').
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "READ",
    ADMIN: "FULL", // administrator to'lov qabul qiladi
    ACCOUNTANT: "FULL", // hisobchining asosiy vazifasi
  },
  // Xarajatlar — moliyani boshqarish (rahbariyat + menejer + hisobchi)
  EXPENSES: {
    MANAGER: "FULL",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ACCOUNTANT: "FULL",
    // Administrator moliyani boshqarmaydi (faqat to'lov qabul qiladi)
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
    ACCOUNTANT: "FULL", // ish haqi hisob-kitobi ham hisobchi vazifasi
  },
  REPORTS: {
    TEACHER: "OWN",
    OPERATOR: "OWN",   // faqat o'z qo'ng'iroq/KPI ko'rsatkichlari
    ROP: "FULL",       // jamoasi: operatorlar, KPI, qo'ng'iroqlar
    MANAGER: "OWN",
    DEPUTY_DIRECTOR: "FULL",
    DIRECTOR: "FULL",
    ADMIN: "READ",
    // Hisobchiga umumiy (CRM/sotuv aralash) hisobotlar kerak emas — faqat /finance yetarli
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

// Yozish (yaratish/tahrirlash) huquqi — FULL yoki OWN bo'lsa (OWN — resurs darajasida qo'shimcha tekshiriladi)
export function canWrite(role: string, module: ModuleKey): boolean {
  const p = getPermission(role, module);
  return p === "FULL" || p === "OWN";
}

/**
 * Butun jamoa hisobotlarini (operatorlar ro'yxati, umumiy KPI, ROP paneli)
 * ko'rish huquqi. Operatorda REPORTS = "OWN" — u faqat O'Z ko'rsatkichlarini
 * ko'radi, boshqa operatorlarnikini emas (eski loyihada ham 'view_operator_kpi'
 * faqat ROP da bor).
 */
export function canSeeTeamReports(role: string): boolean {
  const p = getPermission(role, MODULES.REPORTS);
  return p === "FULL" || p === "READ";
}

// Faqat o'ziga tegishli resurslar bilan cheklanganmi?
export function isScopedToOwn(role: string, module: ModuleKey): boolean {
  return getPermission(role, module) === "OWN";
}

// Har bir rol uchun asosiy (default) kabinet moduli
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
