"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/constants";
import { getT } from "@/lib/i18n";
import { Icon } from "./Icon";
import Topbar, { type TopbarProps } from "./Topbar";
import { logout } from "../actions";

export interface ShellNavItem {
  href: string;
  icon: string;
  label: string;
}

interface SubItem {
  href: string;
  icon: string;
  label: Record<Locale, string>;
}
interface SubGroup {
  label?: Record<Locale, string>; // bo'lim sarlavhasi (ixtiyoriy)
  items: SubItem[];
}
// qisqa yozuv uchun: L("uz") yoki L("uz","ru","en")
const L = (uz: string, ru = uz, en = uz): Record<Locale, string> => ({ uz, ru, en });

// Footer havolalari — texnik yordam (Telegram lichka) va video darsliklar kanali
const SUPPORT_TELEGRAM = "https://t.me/yuksalish_development";
const VIDEO_CHANNEL = "https://t.me/yuksalish_development";

// Sidebar bo'limlari uchun yonboshdan ochiluvchi submenu (Radian/Modme uslubida)
const SUBMENUS: Record<string, { title: Record<Locale, string>; groups: SubGroup[] }> = {
  "/groups": {
    title: { uz: "Guruhlar", ru: "Группы", en: "Groups" },
    groups: [
      { items: [
        { href: "/groups", icon: "layers", label: { uz: "Guruh", ru: "Группа", en: "Group" } },
        { href: "/assignments", icon: "clipboard", label: { uz: "Barcha vazifalar", ru: "Все задачи", en: "All tasks" } },
        { href: "/schedule", icon: "calendar", label: { uz: "Dars jadvali", ru: "Расписание", en: "Schedule" } },
        { href: "/rooms", icon: "building", label: { uz: "Xonalar", ru: "Кабинеты", en: "Rooms" } },
        { href: "/group-students", icon: "graduation", label: { uz: "Guruh o'quvchilari", ru: "Ученики группы", en: "Group students" } },
      ] },
    ],
  },
  "/management": {
    title: { uz: "Boshqaruv", ru: "Управление", en: "Management" },
    groups: [
      { items: [
        { href: "/users", icon: "users", label: { uz: "Xodimlar", ru: "Сотрудники", en: "Staff" } },
        { href: "/roles", icon: "shield", label: { uz: "Rollar", ru: "Роли", en: "Roles" } },
        { href: "/branches", icon: "building", label: { uz: "Filiallar", ru: "Филиалы", en: "Branches" } },
        { href: "/tags", icon: "layers", label: { uz: "Teglar", ru: "Теги", en: "Tags" } },
      ] },
    ],
  },
  "/reports": {
    title: L("Hisobotlar", "Отчёты", "Reports"),
    groups: [
      { items: [
        { href: "/reports/conversion", icon: "chart", label: L("Konversiya hisobotlari") },
        { href: "/reports/attendance", icon: "check", label: L("Davomat hisobotlari") },
        { href: "/reports/leads", icon: "download", label: L("Lidlar hisobotlari") },
        { href: "/reports/left-students", icon: "personMinus", label: L("Guruhni tark etganlar") },
      ] },
      { label: L("Jurnallar", "Журналы", "Logs"), items: [
        { href: "/reports/sms", icon: "mail", label: L("Yuborilgan SMS jurnali") },
        { href: "/reports/calls", icon: "phone", label: L("Qo'ng'iroqlar jurnali") },
        { href: "/audit", icon: "listView", label: L("Audit jurnali") },
        { href: "/teacher-attendance", icon: "clock", label: L("Workly hisoboti") },
      ] },
      { label: L("Sotuv va marketing", "Продажи и маркетинг", "Sales & marketing"), items: [
        { href: "/reports/funnel", icon: "megaphone", label: L("Sotuv voronkasi") },
        { href: "/reports/leads", icon: "download", label: L("Lidlar oqimi") },
      ] },
      { label: L("Moliya", "Финансы", "Finance"), items: [
        { href: "/reports/balance", icon: "wallet", label: L("Balans") },
        { href: "/reports/payments", icon: "refresh", label: L("Kirim chiqim (tushum)") },
        { href: "/reports/cancelled", icon: "fileX", label: L("Bekor qilingan to'lovlar") },
      ] },
      { label: L("O'quv", "Учебное", "Education"), items: [
        { href: "/reports/teacher-performance", icon: "teacher", label: L("O'qituvchilar samaradorligi") },
        { href: "/reports/admin-performance", icon: "users", label: L("Adminlar samaradorligi") },
        { href: "/reports/leave-reasons", icon: "info", label: L("Ketish sabablari") },
        { href: "/reports/rooms-analytics", icon: "building", label: L("Xonalar analitikasi") },
        { href: "/reports/worked-hours", icon: "clock", label: L("Ishlab berilgan soatlar") },
        { href: "/reports/cancelled-attendance", icon: "fileX", label: L("Bekor qilingan davomatlar") },
      ] },
    ],
  },
  // Nazorat submenu — hisobot elementlari /reports dan ko'chirildi (takrorlanmasin)
  "/control": {
    title: L("Nazorat", "Контроль", "Control"),
    groups: [
      { label: L("Amallar", "Действия", "Actions"), items: [
        { href: "/attendance", icon: "check", label: L("Davomat") },
        { href: "/reports/attendance", icon: "chart", label: L("Davomat analitikasi") },
        { href: "/control/feedback", icon: "info", label: L("Fikr-mulohaza") },
      ] },
      { label: L("Hisobotlar", "Отчёты", "Reports"), items: [
        { href: "/reports/staff-rating", icon: "trophy", label: L("Xodimlar reytingi") },
        { href: "/reports/no-attendance", icon: "layers", label: L("Davomatsiz guruhlar") },
        { href: "/reports/branches-status", icon: "building", label: L("Filiallar holati") },
        { href: "/control/turnstile", icon: "shieldCheck", label: L("Turniket analitikasi") },
        { href: "/control/turnstile-log", icon: "shieldCheck", label: L("Turniket kirish-chiqish") },
        { href: "/control/support", icon: "eye", label: L("Qo'llab-quvvatlash") },
      ] },
    ],
  },
  "/finance": {
    title: L("Moliya", "Финансы", "Finance"),
    groups: [
      { items: [
        { href: "/finance/payments", icon: "coins", label: L("Barcha to'lovlar") },
        { href: "/finance/withdrawals", icon: "coins", label: L("Yechib olish") },
        { href: "/finance/expenses", icon: "wallet", label: L("Xarajatlar") },
        { href: "/finance/salary", icon: "clipboard", label: L("Ish haqi new") },
        { href: "/finance/debtors", icon: "alert", label: L("Qarzdorlar") },
      ] },
    ],
  },
  "/marketing": {
    title: L("Sotuv / Marketing", "Продажи / Маркетинг", "Sales / Marketing"),
    groups: [
      { label: L("Marketing"), items: [
        { href: "/marketing", icon: "megaphone", label: L("Marketing") },
        { href: "/marketing", icon: "bell", label: L("Yangiliklar") },
        { href: "/marketing", icon: "book", label: L("Hikoya") },
        { href: "/settings/sms", icon: "mail", label: L("SMS shablonlari") },
        { href: "/reports/sms", icon: "listView", label: L("Xabarlar ro'yhati") },
      ] },
      { label: L("Sotuv bo'limi", "Отдел продаж", "Sales dept."), items: [
        { href: "/rop", icon: "chart", label: L("ROP Dashboard") },
        { href: "/operator", icon: "headphones", label: L("Operator konsoli") },
        { href: "/crm", icon: "download", label: L("Lidlar (buyurtmalar)") },
        { href: "/vacancies", icon: "building", label: L("Vakansiyalar", "Вакансии", "Vacancies") },
        { href: "/links", icon: "link", label: L("Maxsus linklar", "Спец. ссылки", "Special links") },
        { href: "/reports/funnel", icon: "megaphone", label: L("Sotuv voronkasi") },
        { href: "/reports/sales-team", icon: "chart", label: L("Savdo bo'limi") },
        { href: "/reports/operators", icon: "user", label: L("Operatorlar") },
        { href: "/reports/kpi", icon: "trophy", label: L("KPI") },
      ] },
    ],
  },
  "/settings": {
    title: { uz: "Sozlamalar", ru: "Настройки", en: "Settings" },
    groups: [
      { items: [
        { href: "/settings/sms", icon: "mail", label: { uz: "SMS sozlamalari", ru: "Настройки SMS", en: "SMS settings" } },
        { href: "/settings/telephony", icon: "phone", label: { uz: "Onlain telefoniya", ru: "Онлайн телефония", en: "Online telephony" } },
        { href: "/settings/grading", icon: "award", label: { uz: "Baholash", ru: "Оценивание", en: "Grading" } },
        { href: "/settings/operator", icon: "headphones", label: { uz: "Operator sozlamalari", ru: "Настройки оператора", en: "Operator settings" } },
      ] },
      { label: { uz: "CEO", ru: "CEO", en: "CEO" }, items: [
        { href: "/settings", icon: "settings", label: { uz: "Umumiy sozlamalar", ru: "Общие настройки", en: "General settings" } },
        { href: "/settings/staff", icon: "users", label: { uz: "Xodimlar", ru: "Сотрудники", en: "Staff" } },
        { href: "/settings/billing", icon: "card", label: { uz: "Billing", ru: "Биллинг", en: "Billing" } },
        { href: "/roadmap", icon: "chart", label: { uz: "Roadmap", ru: "Roadmap", en: "Roadmap" } },
      ] },
      { label: { uz: "Ofis", ru: "Офис", en: "Office" }, items: [
        { href: "/courses", icon: "book", label: { uz: "Kurslar", ru: "Курсы", en: "Courses" } },
        { href: "/rooms", icon: "building", label: { uz: "Xonalar", ru: "Кабинеты", en: "Rooms" } },
        { href: "/settings/holidays", icon: "calendar", label: { uz: "Dam olish kunlari", ru: "Выходные дни", en: "Holidays" } },
        { href: "/archive", icon: "history", label: { uz: "Arxiv", ru: "Архив", en: "Archive" } },
      ] },
    ],
  },
};

