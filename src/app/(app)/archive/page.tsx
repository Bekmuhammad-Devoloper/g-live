import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES, ROLE_LABELS, label, type Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import { getSetting } from "@/lib/settings";
import ArchiveView, { type VArchived } from "./ArchiveView";

const ALLOWED = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];
const STAFF_ROLES = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;

export default async function ArchivePage() {
  const s = await requireSession();
  if (!ALLOWED.includes(s.role as never)) {
    return <Forbidden title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied" })} body={tr(s.locale, { uz: "Arxiv faqat rahbariyat uchun.", ru: "Архив доступен только руководству.", en: "The archive is available only to management." })} />;
  }

  const [users, reasonsRaw] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, isActive: false },
      orderBy: [{ archivedAt: "desc" }, { updatedAt: "desc" }],
      select: { id: true, fullName: true, phone: true, role: true, archiveReason: true, archiveNote: true, archivedAt: true, updatedAt: true },
    }),
    getSetting("archive.reasons"),
  ]);

  const rows: VArchived[] = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    roleLabel: label(ROLE_LABELS, u.role, s.locale as Locale),
    reason: u.archiveReason,
    note: u.archiveNote,
    archivedAt: (u.archivedAt ?? u.updatedAt) ? fmt(u.archivedAt ?? u.updatedAt) : "—",
    archivedAtIso: (u.archivedAt ?? u.updatedAt).toISOString().slice(0, 10),
  }));

  let reasons: string[] = [];
  try { if (reasonsRaw) reasons = JSON.parse(reasonsRaw); } catch { reasons = []; }
  // Standart sabablar (bo'sh bo'lsa)
  if (reasons.length === 0) reasons = [
    tr(s.locale, { uz: "Ishdan bo'shadi", ru: "Уволился", en: "Left the job" }),
    tr(s.locale, { uz: "Shartnoma tugadi", ru: "Договор завершён", en: "Contract ended" }),
    tr(s.locale, { uz: "Intizom buzilishi", ru: "Нарушение дисциплины", en: "Disciplinary violation" }),
    tr(s.locale, { uz: "Boshqa", ru: "Другое", en: "Other" }),
  ];

  const roleOptions = STAFF_ROLES.map((r) => ({ value: r, label: label(ROLE_LABELS, r, s.locale as Locale) }));

  return <ArchiveView locale={s.locale} rows={rows} reasons={reasons} roleOptions={roleOptions} />;
}

export const dynamic = "force-dynamic";
