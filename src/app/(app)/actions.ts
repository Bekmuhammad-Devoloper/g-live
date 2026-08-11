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
const studentSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  currentLevel: z.string().optional(),
});

export type QuickState = { ok?: boolean; error?: string };

export async function quickCreateStudent(_prev: QuickState, formData: FormData): Promise<QuickState> {
  const s = await requireSession();
  const allowed = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];
  if (!allowed.includes(s.role as never)) return { error: "forbidden" };

  const parsed = studentSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || undefined,
    currentLevel: formData.get("currentLevel") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const student = await prisma.student.create({
    data: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone || null,
      currentLevel: parsed.data.currentLevel || null,
      branchId: s.branchId,
      eduStatus: "WAITING",
    },
  });

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Student",
    entityId: student.id,
    newValue: { fullName: student.fullName },
    reason: "Navbar orqali tez qo'shildi",
  });

  revalidatePath("/students");
  return { ok: true };
}
