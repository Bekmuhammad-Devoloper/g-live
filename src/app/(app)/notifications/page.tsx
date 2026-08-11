import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { PageHeader, Card } from "../_components/ui";
import { markAllRead } from "./actions";
import NotificationList, { type NotifItem } from "./NotificationList";

const READ_HINT: Record<string, string> = {
  uz: "O'qilgan deb belgilash",
  ru: "Отметить как прочитанное",
  en: "Mark as read",
};

export default async function NotificationsPage() {
  const s = await requireSession();
  const t = getT(s.locale);

  const items = await prisma.notification.findMany({
    where: { userId: s.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const hasUnread = items.some((n) => !n.isRead);
  const df = new Intl.DateTimeFormat(s.locale === "ru" ? "ru-RU" : "uz-UZ", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const listItems: NotifItem[] = items.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    date: df.format(n.createdAt),
  }));

  return (
    <>
      <PageHeader
        title={t("notif.title")}
        action={
          hasUnread ? (
            <form action={markAllRead}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {t("notif.markAllRead")}
              </button>
            </form>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">{t("notif.empty")}</p>
        </Card>
      ) : (
        <NotificationList items={listItems} readHint={READ_HINT[s.locale] ?? READ_HINT.uz} />
      )}
    </>
  );
}
