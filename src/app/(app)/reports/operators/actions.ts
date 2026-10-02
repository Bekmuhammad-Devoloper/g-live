"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { canManageAdminTeam, canManageOperators } from "@/lib/operatorAccess";
import { TEAM, teamKindOf, type TeamKind } from "./teamKind";
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

// Bo'lim turi formadagi "kind" maydonidan (operator / admin) — huquq ham, rol ham shunga qarab.
//   operator — Direktor/Administrator (USERS moduli) yoki ROP: operatorlar uning jamoasi;
//   admin    — faqat rahbariyat va ROP (administrator hamkasbini boshqarmaydi).
async function guard(fd: FormData) {
  const s = await requireSession();
  const kind: TeamKind = teamKindOf(fd.get("kind"));
  const allowed = kind === "admin" ? canManageAdminTeam(s.role) : await canManageOperators(s.role, s.userId);
  const error = allowed ? null : tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" });
  return { s, error, kind, cfg: TEAM[kind] };
}

function refresh(kind: TeamKind) {
  revalidatePath(TEAM[kind].base);
}

const notFoundMsg = (locale: string, kind: TeamKind) => tr(locale as never, TEAM[kind].t.notFound);

// ─────────────────────────────────────────────────────────────
// Yangi operator — MANAGER rolidagi foydalanuvchi yaratadi.
// Filial (branchId) joriy sessiyadan olinadi.
// ─────────────────────────────────────────────────────────────
export async function createOperator(fd: FormData): Promise<OpResult> {
  const { s, error, kind, cfg } = await guard(fd);
  if (error) return { error };

  // Administrator filialga biriktiriladi (formadan); operator — yaratuvchining filialida
  let branchId = s.branchId;
  if (kind === "admin") {
    const picked = txt(fd, "branchId");
    const branch = picked ? await prisma.branch.findFirst({ where: { id: picked, isActive: true }, select: { id: true } }) : null;
    if (!branch) return { error: tr(s.locale, { uz: "Filialni tanlang", ru: "Выберите филиал", en: "Select a branch", de: "Filiale wählen" }) };
    branchId = branch.id;
  }

  const fullName = txt(fd, "fullName");
  const email = txt(fd, "email").toLowerCase();
  const phone = txt(fd, "phone") || null;
  const sipExtension = txt(fd, "sipExtension") || null;
  const password = String(fd.get("password") ?? "");
  const fiksa = numOf(fd.get("fiksa"));
  const kpiBonus = numOf(fd.get("kpiBonus"));

  if (fullName.length < 3) return { error: tr(s.locale, { uz: "F.I.Sh. kamida 3 ta harf bo'lsin", ru: "Ф.И.О. — минимум 3 буквы", en: "Full name must be at least 3 letters", de: "Der vollständige Name muss mindestens 3 Buchstaben haben" }) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: tr(s.locale, { uz: "Email noto'g'ri", ru: "Неверный email", en: "Invalid email", de: "Ungültige E-Mail" }) };
  if (password.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль — минимум 4 символа", en: "Password must be at least 4 characters", de: "Das Passwort muss mindestens 4 Zeichen haben" }) };

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: tr(s.locale, { uz: "Bu email allaqachon mavjud", ru: "Этот email уже существует", en: "This email already exists", de: "Diese E-Mail existiert bereits" }) };

  if (sipExtension) {
    const busy = await prisma.user.findUnique({ where: { sipExtension }, select: { id: true } });
    if (busy) return { error: tr(s.locale, { uz: "Bu SIP raqam band", ru: "Этот SIP номер занят", en: "This SIP extension is taken", de: "Diese SIP-Nummer ist bereits vergeben" }) };
  }

  const u = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      sipExtension,
      passwordHash: await hashPassword(password),
      plainPassword: password, // rahbariyat ko'rishi uchun ochiq nusxa
      role: cfg.role,
      branchId,
      fiksa,
      kpiBonus,
      isActive: true,
    },
    select: { id: true },
  });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "User", entityId: u.id, newValue: { fullName, role: cfg.role } });
  refresh(kind);
  return { ok: true, credentials: { fullName, email, password } };
}

