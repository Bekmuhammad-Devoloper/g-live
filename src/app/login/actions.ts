"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { normalizeLogin } from "@/lib/credentials";
import { healLegacyEmail, passwordMatches, recordFailedLogin } from "@/lib/loginCheck";
import { writeAudit } from "@/lib/audit";
import type { Locale } from "@/lib/constants";
import { safeNextPath } from "@/lib/lessonLink";

const schema = z.object({
  email: z.string().min(3).max(120).regex(/^[^\s]+$/, "no_spaces"),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawLogin = String(formData.get("email") ?? "");
  const parsed = schema.safeParse({
    email: normalizeLogin(rawLogin),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "invalid" };

  const legacyLogin = rawLogin.trim().toLowerCase();
  const legacyUser = legacyLogin !== parsed.data.email ? await prisma.user.findUnique({ where: { email: legacyLogin } }) : null;
  const cleanUser = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const candidates = [legacyUser, cleanUser].filter((u, i, arr): u is NonNullable<typeof u> => !!u && arr.findIndex((x) => x?.id === u.id) === i);
  if (!candidates.length) return { error: "invalid" };

  let user: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    if (c.isActive && (await passwordMatches(c, parsed.data.password))) { user = c; break; }
  }
  if (!user) {
    await recordFailedLogin(candidates[0], candidates[0].isActive ? "bad_password" : "inactive");
    return { error: "invalid" };
  }
  await healLegacyEmail(user, parsed.data.email);

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
