"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { Locale } from "@/lib/constants";
import { safeNextPath } from "@/lib/lessonLink";

// Login — e-mail YOKI foydalanuvchi nomi (o'quvchilarga "ism" ko'rinishida
// beriladi, xodimlarda avvalgidek e-mail). Ikkalasi ham User.email da saqlanadi.
const schema = z.object({
  email: z.string().min(3).max(120).regex(/^[^\s]+$/, "no_spaces"),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "invalid" };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive) return { error: "invalid" };

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return { error: "invalid" };

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

  await createSession({
    userId: user.id,
    role: user.role,
    fullName: user.fullName,
    locale: (user.locale as Locale) ?? "uz",
    branchId: user.branchId,
  });

  // Dars QR havolasidan kelingan bo'lsa — o'sha darsga; aks holda
  // o'quvchi mobil ilova ko'rinishidagi portalga, xodim boshqaruv paneliga
  redirect(safeNextPath(formData.get("next")) ?? (user.role === "STUDENT" ? "/student" : "/dashboard"));
}
