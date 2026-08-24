// Faol filial bo'yicha ro'yxat filtri (2026-08-23 talab: filial almashtirilganda
// HAMMA bo'lim faqat o'sha filial ma'lumotini ko'rsatsin).
//
// Qoida: sessiyada faol filial bo'lsa — o'sha filial yozuvlari KO'RSATILADI,
// filialga biriktirilmagan (branchId=null) eski yozuvlar ham ko'rinadi
// (aks holda ular hech qaysi filialda chiqmay "yo'qolib" qolardi).
// Sessiyada filial bo'lmasa — hammasi ko'rinadi.

type BW = { OR: ({ branchId: string } | { branchId: null })[] } | Record<string, never>;

/** branchId maydoni BOR modellar uchun: Lead, Student, Group, Room, User, Vacancy, Expense. */
export function branchWhere(s: { branchId: string | null }): BW {
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
