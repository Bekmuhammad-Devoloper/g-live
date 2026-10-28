import "server-only";
import { prisma } from "./db";
import { sendPush, sendPushMany } from "./push";
import type { Locale, LocaleText } from "./constants";
import { tr } from "./tr";

export type NotifyText = string | LocaleText;

const pick = (t: NotifyText | undefined, locale: Locale): string | undefined =>
  t === undefined ? undefined : typeof t === "string" ? t : tr(locale, t);

const needsLocale = (...ts: (NotifyText | undefined)[]) => ts.some((t) => t !== undefined && typeof t !== "string");

async function localeOf(userId: string): Promise<Locale> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return (u?.locale as Locale) ?? "uz";
}

export async function notify(params: {
  userId: string;
  title: NotifyText;
  body?: NotifyText;
  event?: string;
  channel?: string;
  url?: string;
}): Promise<void> {
  const locale = needsLocale(params.title, params.body) ? await localeOf(params.userId) : "uz";
  const title = pick(params.title, locale) ?? "";
  const body = pick(params.body, locale);

  await prisma.notification.create({
    data: {
      userId: params.userId,
      title,
      body: body ?? null,
      event: params.event ?? null,
      channel: params.channel ?? "APP",
    },
  });

  await sendPush(params.userId, { title, body, url: params.url }).catch(() => {});
}

export async function notifyMany(
  userIds: string[],
  data: { title: NotifyText; body?: NotifyText; event?: string; url?: string },
) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;

  const locales = new Map<string, Locale>();
  if (needsLocale(data.title, data.body)) {
    const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, locale: true } });
    for (const u of users) locales.set(u.id, (u.locale as Locale) ?? "uz");
  }
  const localeFor = (id: string): Locale => locales.get(id) ?? "uz";

  await prisma.notification.createMany({
    data: unique.map((userId) => {
      const l = localeFor(userId);
      return {
        userId,
        title: pick(data.title, l) ?? "",
        body: pick(data.body, l) ?? null,
        event: data.event ?? null,
        channel: "APP",
      };
    }),
  });

  const groups = new Map<Locale, string[]>();
  for (const id of unique) {
    const l = localeFor(id);
    groups.set(l, [...(groups.get(l) ?? []), id]);
  }
  for (const [l, ids] of groups) {
    await sendPushMany(ids, { title: pick(data.title, l) ?? "", body: pick(data.body, l), url: data.url }).catch(() => {});
  }
}
