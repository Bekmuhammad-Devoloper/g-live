"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { tr } from "@/lib/tr";
import { CHAT_MAX } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { canRead, canWrite, MODULES } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/constants";

export type Res = { ok?: boolean; error?: string };

// Xodim shu o'quvchining yozishmasini ko'ra oladimi?
// Ustoz — faqat o'z guruhi o'quvchisi bilan; rahbariyat — hammasi bilan.
async function canTouch(role: string, userId: string, studentId: string): Promise<boolean> {
  if (!canRead(role, MODULES.CHAT)) return false;
  if (role !== ROLES.TEACHER) return true;
  const own = await prisma.groupStudent.findFirst({
    where: { studentId, isActive: true, group: { teacherId: userId } },
    select: { id: true },
  });
  return !!own;
}

export async function replyToStudent(studentId: string, text: string): Promise<Res> {
  const s = await requireSession();
  if (!canWrite(s.role, MODULES.CHAT)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  if (!(await canTouch(s.role, s.userId, studentId))) return { error: tr(s.locale, { uz: "Bu o'quvchi sizga biriktirilmagan", ru: "Этот ученик не закреплён за вами", en: "This student is not assigned to you", de: "Dieser Schüler ist Ihnen nicht zugewiesen" }) };

  const body = text.trim();
  if (body.length < 1) return { error: tr(s.locale, { uz: "Xabar bo'sh", ru: "Сообщение пустое", en: "Message is empty", de: "Nachricht ist leer" }) };
  if (body.length > CHAT_MAX) return { error: tr(s.locale, { uz: `Xabar ${CHAT_MAX} belgidan oshmasin`, ru: `Сообщение не должно превышать ${CHAT_MAX} символов`, en: `Message must not exceed ${CHAT_MAX} characters`, de: `Die Nachricht darf ${CHAT_MAX} Zeichen nicht überschreiten` }) };

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      userId: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { group: { select: { teacherId: true } } },
      },
    },
  });
  if (!student) return { error: tr(s.locale, { uz: "O'quvchi topilmadi", ru: "Ученик не найден", en: "Student not found", de: "Schüler nicht gefunden" }) };

  const teacherId = student.enrollments[0]?.group.teacherId ?? (s.role === ROLES.TEACHER ? s.userId : null);

  const pending = student.userId
    ? await prisma.chatMessage.count({ where: { studentId, fromStudent: false, readAt: null } })
    : 0;

  await prisma.chatMessage.create({
    data: { studentId, teacherId, fromStudent: false, authorId: s.userId, text: body },
  });

  // O'quvchini ortiqcha bezovta qilmaymiz: o'qilmagani bo'lsa xabar bermaymiz
  if (student.userId && pending === 0) {
    // O'quvchining tilida (notify oluvchi tilini o'zi tanlaydi)
    await notify({
      userId: student.userId,
      title: { uz: "Ustozdan javob", ru: "Ответ преподавателя", en: "Reply from your teacher", de: "Antwort der Lehrkraft" },
      body: body.slice(0, 120),
      event: "CHAT",
      url: "/student/lehrer",
    });
  }

  revalidatePath("/chat");
  revalidatePath("/student/lehrer");
  return { ok: true };
}

// O'quvchidan kelgan xabarlarni o'qilgan deb belgilash
export async function markThreadRead(studentId: string): Promise<Res> {
  const s = await requireSession();
  if (!(await canTouch(s.role, s.userId, studentId))) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  await prisma.chatMessage.updateMany({
    where: { studentId, fromStudent: true, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/chat");
  return { ok: true };
}
