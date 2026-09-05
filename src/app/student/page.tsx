import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { S } from "./_i18n";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPortalFeatureOn } from "@/lib/portalFeatures";
import { getStudentProgress } from "@/lib/studentProgress";
import { getActiveLevels, levelTitle, matchLevel } from "@/lib/studyLevels";
import { coinBalance, starBalance } from "@/lib/coins";
import { studentRank } from "@/lib/rank";
import { getActiveStarRanks, progressOf, rankName } from "@/lib/starRanks";
import { getActiveBanners, getActiveVideos, videoThumb } from "@/lib/portalContent";
import BannerCarousel from "./BannerCarousel";
import { CARD, CoinGold, FlagAvatar, IcoBell, IcoBook, IcoFlame, INK, NAVY, Ring, TEAL, isAttended } from "./_ui";
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
        select: { groupId: true, group: { select: { id: true, name: true, levelCode: true, programId: true, program: { select: { name: true } } } } },
      },
    },
  });
  // Student yozuvi yo'q — /dashboard ga redirect AYLANISH hosil qiladi
  // (dashboard STUDENT ni yana shu yerga qaytaradi). Xabar ko'rsatamiz.
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  const [attendance, submissions, exams, prog, levels, mates, unread] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { markedAt: "desc" },
      select: { status: true },
      take: 200,
    }),
    prisma.submission.findMany({ where: { studentId: student.id, status: "GRADED" }, select: { score: true, assignment: { select: { maxScore: true } } } }),
    prisma.examResult.findMany({ where: { studentId: student.id }, select: { score: true } }),
    // Jarayon YAGONA joyda (src/lib/studentProgress.ts) — o'quvchi ko'rgan
    // darslar ham hisobga olinadi, faqat o'qituvchi belgilagani emas
    getStudentProgress(student.id, group),
    getActiveLevels(),
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
  // Kartochka JORIY daraja haqida gapiradi ("A1 · Bo'lim 3"), shuning uchun
  // foiz ham o'sha darajaniki bo'lishi kerak — butun dasturniki emas.
  const curLevel = matchLevel(group?.levelCode ?? student.currentLevel, levels);
  const level = curLevel?.code ?? group?.levelCode ?? student.currentLevel ?? "A1";
  const lvlStat = prog.byLevel.get(level) ?? null;
  const chapter = Math.max(1, lvlStat?.done ?? prog.doneCount);
  const kursPct = lvlStat?.pct ?? prog.overallPct;
  const sprechen = prog.overallPct; // "Gapirish" ko'nikmasi — butun dastur bo'yicha
  const currentLesson = prog.currentLesson;
  // Kartochka foni — shu darajaning banneri (ma'muriyat yuklagan bo'lsa)
  const levelBanner = curLevel?.bannerUrl ?? null;
  const levelName = curLevel ? levelTitle(curLevel, session.locale) : null;

  // ── Tanga / seriya ──
  // Hisob bitta joyda (src/lib/coins.ts) — Market va Sozlamalar bilan bir xil
  const notifOn = await isPortalFeatureOn("mitteilungen"); // o'chirilgan bo'lsa qo'ng'iroqcha yo'q
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
        {/* Shrift o'lchami bo'sh joyga qarab tanlangan: 360px ekranda ism
            uchun 220px qoladi (rasm 44 + bildirishnoma 44 + oraliqlar),
            16px extrabold da esa ~24 ta belgi sig'adi — eng uzun ism-familiya
            ham to'liq chiqadi, kesilmaydi. */}
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-extrabold leading-tight tracking-[-0.015em] text-slate-900 min-[380px]:text-[17px] sm:text-[19px]">
          {fullName}
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
            <div className="px-0.5 text-center text-[12px] font-semibold leading-[15px] text-slate-800">{sk.label}</div>
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
      <Link
        href={kurseHref}
        className={
          levelBanner
            ? "relative block min-h-[168px] overflow-hidden rounded-[26px] p-6 text-white shadow-[0_14px_30px_rgba(19,78,94,0.22)] transition active:scale-[0.985]"
            : "gl-glass-hero block min-h-[168px] p-6 transition active:scale-[0.985]"
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
              className="text-[12px] font-bold uppercase tracking-[0.22em]"
              style={levelBanner ? { color: "rgba(255,255,255,0.85)" } : { color: TEAL }}
            >
              {t.yourProgress}
            </div>
            <div className={
              levelBanner
                ? "font-hand mt-1.5 text-[32px] font-bold leading-[1.05] sm:text-[38px]"
                : "font-hand mt-1.5 text-[32px] font-bold leading-[1.05] text-slate-900 sm:text-[38px]"
            }>
              {levelName ?? level}
            </div>
            <div className={levelBanner ? "mt-0.5 text-[14px] font-semibold text-white/85" : "mt-0.5 text-[14px] font-semibold text-slate-700"}>
              {level} · {t.chapter} {chapter}
            </div>
            <div className={levelBanner ? "mt-1 line-clamp-2 text-[14px] text-white/75" : "mt-1 line-clamp-2 text-[14px] font-medium text-slate-700"}>
              {currentLesson?.topic || currentLesson?.title || group?.program.name || t.everydayBasics}
            </div>
          </div>
          <div className="relative grid shrink-0 place-items-center">
            <Ring pct={kursPct} size={96} stroke={6} color={levelBanner ? "#ffffff" : NAVY} />
            <span
              className="absolute grid h-[66px] w-[66px] place-items-center rounded-full shadow-[0_4px_12px_rgba(19,78,94,0.15)]"
              style={{ background: levelBanner ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)" }}
            >
              <IcoTarget c={NAVY} s={38} />
            </span>
          </div>
        </div>
        <div className="relative mt-4 flex items-center gap-3">
          <div className={
            levelBanner
              ? "h-[10px] flex-1 overflow-hidden rounded-full bg-white/30"
              : "h-[10px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]"
          }>
            <div className="h-full rounded-full" style={{ width: `${kursPct}%`, background: levelBanner ? "#ffffff" : NAVY }} />
          </div>
          <span className="text-[20px] font-extrabold" style={{ color: levelBanner ? "#ffffff" : NAVY }}>{kursPct}%</span>
        </div>
      </Link>

      {/* ── Tanga · Yulduz · Seriya · Reyting ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          // Tanga — doira ichidagi belgi emas, tanganing o'zi (shu sabab `bare`)
          { icon: <CoinGold s={46} />, bare: true, label: t.coins, value: String(coins) },
          { icon: <IcoStarGold />, bare: false, label: t.stars, value: String(stars) },
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
