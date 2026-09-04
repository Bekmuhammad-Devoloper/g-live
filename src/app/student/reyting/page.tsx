import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rankBoard, type BoardRow } from "@/lib/rank";
import { S } from "../_i18n";
import { CARD, FlagAvatar, PageHeader, TEAL } from "../_ui";
import MissingStudent from "../MissingStudent";

// Reyting — o'quvchi o'z o'rnini va oldindagilarni ko'radi.
// Taqqoslash doirasi (guruh / filial / markaz) va mezoni (davomat / tanga /
// o'rtacha ball) Sozlamalar > Ball va mukofotlar bo'limida belgilanadi.

const SCOPE_LABEL: Record<string, string> = {
  group: "Guruh ichida",
  branch: "Filial bo'yicha",
  center: "Butun markaz",
};

const BASIS_LABEL: Record<string, string> = {
  attendance: "qatnashgan darslar soni",
  coins: "yig'ilgan tanga",
  score: "o'rtacha ball, %",
};

// Ustundagi raqam ostidagi qisqa birlik (uzun matn sig'maydi)
const UNIT: Record<string, string> = {
  attendance: "dars",
  coins: "tanga",
  score: "%",
};

// Birinchi uchta o'rin — medal ranglari
const MEDAL: Record<number, { bg: string; ring: string }> = {
  1: { bg: "linear-gradient(140deg,#fde68a,#f59e0b 45%,#b45309)", ring: "rgba(245,158,11,0.45)" },
  2: { bg: "linear-gradient(140deg,#f1f5f9,#cbd5e1 45%,#94a3b8)", ring: "rgba(148,163,184,0.45)" },
  3: { bg: "linear-gradient(140deg,#fcd9b6,#d8a06a 45%,#a16207)", ring: "rgba(180,120,60,0.45)" },
};

// ── Avatar: rasm bo'lsa — o'sha, bo'lmasa Germaniya bayrog'i ──
function Avatar({ row, size = 42 }: { row: BoardRow; size?: number }) {
  if (row.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.imageUrl}
        alt=""
        className="shrink-0 rounded-full object-cover ring-2 ring-white"
        style={{ width: size, height: size }}
      />
    );
  }
  // clipPath id'si har qatorda noyob bo'lishi shart — aks holda SVG chalkashadi
  return <FlagAvatar s={size} id={`rk-${row.id}`} />;
}

export default async function StudentRatingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return <MissingStudent />;

  const { rows, me, total, scope, basis } = await rankBoard(student.id, 50);
  const unit = UNIT[basis] ?? "";

  // Nechta o'quvchi bir xil o'rinda turibdi — "teng natija" belgisi uchun
  const samePlace = new Map<number, number>();
  for (const r of rows) samePlace.set(r.place, (samePlace.get(r.place) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <PageHeader title={t.rank} subtitle={`${SCOPE_LABEL[scope] ?? ""} · ${BASIS_LABEL[basis] ?? ""}`} />

      {/* ── Mening o'rnim ── */}
      {me && (
        <div
          className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_16px_34px_-18px_rgba(14,116,144,0.9)]"
          style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
        >
          {/* yumshoq yorug'lik dog'i — kartaga chuqurlik beradi */}
          <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex items-center gap-3.5">
            <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl bg-white/20 text-[24px] font-extrabold tabular-nums backdrop-blur-sm">
              {me.place}
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Sizning o&apos;rningiz</div>
              <div className="mt-1 flex items-center gap-2">
                <Avatar row={me} size={26} />
                <span className="min-w-0 truncate text-[18px] font-extrabold leading-tight">{me.name}</span>
              </div>
              <div className="mt-1 text-[12.5px] text-white/75">
                <b className="font-extrabold text-white">{me.value}</b> {BASIS_LABEL[basis]}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[11px] text-white/60">jami</div>
              <div className="text-[17px] font-extrabold tabular-nums">{total}</div>
              <div className="text-[10.5px] text-white/60">o&apos;quvchi</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Ro'yxat ── */}
      {rows.length === 0 ? (
        <div className={CARD + " rounded-[26px] px-5 py-12 text-center"}>
          <div className="text-[15px] font-semibold text-slate-700">Reyting hali tuzilmagan</div>
          <p className="mt-1 text-[13px] text-slate-400">Darslar boshlangach shu yerda ko&apos;rinadi.</p>
        </div>
      ) : (
        <div className={CARD + " overflow-hidden rounded-[26px]"}>
          {rows.map((r, i) => {
            const medal = MEDAL[r.place];
            const tied = (samePlace.get(r.place) ?? 1) > 1;
            return (
              <div
                key={r.id}
                className={
                  "relative flex items-center gap-3 px-4 py-2.5 " +
                  (i > 0 ? "border-t border-slate-900/[0.05] " : "") +
                  (r.isMe ? "bg-[#0e7490]/[0.08]" : "")
                }
              >
                {/* O'z qatoringiz — chap chetda rangli chiziq */}
                {r.isMe && <span className="absolute inset-y-0 left-0 w-[3px] rounded-r" style={{ background: TEAL }} />}

                {/* O'rin */}
                <span
                  className={
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[14px] font-extrabold tabular-nums " +
                    (medal ? "text-white" : "bg-slate-100 text-slate-500")
                  }
                  style={medal ? { background: medal.bg, boxShadow: `0 4px 12px -4px ${medal.ring}` } : undefined}
                >
                  {r.place}
                </span>

                <Avatar row={r} />

                <span className="min-w-0 flex-1">
                  <span className={"block truncate text-[14.5px] " + (r.isMe ? "font-extrabold text-slate-900" : "font-semibold text-slate-700")}>
                    {r.name}
                  </span>
                  {(r.isMe || tied) && (
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {r.isMe && (
                        <span className="rounded-md px-1.5 py-[1px] text-[10px] font-bold text-white" style={{ background: TEAL }}>
                          siz
                        </span>
                      )}
                      {tied && <span className="text-[10.5px] text-slate-400">teng natija</span>}
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-[16px] font-extrabold leading-none tabular-nums" style={{ color: TEAL }}>
                    {r.value}
                  </span>
                  {unit && <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{unit}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {total > rows.length && (
        <p className="px-1 text-center text-[12.5px] text-slate-400">
          Birinchi {rows.length} ta ko&apos;rsatilgan — jami {total} o&apos;quvchi
        </p>
      )}
    </div>
  );
}
