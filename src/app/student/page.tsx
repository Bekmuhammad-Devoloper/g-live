import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { fill, S } from "./_i18n";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { getStudentProgress } from "@/lib/studentProgress";
import { getSkills } from "@/lib/skills";
import { getActiveLevels, levelTitle, matchLevel } from "@/lib/studyLevels";
import { coinBalance, starBalance } from "@/lib/coins";
import { studentRank } from "@/lib/rank";
import { getActiveStarRanks, progressOf, rankName } from "@/lib/starRanks";
import { getActiveBanners, getActiveVideos, videoThumb } from "@/lib/portalContent";
import BannerCarousel from "./BannerCarousel";
import HeroCarousel from "./HeroCarousel";
import { CARD, CoinGold, FlagAvatar, IcoBell, IcoBook, IcoCalendar, IcoChevron, IcoClock, IcoFlame, IcoPin, INK, NAVY, Ring, TEAL } from "./_ui";
import { plannedLessonDays, todayISOLocal } from "@/lib/attendanceWindow";
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


// ── Ko'nikma rasmlari (public/skills/) ──
// Rasm FAQAT kartadagi foizga qarab tanlanadi — 4 ta teng bo'lak:
//   1 -> 0-25%   2 -> 26-50%   3 -> 51-75%   4 -> 76-100%
// Ilgari "ma'lumot hali yo'q" holatida o'rtacha rasm qo'yilardi, natijada
// kartada 0% yozilib, 2-rasm turardi — foiz bilan rasm bir-biriga mos
// kelmasdi. Endi bunday istisno yo'q.
// Rasm hali yuklanmagan bo'lsa — pastdagi SVG ikonka ishlatiladi (sayt buzilmaydi).
function skillLevel(pct: number): 1 | 2 | 3 | 4 {
  if (pct <= 25) return 1;
  if (pct <= 50) return 2;
  if (pct <= 75) return 3;
  return 4;
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


// ── Maket ikonkalari (SVG, chiziqli uslub) ──
const sw = 2; // stroke-width
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

// Yulduz pog'onasi — medal. Ichida yulduz bor: pog'ona aynan yulduz
// yig'ib ochilishi bir qarashda o'qilsin.
function IcoMedalGold({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="glMedalGold" x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor="#ffe9a3" />
          <stop offset="52%" stopColor="#fbc63f" />
          <stop offset="100%" stopColor="#ef9f21" />
        </linearGradient>
      </defs>
      {/* Lentalar */}
      <path d="M8.2 2.5h3L8.6 8.2 5.6 6.9 8.2 2.5Zm7.6 0h-3l2.6 5.7 3-1.3-2.6-4.4Z" fill="#fff" fillOpacity="0.85" />
      {/* Disk */}
      <circle cx="12" cy="15" r="6.6" fill="url(#glMedalGold)" stroke="#fff7de" strokeOpacity="0.6" strokeWidth="0.9" />
      {/* Ichidagi yulduz */}
      <path d="M12 11.3l1.16 2.35 2.59.38-1.87 1.82.44 2.58L12 17.2l-2.32 1.23.44-2.58-1.87-1.82 2.59-.38L12 11.3Z" fill="#fff8e1" />
    </svg>
  );
}

// Reyting — o'sish strelkasi (chiziqli grafik), tilla rangda
function IcoGrowthGold({ s = 24 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id="glGrowthGold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ef9f21" />
          <stop offset="55%" stopColor="#fbc63f" />
          <stop offset="100%" stopColor="#ffe9a3" />
        </linearGradient>
      </defs>
      <path d="m3.6 16.8 5.6-5.6 3.6 3.6 7.6-7.6" stroke="url(#glGrowthGold)" />
      <path d="M14.6 7.2h6v6" stroke="url(#glGrowthGold)" />
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
        select: {
          groupId: true,
          group: {
            select: {
              id: true, name: true, levelCode: true, programId: true,
              // Dars kunlari kalendari va "Keyingi dars" banneri uchun jadval
              weekdays: true, startTime: true, endTime: true, room: true, startDate: true, endDate: true, lessonsPerMonth: true,
              program: { select: { name: true, lessonsPerMonth: true } },
            },
          },
        },
      },
    },
  });
  // Student yozuvi yo'q — /dashboard ga redirect AYLANISH hosil qiladi
  // (dashboard STUDENT ni yana shu yerga qaytaradi). Xabar ko'rsatamiz.
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  // ── Dars jadvali: keyingi dars va joriy oy kalendari ──
  // Barcha faol guruhlar bo'yicha (o'quvchi ikkita guruhda bo'lishi mumkin).
  // Kunlar guruhning haftalik kunlaridan, "oyiga N dars" chegarasi bilan
  // (src/lib/attendanceWindow.ts plannedLessonDays) — kalendarda 13 kun chiqsa
  // ham 13-chisi dars emas.
  const todayISO = todayISOLocal();
  const now = new Date();
  const calY = now.getFullYear(), calM = now.getMonth();
  const nextY = calM === 11 ? calY + 1 : calY, nextM = (calM + 1) % 12;
  type LessonDay = { iso: string; group: string; startTime: string | null; endTime: string | null; room: string | null };
  const lessonDayMap = new Map<string, LessonDay>();
  for (const e of student.enrollments) {
    const g = e.group;
    if (!g.weekdays) continue;
    const limit = g.lessonsPerMonth ?? g.program.lessonsPerMonth;
    // Tugash sanasi o'tib ketgan, lekin o'quvchi hali ham faol — demak guruh
    // davom etyapti (sana yangilanmagan). Bunday sana jadvalni yashirmasin.
    const endDate = g.endDate && g.endDate.getTime() >= now.getTime() - 86_400_000 ? g.endDate : null;
    const days = [
      ...plannedLessonDays(calY, calM, g.weekdays, limit, g.startDate, endDate),
      ...plannedLessonDays(nextY, nextM, g.weekdays, limit, g.startDate, endDate),
    ];
    for (const iso of days) {
      if (!lessonDayMap.has(iso)) lessonDayMap.set(iso, { iso, group: g.name, startTime: g.startTime, endTime: g.endTime, room: g.room });
    }
  }
  const hasSchedule = student.enrollments.some((e) => !!e.group.weekdays);
  // Keyingi dars: bugungi dars hali tugamagan bo'lsa — bugun, aks holda keyingi kun
  const hhmmNow = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextLesson = [...lessonDayMap.values()]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .find((d) => d.iso > todayISO || (d.iso === todayISO && (!d.endTime || d.endTime > hhmmNow))) ?? null;

  const [prog, levels, mates, unread, skillScores] = await Promise.all([
    // Jarayon YAGONA joyda (src/lib/studentProgress.ts) — o'quvchi ko'rgan
    // darslar ham hisobga olinadi, faqat o'qituvchi belgilagani emas
    getStudentProgress(student.id, group),
    getActiveLevels(),
    group
      ? prisma.groupStudent.findMany({ where: { groupId: group.id, isActive: true }, select: { studentId: true } })
      : Promise.resolve([]),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    // Ko'nikma plitkalari. Ilgari davomat/vazifa/imtihon o'rtachasidan
    // hisoblanardi — o'quvchining mashqiga bog'liq emas edi va hech qachon
    // pasaymasdi. Endi lib/skills.ts: to'g'ri bajarilgan mashq/vazifa ball
    // qo'shadi, ilova ochilmagan har kun ball ayiradi.
    getSkills(student.id),
  ]);

  // ── Ko'nikmalar ──
  const woerter = skillScores.words;
  const lesen = skillScores.reading;
  const hoeren = skillScores.listening;
  const sprechen = skillScores.speaking;

  // ── Kurs jarayoni ──
  // Kartochka JORIY daraja haqida gapiradi ("A1 · Bo'lim 3"), shuning uchun
  // foiz ham o'sha darajaniki bo'lishi kerak — butun dasturniki emas.
  const curLevel = matchLevel(group?.levelCode ?? student.currentLevel, levels);
  const level = curLevel?.code ?? group?.levelCode ?? student.currentLevel ?? "A1";
  const lvlStat = prog.byLevel.get(level) ?? null;
  const chapter = Math.max(1, lvlStat?.done ?? prog.doneCount);
  const kursPct = lvlStat?.pct ?? prog.overallPct;
  const currentLesson = prog.currentLesson;
  // Kartochka foni — shu darajaning banneri (ma'muriyat yuklagan bo'lsa)
  const levelBanner = curLevel?.bannerUrl ?? null;
  const levelName = curLevel ? levelTitle(curLevel, session.locale) : null;

  // ── Tanga / seriya ──
  // Hisob bitta joyda (src/lib/coins.ts) — Market va Sozlamalar bilan bir xil
  const notifOn = await isPortalFeatureOn("mitteilungen"); // o'chirilgan bo'lsa qo'ng'iroqcha yo'q
  const marketOn = await isPortalFeatureOn("market");        // o'chiq bo'lsa tanga plitkasi havola bo'lmaydi
  const [purse, starPurse, banners, videoList, starRanks] = await Promise.all([
    coinBalance(student.id),
    starBalance(student.id),
    getActiveBanners(),
    getActiveVideos(),
    getActiveStarRanks(),
  ]);
  const coins = purse.balance;
  const stars = starPurse.earned; // yulduz sarflanmaydi
  const streak = purse.streak;
  // Yulduz pog'onasi — plitkada nomi turadi, batafsili /student/daraja da
  const starStep = progressOf(starRanks, starPurse.earned);

  // Kartada oxirgi videoning rasmi turadi. Vimeo rasm bermaydi — shuning uchun
  // rasmi bori topilguncha oxiridan boshlab qaraymiz, topilmasa chizma qoladi.
  const lastThumb = [...videoList].reverse().map((v) => videoThumb(v.url)).find(Boolean) ?? null;

  // ── Reyting: o'rin (raqam) ──
  // Doira va mezon Sozlamalar > Ball va mukofotlar bo'limidan olinadi;
  // yuqoridagi kubok belgisi ham aynan shu hisobni ko'rsatadi.
  const { place: rangPos } = await studentRank(student.id);

  const kurseHref = "/student/kurse"; // kurs sahifasi endi portal ichida
  // Salomlashishda TO'LIQ ism-familiya. Bitta qatorga sig'masa ikkinchi
  // qatorga tushadi — uch nuqta bilan qirqilgani ismni o'qib bo'lmaydigan
  // qilib qo'yardi ("Abdugaffarova Ezo...").
  const fullName = student.fullName.trim();
  // Profil rasmi: avval o'quvchi rasmi, keyin foydalanuvchi rasmi; ikkalasi ham yo'q bo'lsa — logotip
  const avatarUrl = student.imageUrl || student.user?.imageUrl || null;

  // Yangi o'quvchida hali hech qanday ma'lumot yo'q. Bunda 0% ko'rsatish
  // "ma'lumot yo'q" emas, "yiqilding" degan ma'no beradi — ustiga eng past
  // darajadagi (xafa) ko'nikma rasmi tanlanardi. Shu sabab har ko'nikma uchun
  // "manbasi bormi" belgisi olib yuriladi: bo'lmasa foiz o'rniga chiziqcha.
  const skills = [
    // Ma'lumot yo'q bo'lsa rasm YASHIRILMAYDI, balki NEYTRAL daraja (3)
    // ko'rsatiladi. Aks holda qator aralash chiqadi — bittasi rasm, bittasi
    // chiziqli ikonka — va yagona rasmli karta eng past (xafa) darajada
    // bo'lib, yangi o'quvchiga "yomon boshladingiz" degan taassurot beradi.
    // Foiz o'rnidagi chiziqcha ma'lumot yo'qligini o'zi aytib turadi.
    { key: "w", label: t.words, pct: woerter, img: skillImage("woerter", woerter), icon: <span style={{ color: TEAL }} className="text-[28px] font-extrabold leading-none">W</span> },
    { key: "l", label: t.reading, pct: lesen, img: skillImage("lesen", lesen), icon: <IcoBook s={34} /> },
    { key: "h", label: t.listening, pct: hoeren, img: skillImage("hoeren", hoeren), icon: <IcoHeadphones s={34} /> },
    { key: "s", label: t.speaking, pct: sprechen, img: skillImage("sprechen", sprechen), icon: <IcoMic s={34} /> },
  ];

  // Karta uslubi — yagona manba `_ui.tsx` dagi CARD ("gl-glass").
  // Ilgari bu yerda aynan shu satr ikkinchi marta yozilgan edi va ikkalasi
  // vaqt o'tib bir-biridan uzilib qolardi.
  const card = CARD;

  return (
    <div className="space-y-[18px]">
      {/* ── Yuqori qator: o'quvchi, seriya va bildirishnoma ── */}
      {/* Salomlashish matni ("Salom, ..." va "Nemis tilini o'rganishga
          tayyormisiz?") olib tashlandi: har ochilganda takrorlanadigan,
          hech qanday ma'lumot bermaydigan matn edi va ekranning eng
          qimmatli joyidan — tepasidan — ikki qator yer yerdi.
          Qator endi bitta satr, shu sabab o'rtaga tekislangan. */}
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
        {/* Ism IKKI QATORGACHA cho'ziladi, kesilmaydi.
            Ilgari bitta qatorda `truncate` edi va uzun familiya "Abdugaffarova…"
            bo'lib qirqilardi: qatorda rasm (44) + seriya (~86) + qo'ng'iroq (44)
            turgani uchun ismga 360px ekranda atigi ~135px qoladi — bu 16px
            extrabold da 13-14 ta belgi.
            Ikki qator 17px dan = 34px, ya'ni avatardan (44px) past — shu sabab
            qator balandligi umuman o'zgarmaydi. */}
        <h1 className="min-w-0 flex-1 text-[15.5px] font-extrabold leading-[1.1] tracking-[-0.015em] text-slate-900 min-[380px]:text-[16.5px] sm:text-[18px]">
          <span className="line-clamp-2">{fullName}</span>
        </h1>
        {/* Qo'ng'iroq va seriya — ichki sahifalardagi HeaderBadges bilan
            bir xil ko'rinish va bir xil tartibda. `relative` shart: nuqta
            qo'ng'iroqning o'zida turishi kerak, aks holda u eng yaqin
            joylashtirilgan ota-elementga nisbatan suzib ketadi. */}
        {/* Seriya — har kuni ko'rinib tursin: pastdagi plitkalargacha
            aylantirmasdan ham necha kun ketma-ket kelgani bilinadi. */}
        <div className="gl-glass flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3">
          <IcoFlame s={26} />
          <div className="leading-none">
            <div className="text-[17px] font-extrabold tabular-nums text-slate-900">{streak}</div>
            <div className="mt-[3px] text-[10px] font-semibold text-slate-500">{t.day}</div>
          </div>
        </div>
        {notifOn && (
        <Link href="/student/mitteilungen" aria-label={t.notifications} className="gl-glass relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
          <IcoBell c={INK} s={25} />
          {/* bildirishnoma nuqtasi — faqat o'qilmagan xabar bo'lsa */}
          {unread > 0 && (
            <span className="absolute right-[9px] top-[9px] h-[9px] w-[9px] rounded-full ring-2 ring-white" style={{ background: "#f4511e" }} />
          )}
        </Link>
        )}
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
            <div
              className={
                "w-full px-0.5 text-center font-semibold leading-[15px] text-slate-800 " +
                (sk.label.length > 9 ? "text-[9.5px] tracking-[-0.02em]" : sk.label.length > 7 ? "text-[11px]" : "text-[12px]")
              }
            >
              {sk.label}
            </div>
            <div className="relative grid place-items-center">
              <Ring pct={sk.pct} size={52} stroke={4.5} />
              {/* Ma'lumot bo'lmasa ham foiz ko'rsatiladi (0%) — chiziqcha
                  o'quvchida "ishlamayapti" degan taassurot qoldirardi */}
              <span className="absolute text-[11px] font-bold leading-none text-slate-800">{sk.pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sizning natijangiz ──
          Ayni damda o'qilayotgan darajaning banneri fon bo'ladi (ma'muriyat
          yuklagan bo'lsa), yozuvlar esa o'sha kursga tegishli: daraja nomi,
          bo'lim raqami va joriy dars mavzusi. Banner bo'lmasa — avvalgi
          shisha ko'rinish. */}
      <HeroCarousel slides={[
      <Link
        key="course"
        href={kurseHref}
        className={
          levelBanner
            ? "relative block h-full min-h-[136px] overflow-hidden rounded-[24px] p-4 pb-7 text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)] transition active:scale-[0.985]"
            : "gl-glass-hero block h-full min-h-[136px] p-4 pb-7 transition active:scale-[0.985]"
        }
      >
        {levelBanner ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={levelBanner} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {/* Yozuvlar rasm ustida ham aniq o'qilishi uchun — chapdan o'ngga
                so'nuvchi qoramtir parda (matn chap tomonda turadi) */}
            <span className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
          </>
        ) : null}

        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.2em]"
              style={levelBanner ? { color: "rgba(255,255,255,0.85)" } : { color: TEAL }}
            >
              {t.yourProgress}
            </div>
            <div className={
              levelBanner
                ? "font-hand mt-1 text-[27px] font-bold leading-[1.05] sm:text-[32px]"
                : "font-hand mt-1 text-[27px] font-bold leading-[1.05] text-slate-900 sm:text-[32px]"
            }>
              {levelName ?? level}
            </div>
            <div className={levelBanner ? "mt-0.5 text-[13px] font-semibold text-white/85" : "mt-0.5 text-[13px] font-semibold text-slate-700"}>
              {level} · {t.chapter} {chapter}
            </div>
            <div className={levelBanner ? "mt-0.5 line-clamp-1 text-[12.5px] text-white/75" : "mt-0.5 line-clamp-1 text-[12.5px] font-medium text-slate-700"}>
              {currentLesson?.topic || currentLesson?.title || group?.program.name || t.everydayBasics}
            </div>
          </div>
          <div className="relative grid shrink-0 place-items-center">
            <Ring pct={kursPct} size={72} stroke={5} color={levelBanner ? "#ffffff" : NAVY} />
            <span
              className="absolute grid h-[50px] w-[50px] place-items-center rounded-full shadow-[0_4px_12px_rgba(19,78,94,0.15)]"
              style={{ background: levelBanner ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)" }}
            >
              <IcoTarget c={NAVY} s={28} />
            </span>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-3">
          <div className={
            levelBanner
              ? "h-[8px] flex-1 overflow-hidden rounded-full bg-white/30"
              : "h-[8px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]"
          }>
            <div className="h-full rounded-full" style={{ width: `${kursPct}%`, background: levelBanner ? "#ffffff" : NAVY }} />
          </div>
          <span className="text-[17px] font-extrabold" style={{ color: levelBanner ? "#ffffff" : NAVY }}>{kursPct}%</span>
        </div>
      </Link>,

      /* ── Keyingi dars — kurs banneri bilan navbatma-navbat ko'rinadi ── */
      <NextLessonBanner
        key="next"
        t={t}
        locale={session.locale}
        todayISO={todayISO}
        next={nextLesson}
        hasSchedule={hasSchedule}
        cardCls={card}
        imageUrl={levelBanner}
      />,
      ]} />

      {/* ── Tanga · Yulduz · Seriya · Reyting ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          // Tanga — doira ichidagi belgi emas, tanganing o'zi (shu sabab `bare`)
          // Tanga -> Market (sarflanadigan joy), yulduz -> qanday yig'ish
          { icon: <CoinGold s={46} />, bare: true, label: t.coins, value: String(coins), href: marketOn ? "/student/market" : undefined },
          { icon: <IcoStarGold />, bare: false, label: t.stars, value: String(stars), href: "/student/yulduz" },
          // Seriya yuqori qatorga (olov belgisiga) ko'chdi — bu yerda uning
          // o'rnida yulduz pog'onasi turadi: o'quvchi qaysi bosqichdaligi
          // raqamdan ko'ra ko'proq narsa aytadi.
          {
            // Ma'muriyat pog'onaga belgi yuklagan bo'lsa — o'sha turadi
            icon: starStep.current?.iconUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={starStep.current.iconUrl} alt="" className="h-[46px] w-[46px] object-contain" />
              : <IcoMedalGold />,
            bare: Boolean(starStep.current?.iconUrl),
            label: t.starRank,
            value: starStep.current ? rankName(starStep.current, session.locale) : "—",
            small: true,
            href: "/student/daraja",
          },
          { icon: <IcoGrowthGold />, bare: false, label: t.rank, value: String(rangPos), href: "/student/reyting" },
        ].map((it) => {
          const inner = (
            <>
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
              {/* Pog'ona nomi bitta qatorga sig'maydi (masalan "Yangi boshlovchi")
                  — kesib tashlash o'rniga ikki qatorga bo'linadi. Plitkalar
                  grid ichida bo'lgani uchun balandligi baribir tenglashadi. */}
              <span
                className={
                  "w-full px-0.5 text-center font-extrabold text-slate-900 " +
                  (it.small
                    ? "line-clamp-2 text-[11.5px] leading-[13px]"
                    : "truncate text-[21px] leading-none")
                }
              >
                {it.value}
              </span>
            </>
          );
          const cls = `${card} flex flex-col items-center gap-2 rounded-[22px] px-1 pb-3 pt-3`;

          // Reyting bosilganda to'liq ro'yxat ochiladi, qolganlari oddiy karta
          return it.href ? (
            <Link key={it.label} href={it.href} className={`${cls} transition active:scale-[0.97]`}>
              {inner}
            </Link>
          ) : (
            <div key={it.label} className={cls}>{inner}</div>
          );
        })}
      </div>

      {/* ── Dars kunlari kalendari (joriy oy) ── */}
      {hasSchedule && (
        <LessonCalendar
          t={t}
          locale={session.locale}
          year={calY}
          month0={calM}
          todayISO={todayISO}
          lessonDays={new Set([...lessonDayMap.keys()].filter((iso) => iso.startsWith(`${calY}-${String(calM + 1).padStart(2, "0")}`)))}
          cardCls={card}
        />
      )}

      {/* ── Reklama banneri (Sozlamalar > Bosh sahifa) ── */}
      <BannerCarousel
        items={banners.map((b) => ({
          id: b.id, title: b.title, subtitle: b.subtitle, btnLabel: b.btnLabel,
          href: b.href, imageUrl: b.imageUrl, color: b.color,
        }))}
      />

      {/* ── Videos & Podcasts ── */}
      {lastThumb ? (
        // Oxirgi videoning rasmi butun kartani egallaydi. Matn pastda,
        // qora gradient ustida turadi — rasm qanday bo'lishidan qat'i nazar
        // oq harflar o'qiladi.
        <Link href="/student/videos" className={`${card} relative block overflow-hidden active:scale-[0.99]`}>
          <div className="relative aspect-[16/9] w-full bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lastThumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />

            <div className="absolute inset-x-0 bottom-0 p-5">
              <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-white">{t.videosPodcasts}</h2>
              <p className="mt-1 max-w-[85%] text-[13.5px] leading-snug text-white/80">{t.learnWithContent}</p>
              <span
                className="mt-3.5 inline-flex items-center gap-1 rounded-2xl px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
                style={{ background: TEAL }}
              >
                {t.discover}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
              </span>
            </div>
          </div>
        </Link>
      ) : (
        // Video yo'q — avvalgidek chizma
        <div className={`${card} relative overflow-hidden p-6`}>
          <div className="relative z-10 max-w-[58%]">
            <h2 className="text-[24px] font-extrabold leading-tight tracking-tight text-slate-900">{t.videosPodcasts}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{t.learnWithContent}</p>
            <Link href="/student/videos" className="mt-4 inline-flex items-center gap-1 rounded-2xl px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_16px_rgba(14,116,144,0.3)]" style={{ background: TEAL }}>
              {t.discover}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          </div>
          <div className="pointer-events-none absolute -right-2 top-1 z-0">
            <BigHeadphones w={96} />
          </div>
          <div className="pointer-events-none absolute bottom-3 right-14 z-0 rotate-[-10deg]">
            <Tablet w={70} />
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────── Dars jadvali komponentlari ─────────────────

const MONTHS: Record<string, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};
// Dushanbadan boshlab (kalendar ustunlari ham shu tartibda)
const WEEKDAYS_SHORT: Record<string, string[]> = {
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
};
const WEEKDAYS_FULL: Record<string, string[]> = {
  uz: ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"],
  ru: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
};
/** "YYYY-MM-DD" → dushanba=0 … yakshanba=6 */
function mondayIndex(iso: string): number {
  const d = new Date(iso + "T12:00:00");
  return (d.getDay() + 6) % 7;
}
function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO + "T12:00:00").getTime() - new Date(fromISO + "T12:00:00").getTime()) / 86_400_000);
}

