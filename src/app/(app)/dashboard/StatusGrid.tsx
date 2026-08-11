import Link from "next/link";
import { Icon } from "../_components/Icon";
import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/constants";

export interface StatusCounts {
  orders: number;
  firstLesson: number;
  newStudents: number;
  activeStudents: number;
  leftOrders: number;
  leftNew: number;
  leftActive: number;
  debtors: number;
  groups: number;
  firstPayment: number;
  frozen: number;
  archived: number;
}

const LABELS: Record<Locale, string[]> = {
  uz: [
    "Buyurtmalar", "Birinchi darsga keladiganlar", "Yangi o'quvchilar", "Aktiv o'quvchilar",
    "Buyurtmadan ketganlar", "Yangi o'quvchidan ketganlar", "Aktiv o'quvchidan ketganlar", "Qarzdorlar",
    "Guruhlar", "Birinchi to'lovni qilganlar", "Muzlatilgan", "Arxivlar",
  ],
  ru: [
    "Заявки", "Придут на первый урок", "Новые ученики", "Активные ученики",
    "Ушли из заявок", "Ушли из новых", "Ушли из активных", "Должники",
    "Группы", "Сделали первый платёж", "Заморожены", "Архив",
  ],
  en: [
    "Orders", "Coming to first lesson", "New students", "Active students",
    "Left from orders", "Left from new", "Left from active", "Debtors",
    "Groups", "Made first payment", "Frozen", "Archived",
  ],
};

// Har karta: [ikonka, rang(bg), qiymat kaliti, havola]
// color — ikonka fonи, num — raqam rangi (ikonka rangiga mos, lekin matn uchun to'qroq)
const META: { icon: string; color: string; num: string; key: keyof StatusCounts; href: string }[] = [
  { icon: "personPlus", color: "bg-emerald-500", num: "text-emerald-600", key: "orders", href: "/crm" },
  { icon: "personCheck", color: "bg-blue-500", num: "text-blue-600", key: "firstLesson", href: "/crm" },
  { icon: "user", color: "bg-violet-500", num: "text-violet-600", key: "newStudents", href: "/students" },
  { icon: "personStar", color: "bg-emerald-500", num: "text-emerald-600", key: "activeStudents", href: "/students" },
  { icon: "fileX", color: "bg-red-500", num: "text-red-600", key: "leftOrders", href: "/crm" },
  { icon: "personMinus", color: "bg-red-500", num: "text-red-600", key: "leftNew", href: "/students" },
  { icon: "personX", color: "bg-red-500", num: "text-red-600", key: "leftActive", href: "/students" },
  { icon: "wallet", color: "bg-slate-900", num: "text-slate-900", key: "debtors", href: "/finance" },
  { icon: "users", color: "bg-sky-500", num: "text-sky-600", key: "groups", href: "/groups" },
  { icon: "card", color: "bg-amber-400", num: "text-amber-500", key: "firstPayment", href: "/finance" },
  { icon: "snowflake", color: "bg-cyan-500", num: "text-cyan-600", key: "frozen", href: "/students" },
  { icon: "personOff", color: "bg-slate-400", num: "text-slate-500", key: "archived", href: "/students" },
];

// Modme uslubidagi 12 status kartasi uchun sonlar (haqiqiy bazadan)
export async function computeStatusCounts(): Promise<StatusCounts> {
  const [
    orders, firstLesson, newStudents, activeStudents,
    leftOrders, leftNew, leftActive, debtors,
    groups, firstPayment, frozen, archived,
  ] = await Promise.all([
    prisma.lead.count({ where: { stage: { in: ["NEW", "IN_PROGRESS", "CONTACTED"] } } }),
    prisma.lead.count({ where: { stage: { in: ["TEST", "OFFER", "AWAITING_PAYMENT"] } } }),
    prisma.student.count({ where: { eduStatus: "WAITING" } }),
    prisma.student.count({ where: { eduStatus: "ACTIVE" } }),
    prisma.lead.count({ where: { stage: "LOST" } }),
    prisma.student.count({ where: { eduStatus: "EXPELLED", payments: { none: { status: "PAID" } } } }),
    prisma.student.count({ where: { eduStatus: "EXPELLED", payments: { some: { status: "PAID" } } } }),
    prisma.student.count({ where: { eduStatus: "ACTIVE", payments: { none: { status: "PAID" } } } }),
    prisma.group.count({ where: { status: "ACTIVE" } }),
    prisma.student.count({ where: { payments: { some: { status: "PAID" } } } }),
    prisma.student.count({ where: { eduStatus: "FROZEN" } }),
    prisma.student.count({ where: { eduStatus: { in: ["PROGRAM_DONE", "CERTIFIED"] } } }),
  ]);
  return {
    orders, firstLesson, newStudents, activeStudents,
    leftOrders, leftNew, leftActive, debtors,
    groups, firstPayment, frozen, archived,
  };
}

export function StatusGrid({ counts, locale }: { counts: StatusCounts; locale: Locale }) {
  const labels = LABELS[locale] ?? LABELS.uz;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {META.map((m, i) => (
        <Link
          key={m.key}
          href={m.href}
          className="group rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
        >
          {/* Ikonka + yozuv + raqam — bitta qatorda; raqam kartochka rangida */}
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${m.color} shadow-sm`}>
              <Icon name={m.icon} className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-[11.5px] font-medium leading-[1.2] text-slate-500">
              {labels[i]}
            </div>
            <div className={`shrink-0 text-2xl font-bold tabular-nums ${m.num}`}>{counts[m.key]}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
