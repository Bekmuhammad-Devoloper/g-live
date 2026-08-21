"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, destroySession, createSession, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ROLES, type Locale } from "@/lib/constants";

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function setLocale(locale: Locale) {
  const session = await getSession();
  if (!session) return;
  // Sessiyani yangi til bilan qayta imzolash + foydalanuvchida saqlash
  await createSession({ ...session, locale });
  await prisma.user.update({ where: { id: session.userId }, data: { locale } });
}

// Faol filialni almashtirish — yangi yozuvlar (lid, guruh, o'quvchi) shu filialga bog'lanadi.
// Faqat rahbariyat/administrator filial almashtira oladi.
export async function setBranch(branchId: string): Promise<void> {
  const s = await requireSession();
  const canSwitch = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN].includes(s.role as never);
  if (!canSwitch) return;

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch || !branch.isActive) return;

  await prisma.user.update({ where: { id: s.userId }, data: { branchId } });
  await createSession({ ...s, branchId });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: s.userId,
    newValue: { branchId },
    reason: "Faol filial almashtirildi",
  });
  revalidatePath("/", "layout");
}

// ─── Tez talaba qo'shish (navbardagi + tugmasi) ───
// Ism/Familiya alohida, yosh va qo'shimcha raqam ixtiyoriy.
// Guruh tanlansa — talaba darhol o'sha guruhga biriktiriladi.
const studentSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  age: z.coerce.number().int().min(3).max(100).optional(),
  currentLevel: z.string().optional(),
  groupId: z.string().optional(),
});

export type QuickState = { ok?: boolean; error?: string; studentId?: string };

export async function quickCreateStudent(_prev: QuickState, formData: FormData): Promise<QuickState> {
  const s = await requireSession();
  const allowed = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];
  if (!allowed.includes(s.role as never)) return { error: "forbidden" };

  const parsed = studentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") || undefined,
    phone: formData.get("phone") || undefined,
    phone2: formData.get("phone2") || undefined,
    age: formData.get("age") || undefined,
    currentLevel: formData.get("currentLevel") || undefined,
    groupId: formData.get("groupId") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  // Guruh tanlangan bo'lsa — mavjudligini tekshiramiz (yo'q bo'lsa biriktirmaymiz)
  const group = d.groupId
    ? await prisma.group.findUnique({ where: { id: d.groupId }, select: { id: true, branchId: true, levelCode: true } })
    : null;
  if (d.groupId && !group) return { error: "invalid" };

  const fullName = [d.firstName.trim(), d.lastName?.trim()].filter(Boolean).join(" ");

  const student = await prisma.student.create({
    data: {
      fullName,
      phone: d.phone || null,
      phone2: d.phone2 || null,
      age: d.age ?? null,
      currentLevel: d.currentLevel || group?.levelCode || null,
      branchId: group?.branchId ?? s.branchId,
      // Guruhga biriktirilsa darhol faol, aks holda kutish holatida
      eduStatus: group ? "ACTIVE" : "WAITING",
    },
  });

  if (group) {
    await prisma.groupStudent.create({ data: { groupId: group.id, studentId: student.id } });
  }

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Student",
    entityId: student.id,
    newValue: { fullName: student.fullName, groupId: group?.id ?? null },
    reason: "Navbar orqali tez qo'shildi",
  });

  revalidatePath("/students");
  if (group) revalidatePath(`/groups/${group.id}`);
  return { ok: true, studentId: student.id };
}
