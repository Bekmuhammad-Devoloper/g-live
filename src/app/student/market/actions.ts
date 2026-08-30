"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { coinBalance } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { notifyMany } from "@/lib/notify";

export type Res = { ok?: boolean; error?: string };

// Sovg'ani tangaga sotib olish. Balans va zaxira shu yerda tekshiriladi —
// mijoz tomonidagi tekshiruvga ishonib bo'lmaydi.
export async function buyItem(itemId: string): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: { id: true, fullName: true, branchId: true },
  });
  if (!student) return { error: "O'quvchi topilmadi" };

  const item = await prisma.marketItem.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, price: true, stock: true, isActive: true, branchId: true },
  });
  if (!item || !item.isActive) return { error: "Sovg'a mavjud emas" };
  if (item.branchId && student.branchId && item.branchId !== student.branchId) {
    return { error: "Bu sovg'a boshqa filialda" };
  }

  if (item.stock !== null && item.stock <= 0) return { error: "Zaxira tugagan" };

  const { balance } = await coinBalance(student.id);
  if (balance < item.price) return { error: `Tanga yetarli emas (${balance}/${item.price})` };

  await prisma.$transaction(async (tx) => {
    if (item.stock !== null) {
      await tx.marketItem.update({ where: { id: item.id }, data: { stock: { decrement: 1 } } });
    }
    await tx.marketOrder.create({
      data: { itemId: item.id, studentId: student.id, price: item.price },
    });
  });

  // Ma'muriyat sovg'ani topshirishi kerak — xabar beramiz
  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [ROLES.MANAGER, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR] },
      ...(student.branchId ? { OR: [{ branchId: student.branchId }, { branchId: null }] } : {}),
    },
    select: { id: true },
  });
  await notifyMany(
    staff.map((u) => u.id),
    {
      title: "Market: yangi buyurtma",
      body: `${student.fullName} — ${item.title} (${item.price} tanga)`,
      event: "MARKET_ORDER",
    },
  );

  revalidatePath("/student/market");
  revalidatePath("/market");
  return { ok: true };
}
