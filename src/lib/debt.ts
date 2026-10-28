import "server-only";
import { prisma } from "./db";
import { getSetting } from "./settings";

// Qarz hisobi: o'quvchi TIZIMGA BIRIKTIRILGAN kundan
// boshlab avtomatik hisoblanadi — guruhga qo'shilishini kutmaydi.
//
// Har kalendar oy uchun to'lov:
//   • o'sha oyda o'quvchi guruh(lar)da bo'lsa — guruh narxi (Group.monthlyFee),
//     bo'lmasa kurs narxi (Program.monthlyFee); bir nechta guruhda bo'lsa yig'iladi;
//   • hech qaysi guruhda bo'lmasa — markazning umumiy narxi (sozlamalardan).
// Guruhga qo'shilgan oy — faqat qolgan darslar ulushi: oylik narx × (qo'shilgan
// kundan boshlab shu oydagi darslar) / (oydagi jami darslar). Masalan 12 darslik
// 600 000 so'mli guruhga 7-darsdan qo'shilsa — 6 dars, 300 000 so'm.
//
//   qarz   = max(0, hisoblangan + qo'lda kiritilgan qarz (PENDING) − to'langan − promokod chegirmasi)
//   balans = max(0, to'langan + chegirma − hisoblangan − qo'lda qarz)  — oldindan to'langan pul
//
// To'lov AVVAL hisoblangan oylik to'lovni, keyin qo'lda qarzni yopadi. Ilgari
// qo'lda qarz tashqaridan qo'shilardi (max(0, hisoblangan − to'langan) + qarz) —
// shunda to'lov hisoblanganidan oshsa ham qarz kamaymasdi (2026-09-14 xatosi:
// 50 000 qarz + 100 000 to'lov = baribir 50 000 qarz).
//
// Hech qayerda narx belgilanmagan bo'lsa hisob 0 bo'ladi — ya'ni narx
// kiritmagan markazlarda hech narsa o'zgarmaydi.

/** Markazning umumiy oylik to'lovi (guruhsiz oylar uchun) — Sozlamalar > Moliya */
export const DEFAULT_FEE_KEY = "finance.defaultMonthlyFee";

export async function getDefaultMonthlyFee(): Promise<number> {
  const raw = await getSetting(DEFAULT_FEE_KEY);
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface StudentDebt {
  /** Ro'yxatga olingan oydan hozirgacha hisoblangan jami to'lov */
  accrued: number;
  /** PAID holatidagi to'lovlar yig'indisi */
  paid: number;
  /** Qo'lda kiritilgan qarz (PENDING to'lovlar) */
  manual: number;
  /** Promokod chegirmalari (PAID to'lovlardagi discount) — majburiyatni kamaytiradi, pul emas */
  discount: number;
  /** Umumiy qarz — ro'yxatlarda shu ko'rsatiladi */
  debt: number;
  /** Balans — majburiyatlardan ortiqcha to'langan (oldindan to'lov) */
  credit: number;
  /** Nechta oy hisoblangan */
  months: number;
  /** Hisob boshlangan sana (ro'yxatga olingan yoki birinchi guruhga qo'shilgan) */
  since: Date | null;
  /**
   * To'lanmagan oylar soni — to'lovlar eng eski oylarni birinchi yopadi.
   * 1 — faqat bir oy (yoki qisman) qarz, 2+ — bir oydan ko'p qarz.
   */
  overdueMonths: number;
}

const EMPTY: StudentDebt = { accrued: 0, paid: 0, manual: 0, discount: 0, debt: 0, credit: 0, months: 0, since: null, overdueMonths: 0 };

/** Sanani "oy indeksi"ga aylantiradi (yil*12 + oy) — oylarni solishtirish uchun. */
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/** Qo'shilgan oyni darslar ulushi bo'yicha hisoblash shu kundan boshlab qo'shilganlarga qo'llanadi */
export const PRORATE_FROM = new Date(2026, 9, 28);

/** Narx hisobi uchun guruh ma'lumoti */
export interface FeeGroup {
  monthlyFee: number | null;
  weekdays: string | null;
  lessonsPerMonth: number | null;
  program: { monthlyFee: number | null; lessonsPerMonth: number | null };
}
const FEE_GROUP_SELECT = {
  monthlyFee: true, weekdays: true, lessonsPerMonth: true,
  program: { select: { monthlyFee: true, lessonsPerMonth: true } },
} as const;

/** Oyning dars kunlari (sana raqamlari) — guruh jadvali bo'yicha, oyiga darslar soni bilan cheklangan */
export function monthLessonDays(g: FeeGroup, mIdx: number): number[] | null {
  const days = new Set((g.weekdays ?? "").split(",").map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 7));
  if (days.size === 0) return null;
  const y = Math.floor(mIdx / 12), mo = mIdx % 12;
  const dim = new Date(y, mo + 1, 0).getDate();
  const out: number[] = [];
  for (let d = 1; d <= dim; d++) {
    const wd = ((new Date(y, mo, d).getDay() + 6) % 7) + 1; // Du=1 ... Ya=7
    if (days.has(wd)) out.push(d);
  }
  const cap = g.lessonsPerMonth ?? g.program.lessonsPerMonth ?? 0;
  return cap > 0 ? out.slice(0, cap) : out;
}

