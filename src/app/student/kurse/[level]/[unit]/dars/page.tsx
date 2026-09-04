import Link from "next/link";
import MissingStudent from "../../../../MissingStudent";
import { loadUnit } from "../_load";
import { loadUnitProgress } from "../_progress";
import { SectionHeader, IcoPlayCircle } from "../_parts";
import { CoinGold, NAVY, TEAL } from "../../../../_ui";

// "Dars" bo'limi — darsning videolari ro'yxati.
//
// Har karta ikki qatordan: VIDEO (ko'rilganmi) va MASHQ (topshirilganmi).
// Har qatorda o'sha ish uchun beriladigan tanga va yulduz ko'rinadi —
// o'quvchi nima uchun nima olishini oldindan biladi.
//
// Ma'lumot modelida bitta darsda BITTA video bor, shuning uchun ro'yxatda
// hozircha bitta karta bo'ladi. Tuzilma ro'yxat qilib qurilgan: dasturga
// darsga bir nechta video qo'shilsa, ro'yxat o'zi kengayadi.

const ACCENT = "linear-gradient(150deg, #2fb9dc 0%, #0e7490 100%)";

/** Kichik yulduz — mukofot chipida */
function StarSmall({ s = 15 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3.1l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 17.14l-5.5 2.89 1.05-6.12L3.1 9.57l6.15-.9L12 3.1Z"
        fill="#fbc63f"
        stroke="#fff7de"
        strokeOpacity="0.6"
        strokeWidth="0.9"
      />
    </svg>
  );
}

/** Mukofot chipi: ikonka + olingan/jami */
function Reward({ icon, got, total }: { icon: React.ReactNode; got: number; total: number }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/75 px-2 py-[3px]">
      {icon}
      <span className="text-[12px] font-extrabold tabular-nums text-slate-800">
        {got}/{total}
      </span>
    </span>
  );
}

/** Bitta qator: nom, mukofotlar va jarayon chizig'i */
function Row({
  label, pct, coinGot, coinTotal, starGot, starTotal,
}: {
  label: string;
  pct: number;
  coinGot: number;
  coinTotal: number;
  starGot: number;
  starTotal: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800">{label}:</span>
        <Reward icon={<CoinGold s={15} />} got={coinGot} total={coinTotal} />
        <Reward icon={<StarSmall />} got={starGot} total={starTotal} />
      </div>
      <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg,#3fc9e4,${TEAL})` }} />
      </div>
    </div>
  );
}

export default async function LessonVideosPage({
  params,
}: {
  params: Promise<{ level: string; unit: string }>;
}) {
  const { level, unit } = await params;
  const ctx = await loadUnit(level, unit);
  if (ctx.missing) return <MissingStudent />;

  const { t, code, lesson, unitLabel } = ctx;
  const p = await loadUnitProgress(ctx);

  // Video mukofoti — bitta hodisa, shuning uchun "olingan/jami" 0/3 yoki 3/3
  const vCoinTotal = p.reward.viewCoin;
  const vStarTotal = p.reward.viewStar;
  const vCoinGot = p.lesson.watched ? vCoinTotal : 0;
  const vStarGot = p.lesson.watched ? vStarTotal : 0;

  // Mashq mukofoti — har topshirilgan vazifa uchun
  const eCoinTotal = p.reward.taskCoin * p.homework.total;
  const eStarTotal = p.reward.taskStar * p.homework.total;
  const eCoinGot = p.reward.taskCoin * p.homework.done;
  const eStarGot = p.reward.taskStar * p.homework.done;

  const base = `/student/kurse/${code}/${lesson.id}`;

  return (
    <div>
      <SectionHeader
        backHref={base}
        backLabel={t.back}
        title={t.lesson}
        subtitle={`${unitLabel} · ${lesson.title}`}
        accent={ACCENT}
      />

      <div className="mt-4 space-y-3">
        {p.lesson.hasVideo ? (
          <Link
            href={`${base}/dars/video`}
            className="gl-glass block rounded-[24px] p-4 transition active:scale-[0.985]"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] text-white" style={{ background: ACCENT }}>
                <IcoPlayCircle s={20} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-[-0.015em] text-slate-900">
                1-{t.videoSection.toLowerCase()}
              </span>
              {p.lesson.watched && (
                <span className="shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: "rgba(14,116,144,0.14)", color: NAVY }}>
                  {t.watched}
                </span>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <Row
                label={t.videoSection}
                pct={p.lesson.pct}
                coinGot={vCoinGot}
                coinTotal={vCoinTotal}
                starGot={vStarGot}
                starTotal={vStarTotal}
              />
              {p.homework.total > 0 && (
                <Row
                  label={t.exercise}
                  pct={p.homework.pct}
                  coinGot={eCoinGot}
                  coinTotal={eCoinTotal}
                  starGot={eStarGot}
                  starTotal={eStarTotal}
                />
              )}
            </div>
          </Link>
        ) : (
          <div className="gl-glass rounded-[26px] px-5 py-14 text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/60 text-slate-400">
              <IcoPlayCircle s={26} />
            </span>
            <div className="text-[14.5px] font-semibold text-slate-700">{t.noVideoYet}</div>
          </div>
        )}
      </div>
    </div>
  );
}
