"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { notify } from "@/lib/notify";

export type TaskState = { ok?: boolean; error?: string };

// Topshiriq/eslatma bilan ishlash — o'quvchi va ota-onadan tashqari barcha xodimlar
function isStaff(role: string) {
  return role !== ROLES.STUDENT && role !== ROLES.PARENT;
}

const schema = z.object({
  kind: z.enum(["TASK", "REMINDER"]),
  title: z.string().min(2),
  note: z.string().optional(),
  tag: z.string().optional(),
  assigneeId: z.string().optional(),
  studentId: z.string().optional(),
  groupId: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  dueAt: z.string().optional(),
});

export async function createTask(_prev: TaskState, formData: FormData): Promise<TaskState> {
  const s = await requireSession();
  if (!isStaff(s.role)) return { error: "forbidden" };

  const parsed = schema.safeParse({
    kind: formData.get("kind") || "TASK",
    title: formData.get("title"),
    note: formData.get("note") || undefined,
    tag: formData.get("tag") || undefined,
    assigneeId: formData.get("assigneeId") || undefined,
    studentId: formData.get("studentId") || undefined,
    groupId: formData.get("groupId") || undefined,
    priority: formData.get("priority") || "NORMAL",
    dueAt: formData.get("dueAt") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };

  const task = await prisma.task.create({
    data: {
      kind: parsed.data.kind,
      title: parsed.data.title,
      note: parsed.data.note || null,
      tag: parsed.data.tag || null,
      priority: parsed.data.priority ?? "NORMAL",
      assigneeId: parsed.data.assigneeId || null,
      studentId: parsed.data.studentId || null,
      groupId: parsed.data.groupId || null,
      authorId: s.userId,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    },
  });

  // Mas'ul xodimga bildirishnoma
  if (task.assigneeId && task.assigneeId !== s.userId) {
    await notify({
      userId: task.assigneeId,
      title: parsed.data.kind === "REMINDER" ? "Yangi eslatma" : "Yangi topshiriq",
      body: task.title,
      event: "task",
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/reminders");
  return { ok: true };
}

export async function toggleTask(id: string): Promise<void> {
  const s = await requireSession();
  if (!isStaff(s.role)) return;

  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;

  const done = t.status !== "DONE";
  await prisma.task.update({
    where: { id },
    data: { status: done ? "DONE" : "OPEN", doneAt: done ? new Date() : null },
  });

  revalidatePath("/tasks");
  revalidatePath("/reminders");
}

export async function deleteTask(id: string): Promise<void> {
  const s = await requireSession();
  if (!isStaff(s.role)) return;
  await prisma.task.delete({ where: { id } }).catch(() => {});
  revalidatePath("/tasks");
  revalidatePath("/reminders");
}