// ROP (sotuv bo'limi boshlig'i) uchun alohida sidebar bandlari
const ROP_NAV: { href: string; icon: string; label: Record<Locale, string>; exact?: boolean }[] = [
  { href: "/rop", icon: "grid", label: L("Bosh sahifa", "Главная", "Home"), exact: true },
  { href: "/crm", icon: "download", label: L("Lidlar", "Лиды", "Leads") },
  { href: "/reports/operators", icon: "headphones", label: L("Operatorlar", "Операторы", "Operators") },
  { href: "/reports/kpi", icon: "chart", label: L("KPI") },
  { href: "/rop/kpi-settings", icon: "settings", label: L("KPI sozlamalari", "Настройки KPI", "KPI settings") },
  { href: "/reports/calls", icon: "phone", label: L("Qo'ng'iroq", "Звонки", "Calls") },
  { href: "/vacancies", icon: "building", label: L("Vakansiyalar", "Вакансии", "Vacancies") },
  { href: "/links", icon: "link", label: L("Havolalar", "Ссылки", "Links") },
  { href: "/tasks", icon: "clipboard", label: L("Vazifalar", "Задачи", "Tasks") },
  { href: "/marketing", icon: "bell", label: L("Xabarlar", "Сообщения", "Messages") },
  { href: "/settings/operator", icon: "settings", label: L("Sozlamalar", "Настройки", "Settings") },
];

