import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { canRead, MODULES } from "@/lib/rbac";
import type { Locale } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { PageHeader, StatCard, Forbidden } from "../../_components/ui";
import SmsLog, { type SmsRow } from "./SmsLog";

const CHANNEL_LABEL: Record<string, { uz: string; ru: string; en: string }> = {
  APP: { uz: "Ilova", ru: "Приложение", en: "App" },
  SMS: { uz: "SMS", ru: "SMS", en: "SMS" },
  PUSH: { uz: "Push", ru: "Push", en: "Push" },
  TELEGRAM: { uz: "Telegram", ru: "Telegram", en: "Telegram" },
  EMAIL: { uz: "E-mail", ru: "E-mail", en: "E-mail" },
};

export default async function SmsLogPage() {
  const s = await requireSession();
  const t = getT(s.locale);
  if (!canRead(s.role, MODULES.REPORTS)) {
    return <Forbidden title={t("err.forbidden")} body={t("err.forbiddenBody")} />;
  }

  const [items, total, byChannel] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.notification.count(),
    prisma.notification.groupBy({ by: ["channel"], _count: true }),
  ]);

  const cCount = (ch: string) => byChannel.find((b) => b.channel === ch)?._count ?? 0;
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "short", timeStyle: "short" }).format(d);

  const rows: SmsRow[] = items.map((n) => ({
    id: n.id,
    date: fmt(n.createdAt),
    recipient: n.user?.fullName ?? "—",
    channel: n.channel,
    channelLabel: CHANNEL_LABEL[n.channel] ? tr(s.locale, CHANNEL_LABEL[n.channel]) : n.channel,
    title: n.title,
    body: n.body ?? "",
    isRead: n.isRead,
  }));

  return (
    <>
      <div className="mb-4">
        <Link href="/reports" className="text-sm text-brand-600 hover:underline">← {tr(s.locale, { uz: "Hisobotlar", ru: "Отчёты", en: "Reports" })}</Link>
      </div>
      <PageHeader title={tr(s.locale, { uz: "Yuborilgan xabarlar jurnali", ru: "Журнал отправленных сообщений", en: "Sent messages log" })} subtitle={tr(s.locale, { uz: "SMS, Telegram, Push va boshqa bildirishnomalar", ru: "SMS, Telegram, Push и другие уведомления", en: "SMS, Telegram, Push and other notifications" })} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={tr(s.locale, { uz: "Jami xabarlar", ru: "Всего сообщений", en: "Total messages" })} value={total} tone="brand" icon="mail" />
        <StatCard label={tr(s.locale, { uz: "SMS", ru: "SMS", en: "SMS" })} value={cCount("SMS")} tone="green" icon="mail" />
        <StatCard label={tr(s.locale, { uz: "Telegram", ru: "Telegram", en: "Telegram" })} value={cCount("TELEGRAM")} icon="mail" />
        <StatCard label={tr(s.locale, { uz: "Push", ru: "Push", en: "Push" })} value={cCount("PUSH")} tone="amber" icon="bell" />
      </div>

      <SmsLog rows={rows} locale={s.locale} />
    </>
  );
}
