import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";
import { hashPassword, verifyPassword, verifyPasswordInput } from "./auth";
import { normalizePassword } from "./credentials";
import { writeAudit } from "./audit";

export interface LoginCandidate { id: string; passwordHash: string; plainPassword: string | null }

export async function passwordMatches(user: LoginCandidate, raw: string): Promise<boolean> {
  if (await verifyPasswordInput(raw, user.passwordHash)) return true;

  const clean = normalizePassword(raw);
  const stored = user.plainPassword;
  if (!clean || !stored || stored === clean || normalizePassword(stored) !== clean) return false;
  if (!(await verifyPassword(stored, user.passwordHash))) return false;
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(clean), plainPassword: clean } });
  await writeAudit({ actorId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, reason: "Parol chetidagi ko'rinmas belgilardan tozalandi (kirishda)" });
  return true;
}

const FAILED_LOGIN_LOG_MINUTES = 10;

export async function recordFailedLogin(user: { id: string; email: string }, reason: "inactive" | "bad_password"): Promise<void> {
  try {
    const since = new Date(Date.now() - FAILED_LOGIN_LOG_MINUTES * 60_000);
    const recent = await prisma.auditLog.findFirst({ where: { action: "LOGIN_FAILED", entityId: user.id, createdAt: { gte: since } }, select: { id: true } });
    if (recent) return;
    const h = await headers();
    const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await writeAudit({
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
      reason: reason === "inactive" ? `Arxivdagi xodim kirishga urindi: ${user.email}` : `Parol noto'g'ri: ${user.email}`,
      ip,
    });
  } catch (e) {
    console.error("[login] LOGIN_FAILED audit yozilmadi", e);
  }
}

export async function healLegacyEmail(user: { id: string; email: string }, clean: string): Promise<void> {
  if (user.email === clean) return;
  try {
    const taken = await prisma.user.findUnique({ where: { email: clean }, select: { id: true } });
    if (taken) return;
    await prisma.user.update({ where: { id: user.id }, data: { email: clean } });
    await writeAudit({ actorId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, oldValue: { email: user.email }, newValue: { email: clean }, reason: "Email ko'rinmas belgilardan tozalandi (kirishda)" });
  } catch (e) {
    console.error("[login] email tozalanmadi", e);
  }
}
