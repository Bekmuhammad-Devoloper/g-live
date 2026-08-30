import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { coinBalance } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { S } from "../_i18n";
import { CARD, DEEP_GRADIENT, PageHeader, SectionTitle, fmtDate, safeUrl } from "../_ui";
import MissingStudent from "../MissingStudent";
import ItemCard, { type VItem } from "./ItemCard";

// Market — do'kon ko'rinishidagi vitrina: tanga balansi, sovg'alar to'ri va
// o'quvchining buyurtmalari. Sovg'alarni ma'muriyat CRM dagi /market dan
// boshqaradi.

function IcoCoin({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9.2" fill="#facc15" stroke="#eab308" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5.6" fill="none" stroke="#eab308" strokeWidth="1.4" />
    </svg>
  );
}

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function StudentMarketPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Bo'lim menejer tomonidan o'chirilgan bo'lsa — bosh sahifaga
  if (!(await isPortalFeatureOn("market"))) redirect("/student");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true, branchId: true },
  });
  if (!student) return <MissingStudent />;

  const [coins, items, orders] = await Promise.all([
    coinBalance(student.id),
    prisma.marketItem.findMany({
      where: {
        isActive: true,
        ...(student.branchId ? { OR: [{ branchId: student.branchId }, { branchId: null }] } : {}),
      },
      orderBy: [{ price: "asc" }, { title: "asc" }],
      select: { id: true, title: true, description: true, price: true, imageUrl: true, stock: true },
    }),
    prisma.marketOrder.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, price: true, status: true, createdAt: true, item: { select: { title: true } } },
    }),
  ]);

  const shelf: VItem[] = items.map((i) => ({ ...i, imageUrl: safeUrl(i.imageUrl) }));
  const affordable = shelf.filter((i) => coins.balance >= i.price && !(i.stock !== null && i.stock <= 0)).length;

  return (
    <div className="space-y-4">
      <PageHeader title={t.market} subtitle={t.exchangeCoins} back="/student/profil" />

      {/* ── Hamyon ── */}
      <div className="relative overflow-hidden rounded-[24px] p-4 text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)]" style={{ background: DEEP_GRADIENT }}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
            <IcoCoin s={26} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{t.balance}</div>
            <div className="text-[28px] font-extrabold leading-none">{coins.balance}</div>
          </div>
          <div className="shrink-0 text-right text-[11px] leading-tight text-white/70">
            <div>{t.earned} {coins.earned}</div>
            <div>{t.spent} {coins.spent}</div>
          </div>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-snug text-white/70">{t.coinRule}</p>
      </div>

      {/* ── Vitrina ── */}
      <div className="flex items-baseline justify-between px-1">
        <SectionTitle>{t.rewards}</SectionTitle>
        {shelf.length > 0 ? (
          <span className="text-[11.5px] font-semibold text-slate-400">
            {affordable}/{shelf.length}
          </span>
        ) : null}
      </div>

      {shelf.length === 0 ? (
        <div className={CARD + " px-5 py-12 text-center"}>
          <div className="text-[15px] font-semibold text-slate-700">{t.noRewards}</div>
          <p className="mt-1 text-[13px] text-slate-400">{t.centerAddsSoon}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shelf.map((it, i) => (
            <ItemCard key={it.id} item={it} balance={coins.balance} t={t} index={i} />
          ))}
        </div>
      )}

      {/* ── Buyurtmalarim ── */}
      {orders.length > 0 ? (
        <>
          <SectionTitle>{t.myOrders}</SectionTitle>
          <div className={CARD + " overflow-hidden"}>
            <ul>
              {orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold text-slate-800">{o.item.title}</div>
                    <div className="text-[11.5px] text-slate-400">
                      {fmtDate(o.createdAt)} · {o.price} {t.coins}
                    </div>
                  </div>
                  <span className={"shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold " + (STATUS_CLS[o.status] ?? STATUS_CLS.PENDING)}>
                    {o.status === "DELIVERED" ? t.delivered : o.status === "CANCELLED" ? t.cancelled : t.waiting}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
