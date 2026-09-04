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
// DARAJA ICHI — NEYRON YO'LI
// ───────────────────────────────────────────────────────────────────────
// Ilovada allaqachon "Gehirn / ikkinchi miya" bilim grafi bor
// (gehirn/graph/BrainGraph.tsx): tugunlar va ular orasidagi bog'lanishlar.
// Bu sahifa — o'sha tarmoq ichidagi BITTA yo'l. Shuning uchun bu yerda
// miya ikonka qilib chizilmaydi; miyaning O'ZI to'g'ri anatomiya bilan
// quriladi:
//
//   dendrit  →  soma (yadro bilan)  →  akson  →  sinaps
//
//   • TUGUN — nerv hujayrasi tanasi (soma): nosimmetrik, birorta to'g'ri
//     qirrasi yo'q kontur + ichida YADRO. Dars raqami yadro ichida turadi:
//     yadro hujayraning kimligini saqlaydi, raqam esa darsning kimligini.
//   • YO'L — akson: o'tilgan qismi yo'g'on, feruza va atrofida yumshoq
//     miyelin nuri; qolgani ingichka va och. Joriy darsga boradigan bo'lak
//     yarim yo'lda uzilib turadi — signal HALI yetib bormoqda.
//   • BO'SH YARIM — kollateral (aksonning yon shoxi). Bulut va yulduzcha
//     emas: AYNAN o'sha anatomiya, va u dars sonidan kelib chiqadi, ya'ni
//     hech qachon "tugab qolmaydi".
//   • YAKUN — uzuq konturli bo'sh doira. Bu BrainGraph dagi "hali
//     yaratilmagan tugun" belgisining aynan o'zi: o'quvchi bu belgini
//     boshqa ekranda ko'rgan, izohsiz tushunadi.
//
// NEGA TO'LIQ MIYA SILUETI CHIZILMADI: sinab ko'rildi — 96px li tugunda
// ham, fondagi suv belgisida ham u yo multfilmga, yo chig'anoqqa aylanadi.
// Neyron esa aynan shu o'lchamda aniq o'qiladi va konseptual jihatdan
// to'g'riroq: yo'l — bu miyaning o'zi emas, miya ICHIDAGI yo'l.
//
// RANG QOIDASI: oltin = MUKOFOT. Shuning uchun yo'lda oltin faqat daraja
// 100% bo'lganda chiqadi (jarayon chizig'i + dum + yakun kartasi).
// O'tilgan darslar to'q feruza-navy: og'ir, tugallangan, ko'zni tortmaydi.
// GRAFIKA xiralashadi, MATN hech qachon: eng och matn ham slate-600
// (6.7:1) yoki NAVY (8.1:1).
// ═══════════════════════════════════════════════════════════════════════

const UNITS_PER_CHAPTER = 3; // Unit 1.1 · 1.2 · 1.3 → keyin 2.1 ...

// ── O'lchov tayanchi: butun geometriya shu oltita sondan chiqadi ──
const RAIL = 320; // yo'l ustuni kengligi. SVG birligi = px (1:1), shuning
//                   uchun chiziqlar DPR 2/3 da ham tiniq qoladi.
const NODE = 104; // tugun qutisi (soma 96 + halqa uchun 4px chekka)
const PITCH = 136; // qator balandligi = ikki tugun markazi orasidagi masofa
const Y0 = 52; // birinchi tugun markazi
const COL = [74, 246] as const; // chap / o'ng ustun markazlari
const TAIL = 90; // oxirgi tugundan sinaps belgisigacha

const cxOf = (i: number) => COL[i % 2];
const cyOf = (i: number) => Y0 + i * PITCH;

const CYAN = "#17a2bf"; // ICON_GRADIENT ning och uchi (_ui.tsx)
const GOLD = "#ef9f21";
const GOLD_LIGHT = "#fbc63f";

type NodeState = "done" | "current" | "upcoming";

/* ═══════════════ Soma — dars tuguni ═══════════════ */