/**
 * Guruh a'zoligining shu oy uchun narxi. Qo'shilgan oyda — faqat qolgan darslar
 * ulushi (dars jadvali bo'lmasa — qolgan kunlar ulushi), keyingi oylarda — to'liq.
 */
export function enrollmentMonthFee(g: FeeGroup, joinedAt: Date, mIdx: number): number {
  const fee = g.monthlyFee ?? g.program.monthlyFee ?? 0;
  if (fee <= 0 || monthIndex(joinedAt) !== mIdx) return fee;
  // Qoida shu sanadan keyin qo'shilganlarga — avvalgi hisob-kitoblar o'zgarmaydi
  if (joinedAt.getTime() < PRORATE_FROM.getTime()) return fee;
  const joinDay = joinedAt.getDate();
  const lessons = monthLessonDays(g, mIdx);
  let share: number;
  if (lessons && lessons.length > 0) {
    share = lessons.filter((d) => d >= joinDay).length / lessons.length;
  } else {
    const dim = new Date(Math.floor(mIdx / 12), (mIdx % 12) + 1, 0).getDate();
    share = (dim - joinDay + 1) / dim;
  }
  // 1 000 so'mgacha yaxlitlanadi
  return Math.round((fee * share) / 1000) * 1000;
}

/**
 * Ikki sana orasidagi to'lov oylari soni — boshlangan oyning O'ZI ham kiradi.
 * (Tashqi kodda ishlatiladi; ichkarida oylik sikl bor.)
 */
export function billedMonths(from: Date, now: Date, until?: Date | null): number {
  const end = until && until.getTime() < now.getTime() ? until : now;
  return Math.max(0, monthIndex(end) - monthIndex(from) + 1);
}

/** Shu oyda narxi belgilangan guruhda bo'lganmi — qo'shilgan oy ulushi 0 bo'lsa umumiy narx olinmasin */
function enrolledWithFee(enr: { joinedAt: Date; leftAt: Date | null; isActive: boolean; group: FeeGroup }[], m: number): boolean {
  return enr.some((e) => {
    const from = monthIndex(e.joinedAt);
    const until = e.leftAt ? monthIndex(e.leftAt) : (e.isActive ? Infinity : from);
    return m >= from && m <= until && (e.group.monthlyFee ?? e.group.program.monthlyFee ?? 0) > 0;
  });
}

