import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { coinBalance } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { S, type StudentStrings } from "../_i18n";
import { CARD, CoinGold, DEEP_GRADIENT, PageHeader, SectionTitle, fmtDate, safeUrl } from "../_ui";
import MissingStudent from "../MissingStudent";
import ItemCard, { type VItem } from "./ItemCard";
import CoinRules, { type RuleSlide } from "./CoinRules";

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

// Qoida kaliti -> qisqa tushuntirish (aylanuvchi banner uchun)
const RULE_HINT = (t: StudentStrings, k: string) =>
  k === "lesson" ? t.hintLesson
  : k === "lessonView" ? t.hintLessonView
  : k === "homework" ? t.hintHomework
  : k === "perfect" ? t.hintPerfect
  : k === "gameWin" ? t.hintGameWin
  : k === "streak7" ? t.hintStreak
  : t.hintLevelUp;

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

  // Aylanuvchi banner uchun: avval o'quvchi allaqachon yig'ganlari
  // (o'ziga tegishli bo'lgani uchun qiziqarliroq), keyin qolganlari
  const slides: RuleSlide[] = [...coins.lines]
    .sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0))
    .map((l) => ({
      key: l.key,
      label: RULE_LABEL(t, l.key),
      hint: RULE_HINT(t, l.key),
      per: l.per,
      count: l.count,
      total: l.total,
    }));

  return (
    <div className="space-y-4">
      <PageHeader title={t.market} subtitle={t.exchangeCoins} backLabel={t.back} back="/student/profil" />

      {/* ── Hamyon ──
          Bank kartasi o'lchamidagi ixcham karta: faqat balans, yig'ilgan /
          sarflangan va eng arzon sovg'agacha qolgan yo'l. Tanga qanday
          yig'ilishi — pastdagi aylanuvchi bannerda (ilgari yettala qoida
          shu kartaning ichida turib, uni uzun va o'qishga og'ir qilardi). */}
      <div
        className="relative flex aspect-[1.62/1] max-h-[230px] flex-col justify-between overflow-hidden rounded-[22px] p-5 text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)]"
        style={{ background: DEEP_GRADIENT }}
      >
        {/* Orqa fondagi katta tanga — yumshoq bezak */}
        <span className="pointer-events-none absolute -right-7 -top-9 opacity-[0.10]">
          <CoinGold s={140} />
        </span>

        {/* Yuqori qator: balans */}
        <div className="relative flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <CoinGold s={30} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/70">{t.balance}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[36px] font-extrabold leading-none tracking-tight">{coins.balance}</span>
              <span className="text-[13px] font-semibold text-white/70">{t.coins}</span>
            </div>
          </div>
        </div>

        {/* O'rta qator: yig'ilgan / sarflangan */}
        <div className="relative flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-sm">
            {t.earned} <b className="font-extrabold">{coins.earned}</b>
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-sm">
            {t.spent} <b className="font-extrabold">{coins.spent}</b>
          </span>
        </div>

        {/* Pastki qator: eng arzon sovg'agacha */}
        {cheapest !== null ? (
          <div className="relative">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[11.5px]">
              <span className="truncate font-semibold text-white/80">
                {needed > 0 ? t.toCheapest : t.canBuyNow}
              </span>
              {needed > 0 ? (
                <span className="shrink-0 font-extrabold">{needed} {t.coins}</span>
              ) : (
                <span className="shrink-0 text-[15px] leading-none">✓</span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${toCheapestPct}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Tangani qanday yig'asiz — birin-ketin aylanadigan banner ── */}
      <CoinRules slides={slides} title={t.coinRule} timesLabel={t.timesEarned} />

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
