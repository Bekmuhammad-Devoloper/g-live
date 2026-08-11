"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

const CAN = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];
const can = (r: string) => CAN.includes(r as never);
const STAFF_ROLES = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export type State = { ok?: boolean; error?: string };

export async function createStaff(fd: FormData): Promise<State> {
  const s = await requireSession();
  if (!can(s.role)) return { error: "Ruxsat yo'q" };

  const fullName = String(fd.get("fullName") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const phone = String(fd.get("phone") || "").trim() || null;
  const position = String(fd.get("position") || "").trim() || null;
  const password = String(fd.get("password") || "");
  const role = String(fd.get("role") || "");

  if (fullName.length < 3) return { error: "F.I.Sh. kamida 3 ta harf bo'lsin" };
  if (!emailOk(email)) return { error: "Email noto'g'ri" };
  if (password.length < 4) return { error: "Parol kamida 4 ta belgi bo'lsin" };
  if (!STAFF_ROLES.includes(role as never)) return { error: "Rol tanlanmagan" };

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return { error: "Bu email allaqachon mavjud" };

  const u = await prisma.user.create({
    data: { fullName, email, phone, position, passwordHash: await hashPassword(password), role, branchId: s.branchId, isActive: true },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "User", entityId: u.id, newValue: { fullName, role } });
  revalidatePath("/settings/staff");
  return { ok: true };
}

export async function updateStaff(fd: FormData): Promise<State> {
  const s = await requireSession();
  if (!can(s.role)) return { error: "Ruxsat yo'q" };
  const id = String(fd.get("id") || "");
  const fullName = String(fd.get("fullName") || "").trim();
  const phone = String(fd.get("phone") || "").trim() || null;
  const position = String(fd.get("position") || "").trim() || null;
  const role = String(fd.get("role") || "");
  const password = String(fd.get("password") || "");
  if (fullName.length < 3) return { error: "F.I.Sh. kamida 3 ta harf bo'lsin" };
  if (!STAFF_ROLES.includes(role as never)) return { error: "Rol tanlanmagan" };

  await prisma.user.update({
    where: { id },
    data: { fullName, phone, position, role, ...(password.length >= 4 ? { passwordHash: await hashPassword(password) } : {}) },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: id, newValue: { fullName, role } });
  revalidatePath("/settings/staff");
  return { ok: true };
}

export async function deleteStaff(id: string, reason?: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  if (id === s.userId) return; // o'zini o'chira olmaydi
  await prisma.user.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), archiveReason: reason?.trim() || null } }).catch(() => {});
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: id, newValue: { archived: true } });
  revalidatePath("/settings/staff");
  revalidatePath("/archive");
}

// Konvert (Amallar) — xodimga ilova ichida taklif/xabar yuboradi
export async function inviteStaff(id: string): Promise<State> {
  const s = await requireSession();
  if (!can(s.role)) return { error: "Ruxsat yo'q" };
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true } });
  if (!u) return { error: "Xodim topilmadi" };
  await prisma.notification.create({
    data: { userId: u.id, title: "Tizimga taklif", body: "Germaniya Live tizimiga kirishingiz mumkin. Login — emailingiz.", channel: "APP", event: "invite" },
  });
  return { ok: true };
}

// Import — [{fullName,email,phone,position,role,password}] massividan ommaviy yaratadi
export async function importStaff(rows: { fullName: string; email: string; phone?: string; position?: string; role?: string; password?: string }[]): Promise<{ created: number; skipped: number; errors: string[] }> {
  const s = await requireSession();
  if (!can(s.role)) return { created: 0, skipped: 0, errors: ["Ruxsat yo'q"] };
  let created = 0, skipped = 0;
  const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const fullName = (r.fullName || "").trim();
    const email = (r.email || "").trim().toLowerCase();
    // Import faylida rol ko'rsatilmagan bo'lsa — operator (sotuv bo'limi asosiy xodimi)
    const role = STAFF_ROLES.includes((r.role || "") as never) ? (r.role as string) : ROLES.OPERATOR;
    if (fullName.length < 3 || !emailOk(email)) { skipped++; errors.push(`${i + 1}-qator: nom yoki email noto'g'ri`); continue; }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) { skipped++; continue; }
    await prisma.user.create({
      data: { fullName, email, phone: (r.phone || "").trim() || null, position: (r.position || "").trim() || null, role, branchId: s.branchId, passwordHash: await hashPassword((r.password || "").trim() || "12345678"), isActive: true },
    });
    created++;
  }
  if (created) await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "User", newValue: { imported: created } });
  revalidatePath("/settings/staff");
  return { created, skipped, errors: errors.slice(0, 5) };
}
