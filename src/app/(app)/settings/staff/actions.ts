"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { ROLES, type Locale } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
import { tr } from "@/lib/tr";
import { getBrand } from "@/lib/brand";
import { claimSipExtension } from "@/lib/sipAssign";
import { archivedEmailError, isValidStaffEmail, normalizeLogin, normalizePassword, staffEmailError } from "@/lib/credentials";

const CAN = [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.DEPUTY_DIRECTOR];
const can = (r: string) => CAN.includes(r as never);
const CAN_DELETE_STAFF = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];
const canDelete = (r: string) => CAN_DELETE_STAFF.includes(r as never);
const STAFF_ROLES = [ROLES.OPERATOR, ROLES.ROP, ROLES.MANAGER, ROLES.DEPUTY_DIRECTOR, ROLES.DIRECTOR, ROLES.ADMIN, ROLES.TEACHER];
const MULTI_BRANCH_ROLES: string[] = [ROLES.ROP, ROLES.OPERATOR, ROLES.MANAGER, ROLES.TEACHER];

async function pickedBranches(fd: FormData, role: string): Promise<string[] | null> {
  if (!MULTI_BRANCH_ROLES.includes(role) || !fd.has("branchesSent")) return null;
  const ids = [...new Set(fd.getAll("branches").map(String).filter(Boolean))];
  if (ids.length === 0) return [];
  const valid = new Set((await prisma.branch.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((b) => b.id));
  return ids.filter((id) => valid.has(id));
}

async function syncExtraBranches(userId: string, primary: string | null, picked: string[]): Promise<void> {
  const extra = picked.filter((b) => b !== primary);
  await prisma.$transaction([
    prisma.userBranch.deleteMany({ where: { userId, branchId: { notIn: extra } } }),
    ...extra.map((branchId) => prisma.userBranch.upsert({ where: { userId_branchId: { userId, branchId } }, create: { userId, branchId }, update: {} })),
  ]);
}

export type State = { ok?: boolean; error?: string; notice?: string };

export async function createStaff(fd: FormData): Promise<State> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  const fullName = String(fd.get("fullName") || "").trim();
  const email = normalizeLogin(fd.get("email"));
  const phone = String(fd.get("phone") || "").trim() || null;
  const position = String(fd.get("position") || "").trim() || null;
  const password = normalizePassword(fd.get("password"));
  const role = String(fd.get("role") || "");

  if (fullName.length < 3) return { error: tr(s.locale, { uz: "F.I.Sh. kamida 3 ta harf bo'lsin", ru: "Ф.И.О. — не менее 3 букв", en: "Full name must be at least 3 characters", de: "Der Name muss mindestens 3 Zeichen lang sein" }) };
  if (!isValidStaffEmail(email)) return { error: staffEmailError(s.locale as Locale) };
  if (password.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль должен быть не менее 4 символов", en: "Password must be at least 4 characters", de: "Das Passwort muss mindestens 4 Zeichen lang sein" }) };
  if (!STAFF_ROLES.includes(role as never)) return { error: tr(s.locale, { uz: "Rol tanlanmagan", ru: "Роль не выбрана", en: "Role not selected", de: "Keine Rolle ausgewählt" }) };
  const picked = await pickedBranches(fd, role);
  if (picked && picked.length === 0) return { error: tr(s.locale, { uz: "Kamida bitta filial belgilang", ru: "Отметьте хотя бы один филиал", en: "Select at least one branch", de: "Mindestens eine Filiale auswählen" }) };
  const primary = picked ? (s.branchId && picked.includes(s.branchId) ? s.branchId : picked[0]) : s.branchId;

  const dup = await prisma.user.findUnique({ where: { email }, select: { id: true, fullName: true, isActive: true, branchId: true, branches: { select: { branchId: true } } } });
  if (dup) {
    if (!dup.isActive) return { error: archivedEmailError(s.locale as Locale, dup.fullName) };
    const targets = picked ?? (s.branchId ? [s.branchId] : []);
    const fresh = targets.filter((b) => b !== dup.branchId && !dup.branches.some((x) => x.branchId === b));
    if (fresh.length === 0) return { error: tr(s.locale, { uz: "Bu email allaqachon mavjud", ru: "Этот email уже существует", en: "This email already exists", de: "Diese E-Mail existiert bereits" }) };
    for (const branchId of fresh) await prisma.userBranch.create({ data: { userId: dup.id, branchId } });
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: dup.id, newValue: { addBranch: fresh }, reason: "Qo'shimcha filialga biriktirildi" });
    revalidatePath("/settings/staff");
    return {
      ok: true,
      notice: tr(s.locale as Locale, {
        uz: `${dup.fullName} allaqachon ro'yxatda — endi shu filialga ham biriktirildi. Login va paroli o'zgarmadi (kiritilgan yangi parol saqlanmadi). Parolni xodimni tahrirlab o'zgartiring.`,
        ru: `${dup.fullName} уже есть в списке — теперь также прикреплён к этому филиалу. Логин и пароль не изменились (введённый пароль не сохранён). Пароль меняется через редактирование сотрудника.`,
        en: `${dup.fullName} already exists — now also assigned to this branch. Login and password are unchanged (the password you typed was not saved). Change the password by editing the staff member.`,
        de: `${dup.fullName} existiert bereits — jetzt auch dieser Filiale zugeordnet. Login und Passwort bleiben gleich (das eingegebene Passwort wurde nicht gespeichert). Passwort über Bearbeiten ändern.`,
      }),
    };
  }

  const claimed = await claimSipExtension(s.locale as Locale, null, String(fd.get("sipExtension") || ""), s);
  if ("error" in claimed) return { error: claimed.error };

  const u = await prisma.user.create({
    data: { fullName, email, phone, position, passwordHash: await hashPassword(password), plainPassword: password, role, branchId: primary, isActive: true, sipExtension: claimed.sip },
  });
  if (picked) await syncExtraBranches(u.id, primary, picked);
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "User", entityId: u.id, newValue: { fullName, role, branches: picked ?? undefined } });
  revalidatePath("/settings/staff");
  return { ok: true };
}

