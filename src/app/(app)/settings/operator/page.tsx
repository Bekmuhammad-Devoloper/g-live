import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, ROLE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { getSetting } from "@/lib/settings";
import { Forbidden } from "../../_components/ui";
import { parsePrefs, prefsKey } from "./prefs";
import OperatorSettingsView from "./OperatorSettingsView";

// Operator / ROP shaxsiy sozlamalari — bildirishnoma, ko'rinish va maosh (KPI) ma'lumotlari.
// Shaxsiy ma'lumotlar va parol /profile sahifasida (bu yerda takrorlanmaydi).
const ALLOWED: string[] = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN];

const MONTHS: Record<Locale, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
// Summani "200 000" ko'rinishida formatlash (serverda tayyorlanadi — mijozga faqat matn ketadi).
const money = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default async function OperatorSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })}
        body={tr(s.locale, {
          uz: "Bu sozlamalar operator, ROP va rahbariyat uchun.",
          ru: "Эти настройки доступны оператору, РОПу и руководству.",
          en: "These settings are available to operators, the sales head and management.",
        })}
      />
    );
  }

  const sp = await searchParams;
  const locale = s.locale as Locale;

  const [u, rawPrefs, wonLeads] = await Promise.all([
    prisma.user.findUnique({
      where: { id: s.userId },
      select: {
        fullName: true, email: true, role: true, imageUrl: true, locale: true,
        position: true, sipExtension: true, fiksa: true, kpiBonus: true, lastLoginAt: true,
        branch: { select: { name: true } },
      },
    }),
    getSetting(prefsKey(s.userId)),
    prisma.lead.findMany({
      where: { managerId: s.userId, stage: "WON" },
      select: { id: true, fullName: true, phone: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!u) return null;

  // ── Oylik KPI: oxirgi oylar bo'yicha muvaffaqiyatli (WON) lidlar ──
  const now = new Date();
  const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const counts = new Map<string, number>();
  for (const l of wonLeads) counts.set(keyOf(l.createdAt), (counts.get(keyOf(l.createdAt)) ?? 0) + 1);

  const bonus = u.kpiBonus ?? 0;
  const fiksa = u.fiksa ?? 0;
  const wonThisMonth = counts.get(keyOf(now)) ?? 0;

  const previous: { key: string; label: string; count: number; total: string; formula: string }[] = [];
  for (let i = 1; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = counts.get(keyOf(d)) ?? 0;
    if (count === 0) continue;
    previous.push({
      key: keyOf(d),
      label: `${MONTHS[locale][d.getMonth()]} ${d.getFullYear()}`,
      count,
      total: money(fiksa + bonus * count),
      formula: `${money(fiksa)} + ${count} × ${money(bonus)}`,
    });
  }

  // Joriy oyda yopilgan lidlar (ko'pi bilan 8 tasi ko'rsatiladi)
  const monthLeads = wonLeads.filter((l) => keyOf(l.createdAt) === keyOf(now));

  return (
    <OperatorSettingsView
      locale={locale}
      initialTab={sp.tab === "appearance" || sp.tab === "salary" ? sp.tab : "notifications"}
      me={{
        fullName: u.fullName,
        email: u.email,
        imageUrl: u.imageUrl,
        roleLabel: label(ROLE_LABELS, u.role, locale),
        branchName: u.branch?.name ?? null,
        position: u.position,
        sipExtension: u.sipExtension,
        lastLogin: u.lastLoginAt ? fmtDate(u.lastLoginAt) : null,
        locale: ["uz", "ru", "en"].includes(u.locale) ? u.locale : "uz",
      }}
      prefs={parsePrefs(rawPrefs)}
      salary={{
        configured: fiksa > 0 || bonus > 0,
        fiksa: money(fiksa),
        bonusPerLead: money(bonus),
        monthLabel: MONTHS[locale][now.getMonth()],
        wonThisMonth,
        bonusThisMonth: money(bonus * wonThisMonth),
        total: money(fiksa + bonus * wonThisMonth),
        formula: `${money(fiksa)} + ${wonThisMonth} × ${money(bonus)}`,
        wonTotal: wonLeads.length,
        previous,
        monthLeads: monthLeads.slice(0, 8).map((l) => ({
          id: l.id,
          name: l.fullName,
          phone: l.phone,
          date: fmtDate(l.createdAt),
        })),
        monthLeadsMore: Math.max(0, monthLeads.length - 8),
      }}
    />
  );
}

export const dynamic = "force-dynamic";
