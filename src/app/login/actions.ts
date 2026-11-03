"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { normalizeLogin } from "@/lib/credentials";
import { passwordMatches } from "@/lib/loginCheck";
import { writeAudit } from "@/lib/audit";
import type { Locale } from "@/lib/constants";
import { safeNextPath } from "@/lib/lessonLink";

const schema = z.object({
  email: z.string().min(3).max(120).regex(/^[^\s]+$/, "no_spaces"),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: normalizeLogin(formData.get("email")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "invalid" };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return { error: "invalid" };
  if (!user.isActive) {
    await writeAudit({ action: "LOGIN_FAILED", entityType: "User", entityId: user.id, reason: "inactive" });
    return { error: "invalid" };
  }

  const ok = await passwordMatches(user, parsed.data.password);
  if (!ok) {
    await writeAudit({ action: "LOGIN_FAILED", entityType: "User", entityId: user.id, reason: "bad_password" });
    return { error: "invalid" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

  await createSession({
    userId: user.id,
    role: user.role,
    fullName: user.fullName,
    locale: (user.locale as Locale) ?? "uz",
    branchId: user.branchId,
  });

  redirect(safeNextPath(formData.get("next")) ?? (user.role === "STUDENT" ? "/student" : "/dashboard"));
}
