import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAttended } from "./_ui";
import MissingStudent from "./MissingStudent";

// O'quvchi "Start" ekrani — berilgan maket bilan birma-bir.
// Barcha ikonka va illyustratsiyalar SVG (emoji EMAS — bayroq emojisi
// Windows'da "DE" harflari bo'lib chiqib ketadi). Raqamlar haqiqiy:
//   Wörter   — imtihon natijalari o'rtachasi
//   Lesen    — baholangan uy vazifalari o'rtachasi
//   Hören    — davomat foizi (keldi/darslar)
//   Sprechen — guruh kursining o'tilgan darslari foizi
//   Münzen   — keldi×5 + baholangan vazifa×10
//   Streak   — so'nggi ketma-ket qatnashgan darslar
//   Rang     — guruhdoshlar orasida davomat bo'yicha O'RIN (1 = birinchi)

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
// Münzen — tanga (ikkita ustma-ust tanga, ustidagisida yulduzcha)
function IcoCoin({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {/* pastdagi tanga */}
      <ellipse cx="12" cy="16.4" rx="7.6" ry="3.1" fill="white" opacity="0.45" />
      {/* ustidagi tanga */}
      <circle cx="12" cy="10.6" r="7.1" fill="white" />
      <circle cx="12" cy="10.6" r="5.2" fill="none" stroke="#0e7490" strokeWidth="1.1" opacity="0.55" />
      <path d="m12 7.6 1 2.1 2.3.33-1.65 1.6.4 2.28L12 12.83l-2.05 1.08.4-2.28-1.65-1.6L11 9.7 12 7.6Z" fill="#0e7490" />
    </svg>
  );
}

// Streak — olov (ketma-ket kunlar), oq siluet
function IcoFlameWhite({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path
        d="M12 2.4c.6 3.2-1.1 4.8-2.7 6.5C7.6 10.7 5.8 12.6 5.8 15.3a6.2 6.2 0 0 0 12.4 0c0-2.3-1.1-4.2-2.4-5.8-1.5-1.9-3.1-4-3.8-7.1Z"
        fill="white"
      />
      <path
        d="M12 10.8c.35 1.7-.65 2.6-1.5 3.6-.75.85-1.45 1.7-1.45 2.95a3.05 3.05 0 0 0 6.1 0c0-1.15-.55-2-1.2-2.95-.75-1.05-1.6-2.1-1.95-3.6Z"
        fill="#0e7490" opacity="0.35"
      />
    </svg>
  );
}

