import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "../_ui";
import NotifList, { type VNotif } from "./NotifList";

// "Mitteilungen" — o'quvchining bildirishnomalari (Start ekrani uslubida).

export default async function StudentMitteilungenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, isRead: true, createdAt: true },
  });

  const items: VNotif[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-[18px]">
      <PageHeader title="Mitteilungen" subtitle="Deine Nachrichten" />
      <NotifList items={items} />
    </div>
  );
}
