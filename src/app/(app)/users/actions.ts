"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { ROLES, ROLE_LABELS, label, isRopPosition, parseMoney } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";
import { MANAGEMENT_ROLES, defaultPositionFor } from "./positions";

const p2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date | null) => (d ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}` : null);

export interface StaffDetail {
  id: string; fullName: string; email: string; phone: string | null;
  roleKey: string; roleLabel: string; branch: string | null;
  /** Tahrirlash formasi uchun xom qiymatlar */
  position: string | null; branchId: string | null; birthDateIso: string | null;
  /** Qo'shimcha filiallar (asosiysidan tashqari) */
  extraBranchIds: string[];
  gender: "MALE" | "FEMALE" | null; birthDate: string | null; isActive: boolean;
  password: string | null; // ochiq parol (rahbariyat ko'rishi uchun)
  fiksa: number; kpiBonus: number; monthTotal: number;
  workdays: number[]; // 1..7 (ish kunlari)
  startTime: string | null; endTime: string | null;
  groups: string[];
}

const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN];
const can = (r: string) => CAN.includes(r as never);

// Rahbariyat (direktor, o'rinbosar) parolini faqat direktor yoki hisob egasining o'zi almashtiradi —
// aks holda administrator direktor parolini o'zgartirib, uning nomidan kira olardi
const canSetPasswordOf = (s: { role: string; userId: string }, target: { id: string; role: string }): boolean =>
  !MANAGEMENT_ROLES.includes(target.role) || s.role === ROLES.DIRECTOR || s.userId === target.id;

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

export type StaffResult = { ok?: boolean; error?: string; notice?: string };

/** Formadagi qo'shimcha filiallar (asosiysi chiqarib tashlanadi) */
const extraBranchesOf = (fd: FormData, primary: string | null): string[] =>
  [...new Set(fd.getAll("extraBranches").map(String).filter((b) => b && b !== primary))];

export async function createStaff(fd: FormData): Promise<StaffResult> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No access", de: "Kein Zugriff" }) };

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
  // Yuqori chegara SHART (Int'ga sig'maydigan qiymat sahifani yiqitadi)
  const fiksa = parseMoney(fd.get("fiksa"));
  if (fiksa === null) return { error: tr(s.locale, { uz: "Summa juda katta (eng ko'pi 1 mlrd so'm) — nollar sonini tekshiring", ru: "Сумма слишком велика (макс. 1 млрд сум) — проверьте количество нулей", en: "Amount too large (max 1 billion) — check the number of zeros", de: "Betrag zu groß (max. 1 Mrd.) — Anzahl der Nullen prüfen" }) };

  if (ism.length < 2) return { error: tr(s.locale, { uz: "Ism kamida 2 ta harf bo'lsin", ru: "Имя должно содержать не менее 2 букв", en: "First name must be at least 2 letters", de: "Der Vorname muss mindestens 2 Buchstaben enthalten" }) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: tr(s.locale, { uz: "Email noto'g'ri", ru: "Неверный email", en: "Invalid email", de: "Ungültige E-Mail" }) };
  if (password.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль должен содержать не менее 4 символов", en: "Password must be at least 4 characters", de: "Das Passwort muss mindestens 4 Zeichen enthalten" }) };
  if (!position) return { error: tr(s.locale, { uz: "Vazifa tanlanmadi", ru: "Должность не выбрана", en: "Position not selected", de: "Position nicht ausgewählt" }) };
  const role = roleForPosition(position);
  if (MANAGEMENT_ROLES.includes(role) && s.role !== ROLES.DIRECTOR) {
    return { error: tr(s.locale, { uz: "Rahbariyat lavozimini faqat direktor beradi", ru: "Руководящую должность назначает только директор", en: "Only the director can assign management positions", de: "Leitungspositionen vergibt nur der Direktor" }) };
  }

  const exists = await prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, branchId: true, branch: { select: { name: true } }, branches: { select: { branchId: true } } },
  });
  if (exists) {
    // Xodim boshqa filialda allaqachon bor — ikkinchi hisob ochilmaydi, shu filialga ham biriktiriladi
    if (!branchId) return { error: tr(s.locale, { uz: "Bu email allaqachon mavjud", ru: "Этот email уже существует", en: "This email already exists", de: "Diese E-Mail existiert bereits" }) };
    if (exists.branchId === branchId || exists.branches.some((b) => b.branchId === branchId)) {
      return { error: tr(s.locale, { uz: "Bu xodim shu filialda allaqachon bor", ru: "Этот сотрудник уже есть в этом филиале", en: "This staff member is already in this branch", de: "Dieser Mitarbeiter ist bereits in dieser Filiale" }) };
    }
    await prisma.userBranch.create({ data: { userId: exists.id, branchId } });
    await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: exists.id, newValue: { addBranch: branchId }, reason: "Qo'shimcha filialga biriktirildi" });
    revalidatePath("/users");
    revalidatePath("/settings/staff");
    const target = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    const from = exists.branch?.name;
    return {
      ok: true,
      // Filial nomlari ko'pincha "… filiali" ko'rinishida — shuning uchun "filialida" so'zi qo'shilmaydi
      notice: tr(s.locale, {
        uz: `${exists.fullName} allaqachon ro'yxatda${from ? ` («${from}»)` : ""}. Endi «${target?.name ?? ""}»ga ham biriktirildi — login va paroli o'zgarmadi.`,
        ru: `${exists.fullName} уже есть в списке${from ? ` («${from}»)` : ""}. Теперь также прикреплён к «${target?.name ?? ""}» — логин и пароль не изменились.`,
        en: `${exists.fullName} is already in the list${from ? ` (${from})` : ""}. Now also assigned to ${target?.name ?? ""} — login and password are unchanged.`,
        de: `${exists.fullName} ist bereits in der Liste${from ? ` (${from})` : ""}. Jetzt auch ${target?.name ?? ""} zugeordnet — Login und Passwort bleiben gleich.`,
      }),
    };
  }

  const extraBranches = extraBranchesOf(fd, branchId);
  const u = await prisma.user.create({
    data: {
      fullName, email, phone, passwordHash: await hashPassword(password), plainPassword: password, role, position, branchId, gender, birthDate, fiksa, isActive: true,
      branches: { create: extraBranches.map((b) => ({ branchId: b })) },
    },
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
        gender: true, birthDate: true, fiksa: true, kpiBonus: true, plainPassword: true, branchId: true,
        branch: { select: { name: true } },
        branches: { select: { branchId: true, branch: { select: { name: true } } } },
        teacherGroups: { where: { status: "ACTIVE" }, select: { name: true, weekdays: true } },
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
      roleKey: u.role, roleLabel: u.position?.trim() || label(ROLE_LABELS, u.role, s.locale),
      branch: [u.branch?.name, ...u.branches.map((b) => b.branch.name)].filter(Boolean).join(" · ") || null,
      extraBranchIds: u.branches.map((b) => b.branchId),
      // Lavozimi yozilmagan (eski) xodimda rolidan kelib chiqadigan nom tanlangan holda ochiladi
      position: u.position ?? defaultPositionFor(u.role), branchId: u.branchId,
      birthDateIso: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null,
      gender: (u.gender === "MALE" || u.gender === "FEMALE" ? u.gender : null) as "MALE" | "FEMALE" | null,
      birthDate: fmtDate(u.birthDate), isActive: u.isActive,
      // Rahbariyat paroli faqat direktorga (va hisob egasiga) ko'rinadi
      password: canSetPasswordOf(s, u) ? u.plainPassword : null,
      fiksa: u.fiksa, kpiBonus: u.kpiBonus, monthTotal,
      workdays, startTime: schedule?.startTime ?? null, endTime: schedule?.endTime ?? null,
      groups: u.teacherGroups.map((g) => g.name),
    },
  };
}

/**
 * Xodimni tahrirlash — "Boshqaruv → Xodimlar" yon panelidagi "Tahrirlash".
 * Ism, telefon, lavozim (rol lavozimdan aniqlanadi — faqat lavozim o'zgarsa),
 * filial (asosiy + qo'shimcha), jins, tug'ilgan sana, oylik, email (login) va parol. Parol maydoni bo'sh
 * yoki o'zgarmagan bo'lsa parolga tegilmaydi.
 * Ruxsat: direktor / o'rinbosari / administrator — o'z-o'zini ham tahrirlaydi.
 */
export async function updateStaff(fd: FormData): Promise<StaffResult> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No access", de: "Kein Zugriff" }) };

  const id = String(fd.get("id") || "");
  const cur = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, position: true, email: true, plainPassword: true } });
  if (!cur) return { error: tr(s.locale, { uz: "Xodim topilmadi", ru: "Сотрудник не найден", en: "Staff member not found", de: "Mitarbeiter nicht gefunden" }) };

  const ism = String(fd.get("ism") || "").trim();
  const familiya = String(fd.get("familiya") || "").trim();
  const fullName = `${ism} ${familiya}`.trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const phone = String(fd.get("phone") || "").trim() || null;
  const position = String(fd.get("position") || "").trim();
  const branchId = String(fd.get("branchId") || "") || null;
  const gender = ["MALE", "FEMALE"].includes(String(fd.get("gender"))) ? String(fd.get("gender")) : null;
  const birthRaw = String(fd.get("birthDate") || "");
  const birthDate = birthRaw ? new Date(birthRaw) : null;
  const fiksa = parseMoney(fd.get("fiksa"));
  if (fiksa === null) return { error: tr(s.locale, { uz: "Summa juda katta (eng ko'pi 1 mlrd so'm) — nollar sonini tekshiring", ru: "Сумма слишком велика (макс. 1 млрд сум) — проверьте количество нулей", en: "Amount too large (max 1 billion) — check the number of zeros", de: "Betrag zu groß (max. 1 Mrd.) — Anzahl der Nullen prüfen" }) };

  if (ism.length < 2) return { error: tr(s.locale, { uz: "Ism kamida 2 ta harf bo'lsin", ru: "Имя должно содержать не менее 2 букв", en: "First name must be at least 2 letters", de: "Der Vorname muss mindestens 2 Buchstaben enthalten" }) };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: tr(s.locale, { uz: "Email noto'g'ri", ru: "Неверный email", en: "Invalid email", de: "Ungültige E-Mail" }) };
  if (!position) return { error: tr(s.locale, { uz: "Vazifa tanlanmadi", ru: "Должность не выбрана", en: "Position not selected", de: "Position nicht ausgewählt" }) };

  // Parol: bo'sh yoki hozirgisi bilan bir xil bo'lsa — o'zgarmaydi
  const password = String(fd.get("password") || "").trim();
  const newPassword = password && password !== cur.plainPassword ? password : null;
  if (newPassword && newPassword.length < 4) return { error: tr(s.locale, { uz: "Parol kamida 4 ta belgi bo'lsin", ru: "Пароль должен содержать не менее 4 символов", en: "Password must be at least 4 characters", de: "Das Passwort muss mindestens 4 Zeichen enthalten" }) };
  if (newPassword && !canSetPasswordOf(s, cur)) return { error: tr(s.locale, { uz: "Rahbariyat parolini faqat direktor o'zgartiradi", ru: "Пароль руководства меняет только директор", en: "Only the director can change a management password", de: "Passwörter der Leitung ändert nur der Direktor" }) };

  if (email !== cur.email) {
    const busy = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (busy && busy.id !== id) return { error: tr(s.locale, { uz: "Bu email allaqachon mavjud", ru: "Этот email уже существует", en: "This email already exists", de: "Diese E-Mail existiert bereits" }) };
  }

  // Rol lavozimdan aniqlanadi — lekin faqat lavozim o'zgarganda (Sozlamalar → Xodimlar
  // orqali qo'lda berilgan rol lavozim o'zgarmasa buzilmasin)
  // Lavozimi yozilmagan xodimda "hozirgi lavozim" — rolidan kelib chiqqan standart nom
  const curPosition = cur.position ?? defaultPositionFor(cur.role) ?? "";
  const role = position !== curPosition ? roleForPosition(position) : cur.role;
  // Rahbariyat rolini berish yoki olib qo'yish — faqat direktor
  if (role !== cur.role && (MANAGEMENT_ROLES.includes(role) || MANAGEMENT_ROLES.includes(cur.role)) && s.role !== ROLES.DIRECTOR) {
    return { error: tr(s.locale, { uz: "Rahbariyat lavozimini faqat direktor o'zgartiradi", ru: "Руководящую должность меняет только директор", en: "Only the director can change management positions", de: "Leitungspositionen ändert nur der Direktor" }) };
  }
  // O'zini direktorlikdan tushirib qo'yish — tizimga kira olmay qolmasin
  if (id === s.userId && role !== cur.role) {
    return { error: tr(s.locale, { uz: "O'z rolingizni o'zgartira olmaysiz", ru: "Вы не можете изменить свою роль", en: "You cannot change your own role", de: "Sie können Ihre eigene Rolle nicht ändern" }) };
  }

  await prisma.user.update({
    where: { id },
    data: {
      fullName, email, phone, position, role, branchId, gender, birthDate, fiksa,
      ...(newPassword ? { passwordHash: await hashPassword(newPassword), plainPassword: newPassword } : {}),
    },
  });
  // Qo'shimcha filiallar: formadagi ro'yxat bilan tenglashtiriladi
  const extraBranches = extraBranchesOf(fd, branchId);
  await prisma.$transaction([
    prisma.userBranch.deleteMany({ where: { userId: id, branchId: { notIn: extraBranches.length ? extraBranches : ["__none__"] } } }),
    ...extraBranches.map((b) => prisma.userBranch.upsert({ where: { userId_branchId: { userId: id, branchId: b } }, create: { userId: id, branchId: b }, update: {} })),
  ]);
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "User", entityId: id, oldValue: { role: cur.role, position: cur.position, email: cur.email }, newValue: { fullName, role, position, branchId, email }, reason: newPassword ? "Parol yangilandi" : undefined });
  revalidatePath("/users");
  revalidatePath("/settings/staff");
  return { ok: true };
}

/**
 * Xodimni bazadan butunlay o'chirish — faqat direktor. Qaytarilmaydi.
 * Xodimning izi qolgan yozuvlar o'chmaydi, faqat undan uziladi: guruhlar ustozsiz,
 * lidlar menejersiz qoladi, to'lov/xarajat/audit yozuvlarida muallif bo'shaydi.
 * Shaxsiy yozuvlar (bildirishnoma, qurilma, oylik, qo'shimcha filial, ish jadvali,
 * o'qituvchi davomati) o'chiriladi.
 */
export async function deleteStaffPermanent(id: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (id === s.userId) return { error: tr(s.locale, { uz: "O'zingizni o'chira olmaysiz", ru: "Вы не можете удалить себя", en: "You cannot delete yourself", de: "Sie können sich nicht selbst löschen" }) };
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, email: true, role: true, branchId: true, branches: { select: { branchId: true } } } });
  if (!u) return { error: tr(s.locale, { uz: "Xodim topilmadi", ru: "Сотрудник не найден", en: "Staff member not found", de: "Mitarbeiter nicht gefunden" }) };
  // Direktor — istalgan xodimni; filial administratori — faqat o'z filialidagi o'qituvchini
  const adminOwnTeacher = s.role === ROLES.ADMIN && u.role === ROLES.TEACHER && !!s.branchId
    && (u.branchId === s.branchId || u.branches.some((b) => b.branchId === s.branchId));
  if (s.role !== ROLES.DIRECTOR && !adminOwnTeacher) {
    return { error: tr(s.locale, { uz: "Xodimni o'chirishga ruxsat yo'q", ru: "Нет права удалять сотрудника", en: "No permission to delete this staff member", de: "Keine Berechtigung zum Löschen" }) };
  }
  if (u.role === ROLES.DIRECTOR) return { error: tr(s.locale, { uz: "Direktor hisobini o'chirib bo'lmaydi", ru: "Аккаунт директора удалить нельзя", en: "A director account cannot be deleted", de: "Ein Direktorkonto kann nicht gelöscht werden" }) };

  await prisma.$transaction([
    prisma.group.updateMany({ where: { teacherId: id }, data: { teacherId: null } }),
    prisma.chatMessage.updateMany({ where: { teacherId: id }, data: { teacherId: null } }),
    prisma.chatMessage.updateMany({ where: { authorId: id }, data: { authorId: null } }),
    prisma.lead.updateMany({ where: { managerId: id }, data: { managerId: null } }),
    prisma.leadActivity.updateMany({ where: { authorId: id }, data: { authorId: null } }),
    prisma.payment.updateMany({ where: { authorId: id }, data: { authorId: null } }),
    prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } }),
    prisma.task.updateMany({ where: { authorId: id }, data: { authorId: null } }),
    prisma.call.updateMany({ where: { operatorId: id }, data: { operatorId: null } }),
    prisma.expense.updateMany({ where: { authorId: id }, data: { authorId: null } }),
    prisma.submission.updateMany({ where: { gradedById: id }, data: { gradedById: null } }),
    prisma.auditLog.updateMany({ where: { actorId: id }, data: { actorId: null } }),
    prisma.student.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.parent.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.teacherSchedule.deleteMany({ where: { teacherId: id } }),
    prisma.teacherAttendance.deleteMany({ where: { teacherId: id } }),
    // bildirishnoma, qurilma, oylik va qo'shimcha filial yozuvlari kaskad bilan o'chadi
    prisma.user.delete({ where: { id } }),
  ]);
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "User", entityId: id, oldValue: { fullName: u.fullName, email: u.email, role: u.role }, reason: "Xodim bazadan o'chirildi" });
  revalidatePath("/users");
  revalidatePath("/settings/staff");
  revalidatePath("/archive");
  return { ok: true };
}

// Xodim parolini yangilash (hash + ochiq nusxa). Rahbariyat.
export async function setUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { ok: false, error: "forbidden" };
  const pw = (newPassword || "").trim();
  if (pw.length < 4) return { ok: false, error: "short" };
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!u) return { ok: false, error: "notfound" };
  if (!canSetPasswordOf(s, u)) return { ok: false, error: "forbidden" };
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
