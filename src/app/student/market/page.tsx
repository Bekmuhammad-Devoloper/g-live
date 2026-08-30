import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { coinBalance, COIN_PER_LESSON, COIN_PER_TASK } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { CARD, DEEP_GRADIENT, PageHeader, SectionTitle, fmtDate, safeUrl } from "../_ui";
import MissingStudent from "../MissingStudent";
import BuyButton from "./BuyButton";

// Market — o'quvchi yiqqan tangalarini o'quv markazi sovg'alariga almashtiradi.
// Sovg'alar ro'yxatini ma'muriyat CRM dagi /market sahifasidan boshqaradi.

function IcoCoin({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9.2" fill="#facc15" stroke="#eab308" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5.6" fill="none" stroke="#eab308" strokeWidth="1.4" />
    </svg>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Kutilmoqda", cls: "bg-amber-50 text-amber-700" },
  DELIVERED: { label: "Berildi", cls: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "Bekor qilindi", cls: "bg-slate-100 text-slate-500" },
};

export default async function StudentMarketPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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

  return (
    <div className="space-y-4">
      <PageHeader title="Market" subtitle="Tangangizni sovg'aga almashtiring" back="/student/profil" />

      {/* ── Balans ── */}
      <div className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)]" style={{ background: DEEP_GRADIENT }}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
            <IcoCoin s={30} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-white/70">Balans</div>
            <div className="text-[30px] font-extrabold leading-none">{coins.balance}</div>
          </div>
          <div className="shrink-0 text-right text-[11.5px] leading-tight text-white/75">
            <div>Yig'ilgan {coins.earned}</div>
            <div>Sarflangan {coins.spent}</div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-snug text-white/70">
          Har qatnashgan dars +{COIN_PER_LESSON}, har baholangan vazifa +{COIN_PER_TASK} tanga.
        </p>
      </div>

      {/* ── Sovg'alar ── */}
      <SectionTitle>Sovg&apos;alar</SectionTitle>
      {items.length === 0 ? (
        <div className={CARD + " px-5 py-12 text-center"}>
          <div className="text-[15px] font-semibold text-slate-700">Hozircha sovg&apos;a yo&apos;q</div>
          <p className="mt-1 text-[13px] text-slate-400">O&apos;quv markazi tez orada qo&apos;shadi.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const img = safeUrl(it.imageUrl);
            const soldOut = it.stock !== null && it.stock <= 0;
            return (
              <div key={it.id} className={CARD + " flex items-center gap-3 p-3"}>
                {img ? (
                  <img src={img} alt={it.title} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-50">
                    <IcoCoin s={26} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-extrabold text-slate-900">{it.title}</div>
                  {it.description ? (
                    <div className="line-clamp-2 text-[12.5px] leading-snug text-slate-500">{it.description}</div>
                  ) : null}
                  <div className="mt-1 flex items-center gap-1.5">
                    <IcoCoin s={15} />
                    <span className="text-[13px] font-extrabold text-slate-700">{it.price}</span>
                    {it.stock !== null ? (
                      <span className="ml-1 text-[11.5px] text-slate-400">· {soldOut ? "tugagan" : it.stock + " ta qoldi"}</span>
                    ) : null}
                  </div>
                </div>
                <BuyButton
                  id={it.id}
                  title={it.title}
                  price={it.price}
                  affordable={coins.balance >= it.price}
                  soldOut={soldOut}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Buyurtmalarim ── */}
      {orders.length > 0 ? (
        <>
          <SectionTitle>Buyurtmalarim</SectionTitle>
          <div className={CARD + " overflow-hidden"}>
            <ul>
              {orders.map((o) => {
                const st = STATUS[o.status] ?? STATUS.PENDING;
                return (
                  <li key={o.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold text-slate-800">{o.item.title}</div>
                      <div className="text-[11.5px] text-slate-400">
                        {fmtDate(o.createdAt)} · {o.price} tanga
                      </div>
                    </div>
                    <span className={"shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold " + st.cls}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
