import "server-only";
import { prisma } from "./db";
import { ROLES } from "./constants";

/**
 * Davomat belgilash oynasi qoidasi (buyurtmachi talabi):
 * dars vaqti (masalan 10:00–12:00) davomida va tugagach yana GRACE_HOURS (3 soat)
 * ichida davomat belgilanadi/saqlanadi. Undan keyin YOPILADI: belgilanmaganlar
 * avtomatik "yo'q" (ABSENT) bo'ladi. Rahbariyat (menejer/direktor/o'rinbosar/ROP)
 * ruxsat bersa — o'sha kun davomati UNLOCK_HOURS ga qayta ochiladi.
 *
 * DIQQAT: barcha hisob server mahalliy vaqtida — serverda TZ=Asia/Tashkent
 * bo'lishi SHART (B serverda timedatectl bilan o'rnatilgan, deploy/gcp/setup-b.sh
 * ham TZ beradi). Aks holda oyna soatlab suriladi.
 */
export const GRACE_HOURS = 3;
export const UNLOCK_HOURS = 24;
/** Avto-"yo'q" faqat shu kundan eski bo'lmagan yopiq kunlarga yoziladi —
 *  tarixni varaqlash eski oylarga soxta ABSENT to'ldirib yubormasin. */
export const MATERIALIZE_MAX_AGE_DAYS = 7;

/** Oynani yopishda cheklovga TUSHMAYDIGAN (istalgan vaqtda tahrirlaydigan) rollar. */
const BYPASS_ROLES: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ROP];
/** Yopilgan davomatga ruxsat (unlock) bera oladigan rollar. */
const UNLOCK_GRANTERS: string[] = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ROP];

export const canBypassAttendanceLock = (role: string) => BYPASS_ROLES.includes(role);
export const canGrantAttendanceUnlock = (role: string) => UNLOCK_GRANTERS.includes(role);

export interface AttendanceWindow {
  /** Oyna yopiladigan vaqt (dars tugashi + GRACE_HOURS) */
  closesAt: Date;
  /** Hozir yopiqmi (ruxsatlarni hisobga olmagan xom holat) */
  closed: boolean;
}

const HHMM = /^\d{2}:\d{2}$/;
const T = (dateISO: string, hhmm: string) => new Date(`${dateISO}T${hhmm}:00`);

