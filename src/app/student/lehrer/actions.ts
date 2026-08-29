"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { MESSAGE_IN, MESSAGE_SENT } from "./const";

// O'quvchi ustoziga xabar yozadi. Xabar ustozning CRM bildirishnomalariga
// tushadi; o'quvchining o'zida esa "yuborilgan" nusxasi tarix uchun saqlanadi
// (event = MESSAGE_SENT, o'qilgan holatda — hisoblagichni oshirmasin).
export type Res = { ok?: boolean; error?: string };

export async function sendToTeacher(text: string): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };

  const body = text.trim();
  if (body.length < 2) return { error: "Xabar juda qisqa" };
  if (body.length > 1000) return { error: "Xabar 1000 belgidan oshmasin" };

  const student = await prisma.student.findUnique({
    where: { userId: s.userId },
    select: {
      fullName: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        select: { group: { select: { name: true, teacherId: true } } },
      },
    },
  });
  if (!student) return { error: "O'quvchi topilmadi" };

  const group = student.enrollments[0]?.group ?? null;
  if (!group?.teacherId) return { error: "Guruhingizga ustoz biriktirilmagan" };

  await prisma.notification.createMany({
    data: [
      {
        userId: group.teacherId,
        title: `${student.fullName} (${group.name}) xabar yubordi`,
        body,
        event: MESSAGE_IN,
        channel: "APP",
      },
      // o'quvchidagi nusxa — faqat tarix uchun
      { userId: s.userId, title: "Ustozga yuborildi", body, event: MESSAGE_SENT, channel: "APP", isRead: true },
    ],
  });

  revalidatePath("/student/lehrer");
  revalidatePath("/notifications");
  return { ok: true };
}
