import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { starBalance } from "@/lib/coins";
import { getActiveStarRanks, progressOf, rankName } from "@/lib/starRanks";
import { S } from "../_i18n";
import { CARD, PageHeader, TEAL } from "../_ui";
import MissingStudent from "../MissingStudent";

// Yulduz pog'onalari — o'quvchi qayerda turgani va keyingisiga qancha
// qolgani. Ro'yxatni ma'muriyat Sozlamalar > Yulduz darajalari dan
// boshqaradi, shu sabab bu yerda hech narsa qattiq yozilmagan.

function IcoStar({ s = 15 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3.1l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 17.14l-5.5 2.89 1.05-6.12L3.1 9.57l6.15-.9L12 3.1Z" />
    </svg>
  );
}

function IcoCoin({ s = 14 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="#fbc63f" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#e0940f" strokeWidth="1.4" />
    </svg>
  );
}

export default async function StudentStarRankPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return <MissingStudent />;

  const [purse, ranks] = await Promise.all([starBalance(student.id), getActiveStarRanks()]);
  const stars = purse.earned;
  const step = progressOf(ranks, stars);

  return (
    <div className="space-y-4">
      <PageHeader title={t.starRank} subtitle={t.starRankSub} backLabel={t.back} back="/student" />

      {/* ── Hozirgi pog'ona ── */}
      <div
        className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_16px_34px_-18px_rgba(14,116,144,0.9)]"
        style={{ background: `linear-gradient(135deg, ${step.current?.color ?? "#17a2bf"}, ${TEAL})` }}
      >
        <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
            {step.place}/{step.total}
          </div>
          <div className="mt-1 text-[26px] font-extrabold leading-tight">
            {step.current ? rankName(step.current, session.locale) : "—"}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-white/85">
            <IcoStar s={15} />
            {stars} {t.stars}
          </div>

          {step.next ? (
            <>
              <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${step.pct}%` }} />
              </div>
              <div className="mt-2 text-[12.5px] text-white/80">
                {t.nextRank}: <b className="font-extrabold text-white">{rankName(step.next, session.locale)}</b>
                {" — "}
                <b className="font-extrabold text-white tabular-nums">{step.need}</b> {t.starsToNext}
              </div>
            </>
          ) : (
            <div className="mt-3 text-[12.5px] font-semibold text-white/85">{t.topRank}</div>
          )}
        </div>
      </div>

      {/* ── Pog'onalar ro'yxati ── */}
      {ranks.length === 0 ? (
        <div className={CARD + " rounded-[26px] px-5 py-12 text-center"}>
          <div className="text-[15px] font-semibold text-slate-700">—</div>
        </div>
      ) : (
        <div className={CARD + " overflow-hidden rounded-[26px]"}>
          {[...ranks]
            .sort((a, b) => a.stars - b.stars)
            .map((r, i) => {
              const reached = stars >= r.stars;
              const isNow = step.current?.id === r.id;
              return (
                <div
                  key={r.id}
                  className={
                    "flex items-center gap-3 px-4 py-3 " +
                    (i > 0 ? "border-t border-slate-900/[0.05] " : "") +
                    (isNow ? "bg-[#0e7490]/[0.08]" : "")
                  }
                >
                  {/* Pog'ona raqami — ochilgani rangli, ochilmagani kulrang */}
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-extrabold tabular-nums text-white"
                    style={{ background: reached ? r.color : "#cbd5e1" }}
                  >
                    {i + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={"block truncate text-[14.5px] " + (reached ? "font-extrabold text-slate-900" : "font-semibold text-slate-500")}>
                      {rankName(r, session.locale)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2.5 text-[11.5px] text-slate-500">
                      <span className="flex items-center gap-1" style={{ color: reached ? r.color : undefined }}>
                        <IcoStar s={12} />
                        <b className="font-bold tabular-nums">{r.stars}</b>
                      </span>
                      {r.reward > 0 && (
                        <span className="flex items-center gap-1">
                          <IcoCoin s={13} />
                          <b className="font-bold tabular-nums">+{r.reward}</b>
                        </span>
                      )}
                    </span>
                  </span>

                  {reached && (
                    <span
                      className="shrink-0 rounded-md px-1.5 py-[2px] text-[10px] font-bold text-white"
                      style={{ background: isNow ? TEAL : "#94a3b8" }}
                    >
                      {t.rankReached}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
