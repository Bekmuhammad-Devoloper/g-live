import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// O'quvchi "Start" ekrani — berilgan maket bilan birma-bir.
// Barcha ikonka va illyustratsiyalar SVG (emoji EMAS — bayroq emojisi
// Windows'da "DE" harflari bo'lib chiqib ketadi). Raqamlar haqiqiy:
//   Wörter   — imtihon natijalari o'rtachasi
//   Lesen    — baholangan uy vazifalari o'rtachasi
//   Hören    — davomat foizi (keldi/darslar)
//   Sprechen — guruh kursining o'tilgan darslari foizi
//   Münzen   — keldi×5 + baholangan vazifa×10
//   Streak   — so'nggi ketma-ket qatnashgan darslar
//   Rang     — guruhdoshlar orasida davomat bo'yicha o'rin (Top X%)

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const TEAL = "#0e7490"; // asosiy rang (maketdagi to'q moviy-feruza)
const NAVY = "#134e5e"; // halqa/qiymatlarning to'q varianti

// ── Halqali foiz (progress ring) ──
function Ring({ pct, size = 64, stroke = 5.5, color = NAVY }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke - 3) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke="#dce9f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  );
}

// ── Maket ikonkalari (SVG, chiziqli uslub) ──
const sw = 2; // stroke-width
function IcoBook({ c = TEAL, s = 40 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6c-1.5-1.6-3.6-2.2-6-2.2-1 0-2 .15-3 .45V19c1-.3 2-.45 3-.45 2.4 0 4.5.6 6 2.2 1.5-1.6 3.6-2.2 6-2.2 1 0 2 .15 3 .45V4.25c-1-.3-2-.45-3-.45-2.4 0-4.5.6-6 2.2Z" />
      <path d="M12 6v14.75" />
    </svg>
  );
}
function IcoHeadphones({ c = TEAL, s = 40 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="7" rx="2" fill={c} stroke="none" />
      <rect x="16.5" y="14" width="4.5" height="7" rx="2" fill={c} stroke="none" />
    </svg>
  );
}
function IcoMic({ c = TEAL, s = 40 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2.5" width="6" height="12" rx="3" fill={c} stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3.5" />
    </svg>
  );
}
function IcoTarget({ c = "white", s = 34 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" fill={c} stroke="none" />
      <path d="M12 12 20 4" />
      <path d="M17.2 4H20v2.8" />
    </svg>
  );
}
function IcoBadgeStar({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 8 1.2 2.4 2.6.4-1.9 1.9.4 2.6-2.3-1.2-2.3 1.2.4-2.6-1.9-1.9 2.6-.4L12 8Z" fill="white" stroke="none" />
    </svg>
  );
}
function IcoStar({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth={1} strokeLinejoin="round">
      <path d="M12 2.8 14.9 8.6l6.4 .9-4.6 4.5 1.1 6.3L12 17.4 6.2 20.3l1.1-6.3L2.7 9.5l6.4-.9L12 2.8Z" />
    </svg>
  );
}
function IcoTrend({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}
function IcoBell({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
function IcoPerson({ s = 30 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="white">
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.5 20c.9-3.8 4-5.8 7.5-5.8s6.6 2 7.5 5.8H4.5Z" />
    </svg>
  );
}

// ── Germaniya bayrog'i (SVG — emoji o'rniga, hamma qurilmada bir xil) ──
function GermanFlag({ w = 76 }: { w?: number }) {
  const h = Math.round(w * 0.62);
  return (
    <svg width={w + 8} height={h + 26} viewBox={`0 0 ${w + 8} ${h + 26}`}>
      {/* bayroq tayog'i */}
      <rect x="2" y="0" width="3.5" height={h + 26} rx="1.5" fill="#8fb3c4" />
      <circle cx="3.7" cy="2.6" r="2.6" fill="#8fb3c4" />
      {/* hilpiragan bayroq */}
      <g transform={`translate(6,3)`}>
        <path d={`M0 0 Q ${w * 0.55} -6 ${w} 2 L ${w} ${h * 0.33 + 2} Q ${w * 0.55} ${h * 0.33 - 6} 0 ${h * 0.33} Z`} fill="#1f2937" />
        <path d={`M0 ${h * 0.33} Q ${w * 0.55} ${h * 0.33 - 6} ${w} ${h * 0.33 + 2} L ${w} ${h * 0.66 + 2} Q ${w * 0.55} ${h * 0.66 - 6} 0 ${h * 0.66} Z`} fill="#dd2c2c" />
        <path d={`M0 ${h * 0.66} Q ${w * 0.55} ${h * 0.66 - 6} ${w} ${h * 0.66 + 2} L ${w} ${h + 2} Q ${w * 0.55} ${h - 6} 0 ${h} Z`} fill="#f7c948" />
      </g>
    </svg>
  );
}

// ── Brandenburg darvozasi (soddalashtirilgan) ──
function Gate({ w = 58, c = "#e8f2f7" }: { w?: number; c?: string }) {
  const h = Math.round(w * 0.72);
  return (
    <svg width={w} height={h} viewBox="0 0 58 42">
      <rect x="2" y="6" width="54" height="6" rx="2" fill={c} />
      <rect x="6" y="0" width="46" height="5" rx="2" fill={c} />
      {[6, 17, 28, 39, 47].map((x) => (
        <rect key={x} x={x} y="13" width="5" height="25" rx="1.5" fill={c} />
      ))}
      <rect x="2" y="38" width="54" height="4" rx="1.5" fill={c} />
    </svg>
  );
}

// ── Planshet (o'ynatish tugmasi bilan) ──
function Tablet({ w = 64, tone = "#0e7490" }: { w?: number; tone?: string }) {
  const h = Math.round(w * 0.7);
  return (
    <svg width={w} height={h} viewBox="0 0 64 45">
      <rect x="1" y="1" width="62" height="43" rx="7" fill={tone} />
      <rect x="5" y="5" width="54" height="35" rx="4" fill="#bfe3ef" />
      <circle cx="32" cy="22.5" r="9" fill="white" />
      <path d="M29 17.5v10l8.5-5-8.5-5Z" fill={tone} />
    </svg>
  );
}

// ── Katta quloqchin (Videos & Podcasts illyustratsiyasi) ──
function BigHeadphones({ w = 92 }: { w?: number }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
      <rect x="2.6" y="13.4" width="5" height="7.6" rx="2.4" fill={TEAL} stroke="none" />
      <rect x="16.4" y="13.4" width="5" height="7.6" rx="2.4" fill={TEAL} stroke="none" />
    </svg>
  );
}

export default async function StudentStartPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      fullName: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { groupId: true, group: { select: { id: true, name: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  if (!student) redirect("/dashboard");

  const group = student.enrollments[0]?.group ?? null;

  const [attendance, submissions, exams, progress, courseLessons, mates] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { markedAt: "desc" },
      select: { status: true },
      take: 200,
    }),
    prisma.submission.findMany({ where: { studentId: student.id, status: "GRADED" }, select: { score: true } }),
    prisma.examResult.findMany({ where: { studentId: student.id }, select: { score: true } }),
    group ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, orderBy: { taughtAt: "desc" }, select: { courseLessonId: true } }) : Promise.resolve([]),
    group ? prisma.courseLesson.findMany({ where: { programId: group.programId }, orderBy: { order: "asc" }, select: { id: true, title: true, topic: true } }) : Promise.resolve([]),
    group
      ? prisma.groupStudent.findMany({ where: { groupId: group.id, isActive: true }, select: { studentId: true } })
      : Promise.resolve([]),
  ]);

  // ── Ko'nikmalar ──
  const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE");
  const hoeren = attendance.length ? clamp((present.length / attendance.length) * 100) : 0;
  const lesen = submissions.length ? clamp(submissions.reduce((n, x) => n + (x.score ?? 0), 0) / submissions.length) : 0;
  const woerter = exams.length ? clamp(exams.reduce((n, x) => n + (x.score ?? 0), 0) / exams.length) : 0;
  const sprechen = courseLessons.length ? clamp((progress.length / courseLessons.length) * 100) : 0;

  // ── Kurs jarayoni ──
  const level = group?.levelCode ?? student.currentLevel ?? "A1";
  const chapter = Math.max(1, progress.length);
  const taughtIds = new Set(progress.map((p) => p.courseLessonId));
  const currentLesson = courseLessons.find((cl) => !taughtIds.has(cl.id)) ?? courseLessons[courseLessons.length - 1] ?? null;
  const kursPct = sprechen;

  // ── Tanga / seriya ──
  const coins = present.length * 5 + submissions.length * 10;
  let streak = 0;
  for (const a of attendance) {
    if (a.status === "PRESENT" || a.status === "LATE") streak++;
    else break;
  }

  // ── Reyting (guruhdoshlar orasida davomat bo'yicha) ──
  let rangTop = 100;
  if (mates.length > 1) {
    const counts = await prisma.attendance.groupBy({
      by: ["studentId"],
      where: { studentId: { in: mates.map((m) => m.studentId) }, status: { in: ["PRESENT", "LATE"] } },
      _count: { _all: true },
    });
    const mine = counts.find((c) => c.studentId === student.id)?._count._all ?? 0;
    const better = counts.filter((c) => c._count._all > mine).length;
    rangTop = clamp(((better + 1) / mates.length) * 100) || 1;
  }

  const kurseHref = group ? `/groups/${group.id}` : "/student";
  const firstName = student.fullName.split(/\s+/)[0];

  const skills = [
    { key: "w", label: "Wörter", pct: woerter, icon: <span style={{ color: TEAL }} className="text-[34px] font-extrabold leading-none">W</span> },
    { key: "l", label: "Lesen", pct: lesen, icon: <IcoBook /> },
    { key: "h", label: "Hören", pct: hoeren, icon: <IcoHeadphones /> },
    { key: "s", label: "Sprechen", pct: sprechen, icon: <IcoMic /> },
  ];

  // Maketdagi yumshoq oq karta
  const card = "rounded-[26px] bg-white/85 shadow-[0_12px_28px_rgba(19,78,94,0.10),inset_0_1px_0_rgba(255,255,255,0.9)]";

  return (
    <div className="space-y-[18px]">
      {/* ── Salomlashish ── */}
      <div className="flex items-center gap-4 pt-1">
        <div className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-full shadow-[0_10px_20px_rgba(14,116,144,0.35)]" style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}>
          <IcoPerson s={34} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[30px] font-extrabold leading-tight tracking-tight text-slate-900">Hallo, {firstName}!</h1>
          <p className="text-[15px] text-slate-500">Bereit, Deutsch zu lernen?</p>
        </div>
        <Link href="/notifications" className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoBell />
          {/* bildirishnoma nuqtasi */}
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full" style={{ background: "#2ea8c9" }} />
        </Link>
      </div>

      {/* ── 4 ko'nikma kartasi ── */}
      <div className="grid grid-cols-4 gap-3">
        {skills.map((sk) => (
          <div key={sk.key} className={`${card} flex flex-col items-center gap-2.5 px-1 pb-4 pt-5`}>
            <div className="grid h-10 place-items-center">{sk.icon}</div>
            <div className="text-[13px] font-semibold text-slate-800">{sk.label}</div>
            <div className="relative grid place-items-center">
              <Ring pct={sk.pct} size={62} stroke={5} />
              <span className="absolute text-[12px] font-bold text-slate-800">{sk.pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dein Fortschritt ── */}
      <Link
        href={kurseHref}
        className="block rounded-[26px] p-6 shadow-[0_14px_30px_rgba(19,78,94,0.14)]"
        style={{ background: "linear-gradient(135deg, #cfe7f0 0%, #e7f3f8 55%, #f2f9fc 100%)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>Dein Fortschritt</div>
            <div className="mt-1.5 truncate text-[34px] font-extrabold leading-tight tracking-tight text-slate-900">
              {level} · Kapitel {chapter}
            </div>
            <div className="mt-1 truncate text-[15px] text-slate-600">
              {currentLesson?.topic || currentLesson?.title || group?.program.name || "Grundlagen des Alltags"}
            </div>
          </div>
          <div className="relative grid shrink-0 place-items-center">
            <Ring pct={kursPct} size={96} stroke={6} />
            <span className="absolute grid h-[66px] w-[66px] place-items-center rounded-full bg-white shadow-[0_4px_12px_rgba(19,78,94,0.15)]">
              <IcoTarget c={NAVY} s={38} />
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full" style={{ width: `${kursPct}%`, background: NAVY }} />
          </div>
          <span className="text-[20px] font-extrabold" style={{ color: NAVY }}>{kursPct}%</span>
        </div>
      </Link>

      {/* ── Münzen · Streak · Rang ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <IcoBadgeStar />, label: "Münzen", value: String(coins) },
          { icon: <IcoStar />, label: "Streak", value: `${streak} Tage` },
          { icon: <IcoTrend />, label: "Rang", value: `Top ${rangTop}%` },
        ].map((t) => (
          <div key={t.label} className={`${card} flex flex-col items-center gap-2 px-2 pb-5 pt-5`}>
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full shadow-[0_8px_16px_rgba(14,116,144,0.3)]" style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}>
              {t.icon}
            </span>
            <span className="text-[14px] font-medium text-slate-600">{t.label}</span>
            <span className="text-[22px] font-extrabold leading-none text-slate-900">{t.value}</span>
          </div>
        ))}
      </div>

      {/* ── Reklama banneri ── */}
      <div
        className="relative overflow-hidden rounded-[26px] p-6 text-white shadow-[0_16px_32px_rgba(14,116,144,0.3)]"
        style={{ background: "linear-gradient(105deg, #0c6a86 0%, #1590b3 45%, #7fd0e6 100%)" }}
      >
        <div className="relative z-10 max-w-[58%]">
          <div className="text-[22px] font-extrabold leading-snug">Deutsch meistern mit Spaß! ✨</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/85">Interaktive Übungen, Videos und spannende Inhalte.</p>
          <Link href={kurseHref} className="mt-4 inline-block rounded-2xl bg-white px-5 py-2.5 text-[14px] font-bold shadow" style={{ color: TEAL }}>
            Jetzt entdecken
          </Link>
        </div>
        {/* o'ng tomondagi illyustratsiya: bayroq + darvoza + planshet */}
        <div className="pointer-events-none absolute right-3 top-3 z-0">
          <GermanFlag w={72} />
        </div>
        <div className="pointer-events-none absolute bottom-8 right-24 z-0 opacity-90">
          <Gate w={52} />
        </div>
        <div className="pointer-events-none absolute -bottom-1 right-2 z-0 rotate-[-8deg]">
          <Tablet w={58} tone="#0b5d76" />
        </div>
        {/* karusel nuqtalari */}
        <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-1.5 backdrop-blur-sm">
          <span className="h-1.5 w-5 rounded-full bg-white" />
          <span className="h-1.5 w-3 rounded-full bg-white/50" />
          <span className="h-1.5 w-3 rounded-full bg-white/50" />
        </div>
      </div>

      {/* ── Videos & Podcasts ── */}
      <div className={`${card} relative overflow-hidden p-6`}>
        <div className="relative z-10 max-w-[58%]">
          <h2 className="text-[24px] font-extrabold leading-tight tracking-tight text-slate-900">Videos &amp; Podcasts</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">Lerne Deutsch mit spannenden Inhalten</p>
          <Link href={kurseHref} className="mt-4 inline-flex items-center gap-1 rounded-2xl px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)]" style={{ background: TEAL }}>
            Entdecken
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </Link>
        </div>
        {/* o'ng tomonda: quloqchin + planshet */}
        <div className="pointer-events-none absolute -right-2 top-1 z-0">
          <BigHeadphones w={96} />
        </div>
        <div className="pointer-events-none absolute bottom-3 right-14 z-0 rotate-[-10deg]">
          <Tablet w={70} />
        </div>
      </div>
    </div>
  );
}
