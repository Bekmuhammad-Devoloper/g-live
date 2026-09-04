import { getSession } from "@/lib/auth";
import { S } from "./_i18n";
import { prisma } from "@/lib/db";
import { studentRank } from "@/lib/rank";

// Umumiy reyting belgisi — o'quvchining o'rni.
// Hisob src/lib/rank.ts da: taqqoslash doirasi (guruh / filial / markaz) va
// mezoni (davomat / tanga / o'rtacha ball) sozlamadan olinadi. Start
// ekranidagi "Reyting" kartochkasi ham aynan shu funksiyani ishlatadi.

function IcoTrophy({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* qulplar */}
      <path d="M6.5 5.5H4.2v1.7a3.6 3.6 0 0 0 3.1 3.6M17.5 5.5h2.3v1.7a3.6 3.6 0 0 1-3.1 3.6"
        stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />
      {/* kosa */}
      <path d="M6.4 3.6h11.2v5.1a5.6 5.6 0 0 1-11.2 0V3.6Z" fill="#fbbf24" />
      <path d="M6.4 3.6h11.2v5.1a5.6 5.6 0 0 1-11.2 0V3.6Z" fill="#fcd34d" opacity="0.55" />
      {/* oyoq va taglik */}
      <path d="M12 14.3v3.1" stroke="#f59e0b" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M8.4 20.4h7.2" stroke="#f59e0b" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M9.8 17.4h4.4v3h-4.4z" fill="#f59e0b" />
    </svg>
  );
}

export default async function RatingBadge() {
  const session = await getSession();
  if (!session) return null;

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!student) return null;

  // Doira va mezon Sozlamalar > Ball va mukofotlar bo'limida belgilanadi
  const { place } = await studentRank(student.id);

  return (
    <div className="gl-glass flex h-11 shrink-0 items-center gap-1 rounded-2xl px-2.5">
      <IcoTrophy s={26} />
      <div className="leading-none">
        <div className="text-[15px] font-extrabold text-slate-900">{place}</div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-600">{S(session.locale).place}</div>
      </div>
    </div>
  );
}
