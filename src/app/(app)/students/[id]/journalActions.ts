"use server";

import { requireSession } from "@/lib/auth";
import { canViewStudentProfile } from "./access";
import { isValidJournalMonth, loadStudentJournal, type StudentJournal } from "./journal";

// O'quvchi profilidagi oylik davomat jurnali — faqat ko'rish. Ruxsat profil
// sahifasi bilan bir xil; davomat belgilash guruh sahifasida qoladi.
export async function getStudentAttendanceJournal(
  studentId: string,
  year: number,
  month0: number,
): Promise<{ ok: boolean; data?: StudentJournal }> {
  const s = await requireSession();
  if (typeof studentId !== "string" || !studentId) return { ok: false };
  if (!isValidJournalMonth(year, month0)) return { ok: false };
  if (!(await canViewStudentProfile(s, studentId))) return { ok: false };
  return { ok: true, data: await loadStudentJournal(studentId, year, month0) };
}
