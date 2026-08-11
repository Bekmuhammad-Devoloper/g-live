"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { ROLES, ROLE_LABELS, label, isRopPosition } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date | null) => (d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}` : null);

export interface StaffDetail {
  id: string; fullName: string; email: string; phone: string | null;
  roleKey: string; roleLabel: string; branch: string | null;
  gender: "MALE" | "FEMALE" | null; birthDate: string | null; isActive: boolean;
  password: string | null; // ochiq parol (rahbariyat ko'rishi uchun)
  fiksa: number; kpiBonus: number; monthTotal: number;
  workdays: number[]; // 1..7 (ish kunlari)
  startTime: string | null; endTime: string | null;
  groups: string[];
}

const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const can = (r: string) => CAN.includes(r as never);

// Rollar katalogidagi lavozim nomidan tizim ruxsatlari (RBAC roli) ni aniqlaydi.
// Katalog rollari (ROP, Operator, Moliyachi, Marketolog...) erkin qo'shilishi mumkin,
// shu sabab aniq nomlar bo'yicha kalit so'z orqali eng yaqin RBAC roliga bog'laymiz.
function roleForPosition(position: string): string {
  const p = position.toLowerCase();
  if (p.includes("administr")) return ROLES.ADMIN;
  if (p.includes("filial")) return ROLES.DEPUTY_DIRECTOR; // faqat bitta filialni boshqaradi — DIRECTOR emas
  if (p.includes("o'rinbosar") || p.includes("o‘rinbosar") || p.includes("orinbosar")) return ROLES.DEPUTY_DIRECTOR;
  if (p.includes("direktor")) return ROLES.DIRECTOR;
  if (p.includes("o'qituvchi") || p.includes("o‘qituvchi") || p.includes("ustoz") || p.includes("teacher")) return ROLES.TEACHER;
  if (p.includes("moliya") || p.includes("hisobchi") || p.includes("buxgalter") || p.includes("bugalter") || p.includes("accountant")) return ROLES.ACCOUNTANT; // faqat moliya (to'lov/xarajat/oylik) — CRM/guruhlarga kirmaydi
  // Sotuv bo'limi boshlig'i — alohida ROP roli (operatorlarni boshqaradi)
  if (isRopPosition(p)) return ROLES.ROP;
  return ROLES.OPERATOR; // Operator, Marketolog va shunga o'xshash sotuv xodimlari
}

export async function createStaff(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No access" }) };

  const ism = String(fd.get("ism") || "").trim();
  const familiya = String(fd.get("familiya") || "").trim();
  const fullName = `${ism} ${familiya}`.trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const phone = String(fd.get("phone") || "").trim() || null;
  const password = String(fd.get("password") || "");
  const position = String(fd.get("position") || "").trim();
  const branchId = String(fd.get("branchId") || "") || null;
  const gender = ["MALE", "FEMALE"].includes(String(fd.get("gender"))) ? String(fd.get("gender")) : null;
  const birthRaw = String(fd.get("birthDate") || "");
  const birthDate = birthRaw ? new Date(birthRaw) : null;
  const fiksa = Math.max(0, Math.round(Number(fd.get("fiksa")) || 0));

  if (ism.length < 2) return { error: tr(s.locale, { uz: "Ism kamida 2 ta harf bo'lsin", ru: "Имя должно содержать не менее 2 букв", en: "First name must be at least 2 letters" }) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: tr(s.locale, { uz: "Email noto'g'ri", ru: "Неверный email", en: "Invalid email" }) };
  if (password.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль должен содержать не менее 4 символов", en: "Password must be at least 4 characters" }) };
  if (!position) return { error: tr(s.locale, { uz: "Vazifa tanlanmadi", ru: "Должность не выбрана", en: "Position not selected" }) };
  const role = roleForPosition(position);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: tr(s.locale, { uz: "Bu email allaqachon mavjud", ru: "Этот email уже существует", en: "This email already exists" }) };

  const u = await prisma.user.create({
    data: { fullName, email, phone, passwordHash: await hashPassword(password), plainPassword: password, role, position, branchId, gender, birthDate, fiksa, isActive: true },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "User", entityId: u.id, newValue: { fullName, role, position } });
  revalidatePath("/users");
  return { ok: true };
}

