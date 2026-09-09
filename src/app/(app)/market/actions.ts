"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canWrite, MODULES } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { tr } from "@/lib/tr";

export type Res = { ok?: boolean; error?: string };

const MAX_PRICE = 1_000_000;

// ── Sovg'alar ──

export async function saveItem(fd: FormData): Promise<Res> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.MARKET)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  const id = String(fd.get("id") ?? "").trim();
  const title = String(fd.get("title") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const price = Number(fd.get("price"));
  const stockRaw = String(fd.get("stock") ?? "").trim();
  const imageUrl = String(fd.get("imageUrl") ?? "").trim();

  if (title.length < 2) return { error: tr(s.locale, { uz: "Nomi juda qisqa", ru: "Название слишком короткое", en: "Name is too short", de: "Der Name ist zu kurz" }) };
  if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE) return { error: tr(s.locale, { uz: "Narx noto'g'ri", ru: "Неверная цена", en: "Invalid price", de: "Ungültiger Preis" }) };
  const stock = stockRaw === "" ? null : Number(stockRaw);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return { error: tr(s.locale, { uz: "Zaxira noto'g'ri", ru: "Неверный остаток", en: "Invalid stock", de: "Ungültiger Bestand" }) };

  // Filial doirasi formadan: "Barcha filiallar uchun" belgilansa — branchId yo'q
  // (o'quvchi tomonida filialsiz sovg'a hamma filialga ko'rinadi).
  const allBranches = String(fd.get("allBranches") ?? "") === "1";

  const data = {
    title,
    description: description || null,
    price: Math.round(price),
    stock,
    imageUrl: imageUrl || null,
    branchId: allBranches ? null : s.branchId ?? null,
  };

  if (id) {
    await prisma.marketItem.update({ where: { id }, data });
  } else {
    await prisma.marketItem.create({ data });
  }
  await writeAudit({ actorId: s.userId, action: id ? "UPDATE" : "CREATE", entityType: "MarketItem", entityId: id || undefined, newValue: { title, price } });
  revalidatePath("/market");
  revalidatePath("/student/market");
  return { ok: true };
}

export async function toggleItem(id: string, isActive: boolean): Promise<Res> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.MARKET)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  await prisma.marketItem.update({ where: { id }, data: { isActive } });
  revalidatePath("/market");
  revalidatePath("/student/market");
  return { ok: true };
}

export async function deleteItem(id: string): Promise<Res> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.MARKET)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  const used = await prisma.marketOrder.count({ where: { itemId: id } });
  if (used > 0) return { error: tr(s.locale, { uz: "Buyurtmalari bor — o'chirib bo'lmaydi, faolsizlantiring", ru: "Есть заказы — удалить нельзя, деактивируйте", en: "It has orders — cannot delete, deactivate it instead", de: "Es gibt Bestellungen — Löschen nicht möglich, bitte deaktivieren" }) };

  await prisma.marketItem.delete({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "MarketItem", entityId: id });
  revalidatePath("/market");
  revalidatePath("/student/market");
  return { ok: true };
}

// ── Buyurtmalar ──

export async function setOrderStatus(id: string, status: "DELIVERED" | "CANCELLED" | "PENDING"): Promise<Res> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.MARKET)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  const order = await prisma.marketOrder.findUnique({
    where: { id },
    select: {
      status: true,
      itemId: true,
      item: { select: { title: true, stock: true } },
      student: { select: { fullName: true, userId: true } },
    },
  });
  if (!order) return { error: tr(s.locale, { uz: "Buyurtma topilmadi", ru: "Заказ не найден", en: "Order not found", de: "Bestellung nicht gefunden" }) };
  if (order.status === status) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.marketOrder.update({
      where: { id },
      data: { status, deliveredAt: status === "DELIVERED" ? new Date() : null },
    });
    // Bekor qilinsa tanga qaytadi va zaxira tiklanadi
    if (status === "CANCELLED" && order.item.stock !== null) {
      await tx.marketItem.update({ where: { id: order.itemId }, data: { stock: { increment: 1 } } });
    }
    if (order.status === "CANCELLED" && status !== "CANCELLED" && order.item.stock !== null) {
      await tx.marketItem.update({ where: { id: order.itemId }, data: { stock: { decrement: 1 } } });
    }
  });

  if (order.student.userId) {
    await notify({
      userId: order.student.userId,
      title:
        status === "DELIVERED"
          ? { uz: "Sovg'angiz topshirildi", ru: "Ваш подарок выдан", en: "Your gift has been delivered", de: "Ihr Geschenk wurde übergeben" }
          : status === "CANCELLED"
            ? { uz: "Buyurtma bekor qilindi", ru: "Заказ отменён", en: "Order cancelled", de: "Bestellung storniert" }
            : { uz: "Buyurtma qayta ochildi", ru: "Заказ снова открыт", en: "Order reopened", de: "Bestellung wieder geöffnet" },
      body: order.item.title,
      event: "MARKET_ORDER",
    });
  }

  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "MarketOrder", entityId: id, newValue: { status } });
  revalidatePath("/market");
  revalidatePath("/student/market");
  return { ok: true };
}
