import "server-only";
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