// Xodim batafsil ma'lumoti (login/parol/oylik/ish kuni/guruhlar). Faqat rahbariyat, talab bo'yicha.
export async function getStaffDetail(userId: string): Promise<{ ok: boolean; data?: StaffDetail; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false, error: "forbidden" };
  const now = new Date();
  const [u, schedule] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, fullName: true, email: true, phone: true, role: true, position: true, isActive: true,
        gender: true, birthDate: true, fiksa: true, kpiBonus: true, plainPassword: true,
        branch: { select: { name: true } },
        teacherGroups: { where: { status: { not: "CANCELLED" } }, select: { name: true, weekdays: true } },
        salaries: { where: { year: now.getFullYear(), month: now.getMonth() + 1 }, take: 1 },
      },
    }),
    prisma.teacherSchedule.findUnique({ where: { teacherId: userId } }),
  ]);
  if (!u) return { ok: false, error: "notfound" };

  // Ish kunlari: jadval bo'lsa — o'sha, bo'lmasa guruhlar kunlaridan
  let workdays: number[] = [];
  if (schedule?.weekdays) workdays = schedule.weekdays.split(",").map(Number).filter((n) => n >= 1 && n <= 7);
  else {
    const set = new Set<number>();
    for (const g of u.teacherGroups) for (const n of (g.weekdays ?? "").split(",").map(Number)) if (n >= 1 && n <= 7) set.add(n);
    workdays = [...set].sort((a, b) => a - b);
  }
  const cur = u.salaries[0];
  const monthTotal = u.fiksa + u.kpiBonus + (cur?.bonus ?? 0) - (cur?.penalty ?? 0);

  return {
    ok: true,
    data: {
      id: u.id, fullName: u.fullName, email: u.email, phone: u.phone,
      roleKey: u.role, roleLabel: u.position?.trim() || label(ROLE_LABELS, u.role, s.locale), branch: u.branch?.name ?? null,
      gender: (u.gender === "MALE" || u.gender === "FEMALE" ? u.gender : null) as "MALE" | "FEMALE" | null,
      birthDate: fmtDate(u.birthDate), isActive: u.isActive,
      password: u.plainPassword,
      fiksa: u.fiksa, kpiBonus: u.kpiBonus, monthTotal,
      workdays, startTime: schedule?.startTime ?? null, endTime: schedule?.endTime ?? null,
      groups: u.teacherGroups.map((g) => g.name),
    },
  };
}

// Xodim parolini yangilash (hash + ochiq nusxa). Rahbariyat.
export async function setUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false, error: "forbidden" };
  const pw = (newPassword || "").trim();
  if (pw.length < 4) return { ok: false, error: "short" };
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!u) return { ok: false, error: "notfound" };
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw), plainPassword: pw } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: userId, reason: "Parol yangilandi" });
  return { ok: true };
}

export async function toggleStaffActive(id: string): Promise<void> {
  const s = await requireSession();
  if (!can(s.role)) return;
  const u = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
  if (!u) return;
  await prisma.user.update({ where: { id }, data: { isActive: !u.isActive } });
  revalidatePath("/users");
}

/**
 * Xodim (operator/menejer/administrator…) profil rasmini o'rnatadi yoki o'chiradi (null).
 * O'qituvchilar uchun alohida `teachers/teacherActions.setTeacherImage` bor — bu qolgan xodimlar uchun.
 * Rasm data URL sifatida `User.imageUrl` ga saqlanadi (mijozda 220px ga kichraytirilgan JPEG).
 */
export async function setStaffImage(userId: string, dataUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false, error: "forbidden" };

  let value: string | null = null;
  if (dataUrl) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(dataUrl)) return { ok: false, error: "format" };
    if (dataUrl.length > 900_000) return { ok: false, error: "too_big" };
    value = dataUrl;
  }

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } });
  if (!u) return { ok: false, error: "notfound" };

  await prisma.user.update({ where: { id: userId }, data: { imageUrl: value } });
  await writeAudit({
    actorId: s.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    newValue: { imageUrl: value ? "(rasm)" : null },
    reason: value ? `Xodim rasmi yuklandi (${u.fullName})` : `Xodim rasmi o'chirildi (${u.fullName})`,
  });

  revalidatePath("/users");
  revalidatePath("/rop/operators");
  revalidatePath("/reports/kpi");
  return { ok: true };
}
