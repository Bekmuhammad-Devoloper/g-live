"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function markAllRead(): Promise<void> {
  const s = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: s.userId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markRead(id: string): Promise<void> {
  const s = await requireSession();
  await prisma.notification.updateMany({
    where: { id, userId: s.userId },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}