// Yopiq Catmull-Rom halqa: 7 ta tayanch, burchaklari ham radiuslari ham
// har xil — na doira, na yumaloqlangan kvadrat, na simmetriya o'qi.
// O'lchangan chegara: x 6.75…90.56, y 5.29…90.52 (96 lik qutida).
const SOMA =
  "M42 5.4C54 4.4 73.7 9.3 81.8 17.6C89.9 25.8 92.1 42.5 89.6 53.8C87.1 65.2 77.6 78.4 67.2 84.2C56.9 90 38.5 93 28.5 88C18.5 83 11.5 65.9 8.6 54.9C5.7 44 5.8 31.8 11.5 23.4C17.2 15 30.1 6.4 42 5.4Z";

// Yadro — o'z shakli bor, soma bilan konsentrik EMAS (markazi 46,45).
// O'lchangan: to'liq somaning ichida, chekkagacha eng kam 12.45px. Raqam
// maydoni ("12.3" — 46×17px) ham to'liq yadroning ichiga sig'adi.
const NUCLEUS =
  "M37.1 20.6C44.6 17.8 58 19 63.7 23.9C69.4 28.8 72.1 41.5 70.6 49.3C69.2 57.2 62 67.4 55.1 69.9C48.1 72.4 36 69.2 29.9 64.2C23.9 59.1 18.2 47.7 19.4 40.3C20.6 32.9 29.6 23.4 37.1 20.6Z";

// Sitoplazma tolalari — yadro bilan chekka orasida, ikkalasiga ham tegmaydi
// (o'lchangan: chekkadan eng kam 1.36px, yadroga umuman tegmaydi).
const CYTO = ["M14 60C18 70 26 78 36 83", "M83 35C86 42 87 50 85 57", "M30 14C38 10 47 8 56 9"];

// Qirra yorug'ligi — shishaning "ho'l" akslanishi, konturdan 8.2px ichkarida.
const GLINT = "M20 34C25 21 38 13 52 14";

// Markaz (48,48) atrofida kattalashtirish/kichraytirish.
const about = (k: number) => `translate(48,48) scale(${k}) translate(-48,-48)`;