export async function updateStaff(fd: FormData): Promise<State> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const id = String(fd.get("id") || "");
  const fullName = String(fd.get("fullName") || "").trim();
  const phone = String(fd.get("phone") || "").trim() || null;
  const position = String(fd.get("position") || "").trim() || null;
  const role = String(fd.get("role") || "");
  const password = normalizePassword(fd.get("password"));
  if (fullName.length < 3) return { error: tr(s.locale, { uz: "F.I.Sh. kamida 3 ta harf bo'lsin", ru: "Ф.И.О. — не менее 3 букв", en: "Full name must be at least 3 characters", de: "Der Name muss mindestens 3 Zeichen lang sein" }) };
  if (!STAFF_ROLES.includes(role as never)) return { error: tr(s.locale, { uz: "Rol tanlanmagan", ru: "Роль не выбрана", en: "Role not selected", de: "Keine Rolle ausgewählt" }) };

  const picked = await pickedBranches(fd, role);
  if (picked && picked.length === 0) return { error: tr(s.locale, { uz: "Kamida bitta filial belgilang", ru: "Отметьте хотя бы один филиал", en: "Select at least one branch", de: "Mindestens eine Filiale auswählen" }) };

  const cur = await prisma.user.findUnique({ where: { id }, select: { sipExtension: true, branchId: true } });
  if (!cur) return { error: tr(s.locale, { uz: "Xodim topilmadi", ru: "Сотрудник не найден", en: "Staff member not found", de: "Mitarbeiter nicht gefunden" }) };
  const claimed = await claimSipExtension(s.locale as Locale, id, String(fd.get("sipExtension") || ""), s, cur.sipExtension);
  if ("error" in claimed) return { error: claimed.error };
  const primary = picked ? (cur.branchId && picked.includes(cur.branchId) ? cur.branchId : s.branchId && picked.includes(s.branchId) ? s.branchId : picked[0]) : undefined;

  await prisma.user.update({
    where: { id },
    data: { fullName, phone, position, role, sipExtension: claimed.sip, ...(primary !== undefined ? { branchId: primary } : {}), ...(password.length >= 4 ? { passwordHash: await hashPassword(password), plainPassword: password } : {}) },
  });
  if (picked) await syncExtraBranches(id, primary ?? null, picked);
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: id, newValue: { fullName, role, sipExtension: claimed.sip, branches: picked ?? undefined } });
  revalidatePath("/settings/staff");
  return { ok: true };
}

export async function deleteStaff(id: string, reason?: string): Promise<void> {
  const s = await requireSession();
  if (!canDelete(s.role)) return;
  if (id === s.userId) return;
  await prisma.user.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), archiveReason: reason?.trim() || null } }).catch(() => {});
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: id, newValue: { archived: true } });
  revalidatePath("/settings/staff");
  revalidatePath("/archive");
}

export async function inviteStaff(id: string): Promise<State> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, locale: true } });
  if (!u) return { error: tr(s.locale, { uz: "Xodim topilmadi", ru: "Сотрудник не найден", en: "Staff member not found", de: "Mitarbeiter nicht gefunden" }) };
  const rl = (u.locale as Locale) ?? "uz";
  const org = (await getBrand()).name;
  await prisma.notification.create({
    data: {
      userId: u.id,
      title: tr(rl, { uz: "Tizimga taklif", ru: "Приглашение в систему", en: "System invitation", de: "Einladung ins System" }),
      body: tr(rl, {
        uz: `${org} tizimiga kirishingiz mumkin. Login — emailingiz.`,
        ru: `Вы можете войти в систему ${org}. Логин — ваш email.`,
        en: `You can now sign in to ${org}. Your login is your email.`,
        de: `Sie können sich jetzt bei ${org} anmelden. Ihr Login ist Ihre E-Mail.`,
      }),
      channel: "APP",
      event: "invite",
    },
  });
  return { ok: true };
}

export async function importStaff(rows: { fullName: string; email: string; phone?: string; position?: string; role?: string; password?: string }[]): Promise<{ created: number; skipped: number; errors: string[] }> {
  const s = await requireSession();
  if (!can(s.role)) return { created: 0, skipped: 0, errors: [tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" })] };
  let created = 0, skipped = 0;
  const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const fullName = (r.fullName || "").trim();
    const email = normalizeLogin(r.email);
    const role = STAFF_ROLES.includes((r.role || "") as never) ? (r.role as string) : ROLES.OPERATOR;
    if (fullName.length < 3 || !isValidStaffEmail(email)) { skipped++; errors.push(tr(s.locale, { uz: `${i + 1}-qator: nom yoki email noto'g'ri`, ru: `Строка ${i + 1}: неверное имя или email`, en: `Row ${i + 1}: invalid name or email`, de: `Zeile ${i + 1}: ungültiger Name oder E-Mail` })); continue; }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) { skipped++; continue; }
    await prisma.user.create({
      data: { fullName, email, phone: (r.phone || "").trim() || null, position: (r.position || "").trim() || null, role, branchId: s.branchId, passwordHash: await hashPassword(normalizePassword(r.password) || "12345678"), isActive: true },
    });
    created++;
  }
  if (created) await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "User", newValue: { imported: created } });
  revalidatePath("/settings/staff");
  return { created, skipped, errors: errors.slice(0, 5) };
}
