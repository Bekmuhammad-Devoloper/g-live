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
  await createSession({ ...session, locale });
  await prisma.user.update({ where: { id: session.userId }, data: { locale } });
}

export async function setBranch(branchId: string): Promise<void> {
  const s = await requireSession();
  const canSwitch = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR].includes(s.role as never);
  if (!canSwitch) {
    if (!branchId) return;
    const me = await prisma.user.findUnique({
      where: { id: s.userId },
      select: { branchId: true, branches: { select: { branchId: true, branch: { select: { isActive: true } } } } },
    });
    const mine = new Set([me?.branchId, ...(me?.branches.filter((b) => b.branch.isActive).map((b) => b.branchId) ?? [])]);
    if (!mine.has(branchId)) return;
    await createSession({ ...s, branchId });
    revalidatePath("/", "layout");
    return;
  }

  const all = !branchId;
  if (all && !([ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR] as string[]).includes(s.role)) return;

  const branch = all ? null : await prisma.branch.findUnique({ where: { id: branchId } });
  if (!all && (!branch || !branch.isActive)) return;

  const next = all ? null : branchId;
  await prisma.user.update({ where: { id: s.userId }, data: { branchId: next } });
  await createSession({ ...s, branchId: next });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: s.userId,
    newValue: { branchId: next },
    reason: all ? "Barcha filiallar rejimi" : "Faol filial almashtirildi",
  });
  revalidatePath("/", "layout");
}

const studentSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  age: z.coerce.number().int().min(3).max(100).optional(),
  currentLevel: z.string().optional(),
  groupId: z.string().optional(),
  debt: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

export type QuickState = { ok?: boolean; error?: string; studentId?: string };

export async function quickCreateStudent(_prev: QuickState, formData: FormData): Promise<QuickState> {
  const s = await requireSession();
  const allowed = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.MANAGER, ROLES.ADMIN];
  if (!allowed.includes(s.role as never)) return { error: "forbidden" };

  const rawFull = String(formData.get("fullName") ?? "").trim();
  const [fullFirst, ...fullRest] = rawFull.split(/\s+/);

  const parsed = studentSchema.safeParse({
    firstName: formData.get("firstName") || fullFirst || undefined,
    lastName: formData.get("lastName") || (fullRest.length ? fullRest.join(" ") : undefined),
    phone: formData.get("phone") || undefined,
    phone2: formData.get("phone2") || undefined,
    age: formData.get("age") || undefined,
    currentLevel: formData.get("currentLevel") || undefined,
    groupId: formData.get("groupId") || undefined,
    debt: formData.get("debt") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

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
      eduStatus: group ? "ACTIVE" : "WAITING",
    },
  });

  if (group) {
    await prisma.groupStudent.create({ data: { groupId: group.id, studentId: student.id } });
  }

  if (d.debt && d.debt > 0) {
    await prisma.payment.create({
      data: {
        studentId: student.id,
        amount: d.debt,
        method: "CASH",
        status: "PENDING",
        isManual: true,
        purpose: "Boshlang'ich qarz",
        authorId: s.userId,
      },
    });
  }

  await writeAudit({
    actorId: s.userId,
    action: "CREATE",
    entityType: "Student",
    entityId: student.id,
    newValue: { fullName: student.fullName, groupId: group?.id ?? null, debt: d.debt ?? 0 },
    reason: "Navbar orqali tez qo'shildi",
  });

  revalidatePath("/students");
  if (d.debt && d.debt > 0) revalidatePath("/finance/debtors");
  if (group) revalidatePath(`/groups/${group.id}`);
  return { ok: true, studentId: student.id };
}
