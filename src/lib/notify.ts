import "server-only";
import { prisma } from "./db";
import { sendPush, sendPushMany } from "./push";

// Bildirishnoma yaratish (TZ 4.11 bildirishnomalar matritsasi).
//
// Bildirishnoma DOIM bazaga yoziladi — foydalanuvchi uni ilova ichida
// ko'radi. Bundan tashqari, agar Android ilovasi o'rnatilgan bo'lsa,
// telefonga push ham yuboriladi.
//
// Push YUBORILMASA ham bu funksiya muvaffaqiyatli tugaydi: uni chaqirgan
// amal (baho qo'yish, to'lov qabul qilish) push tufayli bekor bo'lib
// qolmasligi kerak. Firebase sozlanmagan bo'lsa esa umuman urinilmaydi.

export async function notify(params: {
  userId: string;
  title: string;
  body?: string;
  event?: string;
  channel?: string;
  /** Push bosilganda ochiladigan sahifa */
  url?: string;
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

  await sendPush(params.userId, {
    title: params.title,
    body: params.body,
    url: params.url,
  }).catch(() => {});
}

// Bir nechta foydalanuvchiga (masalan barcha menejerlarga)
export async function notifyMany(
  userIds: string[],
  data: { title: string; body?: string; event?: string; url?: string },
) {
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

  await sendPushMany(unique, { title: data.title, body: data.body, url: data.url }).catch(() => {});
}