function Soma({ state }: { state: NodeState }) {
  const done = state === "done";
  const cur = state === "current";

  return (
    // viewBox 96 lik shaklga 4px chekka beradi: 1.12 kattalashgan halqaning
    // o'lchangan chegarasi 1.80…95.66 — aynan shu chekkaga sig'adi.
    <svg width={NODE} height={NODE} viewBox="-4 -4 104 104" className="block" aria-hidden>
      {/* joriy tugun atrofidagi halqa — AYNAN soma shaklida, doira emas */}
      {cur && <path d={SOMA} fill="none" stroke={CYAN} strokeOpacity="0.4" strokeWidth="2.2" transform={about(1.12)} />}

      <path
        d={SOMA}
        fill={done ? "url(#nrSomaDone)" : cur ? "url(#nrSomaNow)" : "url(#nrSomaNext)"}
        stroke={done ? "rgba(255,255,255,0.72)" : cur ? NAVY : "url(#nrRim)"}
        strokeOpacity={cur ? 0.92 : 1}
        strokeWidth={done ? 1.8 : cur ? 2.6 : 1.5}
        strokeLinejoin="round"
      />
      {/* joriy tugunda ichki yorug'lik chizig'i — `.gl-glass::before` qirrasi */}
      {cur && <path d={SOMA} fill="none" stroke="url(#nrRim)" strokeWidth="1.3" transform={about(0.955)} />}

      <g
        fill="none"
        strokeLinecap="round"
        stroke={done ? "#04323f" : TEAL}
        strokeOpacity={done ? 0.32 : cur ? 0.22 : 0.14}
        strokeWidth="2"
      >
        {CYTO.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      <path
        d={NUCLEUS}
        fill={done ? "url(#nrNucDone)" : cur ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.34)"}
        stroke={done ? "#7fe3f5" : TEAL}
        strokeOpacity={done ? 0.24 : cur ? 0.42 : 0.22}
        strokeWidth="1.6"
      />

      <path d={GLINT} fill="none" stroke="#ffffff" strokeOpacity={done ? 0.34 : 0.75} strokeWidth="2.6" strokeLinecap="round" />

      {/* Qirradagi muhr — RANGDAN MUSTAQIL belgi: rang ajratolmaydigan
          o'quvchi ham holatni shakl orqali o'qiydi. (78,17) o'lchangan:
          konturdan 2.1px ichkarida, ya'ni muhr qirraga minib turadi. */}
      {done && (
        <g>
          <circle cx="78" cy="17" r="13" fill="#ffffff" stroke={TEAL} strokeOpacity="0.25" strokeWidth="1.4" />
          <path d="M72 17.4 76.4 21.8 84.6 12.6" fill="none" stroke={TEAL} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
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

// Barcha gradientlar bitta yashirin <svg> da: 12 ta dars bo'lsa ham brauzer
// 7 ta bo'yoq manbasi yaratadi, 84 tasini emas.
// `display:none` ATAYLAB ishlatilmagan — eski WebView'da yashirilgan
// element ichidagi gradientga havola uzilib qolishi mumkin.
function NeuronDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute h-0 w-0 overflow-hidden">
      <defs>
        {/* O'tilgan soma va uning yadrosi. Oq raqam yadro ustida turadi:
            #0b5c73 da 7.52:1, #0a3d4c da 10.9:1 — ikkalasi ham AA dan baland. */}
        <linearGradient id="nrSomaDone" x1="0.12" y1="0" x2="0.82" y2="1">
          <stop offset="0%" stopColor="#1fa6c0" />
          <stop offset="46%" stopColor={TEAL} />
          <stop offset="100%" stopColor="#123f4d" />
        </linearGradient>
        <linearGradient id="nrNucDone" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#0b5c73" />
          <stop offset="100%" stopColor="#0a3d4c" />
        </linearGradient>

        {/* Joriy va navbatdagi soma — SHISHA, lekin backdrop-filter SIZ.
            Qiymatlar globals.css `.gl-glass` dan ko'chirilgan (142deg,
            0.54/0.24/0.17/0.36). Ostidagi ambient silliq gradient bo'lgani
            uchun blur deyarli hech narsani o'zgartirmaydi — buni
            globals.css ning o'zi yozib qo'ygan. Natijada N ta dars = N ta
            blur qatlami emas, N ta arzon bo'yash; ekrandagi haqiqiy shisha
            (blur) faqat sarlavha tugmasi, HeaderBadges va yakun kartasida
            qoladi — ya'ni bugungidek. */}
        <linearGradient id="nrSomaNow" x1="0.1" y1="0" x2="0.78" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.74" />
          <stop offset="34%" stopColor="#ffffff" stopOpacity="0.46" />
          <stop offset="63%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id="nrSomaNext" x1="0.1" y1="0" x2="0.78" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.52" />
          <stop offset="34%" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="63%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.36" />
        </linearGradient>
        {/* Qirra — `.gl-glass::before` (150deg) ning aynan o'zi */}
        <linearGradient id="nrRim" x1="0.12" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="36%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="62%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0.34" />
        </linearGradient>

        {/* Miyelinlangan akson o'zagi */}
        <linearGradient id="nrLit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CYAN} />
          <stop offset="100%" stopColor={TEAL} />
        </linearGradient>

        {/* Tugun ostidagi tegish soyasi. ATAYLAB bo'yalgan radial gradient,
            CSS `filter: drop-shadow` emas: filtr ajdodda Backdrop Root
            yaratib, yonidagi shisha kartaning backdrop-filter'ini o'ldiradi.
            Bo'yalgan ellips esa fonning o'ziga tushadi va arzon. */}
        <radialGradient id="nrContact" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={NAVY} stopOpacity="0.2" />
          <stop offset="60%" stopColor={NAVY} stopOpacity="0.09" />
          <stop offset="100%" stopColor={NAVY} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ═══════════════ Akson va shoxlari ═══════════════ */

// BITTA `d` satri — bo'laklarga bo'lingan emas. Shu sabab "o'tilgan" qism
// strokeDasharray bilan emas, AYNAN SHU egri chiziqning PREFIKSI bilan
// chiziladi: uzunlikni o'lchash (getTotalLength — faqat brauzerda) kerak
// emas va yorug' uch hech qachon "sirg'anib" ketmaydi.
function axonPath(from: number, to: number): string {
  let d = `M${cxOf(from)} ${cyOf(from)}`;
  for (let i = from + 1; i <= to; i++) {
    const a = cxOf(i - 1);
    const b = cxOf(i);
    const y = cyOf(i - 1);
    d += `C${a} ${y + 56} ${b} ${y + 84} ${b} ${cyOf(i)}`;
  }
  return d;
}

// Tugundan tashqariga chiqadigan uchta dendrit. Ildizlari somaning ICHIDAN
// boshlanadi (o'lchangan: chekkadan 1.0–2.7px ichkarida), shuning uchun ular
// yopishtirilgan emas, o'sib chiqqandek ko'rinadi. Tashqi tomonga chiqadi —
// dars nomi ichki tomonda turadi.
function dendrites(i: number): Array<[string, number, number]> {
  const x = cxOf(i);
  const y = cyOf(i);
  const s = i % 2 === 0 ? -1 : 1;
  return [
    [`M${x + s * 32} ${y - 26}C${x + s * 44} ${y - 34} ${x + s * 53} ${y - 38} ${x + s * 58} ${y - 44}`, x + s * 58, y - 44],
    [`M${x + s * 40} ${y - 2}C${x + s * 54} ${y - 4} ${x + s * 62} ${y - 10} ${x + s * 70} ${y - 18}`, x + s * 70, y - 18],
    [`M${x + s * 30} ${y + 24}C${x + s * 42} ${y + 34} ${x + s * 50} ${y + 42} ${x + s * 52} ${y + 52}`, x + s * 52, y + 52],
  ];
}

// Kollateral — aksonning yon shoxi, boutoni bilan. Har qatorning gorizontal
// bo'sh yarmini to'ldiradi, lekin bezak emas: bu ham o'sha anatomiya, va u
// dars sonidan kelib chiqadi. Ildizi aksonning O'ZIDA: y+50 balandlikda
// akson markazdan 48px uzoqlikda bo'ladi (o'lchangan).
// Uchi (±126, y+92) — o'lchangan: ikkala qo'shni izohning bandidan tashqarida.
function collateral(i: number): [string, number, number] {
  const x = cxOf(i);
  const y = cyOf(i);
  const s = i % 2 === 0 ? 1 : -1;
  return [
    `M${x + s * 48} ${y + 50}C${x + s * 74} ${y + 58} ${x + s * 100} ${y + 70} ${x + s * 126} ${y + 92}`,
    x + s * 126,
    y + 92,
  ];
}

/* ═══════════════ Yo'l yakuni ═══════════════ */

function FinishCap({ allDone, t }: { allDone: boolean; t: StudentStrings }) {
  return (
    <div className="gl-glass mx-auto mt-3 flex max-w-[320px] items-center gap-3.5 rounded-[26px] px-4 py-4">
      <span className="grid h-[54px] w-[54px] shrink-0 place-items-center">
        {allDone ? (
          <CoinGold s={50} />
        ) : (
          // Belgi yo'lning o'z tilida: uzuq halqa ichida hali yonmagan soma.
          <svg width="54" height="54" viewBox="-4 -4 104 104" aria-hidden>
            <circle cx="48" cy="48" r="49" fill="rgba(255,255,255,0.5)" stroke={NAVY} strokeOpacity="0.26" strokeWidth="1.8" strokeDasharray="4 5" />
            <path d={SOMA} fill="none" stroke={NAVY} strokeOpacity="0.42" strokeWidth="2.6" transform={about(0.62)} />
            <path d={NUCLEUS} fill="none" stroke={NAVY} strokeOpacity="0.3" strokeWidth="2.4" transform={about(0.62)} />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-extrabold leading-tight text-slate-900">{allDone ? t.levelFinished : t.levelFinish}</div>
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

  // Miyelinlangan akson — 0 dan ketma-ket o'tilgan OXIRGI darsgacha.
  // `taught` uzuq bo'lsa (3-dars o'tilgan, 2-si yo'q) chiziq shu yerda
  // to'xtaydi, 3-tugun esa baribir "o'tilgan" bo'lib chiziladi: g'alati
  // ma'lumotni yashirish emas, borini ko'rsatish.
  const lastDone = currentIdx === -1 ? n - 1 : currentIdx - 1;

  const H = (n - 1) * PITCH + 155;
  const lastI = n - 1;
  const tx = cxOf(lastI);
  const ty = cyOf(lastI);
  const dir = lastI % 2 === 0 ? 1 : -1; // dum HAR DOIM markazga qarab ketadi
  const endX = tx + dir * 48;
  const endY = ty + TAIL;

  return (
    <div>
      <NeuronDefs />

      {/* ── Yuqori qator ──
          Binafsha yo'q: sarlavha slate-900, orqaga o'qi TEAL — bu _ui.tsx
          dagi PageHeader bilan aynan bir xil, ya'ni bu ekran endi boshqa
          ichki sahifalardan chetda turmaydi. Darajaning O'Z rangi
          (lvl.color) faqat kichik nishonda qoladi: identifikator shu, lekin
          u endi sarlavhani bo'yamaydi (B1 uchun u binafsha #6d28d9 — aynan
          shu sabab u sarlavhadan olindi). Oltita standart daraja rangining
          hammasida oq matn kontrasti 5.0:1 dan baland (o'lchangan). */}
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

      {/* ── Daraja jarayoni: sahifadagi YAGONA foiz ──
          Har kafeldagi ma'nosiz "0%" o'rniga bitta rost javob. 0% da chiziq
          haqiqatan bo'sh qoladi (yolg'on "boshlandi" ko'rinishi yo'q), 1%
          dan boshlab esa uchi ko'rinsin deb 6% gacha ko'tariladi. */}
      {n > 0 && (
        <div className="mt-3.5 flex items-center gap-2.5">
          <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-white/55 shadow-[inset_0_1px_2px_rgba(19,78,94,0.12)]">
            <div
              className="h-full rounded-full"
              style={{
                width: pct === 0 ? "0%" : `${Math.max(pct, 6)}%`,
                background: allDone ? `linear-gradient(90deg, ${GOLD_LIGHT}, ${GOLD})` : `linear-gradient(90deg, ${CYAN}, ${TEAL})`,
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
          <svg width="64" height="64" viewBox="-4 -4 104 104" className="mx-auto mb-3" aria-hidden>
            <path d={SOMA} fill="url(#nrSomaNext)" stroke="url(#nrRim)" strokeWidth="1.6" />
            <path d={NUCLEUS} fill="rgba(255,255,255,0.34)" stroke={TEAL} strokeOpacity="0.22" strokeWidth="1.6" />
          </svg>
          <div className="text-[15px] font-bold text-slate-800">{t.noLessons}</div>
          <p className="mt-1 text-[12.5px] font-medium text-slate-600">{t.teacherAdds}</p>
        </div>
      ) : (
        // -mx-4 — yo'l ustuni telefonning to'liq enini oladi, so'ng 320px
        // qilib markazlashtiriladi (360px ekranda ikki yonda 20px bo'shliq).
        // overflow-hidden 320px dan tor ekranlarda dendrit uchlarini kesadi,
        // maketni buzmaydi.
        <section className="relative -mx-4 mt-5 overflow-hidden">
          <div className="relative mx-auto" style={{ width: RAIL, height: H }}>
            {/* ── Bitta fon SVG: dendritlar + kollaterallar + soya + akson + dum ──
                Filtr yo'q, blur yo'q, animatsiya yo'q: bir marta bo'yaladi,
                keyin skrollda faqat kompozit qilinadi. */}
            <svg width={RAIL} height={H} viewBox={`0 0 ${RAIL} ${H}`} className="pointer-events-none absolute inset-0" aria-hidden>
              {lessons.map((lesson, i) => {
                const st: NodeState = taught.has(lesson.id) ? "done" : i === currentIdx ? "current" : "upcoming";
                const col = st === "done" ? TEAL : NAVY;
                const op = st === "done" ? 0.28 : st === "current" ? 0.2 : 0.1;
                return (
                  <g
                    key={`dn-${lesson.id}`}
                    fill="none"
                    stroke={col}
                    strokeOpacity={op}
                    strokeWidth={st === "done" ? 1.3 : 1.1}
                    strokeLinecap="round"
                  >
                    {dendrites(i).map(([d, bx, by]) => (
                      <g key={d}>
                        <path d={d} />
                        <circle cx={bx} cy={by} r="1.7" fill={col} fillOpacity={op + 0.08} stroke="none" />
                      </g>
                    ))}
                  </g>
                );
              })}

              {lessons.slice(0, -1).map((lesson, i) => {
                const [d, bx, by] = collateral(i);
                const on = taught.has(lesson.id);
                return (
                  <g
                    key={`co-${lesson.id}`}
                    fill="none"
                    stroke={on ? TEAL : NAVY}
                    strokeOpacity={on ? 0.26 : 0.15}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d={d} />
                    <circle cx={bx} cy={by} r="2.6" fill={on ? TEAL : NAVY} fillOpacity={on ? 0.22 : 0.14} stroke="none" />
                  </g>
                );
              })}

              {lessons.map((lesson, i) => (
                <ellipse key={`sh-${lesson.id}`} cx={cxOf(i)} cy={cyOf(i) + 46} rx="40" ry="10" fill="url(#nrContact)" />
              ))}

              {/* butun akson — doim uzluksiz */}
              {n > 1 && <path d={axonPath(0, n - 1)} fill="none" stroke={NAVY} strokeOpacity="0.16" strokeWidth="3" strokeLinecap="round" />}

              {/* miyelin nuri + o'zak — xuddi shu egri chiziqning prefiksi */}
              {lastDone > 0 && (
                <>
                  <path d={axonPath(0, lastDone)} fill="none" stroke={TEAL} strokeOpacity="0.13" strokeWidth="11" strokeLinecap="round" />
                  <path d={axonPath(0, lastDone)} fill="none" stroke="url(#nrLit)" strokeWidth="3.4" strokeLinecap="round" />
                </>
              )}

              {/* Signal joriy darsga YETIB KELMOQDA: bo'lakning 52%i.
                  `pathLength={100}` uzunlikni foizga keltiradi — bo'lak
                  qanday uzun bo'lishidan qat'i nazar bir xil chiqadi va
                  hech qachon keyingi bo'lakka o'tib ketmaydi. */}
              {lastDone >= 0 && lastDone + 1 < n && (
                <path
                  d={axonPath(lastDone, lastDone + 1)}
                  fill="none"
                  stroke="url(#nrLit)"
                  strokeOpacity="0.5"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="52 100"
                />
              )}

              {/* dum — yo'l uzilmaydi, ingichkalashadi */}
              <path
                d={`M${tx} ${ty}C${tx} ${ty + 50} ${tx + dir * 40} ${ty + 58} ${endX} ${endY}`}
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
                  {/* Nishon = qator eni × 104px: tugun ham, dars nomi ham
                      ichida. 44×44 dan ancha katta, va ekran o'quvchisi uchun
                      havolaning nomi darsning O'Z nomi bo'ladi. */}
                  <Link
                    href={`/student/kurse/${code}/${lesson.id}`}
                    aria-current={st === "current" ? "step" : undefined}
                    className="absolute inset-x-0 top-0 block h-[104px] transition-transform duration-150 active:scale-[0.975]"
                  >
                    <span className={`absolute top-0 block ${right ? "left-[194px]" : "left-[22px]"}`}>
                      {/* Joriy tugun "yonib turadi". transform + opacity —
                          kompozitorda ishlaydi, qayta bo'yash yo'q. 1s emas,
                          2.6s: tinch nafas, asabiy miltillash emas. */}
                      {st === "current" && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-1/2 top-1/2 h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#17a2bf]/20 motion-safe:animate-ping"
                          style={{ animationDuration: "2.6s" }}
                        />
                      )}
                      <Soma state={st} />
                      {/* Raqam HTML matn (SVG <text> emas): ilova shrifti,
                          tiniq, Android shrift kattalashtirishiga bo'ysunadi.
                          Yadro markazi (46,45) quti markazidan 2/3px siljigan
                          — raqam ham shunga siljitiladi, aks holda u yadroda
                          markazda turmaydi. */}
                      <span className="pointer-events-none absolute inset-0 grid place-items-center">
                        <span
                          className="-translate-x-[2px] -translate-y-[3px] text-[23px] font-extrabold leading-none tracking-tight tabular-nums"
                          style={{ color: st === "done" ? "#ffffff" : st === "current" ? NAVY : "#334155" }}
                        >
                          {chapter}.{inChapter}
                        </span>
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
