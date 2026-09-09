"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { coinBalance } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { notifyMany } from "@/lib/notify";
import { fill, LT, S } from "../_i18n";

export type Res = { ok?: boolean; error?: string };

// Sovg'ani tangaga sotib olish. Balans va zaxira shu yerda tekshiriladi —
// mijoz tomonidagi tekshiruvga ishonib bo'lmaydi.
export async function buyItem(itemId: string): Promise<Res> {
  const s = await requireSession();
  const t = S(s.locale); // xato xabarlari o'quvchi tilida
  if (s.role !== ROLES.STUDENT) return { error: t.forbidden };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: { id: true, fullName: true, branchId: true },
  });
  if (!student) return { error: t.studentNotFound };

  const item = await prisma.marketItem.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, price: true, stock: true, isActive: true, branchId: true },
  });
  if (!item || !item.isActive) return { error: t.giftUnavailable };
  if (item.branchId && student.branchId && item.branchId !== student.branchId) {
    return { error: t.giftOtherBranch };
  }

  if (item.stock !== null && item.stock <= 0) return { error: t.outOfStock };

  const { balance } = await coinBalance(student.id);
  if (balance < item.price) return { error: fill(t.notEnoughCoins, { have: balance, need: item.price }) };

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
  // Har xodimga o'z tilida (notifyMany oluvchi tilini o'zi tanlaydi)
  await notifyMany(
    staff.map((u) => u.id),
    {
      title: LT("marketNewOrder"),
      body: LT("marketOrderBody", { name: student.fullName, item: item.title, price: item.price }),
      event: "MARKET_ORDER",
      url: "/market",
    },
  );

  revalidatePath("/student/market");
  revalidatePath("/market");
  return { ok: true };
}
