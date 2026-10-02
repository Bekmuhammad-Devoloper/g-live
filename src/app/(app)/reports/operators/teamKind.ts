import { ROLES, type LocaleText } from "@/lib/constants";

// Jamoa bo'limi ikki tur uchun bitta kod bilan ishlaydi: operatorlar (/reports/operators)
// va filial administratorlari (/reports/admins). Farqi — rol, manzil va matnlar.

export type TeamKind = "operator" | "admin";

export interface TeamConfig {
  kind: TeamKind;
  role: string;
  /** Ro'yxat sahifasi manzili; profil — `${base}/${id}` */
  base: string;
  icon: string;
  emailPlaceholder: string;
  t: {
    one: LocaleText;
    many: LocaleText;
    subtitle: LocaleText;
    add: LocaleText;
    search: LocaleText;
    notFound: LocaleText;
    edit: LocaleText;
    remove: LocaleText;
    created: LocaleText;
    profile: LocaleText;
  };
}

export const TEAM: Record<TeamKind, TeamConfig> = {
  operator: {
    kind: "operator",
    role: ROLES.OPERATOR,
    base: "/reports/operators",
    icon: "headphones",
    emailPlaceholder: "operator@example.com",
    t: {
      one: { uz: "Operator", ru: "Оператор", en: "Operator", de: "Operator" },
      many: { uz: "Operatorlar", ru: "Операторы", en: "Operators", de: "Operatoren" },
      subtitle: { uz: "Operatorlarni boshqarish va monitoring", ru: "Управление и мониторинг операторов", en: "Operator management and monitoring", de: "Verwaltung und Überwachung der Operatoren" },
      add: { uz: "Yangi operator", ru: "Новый оператор", en: "New operator", de: "Neuer Operator" },
      search: { uz: "Operator qidirish...", ru: "Поиск оператора...", en: "Search operator...", de: "Operator suchen..." },
      notFound: { uz: "Operator topilmadi", ru: "Оператор не найден", en: "No operator found", de: "Kein Operator gefunden" },
      edit: { uz: "Operatorni tahrirlash", ru: "Редактировать оператора", en: "Edit operator", de: "Operator bearbeiten" },
      remove: { uz: "Operatorni o'chirish", ru: "Удалить оператора", en: "Remove operator", de: "Operator entfernen" },
      created: { uz: "Operator yaratildi", ru: "Оператор создан", en: "Operator created", de: "Operator erstellt" },
      profile: { uz: "Operator profili", ru: "Профиль оператора", en: "Operator profile", de: "Operatorprofil" },
    },
  },
  admin: {
    kind: "admin",
    role: ROLES.ADMIN,
    base: "/reports/admins",
    icon: "shield",
    emailPlaceholder: "admin@example.com",
    t: {
      one: { uz: "Administrator", ru: "Администратор", en: "Administrator", de: "Administrator" },
      many: { uz: "Administratorlar", ru: "Администраторы", en: "Administrators", de: "Administratoren" },
      subtitle: { uz: "Filial administratorlarini boshqarish va monitoring", ru: "Управление и мониторинг администраторов филиалов", en: "Branch administrator management and monitoring", de: "Verwaltung und Überwachung der Filial-Administratoren" },
      add: { uz: "Yangi administrator", ru: "Новый администратор", en: "New administrator", de: "Neuer Administrator" },
      search: { uz: "Administrator qidirish...", ru: "Поиск администратора...", en: "Search administrator...", de: "Administrator suchen..." },
      notFound: { uz: "Administrator topilmadi", ru: "Администратор не найден", en: "No administrator found", de: "Kein Administrator gefunden" },
      edit: { uz: "Administratorni tahrirlash", ru: "Редактировать администратора", en: "Edit administrator", de: "Administrator bearbeiten" },
      remove: { uz: "Administratorni o'chirish", ru: "Удалить администратора", en: "Remove administrator", de: "Administrator entfernen" },
      created: { uz: "Administrator yaratildi", ru: "Администратор создан", en: "Administrator created", de: "Administrator erstellt" },
      profile: { uz: "Administrator profili", ru: "Профиль администратора", en: "Administrator profile", de: "Administratorprofil" },
    },
  },
};

export const teamKindOf = (v: unknown): TeamKind => (v === "admin" ? "admin" : "operator");
