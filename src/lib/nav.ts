import { ROLES } from "./constants";
import { MODULES, canRead, type ModuleKey } from "./rbac";

export interface NavItem {
  href: string;
  icon: string;
  i18nKey: string;
  module?: ModuleKey; // RBAC matritsasi orqali
  roles?: string[]; // yoki aniq rollar ro'yxati
}

const STAFF = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];
// Eslatma: operator va ROP umumiy STAFF menyusini emas, o'z portalini oladi (AppShell)
const HEAD = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const TOP = [ROLES.DIRECTOR, ROLES.ADMIN];

// Sidebar tartibi — buyurtmachi belgilagan ketma-ketlik
const ALL: NavItem[] = [
  { href: "/tasks", icon: "clipboard", i18nKey: "nav.tasks", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/crm", icon: "download", i18nKey: "nav.leads", module: MODULES.CRM },
  { href: "/teachers", icon: "teacher", i18nKey: "nav.teachers", roles: STAFF },
  { href: "/groups", icon: "layers", i18nKey: "nav.groups", module: MODULES.GROUPS },
  { href: "/students", icon: "graduation", i18nKey: "nav.students", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/education", icon: "book", i18nKey: "nav.education", roles: [...HEAD, ROLES.TEACHER] },
  { href: "/reminders", icon: "clock", i18nKey: "nav.reminders", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/tests", icon: "filecheck", i18nKey: "nav.blocktest", roles: [...HEAD, ROLES.TEACHER] },
  { href: "/finance", icon: "wallet", i18nKey: "nav.finance", roles: [ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ACCOUNTANT] },
  { href: "/rating", icon: "trophy", i18nKey: "nav.rating", roles: [...STAFF, ROLES.TEACHER] },
  { href: "/control", icon: "shieldCheck", i18nKey: "nav.control", roles: HEAD },
  { href: "/teacher-attendance", icon: "calendar", i18nKey: "nav.teacherAttendance", roles: HEAD },
  { href: "/management", icon: "layout", i18nKey: "nav.management", roles: TOP },
  { href: "/reports", icon: "chart", i18nKey: "nav.reports", module: MODULES.REPORTS },
  { href: "/marketing", icon: "megaphone", i18nKey: "nav.marketing", roles: STAFF },
  // Direktor o'rinbosari ham Sozlamalarni ko'radi — "Rahbariyat" guruhi unga tegishli.
  // Menyu ichidagi bandlar rol bo'yicha filtrlanadi (AppShell), shuning uchun
  // u faqat o'zi ocha oladigan bo'limlarni ko'radi.
  { href: "/settings", icon: "settings", i18nKey: "nav.settings", roles: [...TOP, ROLES.DEPUTY_DIRECTOR] },
  // Operator/ROP uchun shaxsiy sozlamalar — ularda umumiy Sozlamalar menyusi yo'q.
  // O'rinbosar bu bandni alohida ko'rmaydi: u Sozlamalar ichida turibdi (takror bo'lmasin).
  { href: "/settings/operator", icon: "headphones", i18nKey: "nav.mySettings", roles: [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER] },
];

export function navFor(role: string): NavItem[] {
  return ALL.filter((it) => {
    if (it.module) return canRead(role, it.module);
    if (it.roles) return it.roles.includes(role);
    return true;
  });
}
