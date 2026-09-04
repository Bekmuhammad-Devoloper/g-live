import Link from "next/link";
import { S, type StudentStrings } from "../../_i18n";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MissingStudent from "../../MissingStudent";
import { getActiveLevels, levelTitle } from "@/lib/studyLevels";
import HeaderBadges from "../../HeaderBadges";
import { CoinGold, NAVY, TEAL } from "../../_ui";

// ═══════════════════════════════════════════════════════════════════════
// DARAJA ICHI — "po'stloq burmasi" (Kortex)
// ───────────────────────────────────────────────────────────────────────
// Miya po'stlog'i — o'z ustiga qayta-qayta buklangan BITTA uzluksiz lenta.
// Darslar zigzagi ham aynan shu shakl. Shu sabab bu yerda miya ikonka
// sifatida chizilmaydi (u kichik o'lchamda multfilmga aylanadi) — u
// UCHTA joyda, uch xil miqyosda ishlaydi:
//
//   1) FON — orqada haqiqiy sagittal po'stloq konturi (0.11 shaffoflik).
//      Miya AYNAN o'sha o'lchamda o'qiladi, kichkina kafelda emas.
//   2) YO'L — tugunlar orasidagi chiziq bitta uzluksiz burma: o'tilgan
//      qismi yo'g'on va feruza (miyelinlangan), qolgani ingichka va och.
//   3) TUGUN — har bir dars = soma: nosimmetrik, birorta to'g'ri qirrasi
//      yo'q shakl + ichida ikkita burma (vodiy + yorug' qirra). Burma —
//      miyaning eng tanib olinadigan belgisi, konturdan ham kuchliroq.
//
// Nega bu bezak emas: ilovada allaqachon "Gehirn / ikkinchi miya" bilim
// grafi bor (gehirn/graph/BrainGraph.tsx). Yo'l oxiridagi uzuq konturli
// bo'sh doira — o'sha grafdagi "hali yaratilmagan tugun" belgisining
// AYNAN o'zi: o'quvchi bu belgini boshqa ekranda o'rgangan.
//
// RANG QOIDASI: oltin = MUKOFOT, shuning uchun butun yo'lda oltin faqat
// daraja 100% bo'lganda paydo bo'ladi (yakun kartasi + yo'l dumi).
// O'tilgan darslar feruza-navy: og'ir, tugallangan, orqaga chekinadi.
// Matn hech qachon xiralashtirilmaydi — faqat GRAFIKA xira bo'ladi.
// Eng och matn ham slate-600 (6.7:1) yoki NAVY (8.1:1).
// ═══════════════════════════════════════════════════════════════════════

const UNITS_PER_CHAPTER = 3; // Unit 1.1 · 1.2 · 1.3 → keyin 2.1 ...

// ── Rels (barcha koordinata shu to'rtta sondan chiqadi) ──
const RAIL = 320; // yo'l ustuni kengligi, px va SVG birligi 1:1
const NODE = 104; // tugun qutisi (soma 96 + halqa uchun 4px chekka)
const PITCH = 136; // qator balandligi = ikki tugun markazi orasi
const Y0 = 52; // birinchi tugun markazi
const COL = [74, 246] as const; // chap / o'ng ustun markazlari
const TAIL = 90; // oxirgi tugundan yakun belgisigacha

const cxOf = (i: number) => COL[i % 2];
const cyOf = (i: number) => Y0 + i * PITCH;

const CYAN = "#17a2bf"; // ICON_GRADIENT ning och uchi
const GOLD = "#ef9f21";
const GOLD_LIGHT = "#fbc63f";

type NodeState = "done" | "current" | "upcoming";

/* ═══════════════ Soma — dars tuguni ═══════════════ */

