import "server-only";
import { prisma } from "./db";
import { getSetting } from "./settings";

// Qarz hisobi (2026-08-27 talab): o'quvchi TIZIMGA BIRIKTIRILGAN kundan
// boshlab avtomatik hisoblanadi — guruhga qo'shilishini kutmaydi.
//
// Har kalendar oy uchun to'lov:
//   • o'sha oyda o'quvchi guruh(lar)da bo'lsa — guruh narxi (Group.monthlyFee),
//     bo'lmasa kurs narxi (Program.monthlyFee); bir nechta guruhda bo'lsa yig'iladi;
//   • hech qaysi guruhda bo'lmasa — markazning umumiy narxi (sozlamalardan).
// Qo'shilgan/ro'yxatga olingan oyning O'ZI to'liq hisoblanadi.
//
//   qarz = (hisoblangan − to'langan) + qo'lda kiritilgan qarz (PENDING)
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
  /** Umumiy qarz — ro'yxatlarda shu ko'rsatiladi */
  debt: number;
  /** Nechta oy hisoblangan */
  months: number;
  /** Hisob boshlangan sana (ro'yxatga olingan yoki birinchi guruhga qo'shilgan) */
  since: Date | null;
}

const EMPTY: StudentDebt = { accrued: 0, paid: 0, manual: 0, debt: 0, months: 0, since: null };

/** Sanani "oy indeksi"ga aylantiradi (yil*12 + oy) — oylarni solishtirish uchun. */
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/**
 * Ikki sana orasidagi to'lov oylari soni — boshlangan oyning O'ZI ham kiradi.
 * (Tashqi kodda ishlatiladi; ichkarida oylik sikl bor.)
 */
export function billedMonths(from: Date, now: Date, until?: Date | null): number {
  const end = until && until.getTime() < now.getTime() ? until : now;
  return Math.max(0, monthIndex(end) - monthIndex(from) + 1);
}

/** Bir nechta o'quvchi uchun bir martada (ro'yxat sahifalari uchun). */
export async function computeDebts(studentIds: string[], now = new Date()): Promise<Map<string, StudentDebt>> {
  const out = new Map<string, StudentDebt>();
  if (studentIds.length === 0) return out;

  const [students, enrollments, payments, defaultFee] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, createdAt: true } }),
    prisma.groupStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        joinedAt: true,
        leftAt: true,
        isActive: true,
        group: { select: { monthlyFee: true, program: { select: { monthlyFee: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { studentId: { in: studentIds }, status: { in: ["PAID", "PENDING"] } },
      select: { studentId: true, amount: true, status: true },
    }),
    getDefaultMonthlyFee(),
  ]);

  const byStudent = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const arr = byStudent.get(e.studentId) ?? [];
    arr.push(e);
    byStudent.set(e.studentId, arr);
  }

  const nowIdx = monthIndex(now);

  for (const st of students) {
    const enr = byStudent.get(st.id) ?? [];
    // Hisob boshlanishi: ro'yxatga olingan sana (yoki undan oldingi a'zolik bo'lsa — o'sha)
    let since = st.createdAt;
    for (const e of enr) if (e.joinedAt < since) since = e.joinedAt;

    let accrued = 0;
    let months = 0;
    for (let m = monthIndex(since); m <= nowIdx; m++) {
      months++;
      let monthFee = 0;
      for (const e of enr) {
        const from = monthIndex(e.joinedAt);
        // Guruhdan chiqarilgan bo'lsa — o'sha oygacha; sana yozilmagan eski
        // yozuvlarda (isActive=false) faqat qo'shilgan oy hisoblanadi.
        const until = e.leftAt ? monthIndex(e.leftAt) : (e.isActive ? Infinity : from);
        if (m >= from && m <= until) {
          monthFee += e.group.monthlyFee ?? e.group.program.monthlyFee ?? 0;
        }
      }
      // Shu oyda hech qaysi guruhda bo'lmagan bo'lsa — markazning umumiy narxi
      accrued += monthFee > 0 ? monthFee : defaultFee;
    }

    out.set(st.id, { ...EMPTY, accrued, months, since });
  }

  // Ro'yxatda bo'lmagan (o'chirilgan) id'lar uchun ham bo'sh yozuv
  for (const id of studentIds) if (!out.has(id)) out.set(id, { ...EMPTY });

  for (const p of payments) {
    const cur = out.get(p.studentId);
    if (!cur) continue;
    if (p.status === "PAID") cur.paid += p.amount;
    else cur.manual += p.amount;
  }

  for (const v of out.values()) {
    v.debt = Math.max(0, v.accrued - v.paid) + v.manual;
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