// Rang — o'sish (ustunlar + yuqoriga strelka)
function IcoGrowth({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5h16" />
      <rect x="5" y="13" width="3.4" height="5" rx="1.2" fill="white" stroke="none" opacity="0.75" />
      <rect x="10.3" y="10" width="3.4" height="8" rx="1.2" fill="white" stroke="none" opacity="0.85" />
      <rect x="15.6" y="6" width="3.4" height="12" rx="1.2" fill="white" stroke="none" />
      <path d="m5.5 9.5 4-3.5 3 2.2 5-4.2" strokeWidth="2" opacity="0.9" />
      <path d="M14.6 3.4h3.2v3.1" strokeWidth="2" opacity="0.9" />
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
function IcoFlame({ s = 30 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      {/* tashqi olov */}
      <path
        d="M12 2.5c.5 3-1 4.6-2.6 6.2C7.7 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.2-1-4-2.2-5.6C14.4 7.5 13 5.5 12 2.5Z"
        fill="#f4511e"
      />
      <path
        d="M12 2.5c.5 3-1 4.6-2.6 6.2C7.7 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.2-1-4-2.2-5.6C14.4 7.5 13 5.5 12 2.5Z"
        fill="#ff7a2f" opacity="0.55"
      />
      {/* ichki olov */}
      <path d="M12 10.5c.3 1.6-.6 2.5-1.4 3.4-.7.8-1.4 1.6-1.4 2.8a2.9 2.9 0 0 0 5.8 0c0-1.1-.5-1.9-1.1-2.8-.7-1-1.5-2-1.9-3.4Z" fill="#ffc93c" />
    </svg>
  );
}

// ── Doira shaklidagi Germaniya bayrog'i (rasm qo'yilmagan avatar uchun) ──
function FlagAvatar({ s = 44 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" className="shrink-0">
      <defs>
        <clipPath id="glAvatarClip"><circle cx="22" cy="22" r="22" /></clipPath>
      </defs>
      <g clipPath="url(#glAvatarClip)">
        <rect x="0" y="0" width="44" height="14.67" fill="#111111" />
        <rect x="0" y="14.67" width="44" height="14.67" fill="#DD0000" />
        <rect x="0" y="29.34" width="44" height="14.66" fill="#FFCE00" />
      </g>
      {/* yengil ichki halqa — chetini yumshatadi */}
      <circle cx="22" cy="22" r="21.25" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
    </svg>
  );
}

// ── Germaniya bayrog'i (silliq to'lqin, rasmiy ranglar) ──
// Uch rangni alohida to'lqinlantirish o'rniga butun bayroq shakli clipPath
// qilinadi va ichiga tekis chiziqlar chiziladi — chetlari toza chiqadi.
function GermanFlag({ w = 88 }: { w?: number }) {
  const h = Math.round(w * 0.6);
  const amp = h * 0.13; // to'lqin balandligi
  const wave = `M0 ${amp}
    C ${w * 0.3} ${-amp * 0.6}, ${w * 0.62} ${amp * 1.7}, ${w} ${amp * 0.2}
    L ${w} ${h + amp * 0.2}
    C ${w * 0.62} ${h + amp * 1.7}, ${w * 0.3} ${h - amp * 0.6}, 0 ${h + amp}
    Z`;
  return (
    <svg width={w + 8} height={h + amp * 2 + 20} viewBox={`0 0 ${w + 8} ${h + amp * 2 + 20}`}>
      <defs>
        <clipPath id="glFlagClip">
          <path d={wave} />
        </clipPath>
        <linearGradient id="glFlagShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
          <stop offset="30%" stopColor="#000" stopOpacity="0" />
          <stop offset="72%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
      </defs>

      {/* tayoq */}
      <rect x="0.5" y="0" width="3" height={h + amp * 2 + 20} rx="1.5" fill="#dceef5" />
      <circle cx="2" cy="2.4" r="2.4" fill="#dceef5" />

      {/* bayroq: uch tekis chiziq, to'lqin shakli bo'yicha kesilgan */}
      <g transform="translate(4.5,3)" clipPath="url(#glFlagClip)">
        <rect x="0" y={-amp * 2} width={w} height={h / 3 + amp * 2} fill="#111111" />
        <rect x="0" y={h / 3} width={w} height={h / 3} fill="#DD0000" />
        <rect x="0" y={(h * 2) / 3} width={w} height={h / 3 + amp * 2} fill="#FFCE00" />
        <rect x="0" y={-amp * 2} width={w} height={h + amp * 4} fill="url(#glFlagShade)" />
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
      imageUrl: true,
      user: { select: { imageUrl: true } },
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { groupId: true, group: { select: { id: true, name: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  // Student yozuvi yo'q — /dashboard ga redirect AYLANISH hosil qiladi
  // (dashboard STUDENT ni yana shu yerga qaytaradi). Xabar ko'rsatamiz.
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  const [attendance, submissions, exams, progress, courseLessons, mates, unread] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { markedAt: "desc" },
      select: { status: true },
      take: 200,
    }),
    prisma.submission.findMany({ where: { studentId: student.id, status: "GRADED" }, select: { score: true, assignment: { select: { maxScore: true } } } }),
    prisma.examResult.findMany({ where: { studentId: student.id }, select: { score: true } }),
    group ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, orderBy: { taughtAt: "desc" }, select: { courseLessonId: true } }) : Promise.resolve([]),
    group ? prisma.courseLesson.findMany({ where: { programId: group.programId }, orderBy: { order: "asc" }, select: { id: true, title: true, topic: true } }) : Promise.resolve([]),
    group
      ? prisma.groupStudent.findMany({ where: { groupId: group.id, isActive: true }, select: { studentId: true } })
      : Promise.resolve([]),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
  ]);

  // ── Ko'nikmalar ──
  // Kanonik davomat formulasi (Profil va admin hisobotlari bilan bir xil)
  const present = attendance.filter((a) => isAttended(a.status));
  const hoeren = attendance.length ? clamp((present.length / attendance.length) * 100) : 0;
  // Ball maxScore ga normalizatsiya qilinadi — 10 ballik vazifada 9 ball 90% bo'lsin
  const lesen = submissions.length
    ? clamp(submissions.reduce((n, x) => n + ((x.score ?? 0) / (x.assignment.maxScore || 100)) * 100, 0) / submissions.length)
    : 0;
  const woerter = exams.length ? clamp(exams.reduce((n, x) => n + (x.score ?? 0), 0) / exams.length) : 0;
  // (sprechen quyida, doneInProgram aniqlangach hisoblanadi)

  // ── Kurs jarayoni ──
  const level = group?.levelCode ?? student.currentLevel ?? "A1";
  const taughtIds = new Set(progress.map((p) => p.courseLessonId));
  // Faqat JORIY kurs dasturidagi o'tilgan darslar sanaladi (guruh dasturi
  // almashtirilgan bo'lsa eski progress yozuvlari Kapitel raqamini oshirmasin
  // — Kurse sahifasi bilan bir xil hisob)
  const doneInProgram = courseLessons.filter((cl) => taughtIds.has(cl.id)).length;
  const chapter = Math.max(1, doneInProgram);
  const sprechen = courseLessons.length ? clamp((doneInProgram / courseLessons.length) * 100) : 0;
  const currentLesson = courseLessons.find((cl) => !taughtIds.has(cl.id)) ?? courseLessons[courseLessons.length - 1] ?? null;
  const kursPct = sprechen;

  // ── Tanga / seriya ──
  const coins = present.length * 5 + submissions.length * 10;
  let streak = 0;
  for (const a of attendance) {
    if (isAttended(a.status)) streak++;
    else break;
  }

  // ── Reyting: guruhdoshlar orasidagi O'RIN (raqam) ──
  let rangPos = 1;
  if (mates.length > 1) {
    const counts = await prisma.attendance.groupBy({
      by: ["studentId"],
      where: { studentId: { in: mates.map((m) => m.studentId) }, status: { in: ["PRESENT", "LATE", "ONLINE", "MAKEUP"] } },
      _count: { _all: true },
    });
    const mine = counts.find((c) => c.studentId === student.id)?._count._all ?? 0;
    const better = counts.filter((c) => c._count._all > mine).length;
    rangPos = better + 1; // 1 = birinchi o'rin
  }

  const kurseHref = "/student/kurse"; // kurs sahifasi endi portal ichida
  const firstName = student.fullName.split(/\s+/)[0];
  // Profil rasmi: avval o'quvchi rasmi, keyin foydalanuvchi rasmi; ikkalasi ham yo'q bo'lsa — logotip
  const avatarUrl = student.imageUrl || student.user?.imageUrl || null;

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
      <div className="flex items-center gap-2.5 pt-1">
        {/* Avatar: rasm qo'yilgan bo'lsa — o'sha, bo'lmasa Germaniya bayrog'i (doira).
            Logotip keng bo'lgani uchun doiraga kesib solinganda chiroyli chiqmasdi. */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={student.fullName}
            className="h-11 w-11 shrink-0 rounded-full object-cover shadow-[0_8px_16px_rgba(14,116,144,0.3)]"
          />
        ) : (
          <span className="shrink-0 rounded-full shadow-[0_8px_16px_rgba(19,78,94,0.22)]" aria-label="Deutsch">
            <FlagAvatar s={44} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[26px]">Hallo, {firstName}!</h1>
          <p className="truncate text-[13px] text-slate-500">Bereit, Deutsch zu lernen?</p>
        </div>
        {/* Streak (ketma-ket qatnashuv) kartochkasi — olovcha + kunlar soni */}
        <div className="flex h-11 shrink-0 items-center gap-1 rounded-2xl bg-white px-2.5 shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoFlame s={26} />
          <div className="leading-none">
            <div className="text-[15px] font-extrabold text-slate-900">{streak}</div>
            <div className="mt-0.5 text-[10px] font-semibold text-slate-500">kun</div>
          </div>
        </div>
        {/* Ikonkalar pastki tab-bar ikonkalari o'lchamida (26px) */}
        <Link href="/student/mitteilungen" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_16px_rgba(19,78,94,0.12)]">
          <IcoBell s={26} />
          {/* bildirishnoma nuqtasi — faqat o'qilmagan xabar bo'lsa */}
          {unread > 0 && <span className="absolute right-[9px] top-[8px] h-2 w-2 rounded-full" style={{ background: "#2ea8c9" }} />}
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
            <div className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
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
          { icon: <IcoCoin />, label: "Münzen", value: String(coins) },
          { icon: <IcoFlameWhite />, label: "Streak", value: String(streak) },
          { icon: <IcoGrowth />, label: "Rang", value: String(rangPos) },
        ].map((t) => (
          <div key={t.label} className={`${card} flex flex-col items-center gap-2.5 px-1.5 pb-4 pt-4`}>
            <span className="grid h-[50px] w-[50px] place-items-center rounded-full shadow-[0_8px_16px_rgba(14,116,144,0.3)]" style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}>
              {t.icon}
            </span>
            <span className="text-[13px] font-medium leading-none text-slate-500">{t.label}</span>
            <span className="whitespace-nowrap text-[24px] font-extrabold leading-none text-slate-900">{t.value}</span>
          </div>
        ))}
      </div>

      {/* ── Reklama banneri ── */}
      <div
        className="relative min-h-[178px] overflow-hidden rounded-[26px] p-6 pb-10 text-white shadow-[0_16px_32px_rgba(14,116,144,0.3)]"
        style={{ background: "linear-gradient(105deg, #0c6a86 0%, #1590b3 45%, #7fd0e6 100%)" }}
      >
        <div className="relative z-10 max-w-[58%]">
          <div className="text-[22px] font-extrabold leading-snug">Deutsch meistern mit Spaß! ✨</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/85">Interaktive Übungen, Videos und spannende Inhalte.</p>
          <Link href={kurseHref} className="mt-4 inline-block rounded-2xl bg-white px-5 py-2.5 text-[14px] font-bold shadow" style={{ color: TEAL }}>
            Jetzt entdecken
          </Link>
        </div>
        {/* o'ng tomondagi illyustratsiya: darvoza (orqada) + bayroq + planshet */}
        <div className="pointer-events-none absolute bottom-6 right-6 z-0 opacity-70">
          <Gate w={62} />
        </div>
        <div className="pointer-events-none absolute right-4 top-4 z-[1] drop-shadow-[0_6px_10px_rgba(0,0,0,0.22)]">
          <GermanFlag w={78} />
        </div>
        <div className="pointer-events-none absolute bottom-4 right-3 z-[2] rotate-[-8deg] drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]">
          <Tablet w={54} tone="#0b5d76" />
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
