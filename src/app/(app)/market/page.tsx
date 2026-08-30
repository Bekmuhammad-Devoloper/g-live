import { requireSession } from "@/lib/auth";
import { branchWhere, branchViaStudent } from "@/lib/branchScope";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { tr } from "@/lib/tr";
import { Forbidden } from "../_components/ui";
import MarketView, { type VItem, type VOrder } from "./MarketView";

// "Market" — o'quvchilar tangasiga almashtiriladigan sovg'alar va ular
// bo'yicha buyurtmalar. O'quvchi tomoni: /student/market.

export default async function MarketPage() {
  const s = await requireSession();
  if (!canRead(s.role, MODULES.MARKET)) {
    return (
      <Forbidden
        title={tr(s.locale, { uz: "Kirish taqiqlangan", ru: "Доступ запрещён", en: "Access denied", de: "Zugriff verweigert" })}
        body={tr(s.locale, {
          uz: "Bu bo'lim uchun ruxsatingiz yo'q.",
          ru: "У вас нет доступа к этому разделу.",
          en: "You do not have permission for this section.",
          de: "Sie haben keine Berechtigung für diesen Bereich.",
        })}
      />
    );
  }

  const [itemRows, orderRows] = await Promise.all([
    prisma.marketItem.findMany({
      where: branchWhere(s),
      orderBy: [{ isActive: "desc" }, { price: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        stock: true,
        imageUrl: true,
        isActive: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.marketOrder.findMany({
      where: branchViaStudent(s),
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        price: true,
        status: true,
        createdAt: true,
        item: { select: { title: true } },
        student: {
          select: {
            fullName: true,
            enrollments: {
              where: { isActive: true },
              take: 1,
              orderBy: { joinedAt: "desc" },
              select: { group: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const items: VItem[] = itemRows.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    price: i.price,
    stock: i.stock,
    imageUrl: i.imageUrl,
    isActive: i.isActive,
    orders: i._count.orders,
  }));

  const orders: VOrder[] = orderRows.map((o) => ({
    id: o.id,
    student: o.student.fullName,
    group: o.student.enrollments[0]?.group.name ?? null,
    item: o.item.title,
    price: o.price,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Market</h1>
        <p className="text-sm text-slate-500">
          O&apos;quvchilar yiqqan tangasini shu sovg&apos;alarga almashtiradi. Buyurtma kelgach, sovg&apos;ani topshirib
          &laquo;Berildi&raquo; tugmasini bosing.
        </p>
      </div>
      <MarketView items={items} orders={orders} canEdit={canWrite(s.role, MODULES.MARKET)} />
    </div>
  );
}
