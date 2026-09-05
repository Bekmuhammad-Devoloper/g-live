import Link from "next/link";
import { S } from "./_i18n";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { IcoFlame, TEAL } from "./_ui";
import { studentStreak } from "@/lib/coins";
import { isPortalFeatureOn } from "@/lib/portalFeatures";

// Portalning HAR BIR sahifasida yuqori o'ng burchakda turadigan ikki belgi:
// seriya (ketma-ket qatnashgan kunlar) va bildirishnoma qo'ng'irog'i.
// Start ekranidagi ko'rinish bilan bir xil bo'lishi uchun bitta joyda saqlanadi.

function IcoBell({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

// `showStreak` — ba'zi sahifalarda sarlavha o'rtada turishi kerak va
// seriya belgisi qatorni tortib yuboradi. Sukut bo'yicha ko'rinadi, ya'ni
// mavjud sahifalar o'zgarmaydi.
export default async function HeaderBadges({ showStreak = true }: { showStreak?: boolean }) {
  const session = await getSession();
  if (!session) return null;

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });

  // Seriya hisobi bitta joyda (src/lib/coins.ts) — sozlamaga bo'ysunadi
  const [streak, unread, notifOn] = await Promise.all([
    student ? studentStreak(student.id) : Promise.resolve(0),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    // Bo'lim o'chirilgan bo'lsa qo'ng'iroqcha ham ko'rinmaydi
    isPortalFeatureOn("mitteilungen"),
  ]);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {notifOn && (
        <Link
          href="/student/mitteilungen"
          aria-label={S(session.locale).messages}
          className="gl-glass relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
        >
          <IcoBell s={26} />
          {unread > 0 && (
            <span className="absolute right-[9px] top-[9px] h-[9px] w-[9px] rounded-full ring-2 ring-white" style={{ background: "#f4511e" }} />
          )}
        </Link>
      )}
      {showStreak && (
        <div className="gl-glass flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3">
          <IcoFlame s={24} />
          <div className="leading-none">
            <div className="text-[16px] font-extrabold tabular-nums text-slate-900">{streak}</div>
            <div className="mt-[3px] text-[10px] font-semibold text-slate-500">{S(session.locale).day}</div>
          </div>
        </div>
      )}
    </div>
  );
}