// Operator (sotuv menejeri) portali — eski loyihadagi `operator` sidebar bilan
// bir xil tartib va bo'limlar:
//   /operator → /operator/leads → /operator/calls → /operator/reminders
//   → /operator/notifications → /operator/settings
// Bu loyihadagi mavjud sahifalarga moslashtirilgan.
const OPERATOR_NAV: { href: string; icon: string; label: Record<Locale, string>; exact?: boolean }[] = [
  { href: "/operator", icon: "grid", label: L("Bosh sahifa", "Главная", "Dashboard"), exact: true },
  { href: "/crm", icon: "download", label: L("Lidlar", "Лиды", "Leads") },
  { href: "/reports/calls", icon: "phone", label: L("Qo'ng'iroqlar", "Звонки", "Calls") },
  { href: "/reminders", icon: "clock", label: L("Eslatmalar", "Напоминания", "Reminders") },
  { href: "/notifications", icon: "bell", label: L("Bildirishnomalar", "Уведомления", "Notifications") },
  { href: "/settings/operator", icon: "settings", label: L("Sozlamalar", "Настройки", "Settings") },
];

interface Props {
  navItems: ShellNavItem[];
  role: string;
  portal?: "rop" | "operator";
  user: { fullName: string; role: string; imageUrl: string | null; roleLabel: string; branchName: string | null };
  locale: Locale;
  labels: { logout: string; appName: string; tagline: string };
  unreadCount: number;
  topbar: Omit<TopbarProps, "onMenu" | "locale" | "unreadCount" | "user" | "appName">;
  children: React.ReactNode;
}

