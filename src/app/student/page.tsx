import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { S } from "./_i18n";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { coinBalance, starBalance } from "@/lib/coins";
import { studentRank } from "@/lib/rank";
import { getActiveBanners, getActiveVideos } from "@/lib/portalContent";
import BannerCarousel from "./BannerCarousel";
import { CARD, CoinGold, isAttended } from "./_ui";
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

// ── Ko'nikma rasmlari (public/skills/) ──
// Foiz 5 ta kayfiyat darajasiga bo'linadi: 0-15, 16-40, 41-60, 61-85, 86-100.
// Rasm hali yuklanmagan bo'lsa — pastdagi SVG ikonka ishlatiladi (sayt buzilmaydi).
function skillLevel(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct <= 15) return 1;
  if (pct <= 40) return 2;
  if (pct <= 60) return 3;
  if (pct <= 85) return 4;
  return 5;
}
function skillImage(base: string, pct: number): string | null {
  // Ikki xil joylashuv qo'llab-quvvatlanadi:
  //   public/skills/hoeren/3.png   (papkali)
  //   public/skills/hoeren-3.png   (yassi)
  // Aniq daraja topilmasa — pastroq darajadagi eng yaqin rasm olinadi.
  // Shunda rasmlar to'liq yuklanmagan bo'lsa ham kartalar bir xil ko'rinadi
  // (ba'zisi rasm, ba'zisi SVG bo'lib chalkashmaydi).
  try {
    for (let lvl = skillLevel(pct); lvl >= 1; lvl--) {
      for (const rel of [`${base}/${lvl}.png`, `${base}-${lvl}.png`]) {
        if (fs.existsSync(path.join(process.cwd(), "public", "skills", rel))) return `/skills/${rel}`;
      }
    }
  } catch { /* fayl tizimi o'qilmasa — SVG ikonka ishlatiladi */ }
  return null;
}

const TEAL = "#0e7490"; // asosiy rang (maketdagi to'q moviy-feruza)
const NAVY = "#134e5e"; // halqa/qiymatlarning to'q varianti