// Yopiq Catmull-Rom halqa: 7 ta tayanch nuqta, burchaklari ham radiuslari
// ham har xil — shuning uchun na doira, na kvadrat, na simmetriya o'qi bor.
// O'lchangan chegara: x 6.75…90.56, y 5.29…90.52 (96 lik qutida).
const SOMA =
  "M42 5.4C54 4.4 73.7 9.3 81.8 17.6C89.9 25.8 92.1 42.5 89.6 53.8C87.1 65.2 77.6 78.4 67.2 84.2C56.9 90 38.5 93 28.5 88C18.5 83 11.5 65.9 8.6 54.9C5.7 44 5.8 31.8 11.5 23.4C17.2 15 30.1 6.4 42 5.4Z";

// Ikki burma. Har biri ikki chiziqdan: VODIY (to'q, chuqurlik) va undan
// 2.4px siljigan QIRRA (yorug', tepalik) — hajm shundan chiqadi.
// O'lchangan: ikkalasi ham somaning ichida (eng yaqin chekka 4.1px) va
// markazdagi raqam maydonini (x 30…66, y 27…69) kesib o'tmaydi.
const GYRUS_A = "M13 47C17 28 33 15 51 15C63 15 71 21 75 31";
const GYRUS_A_RIDGE = "M15.4 49.6C19.4 30.6 35.4 17.6 53.4 17.6C65.4 17.6 73.4 23.6 77.4 33.6";
const GYRUS_B = "M21 62C27 78 45 86 62 81C72 78 79 70 81 59";
const GYRUS_B_RIDGE = "M22.6 59.6C28.6 75.6 46.6 83.6 63.6 78.6C73.6 75.6 80.6 67.6 82.6 56.6";
// Qirra yorug'ligi — shishaning "ho'l" akslanishi, konturdan 8.2px ichkarida.
const GLINT = "M20 34C25 21 38 13 52 14";

// Markaz (48,48) atrofida kattalashtirish — "joriy" tugun halqasi uchun.
const about = (k: number) => `translate(48,48) scale(${k}) translate(-48,-48)`;

function Soma({ state }: { state: NodeState }) {
  const done = state === "done";
  const cur = state === "current";

  const fill = done ? "url(#glSomaDone)" : cur ? "url(#glSomaNow)" : "url(#glSomaNext)";
  const valley = done ? "#06323f" : cur ? TEAL : TEAL;
  const valleyOp = done ? 0.42 : cur ? 0.26 : 0.16;
  const ridge = done ? "#8fe0f2" : "#ffffff";
  const ridgeOp = done ? 0.34 : cur ? 0.85 : 0.75;

  return (
    // viewBox 96 lik shaklga 4px chekka qo'shadi: 1.12 kattalashgan halqa
    // (o'lchangan chegara 1.80…95.66) shu chekkaga sig'adi.
    <svg width={NODE} height={NODE} viewBox="-4 -4 104 104" className="block" aria-hidden>
      {/* joriy tugun atrofidagi halqa — AYNAN soma shaklida, doira emas */}
      {cur && (
        <path d={SOMA} fill="none" stroke={CYAN} strokeOpacity="0.4" strokeWidth="2.2" transform={about(1.12)} />
      )}

      <path
        d={SOMA}
        fill={fill}
        stroke={done ? "rgba(255,255,255,0.72)" : cur ? NAVY : "url(#glRim)"}
        strokeOpacity={cur ? 0.92 : 1}
        strokeWidth={done ? 1.8 : cur ? 2.6 : 1.4}
        strokeLinejoin="round"
      />
      {/* joriy tugunda ichki yorug'lik chizig'i — shisha qirrasi (gl-glass::before) */}
      {cur && <path d={SOMA} fill="none" stroke="url(#glRim)" strokeWidth="1.3" transform={about(0.955)} />}

      <g fill="none" strokeLinecap="round">
        <path d={GYRUS_A} stroke={valley} strokeOpacity={valleyOp} strokeWidth="2.2" />
        <path d={GYRUS_A_RIDGE} stroke={ridge} strokeOpacity={ridgeOp} strokeWidth="1.2" />
        <path d={GYRUS_B} stroke={valley} strokeOpacity={valleyOp} strokeWidth="2.2" />
        <path d={GYRUS_B_RIDGE} stroke={ridge} strokeOpacity={ridgeOp} strokeWidth="1.2" />
        <path d={GLINT} stroke="#ffffff" strokeOpacity={done ? 0.3 : 0.92} strokeWidth="2.6" />
      </g>

      {/* Qirradagi muhr: rangdan MUSTAQIL belgi — rang ko'rmaydigan
          o'quvchi ham holatni shakl orqali ajratadi.
          (78,17) o'lchangan: konturdan 2.1px ichkarida — muhr qirraga minadi. */}
      {done && (
        <g>
          <circle cx="78" cy="17" r="13" fill="#ffffff" stroke={TEAL} strokeOpacity="0.25" strokeWidth="1.4" />
          <path
            d="M72 17.4 76.4 21.8 84.6 12.6"
            fill="none"
            stroke={TEAL}
            strokeWidth="3.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      {cur && (
        <g>
          <circle cx="78" cy="17" r="13" fill={NAVY} stroke="#ffffff" strokeWidth="2" />
          <path d="M74.4 11.4 84.2 17 74.4 22.6Z" fill="#ffffff" />
        </g>
      )}
    </svg>
  );
}

