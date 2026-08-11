"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { canManageOperators } from "@/lib/operatorAccess";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export interface OpResult {
  ok?: boolean;
  error?: string;
  // Yaratilgandan keyin bir marta ko'rsatiladigan kirish ma'lumotlari
  credentials?: { fullName: string; email: string; password: string };
}

const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// Formatlangan ("200 000") qiymatlardan bo'sh joylarni olib tashlab raqamga aylantiramiz
const numOf = (v: FormDataEntryValue | null) => Math.max(0, Math.round(Number(String(v ?? "").replace(/\s/g, "")) || 0));

async function guard() {
  const s = await requireSession();
  // Direktor/Administrator (USERS moduli) yoki ROP — operatorlar uning jamoasi
  const error = (await canManageOperators(s.role, s.userId))
    ? null
    : tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission" });
  return { s, error };
}

function refresh() {
  revalidatePath("/reports/operators");
}

// ─────────────────────────────────────────────────────────────
// Yangi operator — MANAGER rolidagi foydalanuvchi yaratadi.
// Filial (branchId) joriy sessiyadan olinadi.
// ─────────────────────────────────────────────────────────────
export async function createOperator(fd: FormData): Promise<OpResult> {
  const { s, error } = await guard();
  if (error) return { error };

  const fullName = txt(fd, "fullName");
  const email = txt(fd, "email").toLowerCase();
  const phone = txt(fd, "phone") || null;
  const sipExtension = txt(fd, "sipExtension") || null;
  const password = String(fd.get("password") ?? "");
  const fiksa = numOf(fd.get("fiksa"));
  const kpiBonus = numOf(fd.get("kpiBonus"));

  if (fullName.length < 3) return { error: tr(s.locale, { uz: "F.I.Sh. kamida 3 ta harf bo'lsin", ru: "Ф.И.О. — минимум 3 буквы", en: "Full name must be at least 3 letters" }) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: tr(s.locale, { uz: "Email noto'g'ri", ru: "Неверный email", en: "Invalid email" }) };
  if (password.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль — минимум 4 символа", en: "Password must be at least 4 characters" }) };

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: tr(s.locale, { uz: "Bu email allaqachon mavjud", ru: "Этот email уже существует", en: "This email already exists" }) };

  if (sipExtension) {
    const busy = await prisma.user.findUnique({ where: { sipExtension }, select: { id: true } });
    if (busy) return { error: tr(s.locale, { uz: "Bu SIP raqam band", ru: "Этот SIP номер занят", en: "This SIP extension is taken" }) };
  }

  const u = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      sipExtension,
      passwordHash: await hashPassword(password),
      plainPassword: password, // rahbariyat ko'rishi uchun ochiq nusxa
      role: ROLES.OPERATOR,
      branchId: s.branchId,
      fiksa,
      kpiBonus,
      isActive: true,
    },
    select: { id: true },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "User", entityId: u.id, newValue: { fullName, role: ROLES.OPERATOR } });
  refresh();
  return { ok: true, credentials: { fullName, email, password } };
}

