import { ROLES } from "./constants";
import { MODULES, canRead, type ModuleKey } from "./rbac";
import { isPathEnabled } from "./instance";

export interface NavItem {
  href: string;
  icon: string;
  i18nKey: string;
  module?: ModuleKey;
  roles?: string[];
}

const STAFF = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];
const HEAD = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const TOP = [ROLES.DIRECTOR, ROLES.ADMIN];

const ALL: NavItem[] = [
  { href: "/tasks", icon: "clipboard", i18nKey: "nav.tasks", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/crm", icon: "download", i18nKey: "nav.leads", module: MODULES.CRM },
  { href: "/teachers", icon: "teacher", i18nKey: "nav.teachers", roles: STAFF },
  { href: "/groups", icon: "layers", i18nKey: "nav.groups", module: MODULES.GROUPS },
  { href: "/students", icon: "graduation", i18nKey: "nav.students", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/education", icon: "book", i18nKey: "nav.education", roles: [...HEAD, ROLES.TEACHER, ROLES.MANAGER] },
  { href: "/chat", icon: "mail", i18nKey: "nav.chat", roles: [ROLES.TEACHER] },
  { href: "/reminders", icon: "clock", i18nKey: "nav.reminders", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/tests", icon: "filecheck", i18nKey: "nav.blocktest", roles: [...HEAD, ROLES.TEACHER] },
  { href: "/finance", icon: "wallet", i18nKey: "nav.finance", roles: [ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ACCOUNTANT] },
  { href: "/rating", icon: "trophy", i18nKey: "nav.rating", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/market", icon: "coins", i18nKey: "nav.market", roles: STAFF },
  { href: "/control", icon: "shieldCheck", i18nKey: "nav.control", roles: HEAD },
  { href: "/teacher-attendance", icon: "calendar", i18nKey: "nav.teacherAttendance", roles: HEAD },
  { href: "/management", icon: "layout", i18nKey: "nav.management", roles: TOP },
  { href: "/reports", icon: "chart", i18nKey: "nav.reports", module: MODULES.REPORTS },
  { href: "/marketing", icon: "megaphone", i18nKey: "nav.marketing", roles: STAFF },
  { href: "/settings", icon: "settings", i18nKey: "nav.settings", roles: [...TOP, ROLES.DEPUTY_DIRECTOR] },
  { href: "/settings/operator", icon: "headphones", i18nKey: "nav.mySettings", roles: [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER] },
];

export function navFor(role: string): NavItem[] {
  return ALL.filter((it) => {
    if (!isPathEnabled(it.href)) return false;
    if (it.module) return canRead(role, it.module);
    if (it.roles) return it.roles.includes(role);
    return true;
  });
}