/* ═══════════════ Bo'yoq manbalari — sahifada BIR marta ═══════════════ */

// Barcha gradientlar bitta yashirin <svg> da: 12 ta dars bo'lsa ham
// brauzer 6 ta bo'yoq manbasini yaratadi, 72 tasini emas.
// `display:none` ATAYLAB ishlatilmaydi — eski WebView'da yashirilgan
// element ichidagi gradientga havola uzilib qoladi.
function BrainDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute h-0 w-0 overflow-hidden">
      <defs>
        {/* O'tilgan: to'q feruza→navy. Raqam gradientning ~0.5 nuqtasida
            turadi (#0e7490 atrofi) — oq matn 5.36:1, AA ✓ */}
        <linearGradient id="glSomaDone" x1="0.12" y1="0" x2="0.82" y2="1">
          <stop offset="0%" stopColor="#1fa6c0" />
          <stop offset="46%" stopColor={TEAL} />
          <stop offset="100%" stopColor="#123f4d" />
        </linearGradient>

        {/* Joriy va navbatdagi — SHISHA, lekin backdrop-filter siz.
            Qiymatlar globals.css `.gl-glass` dan bir xil ko'chirilgan
            (142deg, 0.54/0.24/0.17/0.36). Silliq ambient gradient ustida
            blur ko'zga ilinmaydi (globals.css ning o'zi shuni yozadi),
            shuning uchun N ta dars = N ta blur qatlami emas, N ta arzon
            bo'yash. Butun ekranda blur faqat shisha kartalarda qoladi. */}
        <linearGradient id="glSomaNow" x1="0.1" y1="0" x2="0.78" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.74" />
          <stop offset="34%" stopColor="#ffffff" stopOpacity="0.46" />
          <stop offset="63%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id="glSomaNext" x1="0.1" y1="0" x2="0.78" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.52" />
          <stop offset="34%" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="63%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.36" />
        </linearGradient>
        {/* Qirra — `.gl-glass::before` (150deg) ning aynan o'zi */}
        <linearGradient id="glRim" x1="0.12" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="36%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="62%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0.34" />
        </linearGradient>

        {/* Yongan burma */}
        <linearGradient id="glLit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CYAN} />
          <stop offset="100%" stopColor={TEAL} />
        </linearGradient>

        {/* Tugun ostidagi tegish soyasi. ATAYLAB bo'yalgan radial gradient,
            CSS `filter: drop-shadow` emas: filtr ajdodda Backdrop Root
            yaratadi va yonidagi shisha kartaning backdrop-filter'ini
            o'ldiradi. Bo'yalgan ellips esa fonning o'ziga tushadi. */}
        <radialGradient id="glContact" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={NAVY} stopOpacity="0.2" />
          <stop offset="60%" stopColor={NAVY} stopOpacity="0.09" />
          <stop offset="100%" stopColor={NAVY} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════ Fon: sagittal po'stloq ═══════════════ */