// Nazorat menyusidagi bandlar. Ular /reports/... yo'lida tursa ham sidebar'da
// HISOBOTLAR emas, NAZORAT yonishi kerak (foydalanuvchi qaysi bo'limdan kirgani muhim).
const CONTROL_ROUTES = new Set<string>([
  "/attendance",
  "/reports/attendance",
  "/reports/staff-rating",
  "/reports/no-attendance",
  "/reports/branches-status",
]);

// O'qituvchi rolida hisobotlar menyusida ko'rinadigan (o'qituvchiga mos) hisobotlar
const TEACHER_REPORTS = new Set<string>([
  "/reports/attendance",
  "/reports/teacher-performance",
  "/reports/worked-hours",
  "/reports/cancelled-attendance",
  "/reports/left-students",
  "/teacher-attendance",
]);

// Mobil menyu qatori (icon + label havola)
function MobileRow({ href, icon, label, active, onNav }: { href: string; icon: string; label: string; active: boolean; onNav: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNav}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
      )}
    >
      <Icon name={icon} className="h-5 w-5 shrink-0" />
      {label}
    </Link>
  );
}

export default function AppShell({ navItems, role, portal, user, locale, labels, unreadCount, topbar, children }: Props) {
  const pathname = usePathname();

  // ROP va operator o'z sidebar'iga ega (umumiy xodim menyusi o'rniga).
  // portalNav null bo'lsa — oddiy rolga mos menyu ko'rsatiladi.
  const portalNav = portal === "rop" ? ROP_NAV : portal === "operator" ? OPERATOR_NAV : null;

  // Submenu guruhlari — o'qituvchi rolida /reports faqat mos hisobotlarga cheklanadi
  const submenuGroups = (href: string): SubGroup[] => {
    const groups = SUBMENUS[href].groups;
    if (href === "/reports" && role === "TEACHER") {
      return groups
        .map((g) => ({ ...g, items: g.items.filter((it) => TEACHER_REPORTS.has(it.href)) }))
        .filter((g) => g.items.length > 0);
    }
    // Davomat analitikasi NAZORAT bo'limida turadi — Hisobotlarda takrorlanmasin.
    // O'qituvchida Nazorat menyusi yo'q, shuning uchun unga qoldiriladi (yuqoridagi shart).
    if (href === "/reports") {
      return groups
        .map((g) => ({ ...g, items: g.items.filter((it) => it.href !== "/reports/attendance") }))
        .filter((g) => g.items.length > 0);
    }
    // Administrator faqat o'z filialiga tayinlangan — Filiallar bo'limini boshqara olmaydi
    if (href === "/management" && role === "ADMIN") {
      return groups
        .map((g) => ({ ...g, items: g.items.filter((it) => it.href !== "/branches") }))
        .filter((g) => g.items.length > 0);
    }
    return groups;
  };
  const [open, setOpen] = useState(false);
  const [fly, setFly] = useState<{ href: string; top: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mOpen, setMOpen] = useState<Set<string>>(new Set()); // mobil menyu ochilgan bo'limlari
  const toggleM = (k: string) => setMOpen((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = getT(locale);

  const toggleGroup = (key: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // Nazorat menyusi bor rollarda (rahbariyat) nazorat yo'llari Nazoratni yoqadi.
  // O'qituvchida Nazorat yo'q — unda bu sahifalar odatdagidek Hisobotlarni yoqadi.
  const hasControl = navItems.some((it) => it.href === "/control");
  const isActive = (href: string) => {
    const inControl = hasControl && CONTROL_ROUTES.has(pathname);
    if (href === "/control") return inControl || pathname === href || pathname.startsWith(href + "/");
    if (href === "/reports" && inControl) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  function openFly(href: string, el: HTMLElement) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFly({ href, top: el.getBoundingClientRect().top });
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFly(null), 160);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  const Rail = (
    <>
      {/* Logotip */}
      <Link
        href="/dashboard"
        onClick={() => setOpen(false)}
        className="flex h-16 shrink-0 items-center justify-center border-b border-slate-200 px-3 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Germaniya Live" className="max-h-10 w-auto max-w-full object-contain dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.png" alt="Germaniya Live" className="hidden max-h-10 w-auto max-w-full object-contain dark:block" />
      </Link>

      {/* Bo'limlar */}
      <nav className="flex-1 overflow-y-auto py-2">
        {portalNav
          ? portalNav.map((it) => {
              const on = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href + it.label.uz}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="group relative flex flex-col items-center gap-1.5 px-1.5 py-2.5"
                >
                  <span
                    className={cn(
                      "relative grid h-[52px] w-[52px] place-items-center rounded-2xl transition",
                      on ? "bg-brand-600 text-white shadow-md shadow-brand-600/30 dark:shadow-lg dark:shadow-brand-950/50" : "text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:bg-white/10 dark:group-hover:text-white"
                    )}
                  >
                    <Icon name={it.icon} className="h-[30px] w-[30px]" />
                  </span>
                  <span
                    className={cn(
                      "text-center text-[11px] font-medium leading-tight",
                      on ? "text-brand-700 dark:text-white" : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                    )}
                  >
                    {it.label[locale] ?? it.label.uz}
                  </span>
                </Link>
              );
            })
          : navItems.map((it) => {
              const active = isActive(it.href);
              const hasSub = !!SUBMENUS[it.href];
              const on = active || fly?.href === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  onMouseEnter={hasSub ? (e) => openFly(it.href, e.currentTarget) : undefined}
                  onMouseLeave={hasSub ? scheduleClose : undefined}
                  className="group relative flex flex-col items-center gap-1.5 px-1.5 py-2.5"
                >
                  {hasSub && (
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 transition group-hover:text-slate-500 dark:text-white/25 dark:group-hover:text-white/50">›</span>
                  )}
                  <span
                    className={cn(
                      "relative grid h-[52px] w-[52px] place-items-center rounded-2xl transition",
                      on ? "bg-brand-600 text-white shadow-md shadow-brand-600/30 dark:shadow-lg dark:shadow-brand-950/50" : "text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:bg-white/10 dark:group-hover:text-white"
                    )}
                  >
                    <Icon name={it.icon} className="h-[30px] w-[30px]" />
                    {it.href === "/reminders" && unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#0d1b38]">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-center text-[11px] font-medium leading-tight",
                      on ? "text-brand-700 dark:text-white" : "text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                    )}
                  >
                    {it.label}
                  </span>
                </Link>
              );
            })}
      </nav>

      {/* Chiqish (ROP portalida sidebar pastida) */}
      {portalNav && (
        <form action={logout} className="shrink-0 border-t border-slate-200 dark:border-white/5">
          <button type="submit" className="group flex w-full flex-col items-center gap-1.5 px-1.5 py-3 text-slate-500 transition hover:text-rose-600 dark:text-slate-400 dark:hover:text-white">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl transition group-hover:bg-rose-50 group-hover:text-rose-600 dark:group-hover:bg-rose-500/20 dark:group-hover:text-rose-300">
              <Icon name="logout" className="h-[30px] w-[30px]" />
            </span>
            <span className="text-[10.5px] font-medium">{labels.logout}</span>
          </button>
        </form>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Desktop rail */}
      {/* Kenglik Modme'dagi saidbar bilan bir xil (120px) */}
      <aside className="sticky top-0 hidden h-screen w-[120px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-transparent dark:bg-[#0d1b38] md:flex">
        {Rail}
      </aside>

      {/* Yonboshdan ochiluvchi submenu (flyout) */}
      {fly && SUBMENUS[fly.href] && (
        <div
          className="fixed bottom-0 left-[120px] top-16 z-40 hidden w-[272px] md:block"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="flex h-full flex-col border-r border-slate-200 bg-white shadow-pop dark:border-transparent dark:bg-[#0d1b38]">
            <div className="shrink-0 border-b border-slate-200 px-4 py-3 text-[15px] font-bold text-slate-800 dark:border-white/5 dark:text-white">
              {SUBMENUS[fly.href].title[locale] ?? SUBMENUS[fly.href].title.uz}
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">
            {submenuGroups(fly.href).map((grp, gi) => {
              const gkey = `${fly.href}:${gi}`;
              const isCol = collapsed.has(gkey);
              return (
                <div key={gi} className={cn(gi > 0 && "mt-1 border-t border-slate-100 pt-1 dark:border-white/5")}>
                  {grp.label && (
                    <button
                      onClick={() => toggleGroup(gkey)}
                      className="flex w-full items-center gap-1.5 px-4 pb-0.5 pt-2 text-[12px] font-bold uppercase tracking-wide text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      <Icon name="chevronDown" className={cn("h-3 w-3 transition-transform", isCol && "-rotate-90")} />
                      {grp.label[locale] ?? grp.label.uz}
                    </button>
                  )}
                  {!isCol && grp.items.map((s) => {
                    const sactive = pathname === s.href;
                    return (
                      <Link
                        key={s.href + s.label.uz}
                        href={s.href}
                        onClick={() => { setFly(null); setOpen(false); }}
                        className={cn(
                          "mx-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] leading-tight whitespace-nowrap transition",
                          sactive
                            ? "bg-brand-600 font-semibold text-white"
                            : "text-slate-600 hover:bg-slate-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                        )}
                      >
                        <Icon name={s.icon} className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="truncate" title={s.label[locale] ?? s.label.uz}>{s.label[locale] ?? s.label.uz}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* Mobil menyu — kengroq, ochiladigan bo'limlar bilan (barcha sahifalar telefonda ochiladi) */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[284px] max-w-[86%] flex-col bg-white shadow-pop dark:bg-[#0d1b38]">
            {/* Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Germaniya Live" className="max-h-9 w-auto object-contain dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-dark.png" alt="Germaniya Live" className="hidden max-h-9 w-auto object-contain dark:block" />
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">✕</button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto p-2">
              {portalNav
                ? portalNav.map((it) => {
                    const on = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
                    return <MobileRow key={it.href + it.label.uz} href={it.href} icon={it.icon} label={it.label[locale] ?? it.label.uz} active={on} onNav={() => setOpen(false)} />;
                  })
                : navItems.map((it) => {
                    const hasSub = !!SUBMENUS[it.href];
                    const on = isActive(it.href);
                    if (!hasSub) return <MobileRow key={it.href} href={it.href} icon={it.icon} label={it.label} active={on} onNav={() => setOpen(false)} />;
                    const exp = mOpen.has(it.href);
                    return (
                      <div key={it.href}>
                        <button
                          onClick={() => toggleM(it.href)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                            on ? "text-brand-700 dark:text-brand-300" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                          )}
                        >
                          <Icon name={it.icon} className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-left">{it.label}</span>
                          <Icon name="chevronDown" className={cn("h-4 w-4 shrink-0 transition-transform", !exp && "-rotate-90")} />
                        </button>
                        {exp && (
                          <div className="mb-1 ml-4 border-l border-slate-200 pl-2 dark:border-white/10">
                            {submenuGroups(it.href).map((grp, gi) => (
                              <div key={gi}>
                                {grp.label && <div className="px-3 pb-0.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{grp.label[locale] ?? grp.label.uz}</div>}
                                {grp.items.map((s) => {
                                  const sactive = pathname === s.href;
                                  return (
                                    <Link
                                      key={s.href + s.label.uz}
                                      href={s.href}
                                      onClick={() => setOpen(false)}
                                      className={cn(
                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] leading-tight whitespace-nowrap transition",
                                        sactive ? "bg-brand-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-100 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                                      )}
                                    >
                                      <Icon name={s.icon} className="h-4 w-4 shrink-0 opacity-90" />
                                      <span className="truncate">{s.label[locale] ?? s.label.uz}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
            </nav>

            {portalNav && (
              <form action={logout} className="shrink-0 border-t border-slate-200 p-2 dark:border-white/5">
                <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">
                  <Icon name="logout" className="h-5 w-5" /> {labels.logout}
                </button>
              </form>
            )}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Yuqori panel */}
        <Topbar
          {...topbar}
          locale={locale}
          unreadCount={unreadCount}
          user={user}
          appName={labels.appName}
          onMenu={() => setOpen(true)}
        />

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>

        {/* Global footer — Modme uslubida */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <a
              href={SUPPORT_TELEGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-1.5 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              <Icon name="user" className="h-3.5 w-3.5" /> {t("footer.support")}
            </a>
            <a
              href={VIDEO_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-1.5 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              <Icon name="info" className="h-3.5 w-3.5" /> {t("footer.video")}
            </a>
            <span className="flex items-center gap-1.5">
              <Icon name="info" className="h-3.5 w-3.5" /> {t("footer.payMode")}:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{t("footer.payModeValue")}</span>
            </span>
          </div>

          <div className="leading-none">
            <div className="flex justify-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Germaniya Live" className="h-8 w-auto object-contain dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-dark.png" alt="Germaniya Live" className="hidden h-8 w-auto object-contain dark:block" />
            </div>
            <div className="mt-1 text-right text-[9px] font-medium uppercase tracking-[0.15em] text-slate-400">
              {t("footer.tagline")}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
