import "server-only";
import { prisma } from "./db";

// Bildirishnoma yaratish (TZ 4.11 bildirishnomalar matritsasi).
// MVP: ilova ichi (APP) kanali. Telegram/e-mail/SMS keyingi bosqichda ulanadi.
export async function notify(params: {
  userId: string;
  title: string;
  body?: string;
  event?: string;
  channel?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body ?? null,
      event: params.event ?? null,
      channel: params.channel ?? "APP",
    },
  });
}

// Bir nechta foydalanuvchiga (masalan barcha menejerlarga)
export async function notifyMany(userIds: string[], data: { title: string; body?: string; event?: string }) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      title: data.title,
      body: data.body ?? null,
      event: data.event ?? null,
      channel: "APP",
    })),
  });
}