// Bulut va yulduzchalar o'rniga. Ular `top-[420px]` kabi qattiq
// koordinatalarda turgani uchun 2 darsli sahifada bo'sh joyda osilib
// qolardi. Bu esa yo'lning O'Z SVG'i ichida: yo'l qayerda boshlansa,
// po'stloq ham o'sha yerda.
//
// #134e5e 11% da sadaf fon ustida ~19 pog'ona farq beradi: qaraganda
// topasan, o'qiyotganda xalaqit bermaydi. O'lchangan: barcha egatlar
// (sulci) konturning ichida, eng yaqini 10.2px.
const SULCI = [
  "M68 62C92 76 100 104 88 128",
  "M104 44C132 62 142 96 126 124",
  "M148 34C178 52 190 88 172 122",
  "M194 34C224 54 236 92 216 126",
  "M240 50C266 72 272 106 252 132",
  "M58 112C80 122 96 138 100 156",
  "M112 138C136 146 156 158 164 172",
];

function Cortex({ lit }: { lit: boolean }) {
  const c = lit ? TEAL : NAVY;
  return (
    <g fill="none" stroke={c} strokeLinecap="round" strokeLinejoin="round">
      {/* katta yarim shar */}
      <path
        strokeOpacity={lit ? 0.13 : 0.11}
        strokeWidth="1.9"
        d="M26 132C10 100 26 58 68 34C110 10 178 6 226 22C274 38 302 74 298 112C294 148 268 170 232 178C196 186 152 184 116 174C78 163 40 158 26 132Z"
      />
      {/* miyacha */}
      <path
        strokeOpacity={lit ? 0.11 : 0.095}
        strokeWidth="1.7"
        d="M232 176C262 172 288 184 288 200C288 214 264 222 240 216C222 211 214 196 222 182"
      />
      {/* miya sopi */}
      <path strokeOpacity={lit ? 0.11 : 0.095} strokeWidth="1.7" d="M208 180C208 198 202 214 192 226" />
      {/* egatlar */}
      <g strokeOpacity={lit ? 0.085 : 0.07} strokeWidth="1.5">
        {SULCI.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </g>
  );
}

/* ═══════════════ Burma: tugunlarni bog'lovchi lenta ═══════════════ */

// BITTA `d` satri — bo'laklarga bo'lingan emas. Shu sabab "o'tilgan"
// qism strokeDasharray bilan emas, AYNAN SHU egri chiziqning prefiksi
// bilan chiziladi: uzunlikni o'lchash (getTotalLength → faqat brauzerda)
// kerak emas va yorug' uch hech qachon "sirg'anib" ketmaydi.
function foldPath(from: number, to: number): string {
  let d = `M${cxOf(from)} ${cyOf(from)}`;
  for (let i = from + 1; i <= to; i++) {
    const a = cxOf(i - 1);
    const b = cxOf(i);
    const y = cyOf(i - 1);
    d += `C${a} ${y + 56} ${b} ${y + 84} ${b} ${cyOf(i)}`;
  }
  return d;
}

// Tugundan tashqariga chiqadigan uchta ipsimon dendrit. Ildizlari somaning
// ICHIDAN boshlanadi (o'lchangan: konturdan 1.0–2.7px ichkarida), shuning
// uchun ular yopishtirilgan emas, o'sib chiqqandek ko'rinadi.
function dendrites(i: number): Array<[string, number, number]> {
  const x = cxOf(i);
  const y = cyOf(i);
  const s = i % 2 === 0 ? -1 : 1; // ustunning TASHQI tomoni (matn ichkarida)
  return [
    [`M${x + s * 32} ${y - 26}C${x + s * 44} ${y - 34} ${x + s * 53} ${y - 38} ${x + s * 58} ${y - 44}`, x + s * 58, y - 44],
    [`M${x + s * 40} ${y - 2}C${x + s * 54} ${y - 4} ${x + s * 62} ${y - 10} ${x + s * 70} ${y - 18}`, x + s * 70, y - 18],
    [`M${x + s * 30} ${y + 24}C${x + s * 42} ${y + 34} ${x + s * 50} ${y + 42} ${x + s * 52} ${y + 52}`, x + s * 52, y + 52],
  ];
}

/* ═══════════════ Yo'l yakuni ═══════════════ */

// Ilgari oxirgi kafeldan keyin yo'l shunchaki UZILARDI va ekranning ~70%
// bo'sh qolardi. Endi yo'l tugamaydi — INGICHKALASHADI: yo'g'on chiziq →
// och chiziq → nuqtali dum → uzuq konturli bo'sh tugun. So'nggi belgi
// BrainGraph dagi "hali yaratilmagan tugun" ning aynan o'zi.
function FinishCap({ allDone, t }: { allDone: boolean; t: StudentStrings }) {
  return (
    <div className="gl-glass mx-auto mt-3 flex max-w-[320px] items-center gap-3.5 rounded-[26px] px-4 py-4">
      <span className="grid h-[54px] w-[54px] shrink-0 place-items-center">
        {allDone ? (
          <CoinGold s={50} />
        ) : (
          <svg width="54" height="54" viewBox="-4 -4 104 104" aria-hidden>
            <circle cx="48" cy="48" r="49" fill="rgba(255,255,255,0.5)" stroke={NAVY} strokeOpacity="0.28" strokeWidth="1.8" strokeDasharray="4 5" />
            <path d={SOMA} fill="none" stroke={NAVY} strokeOpacity="0.4" strokeWidth="2.4" transform={about(0.66)} />
            <path d={GYRUS_A} fill="none" stroke={NAVY} strokeOpacity="0.3" strokeWidth="2.4" strokeLinecap="round" transform={about(0.66)} />
            <path d={GYRUS_B} fill="none" stroke={NAVY} strokeOpacity="0.3" strokeWidth="2.4" strokeLinecap="round" transform={about(0.66)} />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-extrabold leading-tight text-slate-900">
          {allDone ? t.levelFinished : t.levelFinish}
        </div>
        {!allDone && <p className="mt-1 text-[12px] font-medium leading-snug text-slate-600">{t.levelFinishHint}</p>}
      </div>
    </div>
  );
}

function IcoBack({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </svg>
  );
}

/* ═══════════════ Sahifa ═══════════════ */

export default async function StudentLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const code = level.toUpperCase();
  const levels = await getActiveLevels();
  const lvl = levels.find((l) => l.code.toUpperCase() === code);
  if (!lvl) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  const t = S(session.locale);

  const student = await prisma.student.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      currentLevel: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { id: true, levelCode: true, programId: true } } },
      },
    },
  });
  if (!student) return <MissingStudent />;

  const group = student.enrollments[0]?.group ?? null;

  const [allLessons, progress] = await Promise.all([
    group
      ? prisma.courseLesson.findMany({
          where: { programId: group.programId },
          orderBy: { order: "asc" },
          select: { id: true, order: true, levelCode: true, title: true },
        })
      : Promise.resolve([]),
    group
      ? prisma.groupLessonProgress.findMany({ where: { groupId: group.id, taught: true }, select: { courseLessonId: true } })
      : Promise.resolve([]),
  ]);

  const fallback = (group?.levelCode ?? student.currentLevel ?? "A1").slice(0, 2).toUpperCase();
  const lessons = allLessons.filter((l) => (l.levelCode ?? fallback).toUpperCase() === code);
  const taught = new Set(progress.map((p) => p.courseLessonId));

  const n = lessons.length;
  const doneCount = lessons.filter((l) => taught.has(l.id)).length;
  // Joriy dars — o'tilmaganlarning birinchisi (hammasi o'tilgan bo'lsa -1)
  const currentIdx = lessons.findIndex((l) => !taught.has(l.id));
  const pct = n ? Math.round((doneCount / n) * 100) : 0;
  const allDone = n > 0 && doneCount === n;

  // Yonadigan burma — 0 dan ketma-ket o'tilgan OXIRGI darsgacha.
  // `taught` uzuq bo'lsa (3-dars o'tilgan, 2-si yo'q) chiziq shu yerda
  // to'xtaydi, 3-tugun esa baribir "o'tilgan" bo'lib chiziladi: bu
  // g'alati ma'lumotni yashirish emas, rostini ko'rsatish.
  const lastDone = currentIdx === -1 ? n - 1 : currentIdx - 1;

  const H = (n - 1) * PITCH + 155;
  const lastI = n - 1;
  const tailX = cxOf(lastI);
  const tailY = cyOf(lastI);
  const dir = lastI % 2 === 0 ? 1 : -1; // dum HAR DOIM markazga qarab ketadi
  const endX = tailX + dir * 48;
  const endY = tailY + TAIL;

  return (
    <div>
      <BrainDefs />

      {/* ── Yuqori qator ──
          Binafsha yo'q: sarlavha slate-900, orqaga o'qi TEAL (_ui.tsx dagi
          PageHeader bilan aynan bir xil). Darajaning O'Z rangi (lvl.color)
          faqat kichik nishonda qoladi — daraja identifikatori shu, lekin u
          endi sarlavhani bo'yamaydi. Oltita standart daraja rangining
          hammasida oq matn kontrasti 5.0:1 dan yuqori (o'lchangan). */}
      <div className="flex items-center gap-2.5 pt-1">
        <Link href="/student/kurse" aria-label={t.back} className="gl-glass grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <IcoBack />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-tight text-slate-900">
            {levelTitle(lvl, session.locale)}
          </h1>
          <p className="mt-[3px] flex items-center gap-1.5">
            <span
              className="shrink-0 rounded-md px-1.5 py-[1.5px] text-[10px] font-extrabold leading-none tracking-[0.06em] text-white"
              style={{ background: lvl.color }}
            >
              {lvl.code}
            </span>
            {n > 0 && (
              <span className="truncate text-[11.5px] font-semibold text-slate-600">
                {doneCount} / {n} {t.pathProgress}
              </span>
            )}
          </p>
        </div>
        <HeaderBadges />
      </div>

      {/* ── Daraja jarayoni: sahifa darajasidagi YAGONA foiz ──
          Har kafeldagi ma'nosiz "0%" o'rniga bitta rost javob. Oltin
          faqat 100% da — mukofot ranggi shunda ishlaydi. */}
      {n > 0 && (
        <div className="mt-3.5 flex items-center gap-2.5">
          <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: pct === 0 ? "0%" : `${Math.max(pct, 6)}%`,
                background: allDone
                  ? `linear-gradient(90deg, ${GOLD_LIGHT}, ${GOLD})`
                  : `linear-gradient(90deg, ${CYAN}, ${TEAL})`,
              }}
            />
          </div>
          <span className="text-[13px] font-extrabold tabular-nums" style={{ color: NAVY }}>
            {pct}%
          </span>
        </div>
      )}

      {/* ── Darslar yo'li ── */}
      {n === 0 ? (
        <div className="gl-glass mt-8 rounded-[26px] px-5 py-11 text-center">
          <svg width="62" height="62" viewBox="-4 -4 104 104" className="mx-auto mb-3" aria-hidden>
            <path d={SOMA} fill="url(#glSomaNext)" stroke="url(#glRim)" strokeWidth="1.6" />
            <path d={GYRUS_A} fill="none" stroke={TEAL} strokeOpacity="0.2" strokeWidth="2.2" strokeLinecap="round" />
            <path d={GYRUS_B} fill="none" stroke={TEAL} strokeOpacity="0.2" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <div className="text-[15px] font-bold text-slate-800">{t.noLessons}</div>
          <p className="mt-1 text-[12.5px] font-medium text-slate-600">{t.teacherAdds}</p>
        </div>
      ) : (
        // -mx-4 — yo'l ustuni telefonning to'liq enini oladi, keyin 320px
        // qilib markazlashtiriladi. 360px ekranda ikki yonda 20px bo'shliq.
        <section className="relative -mx-4 mt-5 overflow-hidden">
          <div className="relative mx-auto" style={{ width: RAIL, height: H }}>
            {/* ── Bitta fon SVG: po'stloq + dendritlar + soya + burma + dum ──
                Hech qanday filtr, hech qanday blur, hech qanday animatsiya:
                bir marta bo'yaladi, keyin skrollda faqat kompozit qilinadi. */}
            <svg
              width={RAIL}
              height={H}
              viewBox={`0 0 ${RAIL} ${H}`}
              className="pointer-events-none absolute inset-0"
              aria-hidden
            >
              <Cortex lit={allDone} />

              {lessons.map((lesson, i) => {
                const st: NodeState = taught.has(lesson.id) ? "done" : i === currentIdx ? "current" : "upcoming";
                const col = st === "done" ? TEAL : NAVY;
                const op = st === "done" ? 0.28 : st === "current" ? 0.2 : 0.1;
                return (
                  <g key={`d-${lesson.id}`} fill="none" stroke={col} strokeOpacity={op} strokeWidth={st === "done" ? 1.3 : 1.1} strokeLinecap="round">
                    {dendrites(i).map(([d, tx, ty]) => (
                      <g key={d}>
                        <path d={d} />
                        <circle cx={tx} cy={ty} r="1.7" fill={col} fillOpacity={op + 0.08} stroke="none" />
                      </g>
                    ))}
                  </g>
                );
              })}

              {lessons.map((lesson, i) => (
                <ellipse key={`s-${lesson.id}`} cx={cxOf(i)} cy={cyOf(i) + 46} rx="40" ry="10" fill="url(#glContact)" />
              ))}

              {/* butun burma — doim uzluksiz */}
              {n > 1 && <path d={foldPath(0, n - 1)} fill="none" stroke={NAVY} strokeOpacity="0.16" strokeWidth="3" strokeLinecap="round" />}

              {/* miyelinlangan qism — xuddi shu egri chiziqning prefiksi */}
              {lastDone > 0 && (
                <path d={foldPath(0, lastDone)} fill="none" stroke="url(#glLit)" strokeWidth="3.4" strokeLinecap="round" />
              )}

              {/* signal joriy darsga YETIB KELMOQDA: bitta bo'lakning 52%i.
                  `pathLength={100}` uzunlikni foizga keltiradi — bo'lak
                  qanchalik uzun bo'lishidan qat'i nazar bir xil chiqadi. */}
              {lastDone >= 0 && lastDone + 1 < n && (
                <path
                  d={foldPath(lastDone, lastDone + 1)}
                  fill="none"
                  stroke="url(#glLit)"
                  strokeOpacity="0.5"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="52 100"
                />
              )}

              {/* dum — yo'l uzilmaydi, ingichkalashadi */}
              <path
                d={`M${tailX} ${tailY}C${tailX} ${tailY + 50} ${tailX + dir * 40} ${tailY + 58} ${endX} ${endY}`}
                fill="none"
                stroke={allDone ? GOLD : NAVY}
                strokeOpacity={allDone ? 0.5 : 0.2}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeDasharray="1 9"
              />
              {/* BrainGraph dagi "hali yaratilmagan tugun" belgisi */}
              <circle
                cx={endX}
                cy={endY}
                r="9"
                fill="#ffffff"
                fillOpacity="0.55"
                stroke={allDone ? GOLD : "#94a3b8"}
                strokeWidth="1.8"
                strokeDasharray={allDone ? undefined : "3 3"}
              />
            </svg>

            {/* ── Qatorlar ── */}
            {lessons.map((lesson, i) => {
              const right = i % 2 === 1;
              const chapter = Math.floor(i / UNITS_PER_CHAPTER) + 1;
              const inChapter = (i % UNITS_PER_CHAPTER) + 1;
              const st: NodeState = taught.has(lesson.id) ? "done" : i === currentIdx ? "current" : "upcoming";

              return (
                <div key={lesson.id} className="relative" style={{ height: PITCH }}>
                  {/* Nishon = butun qator eni × 104px. Bosiladigan maydonga
                      tugun ham, dars nomi ham kiradi — 44×44 dan ancha katta,
                      va ekran o'quvchisi uchun havolaning nomi dars nomining
                      o'zi bo'ladi (aria-label takrorlash shart emas). */}
                  <Link
                    href={`/student/kurse/${code}/${lesson.id}`}
                    aria-current={st === "current" ? "step" : undefined}
                    className="absolute inset-x-0 top-0 block h-[104px] transition-transform duration-150 active:scale-[0.975]"
                  >
                    <span className={`absolute top-0 block ${right ? "left-[194px]" : "left-[22px]"}`}>
                      {/* Joriy tugun "yonib turadi". transform + opacity —
                          kompozitorda ishlaydi, qayta bo'yash yo'q.
                          1s emas, 2.6s: bu tinch nafas, asabiy miltillash emas. */}
                      {st === "current" && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-1/2 top-1/2 h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#17a2bf]/20 motion-safe:animate-ping"
                          style={{ animationDuration: "2.6s" }}
                        />
                      )}
                      <Soma state={st} />
                      {/* Raqam HTML matn: ilova shrifti, aniq va o'lchamga
                          moslashuvchan. "Unit" so'zi olib tashlandi — u
                          tarjima qilinmagan yagona so'z edi; holat nomi
                          yonidagi izohda, tarjimasi bilan turibdi. */}
                      <span
                        className="pointer-events-none absolute inset-0 grid place-items-center text-[25px] font-extrabold leading-none tracking-tight"
                        style={{ color: st === "done" ? "#ffffff" : st === "current" ? NAVY : "#334155" }}
                      >
                        {chapter}.{inChapter}
                      </span>
                    </span>

                    <span
                      className={`absolute top-1/2 flex w-[180px] -translate-y-1/2 flex-col ${
                        right ? "left-[4px] items-end text-right" : "left-[136px] items-start text-left"
                      }`}
                    >
                      {st === "current" ? (
                        <span
                          className="rounded-full px-2 py-[3px] text-[9.5px] font-extrabold uppercase leading-none tracking-[0.14em]"
                          style={{ color: NAVY, background: "rgba(14,116,144,0.13)" }}
                        >
                          {t.pathCurrent}
                        </span>
                      ) : (
                        <span
                          className="text-[9.5px] font-extrabold uppercase leading-none tracking-[0.16em]"
                          style={{ color: st === "done" ? NAVY : "#475569" }}
                        >
                          {st === "done" ? t.pathDone : t.pathUpcoming}
                        </span>
                      )}
                      {/* Dars nomi ilgari faqat `title` atributida edi —
                          telefonda hover yo'q, ya'ni u umuman ko'rinmasdi. */}
                      <span
                        className={`mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-[1.28] ${
                          st === "upcoming" ? "text-slate-600" : "text-slate-800"
                        }`}
                      >
                        {lesson.title}
                      </span>
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>

          <FinishCap allDone={allDone} t={t} />
        </section>
      )}
    </div>
  );
}
