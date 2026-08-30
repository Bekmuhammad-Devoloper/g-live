"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { activeTeacherOf, CHAT_MAX } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { notify } from "@/lib/notify";

export type Res = { ok?: boolean; error?: string };

// O'quvchi ustoziga xabar yozadi.
export async function sendMessage(text: string): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };

  const body = text.trim();
  if (body.length < 1) return { error: "Xabar bo'sh" };
  if (body.length > CHAT_MAX) return { error: `Xabar ${CHAT_MAX} belgidan oshmasin` };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: { id: true, fullName: true },
  });
  if (!student) return { error: "O'quvchi topilmadi" };

  const teacherId = await activeTeacherOf(student.id);

  // Ustozni bezovta qilmaslik uchun: o'qilmagan xabar allaqachon bo'lsa,
  // yangi bildirishnoma yubormaymiz (chat ichida baribir ko'rinadi).
  const pending = teacherId
    ? await prisma.chatMessage.count({ where: { teacherId, studentId: student.id, fromStudent: true, readAt: null } })
    : 0;

  await prisma.chatMessage.create({
    data: { studentId: student.id, teacherId, fromStudent: true, authorId: s.userId, text: body },
  });

  if (teacherId && pending === 0) {
    await notify({
      userId: teacherId,
      title: `${student.fullName} xabar yozdi`,
      body: body.slice(0, 120),
      event: "CHAT",
    });
  }

  revalidatePath("/student/lehrer");
  revalidatePath("/chat");
  return { ok: true };
}

// Ustozdan kelgan xabarlarni o'qilgan deb belgilash
export async function markRead(): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };

  const student = await prisma.student.findUnique({ where: { userId: s.userId }, select: { id: true } });
  if (!student) return { error: "O'quvchi topilmadi" };

  await prisma.chatMessage.updateMany({
    where: { studentId: student.id, fromStudent: false, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}
