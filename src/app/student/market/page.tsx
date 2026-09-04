import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { coinBalance } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { S, type StudentStrings } from "../_i18n";
import { CARD, CoinGold, DEEP_GRADIENT, PageHeader, SectionTitle, fmtDate, safeUrl } from "../_ui";
import MissingStudent from "../MissingStudent";
import ItemCard, { type VItem } from "./ItemCard";

// Market — do'kon ko'rinishidagi vitrina: tanga balansi, sovg'alar to'ri va
// o'quvchining buyurtmalari. Sovg'alarni ma'muriyat CRM dagi /market dan
// boshqaradi.

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

// Qoida kaliti -> o'quvchi tilidagi nom
const RULE_LABEL = (t: StudentStrings, k: string) =>
  k === "lesson" ? t.ruleLesson
  : k === "lessonView" ? t.ruleLessonView
  : k === "homework" ? t.ruleHomework
  : k === "perfect" ? t.rulePerfect
  : k === "gameWin" ? t.ruleGameWin
  : k === "streak7" ? t.ruleStreak
  : t.ruleLevelUp;

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

  // Hamyon kartasi uchun: eng arzon (mavjud) sovg'a va unga qancha qolgani
  const inStock = shelf.filter((i) => !(i.stock !== null && i.stock <= 0));
  const cheapest = inStock.length ? Math.min(...inStock.map((i) => i.price)) : null;
  const needed = cheapest === null ? 0 : Math.max(0, cheapest - coins.balance);
  const toCheapestPct = cheapest === null || cheapest <= 0
    ? 0
    : Math.max(0, Math.min(100, Math.round((coins.balance / cheapest) * 100)));

  // Qoidalar: yig'ilganlari alohida, hali yig'ilmaganlari alohida
  const earnedLines = coins.lines.filter((l) => l.count > 0);
  const restLines = coins.lines.filter((l) => l.count === 0);

  return (
    <div className="space-y-4">
      <PageHeader title={t.market} subtitle={t.exchangeCoins} backLabel={t.back} back="/student/profil" />

      {/* ── Hamyon ──
          Balans — kartaning bosh raqami. Ostida eng arzon sovg'agacha qancha
          qolgani (o'quvchiga aniq maqsad beradi), so'ng tanga qanday
          yig'ilishi. Qoidalar ikkiga ajratiladi: YIG'ILGANLARI tepada,
          natijasi bilan; hali yig'ilmaganlari pastda, faqat qiymati bilan
          (ilgari ular ham "+5 × 0   0" bo'lib turardi va o'qishga xalaqit
          berardi). */}
      <div className="relative overflow-hidden rounded-[24px] p-5 text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)]" style={{ background: DEEP_GRADIENT }}>
        {/* Orqa fondagi katta tanga — yumshoq bezak */}
        <span className="pointer-events-none absolute -right-6 -top-8 opacity-[0.10]">
          <CoinGold s={132} />
        </span>

        <div className="relative flex items-center gap-3.5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <CoinGold s={34} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{t.balance}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[40px] font-extrabold leading-none tracking-tight">{coins.balance}</span>
              <span className="text-[14px] font-semibold text-white/70">{t.coins}</span>
            </div>
          </div>
        </div>

        {/* Yig'ilgan / sarflangan — kichik yozuv o'rniga aniq belgilar */}
        <div className="relative mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold backdrop-blur-sm">
            {t.earned} <b className="font-extrabold">{coins.earned}</b>
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold backdrop-blur-sm">
            {t.spent} <b className="font-extrabold">{coins.spent}</b>
          </span>
        </div>

        {/* Eng arzon sovg'agacha qancha qolgani */}
        {cheapest !== null ? (
          <div className="relative mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
              <span className="font-semibold text-white/80">
                {needed > 0 ? t.toCheapest : t.canBuyNow}
              </span>
              {needed > 0 ? (
                <span className="shrink-0 font-extrabold">{needed} {t.coins}</span>
              ) : (
                <span className="shrink-0 text-[16px] leading-none">✓</span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${toCheapestPct}%` }} />
            </div>
          </div>
        ) : null}

        {/* Tanga qanday yig'iladi */}
        <div className="relative mt-4 rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">{t.coinRule}</div>

          {earnedLines.length > 0 ? (
            <div className="space-y-1.5">
              {earnedLines.map((l) => (
                <div key={l.key} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                  <span className="min-w-0 flex-1 truncate font-medium text-white">{RULE_LABEL(t, l.key)}</span>
                  <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold text-white/85">
                    {l.count} × {l.per}
                  </span>
                  <span className="w-[42px] shrink-0 text-right text-[14px] font-extrabold tabular-nums">{l.total}</span>
                </div>
              ))}
            </div>
          ) : null}

          {restLines.length > 0 ? (
            <>
              {earnedLines.length > 0 ? <div className="my-2.5 h-px bg-white/15" /> : null}
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">{t.notEarnedYet}</div>
              <div className="flex flex-wrap gap-1.5">
                {restLines.map((l) => (
                  <span key={l.key} className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] text-white/70">
                    {RULE_LABEL(t, l.key)} <b className="font-bold text-white/90">+{l.per}</b>
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Vitrina ── */}
      <div className="flex items-baseline justify-between px-1">
        <SectionTitle>{t.rewards}</SectionTitle>
        {shelf.length > 0 ? (
          <span className="text-[11.5px] font-semibold text-slate-500">
            {affordable}/{shelf.length}
          </span>
        ) : null}
      </div>

      {shelf.length === 0 ? (
        <div className={CARD + " px-5 py-12 text-center"}>
          <div className="text-[15px] font-semibold text-slate-700">{t.noRewards}</div>
          <p className="mt-1 text-[13px] text-slate-500">{t.centerAddsSoon}</p>
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
                    <div className="text-[11.5px] text-slate-500">
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