/** "YYYY-MM-DD" haqiqiy sana ekanini tekshiradi ("2026-13-40" o'tmaydi). */
export function isValidDateISO(dateISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const d = new Date(dateISO + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  // Round-trip: "2026-02-31" kabi ag'darilib ketadigan sanalarni ushlaymiz
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` === dateISO;
}

/** Bugungi sana "YYYY-MM-DD" (server mahalliy vaqtida). */
export function todayISOLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Guruhning shu kundagi davomat oynasini hisoblaydi (server mahalliy vaqtida).
 * endTime bo'lmasa: startTime+90 daqiqa; u ham bo'lmasa kun oxiri deb olinadi —
 * vaqti kiritilmagan guruh ertasi kuni 03:00 gacha ochiq qoladi.
 * endTime < startTime (yarim tundan oshadigan dars) — tugash ertasi kunga o'tadi.
 */
export function computeAttendanceWindow(
  dateISO: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  now: Date = new Date(),
): AttendanceWindow {
  let end: Date;
  if (endTime && HHMM.test(endTime)) {
    end = T(dateISO, endTime);
    // Yarim tundan oshadigan dars (22:00–00:30): tugash ertasi kunda
    if (startTime && HHMM.test(startTime) && end.getTime() <= T(dateISO, startTime).getTime()) {
      end = new Date(end.getTime() + 24 * 3_600_000);
    }
  } else if (startTime && HHMM.test(startTime)) {
    end = new Date(T(dateISO, startTime).getTime() + 90 * 60_000);
  } else {
    end = T(dateISO, "23:59");
  }
  const closesAt = new Date(end.getTime() + GRACE_HOURS * 3_600_000);
  return { closesAt, closed: now.getTime() > closesAt.getTime() };
}

/** Shu guruh+kun uchun amaldagi (muddati o'tmagan) ruxsat — bo'lsa qachongacha. */
export async function activeUnlockUntil(groupId: string, dateISO: string): Promise<Date | null> {
  const u = await prisma.attendanceUnlock.findFirst({
    where: { groupId, date: dateISO, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  return u?.expiresAt ?? null;
}

/** "YYYY-MM-DD" shu guruhning dars kunimi (weekdays: 1=Du..7=Ya). */
export function isLessonDay(dateISO: string, weekdays: string | null | undefined): boolean {
  if (!weekdays) return false;
  const d = new Date(dateISO + "T12:00:00"); // kun o'rtasi — TZ chetlaridan xoli
  if (isNaN(d.getTime())) return false;
  const wd = d.getDay() === 0 ? 7 : d.getDay(); // JS 0=Ya → bizda 7
  return weekdays.split(",").map(Number).includes(wd);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Shu oydagi REJADAGI dars kunlari ("YYYY-MM-DD" ro'yxati): guruh haftalik kunlari
 * bo'yicha, guruh davri (startDate/endDate) ichida, va oyiga `limit` tadan ortiq emas —
 * kalendarda 13 kun chiqsa ham 13-chisi dars bo'lmaydi (kurs/guruh sozlamasi).
 * limit null/0 — cheklovsiz.
 */
export function plannedLessonDays(
  year: number,
  month0: number,
  weekdays: string | null | undefined,
  limit: number | null | undefined,
  startDate?: Date | null,
  endDate?: Date | null,
): string[] {
  if (!weekdays) return [];
  const wds = new Set(weekdays.split(",").map(Number));
  const out: string[] = [];
  const last = new Date(year, month0 + 1, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(year, month0, day, 12);
    const wd = d.getDay() === 0 ? 7 : d.getDay();
    if (!wds.has(wd)) continue;
    if (startDate && d < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) continue;
    if (endDate && d > new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59)) continue;
    out.push(`${year}-${pad2(month0 + 1)}-${pad2(day)}`);
    if (limit && out.length >= limit) break;
  }
  return out;
}

/** Sana rejadagi dars kunimi (oylik chegara bilan). Guruhda kunlar berilmagan bo'lsa — chegara qo'yilmaydi. */
export function isPlannedLessonDay(
  dateISO: string,
  weekdays: string | null | undefined,
  limit: number | null | undefined,
  startDate?: Date | null,
  endDate?: Date | null,
): boolean {
  if (!weekdays) return true;
  const [y, m] = dateISO.split("-").map(Number);
  if (!y || !m) return false;
  return plannedLessonDays(y, m - 1, weekdays, limit, startDate, endDate).includes(dateISO);
}

/**
 * Dars (Lesson) bo'yicha oyna holati — davomat yozadigan BARCHA yo'llar
 * (guruh sahifasi, /attendance, dars sahifasi, QR) bir xil qoidani ishlatsin.
 * null qaytarsa — dars topilmadi.
 */
export async function lessonLockState(lessonId: string): Promise<{
  closed: boolean;
  unlocked: boolean;
  dateISO: string;
  groupId: string;
} | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { startsAt: true, groupId: true, group: { select: { startTime: true, endTime: true } } },
  });
  if (!lesson) return null;
  const dateISO = todayISOLocal(lesson.startsAt); // startsAt kunining ISO'si (server mahalliy)
  const win = computeAttendanceWindow(dateISO, lesson.group.startTime, lesson.group.endTime);
  const unlocked = win.closed ? !!(await activeUnlockUntil(lesson.groupId, dateISO)) : false;
  return { closed: win.closed, unlocked, dateISO, groupId: lesson.groupId };
}