/**
 * "Keyingi dars" banneri — kurs banneri ostidagi ikkinchi banner: qaysi kun
 * (Bugun / Ertaga / hafta kuni va sana), soat, xona, guruh. Jadval yo'q bo'lsa —
 * buni aytadigan yumshoq karta (bo'sh joy qolmaydi).
 */
function NextLessonBanner({ t, locale, todayISO, next, hasSchedule, cardCls, imageUrl }: {
  t: ReturnType<typeof S>;
  locale: string;
  todayISO: string;
  imageUrl?: string | null;
  next: { iso: string; group: string; startTime: string | null; endTime: string | null; room: string | null } | null;
  hasSchedule: boolean;
  cardCls: string;
}) {
  const L = MONTHS[locale] ? locale : "uz";
  if (!next) {
    return (
      <div className={`${cardCls} flex h-full min-h-[168px] items-center gap-4 rounded-[26px] p-5`}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "rgba(14,116,144,0.12)" }}>
          <IcoCalendar c={TEAL} s={26} />
        </span>
        <div className="min-w-0">
          <div className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: TEAL }}>{t.nextLessonTitle}</div>
          <div className="mt-0.5 text-[15px] font-bold text-slate-800">{t.noSchedule}</div>
          <div className="text-[12.5px] text-slate-500">{hasSchedule ? "" : t.noScheduleHint}</div>
        </div>
      </div>
    );
  }

  const diff = daysBetween(todayISO, next.iso);
  const d = new Date(next.iso + "T12:00:00");
  const dayLabel = diff === 0 ? t.today : diff === 1 ? t.tomorrow : WEEKDAYS_FULL[L][mondayIndex(next.iso)];
  const dateLabel = `${d.getDate()} ${MONTHS[L][d.getMonth()].toLowerCase()}`;
  const time = next.startTime ? `${next.startTime}${next.endTime ? `–${next.endTime}` : ""}` : null;

  const weekday = WEEKDAYS_FULL[L][mondayIndex(next.iso)];
  const NIGHT = "#0b1a33";
  // Shisha chip: vaqt / xona — chapda ko'k doira ichida belgi, o'ngda strelka
  const chip = "inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] py-[3px] pl-[3px] pr-2 text-[12px] font-semibold ring-1 ring-white/[0.14] backdrop-blur-sm";
  const chipIco = "grid h-6 w-6 shrink-0 place-items-center rounded-full shadow-[0_4px_10px_rgba(37,99,235,0.45)]";

  return (
    <div
      className="relative flex h-full min-h-[136px] flex-col overflow-hidden rounded-[24px] p-3.5 pb-6 text-white ring-1 ring-sky-400/40 shadow-[0_18px_44px_rgba(2,16,40,0.55),0_0_0_1px_rgba(56,189,248,0.12),inset_0_1px_0_rgba(255,255,255,0.12)]"
      style={{ background: `linear-gradient(135deg, ${NIGHT} 0%, #0d2149 55%, #0b3a7a 100%)` }}
    >
      {/* O'ng tomonda kurs rasmi — tun rangiga singib ketadi */}
      {imageUrl ? (
        <span
          className="pointer-events-none absolute inset-y-0 right-0 w-[58%]"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            WebkitMaskImage: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.9) 100%)",
            maskImage: "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.9) 100%)",
            filter: "saturate(0.6) brightness(0.55)",
            mixBlendMode: "luminosity",
          }}
        />
      ) : null}
      {/* Ko'k yorug'lik dog'lari */}
      <span
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.35) 0%, rgba(56,189,248,0) 65%)" }}
      />
      <span
        className="pointer-events-none absolute -bottom-28 right-10 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.45) 0%, rgba(37,99,235,0) 65%)" }}
      />
      {/* Pastdan o'tuvchi yorug' egri chiziq */}
      <svg className="pointer-events-none absolute bottom-0 right-0 h-[62%] w-[70%]" viewBox="0 0 300 120" fill="none" preserveAspectRatio="none" aria-hidden>
        <path d="M0 118 C 90 118, 150 40, 300 20" stroke="url(#glLine)" strokeWidth="2" />
        <circle cx="210" cy="61" r="4" fill="#38bdf8" />
        <defs>
          <linearGradient id="glLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="0.6" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#38bdf8" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* Yuqori qator: belgi + sarlavha + chiziq · guruh nomi */}
      <div className="relative flex items-center gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.08] ring-1 ring-white/[0.14]">
          <IcoCalendar c="#7dd3fc" s={13} />
        </span>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100/80">{t.nextLessonTitle}</span>
        <span className="h-px min-w-3 flex-1 bg-gradient-to-r from-white/25 to-transparent" />
        <span className="inline-flex max-w-[46%] items-center gap-1 rounded-full bg-white/[0.08] py-[3px] pl-2.5 pr-1.5 text-[11.5px] font-semibold ring-1 ring-white/[0.16] backdrop-blur-sm">
          <span className="truncate">{next.group}</span>
          <IcoChevron c="rgba(255,255,255,0.7)" s={13} />
        </span>
      </div>

      <div className="relative mt-2.5 flex flex-1 items-center gap-3">
        {/* Sana plitkasi — ko'k sarlavhali kalendar varag'i */}
        <div className="relative w-[62px] shrink-0 overflow-hidden rounded-[14px] bg-[#eef3ff] text-center shadow-[0_12px_28px_rgba(2,16,40,0.55),0_0_0_1px_rgba(56,189,248,0.35)]">
          <span
            className="block w-full py-[4px] text-[10px] font-extrabold uppercase tracking-[0.14em] text-white"
            style={{ background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)" }}
          >
            {WEEKDAYS_SHORT[L][mondayIndex(next.iso)]}
          </span>
          <span className="block pt-1 text-[27px] font-black leading-none tracking-tight" style={{ color: "#0b1a33" }}>{d.getDate()}</span>
          <span className="block pb-1.5 pt-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {MONTHS[L][d.getMonth()].slice(0, 3)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-hand text-[27px] font-bold leading-[0.95]">{dayLabel}</span>
            {diff > 1 && (
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11.5px] font-semibold text-sky-100/90 ring-1 ring-white/[0.14]">
                {fill(t.inDays, { n: diff })}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-sky-100/70">
            {diff > 1 ? dateLabel : `${weekday}, ${dateLabel}`}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {time && (
              <span className={chip}>
                <span className={chipIco} style={{ background: "linear-gradient(180deg,#3b82f6,#1d4ed8)" }}><IcoClock c="#ffffff" s={15} /></span>
                <span className="truncate">{time}</span>
                <IcoChevron c="rgba(255,255,255,0.6)" s={14} />
              </span>
            )}
            {next.room && (
              <span className={chip}>
                <span className={chipIco} style={{ background: "linear-gradient(180deg,#3b82f6,#1d4ed8)" }}><IcoPin c="#ffffff" s={15} /></span>
                <span className="max-w-[110px] truncate">{next.room}</span>
                <IcoChevron c="rgba(255,255,255,0.6)" s={14} />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Joriy oy kalendari — dars kunlari rangda: o'tganlari och, kelayotganlari
 * to'q feruza; bugun halqa bilan. Pastda izoh va oydagi darslar soni.
 */
function LessonCalendar({ t, locale, year, month0, todayISO, lessonDays, cardCls }: {
  t: ReturnType<typeof S>;
  locale: string;
  year: number;
  month0: number;
  todayISO: string;
  lessonDays: Set<string>;
  cardCls: string;
}) {
  const L = MONTHS[locale] ? locale : "uz";
  const first = new Date(year, month0, 1);
  const lead = (first.getDay() + 6) % 7; // dushanba = 0
  const total = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const iso = (day: number) => `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <div className={`${cardCls} rounded-[26px] p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(14,116,144,0.12)" }}>
            <IcoCalendar c={TEAL} s={22} />
          </span>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: TEAL }}>{t.lessonDays}</div>
            <div className="text-[17px] font-extrabold leading-tight text-slate-900">{MONTHS[L][month0]} {year}</div>
          </div>
        </div>
        <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: TEAL }}>
          {fill(t.lessonsInMonth, { n: lessonDays.size })}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS_SHORT[L].map((w, i) => (
          <span key={w} className={`text-[11px] font-bold uppercase ${i >= 5 ? "text-rose-400" : "text-slate-400"}`}>{w}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const dISO = iso(day);
          const isLesson = lessonDays.has(dISO);
          const isToday = dISO === todayISO;
          const past = dISO < todayISO;
          return (
            <span key={dISO} className="flex justify-center">
              <span
                className={
                  "grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold transition " +
                  (isLesson
                    ? past
                      ? "text-white/90"
                      : "text-white shadow-[0_6px_14px_rgba(14,116,144,0.35)]"
                    : past
                      ? "text-slate-300"
                      : "text-slate-700")
                }
                style={{
                  background: isLesson ? (past ? "rgba(14,116,144,0.45)" : TEAL) : "transparent",
                  boxShadow: isToday ? `0 0 0 2.5px #ffffff, 0 0 0 4.5px ${NAVY}` : undefined,
                }}
              >
                {day}
              </span>
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: TEAL }} /> {t.legendLesson}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: "rgba(14,116,144,0.45)" }} /> {t.legendPast}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ boxShadow: `0 0 0 2px ${NAVY}` }} /> {t.today}</span>
      </div>
    </div>
  );
}