// ─────────────────────────────────────────────────────────────
// Operatorni tahrirlash
// ─────────────────────────────────────────────────────────────
export async function updateOperator(fd: FormData): Promise<OpResult> {
  const { s, error, kind, cfg } = await guard(fd);
  if (error) return { error };

  const id = txt(fd, "id");
  const fullName = txt(fd, "fullName");
  const phone = txt(fd, "phone") || null;
  const sipExtension = txt(fd, "sipExtension") || null;
  const password = String(fd.get("password") ?? "");
  const fiksa = numOf(fd.get("fiksa"));
  const kpiBonus = numOf(fd.get("kpiBonus"));

  if (!id) return { error: notFoundMsg(s.locale, kind) };
  if (fullName.length < 3) return { error: tr(s.locale, { uz: "F.I.Sh. kamida 3 ta harf bo'lsin", ru: "Ф.И.О. — минимум 3 буквы", en: "Full name must be at least 3 letters", de: "Der vollständige Name muss mindestens 3 Buchstaben haben" }) };
  if (password && password.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль — минимум 4 символа", en: "Password must be at least 4 characters", de: "Das Passwort muss mindestens 4 Zeichen haben" }) };

  const cur = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, sipExtension: true } });
  if (!cur || cur.role !== cfg.role) return { error: notFoundMsg(s.locale, kind) };

  // Administratorni boshqa filialga o'tkazish (tanlangan bo'lsa)
  let branchPatch: { branchId?: string } = {};
  if (kind === "admin") {
    const picked = txt(fd, "branchId");
    if (picked) {
      const branch = await prisma.branch.findFirst({ where: { id: picked, isActive: true }, select: { id: true } });
      if (!branch) return { error: tr(s.locale, { uz: "Filial topilmadi", ru: "Филиал не найден", en: "Branch not found", de: "Filiale nicht gefunden" }) };
      branchPatch = { branchId: branch.id };
    }
  }

  if (sipExtension && sipExtension !== cur.sipExtension) {
    const busy = await prisma.user.findUnique({ where: { sipExtension }, select: { id: true } });
    if (busy) return { error: tr(s.locale, { uz: "Bu SIP raqam band", ru: "Этот SIP номер занят", en: "This SIP extension is taken", de: "Diese SIP-Nummer ist bereits vergeben" }) };
  }

  await prisma.user.update({
    where: { id },
    data: {
      fullName,
      phone,
      sipExtension,
      fiksa,
      kpiBonus,
      ...branchPatch,
      ...(password ? { passwordHash: await hashPassword(password), plainPassword: password } : {}),
    },
  });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: id, newValue: { fullName, phone, fiksa, kpiBonus, ...branchPatch } });
  refresh(kind);
  revalidatePath(`${cfg.base}/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Operatorni o'chirish = arxivlash (isActive=false).
// Lid/qo'ng'iroq tarixi saqlanib qolishi uchun to'liq o'chirilmaydi.
// ─────────────────────────────────────────────────────────────
export async function archiveOperator(fd: FormData): Promise<OpResult> {
  const { s, error, kind, cfg } = await guard(fd);
  if (error) return { error };

  const id = txt(fd, "id");
  const reason = txt(fd, "reason") || null;
  const cur = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, fullName: true } });
  if (!cur || cur.role !== cfg.role) return { error: notFoundMsg(s.locale, kind) };
  if (id === s.userId) return { error: tr(s.locale, { uz: "O'zingizni o'chira olmaysiz", ru: "Нельзя удалить себя", en: "You cannot remove yourself", de: "Sie können sich nicht selbst entfernen" }) };

  await prisma.user.update({ where: { id }, data: { isActive: false, archivedAt: new Date(), archiveReason: reason } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "User", entityId: id, oldValue: { fullName: cur.fullName } });
  refresh(kind);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Operatorga topshiriq berish (Task + bildirishnoma)
// ─────────────────────────────────────────────────────────────
export async function assignOperatorTask(fd: FormData): Promise<OpResult> {
  const { s, error, kind, cfg } = await guard(fd);
  if (error) return { error };

  const id = txt(fd, "id");
  const title = txt(fd, "title");
  const note = txt(fd, "note") || null;
  const priority = ["LOW", "NORMAL", "HIGH"].includes(txt(fd, "priority")) ? txt(fd, "priority") : "NORMAL";
  const due = txt(fd, "dueAt");

  if (!id) return { error: notFoundMsg(s.locale, kind) };
  if (title.length < 3) return { error: tr(s.locale, { uz: "Sarlavha kamida 3 ta harf bo'lsin", ru: "Заголовок — минимум 3 буквы", en: "Title must be at least 3 letters", de: "Der Titel muss mindestens 3 Buchstaben haben" }) };
  // Topshiriq faqat shu bo'lim a'zosiga beriladi (administrator bo'limidan — administratorga)
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, branchId: true } });
  if (!target || target.role !== cfg.role) return { error: notFoundMsg(s.locale, kind) };

  const t = await prisma.task.create({
    data: {
      kind: "TASK",
      title,
      note,
      priority,
      dueAt: /^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T00:00:00`) : null,
      assigneeId: id,
      authorId: s.userId,
      branchId: kind === "admin" ? target.branchId : s.branchId, // administratorga — uning filialida
    },
    select: { id: true },
  });
  await notify({ userId: id, title, body: note ?? undefined, event: "task" });
  await writeAudit({ actorId: s.userId, action: "CREATE", entityType: "Task", entityId: t.id, newValue: { title, assigneeId: id } });
  refresh(kind);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Operatorga bildirishnoma yuborish
// ─────────────────────────────────────────────────────────────
export async function sendOperatorNotification(fd: FormData): Promise<OpResult> {
  const { s, error, kind, cfg } = await guard(fd);
  if (error) return { error };

  const id = txt(fd, "id");
  const title = txt(fd, "title");
  const body = txt(fd, "body") || undefined;
  const event = txt(fd, "event") || "message";

  if (!id) return { error: notFoundMsg(s.locale, kind) };
  if (title.length < 3) return { error: tr(s.locale, { uz: "Sarlavha kamida 3 ta harf bo'lsin", ru: "Заголовок — минимум 3 буквы", en: "Title must be at least 3 letters", de: "Der Titel muss mindestens 3 Buchstaben haben" }) };
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role !== cfg.role) return { error: notFoundMsg(s.locale, kind) };

  await notify({ userId: id, title, body, event });
  refresh(kind);
  return { ok: true };
}
