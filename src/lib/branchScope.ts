// Faol filial bo'yicha ro'yxat filtri: filial almashtirilganda HAMMA bo'lim
// faqat o'sha filial ma'lumotini ko'rsatadi.
//
// Qoida (QAT'IY): sessiyada faol filial bo'lsa — FAQAT o'sha
// filial yozuvlari ko'rinadi. Ilgari filialsiz (branchId=null) yozuvlar ham
// qo'shilardi — shu sabab Qibrayda Oybekniki ham, hech qaysi filialga
// biriktirilmagan eski xodimlar ham chiqib turardi.
// Filialsiz yozuvlarni ko'rish/tuzatish uchun rahbariyat yuqoridagi filial
// tanlovidan "Barcha filiallar" ni tanlaydi (sessiyada filial bo'lmasa — hammasi).

type BW = { branchId: string } | Record<string, never>;
/** Filial + filialsiz (umumiy) yozuvlar — market kabi umumiy ro'yxatlar uchun */
type BWShared = { OR: ({ branchId: string } | { branchId: null })[] } | Record<string, never>;

/** branchId maydoni BOR modellar uchun: Lead, Student, Group, Room, User, Vacancy, Expense. */
export function branchWhere(s: { branchId: string | null }): BW {
  return s.branchId ? { branchId: s.branchId } : {};
}

/**
 * Filialga biriktirilmagan (umumiy) yozuvlar ham ko'rinadigan filtr.
 * Faqat ataylab umumiy bo'lgan ro'yxatlar uchun — masalan Market sovg'alari:
 * ular odatda filialsiz yaratiladi va hamma filialda ko'rinishi kerak.
 */
export function branchWhereShared(s: { branchId: string | null }): BWShared {
  return s.branchId ? { OR: [{ branchId: s.branchId }, { branchId: null }] } : {};
}

/** O'quvchi orqali bog'langan modellar uchun (Payment, Certificate, ExamResult...). */
export function branchViaStudent(s: { branchId: string | null }): { student: BW } | Record<string, never> {
  return s.branchId ? { student: branchWhere(s) } : {};
}

/** Guruh orqali bog'langan modellar uchun (Lesson, GroupStudent, Assignment...). */
export function branchViaGroup(s: { branchId: string | null }): { group: BW } | Record<string, never> {
  return s.branchId ? { group: branchWhere(s) } : {};
}

/** Dars orqali bog'langan modellar uchun (Attendance). */
export function branchViaLesson(s: { branchId: string | null }): { lesson: { group: BW } } | Record<string, never> {
  return s.branchId ? { lesson: { group: branchWhere(s) } } : {};
}