/** Bir nechta o'quvchi uchun bir martada (ro'yxat sahifalari uchun). */
export async function computeDebts(
  studentIds: string[],
  now = new Date(),
  /** Shu guruhlar a'zoligi hisobga olinmaydi — "guruhsiz qarz qancha bo'lardi" (guruhdan chiqarishda) */
  opts: { excludeGroupIds?: string[] } = {},
): Promise<Map<string, StudentDebt>> {
  const out = new Map<string, StudentDebt>();
  if (studentIds.length === 0) return out;
  const excluded = new Set(opts.excludeGroupIds ?? []);

  const [students, enrollments, payments, defaultFee] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, createdAt: true } }),
    prisma.groupStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        groupId: true,
        joinedAt: true,
        leftAt: true,
        isActive: true,
        group: { select: FEE_GROUP_SELECT },
      },
    }),
    prisma.payment.findMany({
      // ADJUST — qarzni qo'lda tuzatish (+/−), pul harakati emas
      where: { studentId: { in: studentIds }, status: { in: ["PAID", "PENDING", "ADJUST"] } },
      select: { studentId: true, amount: true, status: true, discount: true },
    }),
    getDefaultMonthlyFee(),
  ]);

  const byStudent = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    if (excluded.has(e.groupId)) continue;
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push(e);
    byStudent.set(e.studentId, arr);
  }

  const nowIdx = monthIndex(now);
  // Har o'quvchining oyma-oy hisoblangan summalari (eski oydan yangisiga) — qarz oylarini sanash uchun
  const feesByStudent = new Map<string, number[]>();

  for (const st of students) {
    const enr = byStudent.get(st.id) ?? [];
    // Hisob boshlanishi: ro'yxatga olingan sana (yoki undan oldingi a'zolik bo'lsa — o'sha)
    let since = st.createdAt;
    for (const e of enr) if (e.joinedAt < since) since = e.joinedAt;

    let accrued = 0;
    let months = 0;
    const fees: number[] = [];
    for (let m = monthIndex(since); m <= nowIdx; m++) {
      months++;
      let monthFee = 0;
      let inGroup = false;
      for (const e of enr) {
        const from = monthIndex(e.joinedAt);
        // Guruhdan chiqarilgan bo'lsa — o'sha oygacha; sana yozilmagan eski
        // yozuvlarda (isActive=false) faqat qo'shilgan oy hisoblanadi.
        const until = e.leftAt ? monthIndex(e.leftAt) : (e.isActive ? Infinity : from);
        if (m >= from && m <= until) {
          inGroup = true;
          monthFee += enrollmentMonthFee(e.group, e.joinedAt, m);
        }
      }
      // Shu oyda hech qaysi guruhda bo'lmagan bo'lsa — markazning umumiy narxi
      // Guruh(lar)da bo'lsa — guruh narxi (qo'shilgan oyda ulush 0 ham bo'lishi mumkin);
      // narxi belgilanmagan guruh yoki guruhsiz oy — markazning umumiy narxi
      const fee = inGroup && monthFee > 0 ? monthFee : inGroup && enrolledWithFee(enr, m) ? 0 : defaultFee;
      accrued += fee;
      fees.push(fee);
    }

    feesByStudent.set(st.id, fees);
    out.set(st.id, { ...EMPTY, accrued, months, since });
  }

  // Ro'yxatda bo'lmagan (o'chirilgan) id'lar uchun ham bo'sh yozuv
  for (const id of studentIds) if (!out.has(id)) out.set(id, { ...EMPTY });

  for (const p of payments) {
    const cur = out.get(p.studentId);
    if (!cur) continue;
    if (p.status === "PAID") { cur.paid += p.amount; cur.discount += p.discount; }
    else cur.manual += p.amount;
  }

  for (const v of out.values()) {
    // Promokod chegirmasi to'langan pul kabi majburiyatni yopadi
    v.debt = Math.max(0, v.accrued + v.manual - v.paid - v.discount);
    v.credit = Math.max(0, v.paid + v.discount - v.accrued - v.manual);
  }

  // To'lanmagan oylar: to'lov (+chegirma, +manfiy tuzatish) avval eng eski oylarni yopadi
  for (const [id, v] of out) {
    if (v.debt <= 0) continue;
    let cover = v.paid + v.discount + (v.manual < 0 ? -v.manual : 0);
    let uncovered = 0;
    for (const fee of feesByStudent.get(id) ?? []) {
      if (fee <= 0) continue;
      if (cover >= fee) cover -= fee;
      else { cover = 0; uncovered++; }
    }
    // Faqat qo'lda kiritilgan qarz bo'lsa ham — kamida bir oy
    v.overdueMonths = Math.max(1, uncovered);
  }
  return out;
}

/** Bitta o'quvchi uchun. */
export async function computeDebt(studentId: string, now = new Date()): Promise<StudentDebt> {
  const m = await computeDebts([studentId], now);
  return m.get(studentId) ?? { ...EMPTY };
}

/** Platformadagi umumiy qarzdorlik (filial doirasi berilishi mumkin). */
export async function totalDebt(where: object = {}, now = new Date()): Promise<{ total: number; debtors: number }> {
  const ids = (await prisma.student.findMany({ where, select: { id: true } })).map((x) => x.id);
  const map = await computeDebts(ids, now);
  let total = 0, debtors = 0;
  for (const v of map.values()) if (v.debt > 0) { total += v.debt; debtors++; }
  return { total, debtors };
}

/**
 * Bir oy uchun har o'quvchining kutilayotgan to'lovi (hisobotlar uchun).
 * Qoida computeDebts bilan bir xil: o'sha oyda guruh(lar)da bo'lsa — guruh
 * narxi (bo'lmasa kurs narxi), yig'iladi; hech qaysi guruhda bo'lmasa —
 * markazning umumiy narxi. Ro'yxatga olinishidan oldingi oylar uchun 0.
 */
export async function monthlyFees(studentIds: string[], month: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (studentIds.length === 0) return out;
  const m = monthIndex(month);
  const [students, enrollments, defaultFee] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, createdAt: true } }),
    prisma.groupStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true, joinedAt: true, leftAt: true, isActive: true,
        group: { select: FEE_GROUP_SELECT },
      },
    }),
    getDefaultMonthlyFee(),
  ]);
  const byStudent = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push(e);
    byStudent.set(e.studentId, arr);
  }
  for (const st of students) {
    const enr = byStudent.get(st.id) ?? [];
    let since = st.createdAt;
    for (const e of enr) if (e.joinedAt < since) since = e.joinedAt;
    if (m < monthIndex(since)) { out.set(st.id, 0); continue; }
    let fee = 0;
    for (const e of enr) {
      const from = monthIndex(e.joinedAt);
      const until = e.leftAt ? monthIndex(e.leftAt) : (e.isActive ? Infinity : from);
      if (m >= from && m <= until) fee += enrollmentMonthFee(e.group, e.joinedAt, m);
    }
    out.set(st.id, fee > 0 ? fee : enrolledWithFee(enr, m) ? 0 : defaultFee);
  }
  return out;
}
