import Link from "next/link";
import { Icon } from "../_components/Icon";
import { formatMoney } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branchScope";
import { totalDebt } from "@/lib/debt";
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
  debtTotal: number; // umumiy qarzdorlik summasi (so'm)
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
  de: [
    "Bestellungen", "Kommen zur ersten Stunde", "Neue Schüler", "Aktive Schüler",
    "Aus Bestellungen abgesprungen", "Aus Neuen abgesprungen", "Aus Aktiven abgesprungen", "Schuldner",
    "Gruppen", "Erste Zahlung geleistet", "Eingefroren", "Archiviert",
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
// Faol filial doirasida hisoblanadi (filialsiz eski yozuvlar ham qo'shiladi)
export async function computeStatusCounts(s: { branchId: string | null }): Promise<StatusCounts> {
  const b = branchWhere(s);
  const [
    orders, firstLesson, newStudents, activeStudents,
    leftOrders, leftNew, leftActive, debtInfo,
    groups, firstPayment, frozen, archived,
  ] = await Promise.all([
    prisma.lead.count({ where: { AND: [{ stage: { in: ["NEW", "IN_PROGRESS", "CONTACTED"] } }, b] } }),
    prisma.lead.count({ where: { AND: [{ stage: { in: ["TEST", "OFFER", "AWAITING_PAYMENT"] } }, b] } }),
    prisma.student.count({ where: { AND: [{ eduStatus: "WAITING" }, b] } }),
    prisma.student.count({ where: { AND: [{ eduStatus: "ACTIVE" }, b] } }),
    prisma.lead.count({ where: { AND: [{ stage: "LOST" }, b] } }),
    prisma.student.count({ where: { AND: [{ eduStatus: "EXPELLED", payments: { none: { status: "PAID" } } }, b] } }),
    prisma.student.count({ where: { AND: [{ eduStatus: "EXPELLED", payments: { some: { status: "PAID" } } }, b] } }),
    totalDebt({ AND: [{ eduStatus: { not: "ARCHIVED" } }, b] }), // haqiqiy qarz bo'yicha
    prisma.group.count({ where: { AND: [{ status: "ACTIVE" }, b] } }),
    prisma.student.count({ where: { AND: [{ payments: { some: { status: "PAID" } } }, b] } }),
    prisma.student.count({ where: { AND: [{ eduStatus: "FROZEN" }, b] } }),
    prisma.student.count({ where: { AND: [{ eduStatus: { in: ["PROGRAM_DONE", "CERTIFIED"] } }, b] } }),
  ]);
  return {
    orders, firstLesson, newStudents, activeStudents,
    leftOrders, leftNew, leftActive,
    debtors: debtInfo.debtors,
    debtTotal: debtInfo.total,
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
            <div className={`shrink-0 text-2xl font-bold tabular-nums ${m.num}`}>{counts[m.key as keyof StatusCounts]}</div>
          </div>
          {/* Qarzdorlar kartasida umumiy summa ham ko'rinadi (platforma bo'yicha) */}
          {m.key === "debtors" && counts.debtTotal > 0 && (
            <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-right text-[11px] font-semibold tabular-nums text-rose-600 dark:border-white/5 dark:text-rose-400">
              {formatMoney(counts.debtTotal, locale)}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
