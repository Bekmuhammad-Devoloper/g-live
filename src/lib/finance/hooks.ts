import "server-only";

import { prisma } from "@/lib/db";
import { syncStudentHistory } from "./billing/history";
import { syncGroupTeacherAssignment } from "./salary/assignments";

// Finance V2 — legacy action'lar uchun yengil hook. O'quvchining guruh a'zoligi
// yoki holati o'zgargandan keyin chaqiriladi va tarixni (GroupStudentHistory,
// StudentStatusHistory) sinxronlaydi. Legacy oqimni HECH QACHON to'xtatmaydi:
// xato faqat logga yoziladi (billing keyingi hisobda baribir sinxronlaydi).

export async function financeAfterStudentChange(studentIds: string | string[], actorId?: string | null): Promise<void> {
  const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
  const at = new Date();
  for (const id of ids) {
    try {
      await syncStudentHistory(prisma, id, { at, actorId: actorId ?? null });
    } catch (e) {
      console.error("finance hook: tarix sinxron bo'lmadi", id, e instanceof Error ? e.message : e);
    }
  }
}

/** Guruh o'qituvchisi (Group.teacherId) o'zgarganda — tayinlash tarixi (MAIN) sinxronlanadi */
export async function financeAfterGroupTeacherChange(groupId: string, actorId?: string | null): Promise<void> {
  try {
    await syncGroupTeacherAssignment(prisma, groupId, { at: new Date(), actorId: actorId ?? null });
  } catch (e) {
    console.error("finance hook: tayinlash tarixi sinxron bo'lmadi", groupId, e instanceof Error ? e.message : e);
  }
}