// ── Halqali foiz (progress ring) ──
function Ring({ pct, size = 64, stroke = 5.5, color = NAVY }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke - 3) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {/* Markaz shaffof — ostidagi shisha ko'rinib tursin (oq disk uni berkitardi).
          Yo'lakcha (track) ham oq-yarim tiniq: shishaning bir qismidek o'qiladi. */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(255,255,255,0.42)" stroke="rgba(255,255,255,0.8)" strokeWidth={stroke} />
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
// Yulduz — yig'ilgan yutuq (sarflanmaydi). Feruza doira ichida OLTIN yulduz:
// tanga yagona oltin disk bo'lib qolsin, lekin "mukofot = oltin" ishorasi yo'qolmasin.
function IcoStarGold({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" strokeLinejoin="round">
      <defs>
        <linearGradient id="glStarGold" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffe9a3" />
          <stop offset="55%" stopColor="#fbc63f" />
          <stop offset="100%" stopColor="#ef9f21" />
        </linearGradient>
      </defs>
      <path d="M12 3.1l2.75 5.57 6.15.9-4.45 4.34 1.05 6.12L12 17.14l-5.5 2.89 1.05-6.12L3.1 9.57l6.15-.9L12 3.1Z"
        fill="url(#glStarGold)" stroke="#fff7de" strokeOpacity="0.6" strokeWidth="0.9" />
    </svg>
  );
}

// Seriya — olov (yuqoridagi belgi bilan bir xil shakl)
function IcoFlameWhite({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="white">
      <path d="M12 2.5c.5 3-1 4.6-2.6 6.2C7.7 10.4 6 12.2 6 15a6 6 0 0 0 12 0c0-2.2-1-4-2.2-5.6C14.4 7.5 13 5.5 12 2.5Z" />
      <path d="M12 10.5c.3 1.6-.6 2.5-1.4 3.4-.7.8-1.4 1.6-1.4 2.8a2.9 2.9 0 0 0 5.8 0c0-1.1-.5-1.9-1.1-2.8-.7-1-1.5-2-1.9-3.4Z" fill="#ffd7a8" />
    </svg>
  );
}

// Rang — o'sish strelkasi (chiziqli grafik)
function IcoGrowth({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.6 16.8 5.6-5.6 3.6 3.6 7.6-7.6" />
      <path d="M14.6 7.2h6v6" />
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
  const t = S(session.locale);

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
  // Hisob bitta joyda (src/lib/coins.ts) — Market va Sozlamalar bilan bir xil
  const [purse, starPurse, banners, videoList] = await Promise.all([
    coinBalance(student.id),
    starBalance(student.id),
    getActiveBanners(),
    getActiveVideos(),
  ]);
  const coins = purse.balance;
  const stars = starPurse.earned; // yulduz sarflanmaydi
  const streak = purse.streak;

  // ── Reyting: o'rin (raqam) ──
  // Doira va mezon Sozlamalar > Ball va mukofotlar bo'limidan olinadi;
  // yuqoridagi kubok belgisi ham aynan shu hisobni ko'rsatadi.
  const { place: rangPos } = await studentRank(student.id);

  const kurseHref = "/student/kurse"; // kurs sahifasi endi portal ichida
  // Salomlashish uchun qisqaroq nomni tanlaymiz: CRM da ba'zan "Familiya Ism",
  // ba'zan "Ism Familiya" yoziladi — uzun familiya sarlavhaga sig'masdi
  // ("Salom, Abdugaf..."). Ikkitasidan qisqasi odatda ismning o'zi bo'ladi.
  const nameParts = student.fullName.split(/\s+/).filter(Boolean);
  const firstName =
    nameParts.length > 1 && nameParts[0].length > 9 && nameParts[1].length >= 3
      ? nameParts[1]
      : (nameParts[0] ?? student.fullName);
  // Profil rasmi: avval o'quvchi rasmi, keyin foydalanuvchi rasmi; ikkalasi ham yo'q bo'lsa — logotip
  const avatarUrl = student.imageUrl || student.user?.imageUrl || null;

  // Yangi o'quvchida hali hech qanday ma'lumot yo'q. Bunda 0% ko'rsatish
  // "ma'lumot yo'q" emas, "yiqilding" degan ma'no beradi — ustiga eng past
  // darajadagi (xafa) ko'nikma rasmi tanlanardi. Shu sabab har ko'nikma uchun
  // "manbasi bormi" belgisi olib yuriladi: bo'lmasa foiz o'rniga chiziqcha.
  const skills = [
    { key: "w", label: t.words, pct: woerter, has: exams.length > 0, img: exams.length ? skillImage("woerter", woerter) : null, icon: <span style={{ color: TEAL }} className="text-[28px] font-extrabold leading-none">W</span> },
    { key: "l", label: t.reading, pct: lesen, has: submissions.length > 0, img: submissions.length ? skillImage("lesen", lesen) : null, icon: <IcoBook s={34} /> },
    { key: "h", label: t.listening, pct: hoeren, has: attendance.length > 0, img: attendance.length ? skillImage("hoeren", hoeren) : null, icon: <IcoHeadphones s={34} /> },
    { key: "s", label: t.speaking, pct: sprechen, has: courseLessons.length > 0, img: courseLessons.length ? skillImage("sprechen", sprechen) : null, icon: <IcoMic s={34} /> },
  ];

  // Karta uslubi — yagona manba `_ui.tsx` dagi CARD ("gl-glass").
  // Ilgari bu yerda aynan shu satr ikkinchi marta yozilgan edi va ikkalasi
  // vaqt o'tib bir-biridan uzilib qolardi.
  const card = CARD;

  return (
    <div className="space-y-[18px]">
      {/* ── Salomlashish ── */}
      <div className="flex items-start gap-2.5 pt-1">
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
          <h1 className="line-clamp-2 break-words text-[19px] font-extrabold leading-tight tracking-tight text-slate-900 min-[380px]:text-[22px] sm:text-[26px]">
            {t.hello}, {firstName}!
          </h1>
          <p className="line-clamp-2 text-[12.5px] leading-snug text-slate-600">{t.readyToLearn}</p>
        </div>
        {/* Streak (ketma-ket qatnashuv) kartochkasi — olovcha + kunlar soni */}
        <div className="gl-glass flex h-11 shrink-0 items-center gap-1 rounded-2xl px-2.5">
          <IcoFlame s={26} />
          <div className="leading-none">
            <div className="text-[15px] font-extrabold text-slate-900">{streak}</div>
            <div className="mt-0.5 text-[10px] font-semibold text-slate-600">{t.day}</div>
          </div>
        </div>
        {/* Ikonkalar pastki tab-bar ikonkalari o'lchamida (26px) */}
        <Link href="/student/mitteilungen" aria-label={t.notifications} className="gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <IcoBell s={26} />
          {/* bildirishnoma nuqtasi — faqat o'qilmagan xabar bo'lsa */}
          {unread > 0 && <span className="absolute right-[9px] top-[8px] h-2 w-2 rounded-full" style={{ background: "#2ea8c9" }} />}
        </Link>
      </div>

      {/* ── 4 ko'nikma kartasi ── */}
      <div className="mt-1 grid grid-cols-4 gap-2.5">
        {skills.map((sk) => (
          <div key={sk.key} className={`${card} flex flex-col items-center gap-2 rounded-[22px] px-1 pb-3.5 pt-4`}>
            <div className="grid h-12 place-items-center">
              {sk.img
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={sk.img} alt="" className="h-12 w-12 object-contain" />
                : sk.icon}
            </div>
            {/* Qator balandligi qat'iy: `text-[..]` faqat shrift o'lchamini beradi,
                leading esa body'dan meros bo'lardi — karta balandligi tilga qarab
                o'zgarib ketardi (uz/ru/de yorliqlari har xil). */}
            <div className="px-0.5 text-center text-[12px] font-semibold leading-[15px] text-slate-800">{sk.label}</div>
            <div className="relative grid place-items-center">
              <Ring pct={sk.has ? sk.pct : 0} size={52} stroke={4.5} />
              <span className="absolute text-[11px] font-bold leading-none text-slate-800">{sk.has ? `${sk.pct}%` : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dein Fortschritt ── */}
      <Link
        href={kurseHref}
        className="gl-glass-hero block min-h-[168px] p-6 transition active:scale-[0.985]"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: TEAL }}>{t.yourProgress}</div>
            <div className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
              {level} · {t.chapter} {chapter}
            </div>
            <div className="mt-1 truncate text-[15px] font-medium text-slate-700">
              {currentLesson?.topic || currentLesson?.title || group?.program.name || t.everydayBasics}
            </div>
          </div>
          <div className="relative grid shrink-0 place-items-center">
            <Ring pct={kursPct} size={96} stroke={6} />
            <span className="absolute grid h-[66px] w-[66px] place-items-center rounded-full bg-white/60 shadow-[0_4px_12px_rgba(19,78,94,0.15)]">
              <IcoTarget c={NAVY} s={38} />
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]">
            <div className="h-full rounded-full" style={{ width: `${kursPct}%`, background: NAVY }} />
          </div>
          <span className="text-[20px] font-extrabold" style={{ color: NAVY }}>{kursPct}%</span>
        </div>
      </Link>

      {/* ── Tanga · Yulduz · Seriya · Reyting ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          // Tanga — doira ichidagi belgi emas, tanganing o'zi (shu sabab `bare`)
          { icon: <CoinGold s={46} />, bare: true, label: t.coins, value: String(coins) },
          { icon: <IcoStarGold />, bare: false, label: t.stars, value: String(stars) },
          { icon: <IcoFlameWhite />, bare: false, label: t.streak, value: String(streak) },
          { icon: <IcoGrowth />, bare: false, label: t.rank, value: String(rangPos) },
        ].map((it) => (
          <div key={it.label} className={`${card} flex flex-col items-center gap-2 rounded-[22px] px-1 pb-3 pt-3`}>
            {it.bare ? (
              <span className="grid h-[46px] w-[46px] place-items-center drop-shadow-[0_8px_14px_rgba(166,110,18,0.45)]">
                {it.icon}
              </span>
            ) : (
              <span
                className="grid h-[46px] w-[46px] place-items-center rounded-full shadow-[0_8px_16px_rgba(14,116,144,0.3)]"
                style={{ background: `linear-gradient(135deg, #17a2bf, ${TEAL})` }}
              >
                {it.icon}
              </span>
            )}
            <span className="text-[11.5px] font-semibold leading-none text-slate-600">{it.label}</span>
            <span className="whitespace-nowrap text-[21px] font-extrabold leading-none text-slate-900">{it.value}</span>
          </div>
        ))}
      </div>

      {/* ── Reklama banneri (Sozlamalar > Bosh sahifa) ── */}
      <BannerCarousel
        items={banners.map((b) => ({
          id: b.id, title: b.title, subtitle: b.subtitle, btnLabel: b.btnLabel,
          href: b.href, imageUrl: b.imageUrl, color: b.color,
        }))}
      />

      {/* ── Videos & Podcasts ── */}
      <div className={`${card} relative overflow-hidden p-6`}>
        <div className="relative z-10 max-w-[58%]">
          <h2 className="text-[24px] font-extrabold leading-tight tracking-tight text-slate-900">{t.videosPodcasts}</h2>
          {videoList.length > 0 ? (
            <div className="mt-1 text-[12.5px] font-semibold text-slate-600">{videoList.length}</div>
          ) : null}
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{t.learnWithContent}</p>
          <Link href="/student/videos" className="mt-4 inline-flex items-center gap-1 rounded-2xl px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)]" style={{ background: TEAL }}>
            {t.discover}
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