// ─────────────────────────────────────────────────────────────
// Operatorni tahrirlash
// ─────────────────────────────────────────────────────────────
export async function updateOperator(fd: FormData): Promise<OpResult> {
  const { s, error } = await guard();
  if (error) return { error };

  const id = txt(fd, "id");
  const fullName = txt(fd, "fullName");
  const phone = txt(fd, "phone") || null;
  const sipExtension = txt(fd, "sipExtension") || null;
  const password = String(fd.get("password") ?? "");
  const fiksa = numOf(fd.get("fiksa"));
  const kpiBonus = numOf(fd.get("kpiBonus"));

  if (!id) return { error: tr(s.locale, { uz: "Operator topilmadi", ru: "Оператор не найден", en: "Operator not found" }) };
  if (fullName.length < 3) return { error: tr(s.locale, { uz: "F.I.Sh. kamida 3 ta harf bo'lsin", ru: "Ф.И.О. — минимум 3 буквы", en: "Full name must be at least 3 letters" }) };
  if (password && password.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль — минимум 4 символа", en: "Password must be at least 4 characters" }) };

  const cur = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, sipExtension: true } });
  if (!cur || cur.role !== ROLES.OPERATOR) return { error: tr(s.locale, { uz: "Operator topilmadi", ru: "Оператор не найден", en: "Operator not found" }) };

  if (sipExtension && sipExtension !== cur.sipExtension) {
    const busy = await prisma.user.findUnique({ where: { sipExtension }, select: { id: true } });
    if (busy) return { error: tr(s.locale, { uz: "Bu SIP raqam band", ru: "Этот SIP номер занят", en: "This SIP extension is taken" }) };
  }

  await prisma.user.update({
    where: { id },
    data: {
      fullName,
      phone,
      sipExtension,
      fiksa,
      kpiBonus,
      ...(password ? { passwordHash: await hashPassword(password), plainPassword: password } : {}),
    },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: id, newValue: { fullName, phone, fiksa, kpiBonus } });
  refresh();
  revalidatePath(`/reports/operators/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Operatorni o'chirish = arxivlash (isActive=false).
// Lid/qo'ng'iroq tarixi saqlanib qolishi uchun to'liq o'chirilmaydi.
// ─────────────────────────────────────────────────────────────
export async function archiveOperator(fd: FormData): Promise<OpResult> {
  const { s, error } = await guard();
  if (error) return { error };

  const id = txt(fd, "id");
  const reason = txt(fd, "reason") || null;
  const cur = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, fullName: true } });
  if (!cur || cur.role !== ROLES.OPERATOR) return { error: tr(s.locale, { uz: "Operator topilmadi", ru: "Оператор не найден", en: "Operator not found" }) };
  if (id === s.userId) return { error: tr(s.locale, { uz: "O'zingizni o'chira olmaysiz", ru: "Нельзя удалить себя", en: "You cannot remove yourself" }) };

  await prisma.user.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), archiveReason: reason } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "User", entityId: id, oldValue: { fullName: cur.fullName } });
  refresh();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Operatorga topshiriq berish (Task + bildirishnoma)
// ─────────────────────────────────────────────────────────────
export async function assignOperatorTask(fd: FormData): Promise<OpResult> {
  const { s, error } = await guard();
  if (error) return { error };

  const id = txt(fd, "id");
  const title = txt(fd, "title");
  const note = txt(fd, "note") || null;
  const priority = ["LOW", "NORMAL", "HIGH"].includes(txt(fd, "priority")) ? txt(fd, "priority") : "NORMAL";
  const due = txt(fd, "dueAt");

  if (!id) return { error: tr(s.locale, { uz: "Operator topilmadi", ru: "Оператор не найден", en: "Operator not found" }) };
  if (title.length < 3) return { error: tr(s.locale, { uz: "Sarlavha kamida 3 ta harf bo'lsin", ru: "Заголовок — минимум 3 буквы", en: "Title must be at least 3 letters" }) };

  const t = await prisma.task.create({
    data: {
      kind: "TASK",
      title,
      note,
      priority,
      dueAt: /^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T00:00:00`) : null,
      assigneeId: id,
      authorId: s.userId,
    },
    select: { id: true },
  });
  await notify({ userId: id, title, body: note ?? undefined, event: "task" });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Task", entityId: t.id, newValue: { title, assigneeId: id } });
  refresh();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Operatorga bildirishnoma yuborish
// ─────────────────────────────────────────────────────────────
export async function sendOperatorNotification(fd: FormData): Promise<OpResult> {
  const { s, error } = await guard();
  if (error) return { error };

  const id = txt(fd, "id");
  const title = txt(fd, "title");
  const body = txt(fd, "body") || undefined;
  const event = txt(fd, "event") || "message";

  if (!id) return { error: tr(s.locale, { uz: "Operator topilmadi", ru: "Оператор не найден", en: "Operator not found" }) };
  if (title.length < 3) return { error: tr(s.locale, { uz: "Sarlavha kamida 3 ta harf bo'lsin", ru: "Заголовок — минимум 3 буквы", en: "Title must be at least 3 letters" }) };

  await notify({ userId: id, title, body, event });
  refresh();
  return { ok: true };
}
