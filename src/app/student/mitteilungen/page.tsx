import { redirect } from "next/navigation";
import { S } from "../_i18n";
import HeaderBadges from "../HeaderBadges";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { prisma } from "@/lib/db";
import { PageHeader } from "../_ui";
import { MESSAGE_SENT } from "../lehrer/const";
import NotifList, { type VNotif } from "./NotifList";

// "Mitteilungen" — o'quvchining bildirishnomalari (Start ekrani uslubida).

export default async function StudentMitteilungenPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Bo'lim menejer tomonidan o'chirilgan bo'lsa — bosh sahifaga
  if (!(await isPortalFeatureOn("mitteilungen"))) redirect("/student");
  const t = S(session.locale);

  const rows = await prisma.notification.findMany({
    where: { userId: session.userId, NOT: { event: MESSAGE_SENT } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, isRead: true, createdAt: true, event: true },
  });

  const items: VNotif[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    event: n.event,
  }));

  return (
    <div className="space-y-[18px]">
      <PageHeader title={t.messages} subtitle={t.yourMessages} right={<HeaderBadges />} />
      <NotifList items={items} emptyText={t.noMessages} />
    </div>
  );
}
