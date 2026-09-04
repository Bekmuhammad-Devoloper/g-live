import Link from "next/link";
import { S } from "./_i18n";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TEAL } from "./_ui";
import { studentStreak } from "@/lib/coins";
import { isPortalFeatureOn } from "@/lib/portalFeatures";

// Portalning HAR BIR sahifasida yuqori o'ng burchakda turadigan ikki belgi:
// seriya (ketma-ket qatnashgan kunlar) va bildirishnoma qo'ng'irog'i.
// Start ekranidagi ko'rinish bilan bir xil bo'lishi uchun bitta joyda saqlanadi.

function IcoFlame({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M12 2.5c.5 3-1 4.6-2.6 6.2C7.7 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.2-1-4-2.2-5.6C14.4 7.5 13 5.5 12 2.5Z" fill="#f4511e" />
      <path d="M12 2.5c.5 3-1 4.6-2.6 6.2C7.7 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.2-1-4-2.2-5.6C14.4 7.5 13 5.5 12 2.5Z" fill="#ff7a2f" opacity="0.55" />
      <path d="M12 10.5c.3 1.6-.6 2.5-1.4 3.4-.7.8-1.4 1.6-1.4 2.8a2.9 2.9 0 0 0 5.8 0c0-1.1-.5-1.9-1.1-2.8-.7-1-1.5-2-1.9-3.4Z" fill="#ffc93c" />
    </svg>
  );
}
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
      {showStreak && (
        <div className="gl-glass flex h-11 shrink-0 items-center gap-1 rounded-2xl px-2.5">
          <IcoFlame s={26} />
          <div className="leading-none">
            <div className="text-[15px] font-extrabold text-slate-900">{streak}</div>
            <div className="mt-0.5 text-[10px] font-semibold text-slate-600">{S(session.locale).day}</div>
          </div>
        </div>
      )}
      {notifOn && (
      <Link
        href="/student/mitteilungen"
        aria-label={S(session.locale).messages}
        className="gl-glass relative grid h-11 w-11 shrink-0 place-items-center rounded-full"
      >
        <IcoBell s={26} />
        {unread > 0 && <span className="absolute right-[9px] top-[8px] h-2 w-2 rounded-full" style={{ background: "#2ea8c9" }} />}
      </Link>
      )}
    </div>
  );
}
