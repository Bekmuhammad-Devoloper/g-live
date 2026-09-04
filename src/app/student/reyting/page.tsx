import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rankBoard } from "@/lib/rank";
import { S } from "../_i18n";
import { CARD, PageHeader, TEAL } from "../_ui";
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

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

// Birinchi uchtasiga medal rangi
const MEDAL: Record<number, string> = {
  1: "linear-gradient(135deg,#fbbf24,#d97706)",
  2: "linear-gradient(135deg,#cbd5e1,#94a3b8)",
  3: "linear-gradient(135deg,#d8a06a,#a16207)",
};

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

  return (
    <div className="space-y-4">
      <PageHeader title={t.rank} subtitle={`${SCOPE_LABEL[scope] ?? ""} · ${BASIS_LABEL[basis] ?? ""}`} />

      {/* ── Mening o'rnim ── */}
      {me && (
        <div
          className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_16px_34px_-18px_rgba(14,116,144,0.9)]"
          style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
        >
          <div className="flex items-center gap-4">
            <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl bg-white/20 text-[24px] font-extrabold backdrop-blur-sm">
              {me.place}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Sizning o&apos;rningiz</div>
              <div className="mt-0.5 truncate text-[19px] font-extrabold leading-tight">{me.name}</div>
              <div className="mt-0.5 text-[13px] text-white/75">
                {me.value} — {BASIS_LABEL[basis]}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] text-white/60">jami</div>
              <div className="text-[17px] font-extrabold">{total}</div>
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
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={
                "flex items-center gap-3 px-4 py-3 " +
                (i > 0 ? "border-t border-slate-900/[0.05] " : "") +
                (r.isMe ? "bg-[#0e7490]/[0.07]" : "")
              }
            >
              {/* O'rin */}
              <span
                className={
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[14px] font-extrabold " +
                  (MEDAL[r.place] ? "text-white" : "bg-slate-100 text-slate-500")
                }
                style={MEDAL[r.place] ? { background: MEDAL[r.place] } : undefined}
              >
                {r.place}
              </span>

              {/* Rasm yoki bosh harflar */}
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
                >
                  {initials(r.name)}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className={"block truncate text-[14.5px] " + (r.isMe ? "font-extrabold text-slate-900" : "font-semibold text-slate-700")}>
                  {r.name}
                  {r.isMe ? " · siz" : ""}
                </span>
              </span>

              <span className="shrink-0 text-[15px] font-extrabold" style={{ color: TEAL }}>
                {r.value}
              </span>
            </div>
          ))}
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
