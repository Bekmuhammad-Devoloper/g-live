"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { tr } from "@/lib/tr";
import { writeAudit } from "@/lib/audit";

// Administrator faqat o'z filialiga tayinlangan — filiallarni boshqara olmaydi (faqat Direktor/o'rinbosar)
const CAN = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR];
const can = (r: string) => CAN.includes(r as never);

export async function saveBranch(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim();
  const address = String(fd.get("address") || "").trim() || null;
  const phone = String(fd.get("phone") || "").trim() || null;
  const latRaw = Number(fd.get("lat")); const lat = Number.isFinite(latRaw) && latRaw !== 0 ? latRaw : null;
  const lngRaw = Number(fd.get("lng")); const lng = Number.isFinite(lngRaw) && lngRaw !== 0 ? lngRaw : null;
  const radius = Math.max(1, Math.round(Number(fd.get("radius")) || 100));
  const imageUrl = String(fd.get("image") || "").trim() || null;
  if (name.length < 2) return { error: tr(s.locale, { uz: "Nomi kamida 2 ta belgi bo'lsin", ru: "Название должно быть не менее 2 символов", en: "Name must be at least 2 characters", de: "Der Name muss mindestens 2 Zeichen lang sein" }) };
  const data = { name, address, phone, lat, lng, radius, imageUrl };
  if (id) await prisma.branch.update({ where: { id }, data });
  else await prisma.branch.create({ data });
  await writeAudit({ actorId: s.userId, action: id ? "UPDATE" : "CREATE", entityType: "Branch", entityId: id || undefined, newValue: { name } });
  revalidatePath("/branches");
  return { ok: true };
}

export async function deleteBranch(id: string): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  // Filialga bog'liq foydalanuvchi/guruh/o'quvchi bo'lsa o'chirmaymiz — sababini aytamiz
  // (ilgari jimgina qaytardi, foydalanuvchi "o'chirilmayapti" deb o'ylardi)
  const [users, groups, students] = await Promise.all([
    prisma.user.count({ where: { branchId: id } }),
    prisma.group.count({ where: { branchId: id } }),
    prisma.student.count({ where: { branchId: id } }),
  ]);
  if (users > 0 || groups > 0 || students > 0) {
    return {
      error: tr(s.locale, {
        uz: `Filialga ${users} xodim, ${groups} guruh, ${students} o'quvchi bog'langan — avval ularni boshqa filialga o'tkazing yoki filialni "Nofaol" qiling (ro'yxatlarda va arizada chiqmaydi).`,
        ru: `К филиалу привязано: сотрудников ${users}, групп ${groups}, учеников ${students} — сначала переведите их в другой филиал или сделайте филиал «Неактивным».`,
        en: `${users} staff, ${groups} groups and ${students} students are linked to this branch — move them first or mark the branch "Inactive".`,
        de: `${users} Mitarbeiter, ${groups} Gruppen und ${students} Schüler sind mit dieser Filiale verknüpft — zuerst verschieben oder die Filiale "Inaktiv" setzen.`,
      }),
    };
  }
  await prisma.branch.deleteMany({ where: { id } });
  await writeAudit({ actorId: s.userId, action: "DELETE", entityType: "Branch", entityId: id });
  revalidatePath("/branches");
  return { ok: true };
}

/** Filialni nofaol/faol qilish — nofaol filial ariza formasida, tanlovlarda chiqmaydi, ma'lumotlar saqlanadi */
export async function setBranchActive(id: string, active: boolean): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };
  await prisma.branch.update({ where: { id }, data: { isActive: active } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Branch", entityId: id, newValue: { isActive: active } });
  revalidatePath("/branches");
  return { ok: true };
}

/* ─── Filialni BARCHA ma'lumotlari bilan o'chirish ───────────────────────
   Orqaga qaytarib bo'lmaydi. Faqat DIREKTOR; filial nomini yozib tasdiqlaydi.
   O'chadi:  o'quvchilar (to'lov tarixi, davomat, sertifikat, topshiriq javoblari,
             o'yin natijalari... kaskad bilan) va ularning kirish hisoblari;
             guruhlar (darslar, davomat, topshiriqlar bilan).
   Uziladi (o'chmaydi): xodimlar, lidlar, market tovarlari — branchId = null.  */

export interface PurgeSummary { students: number; groups: number; users: number; leads: number; payments: number }

/** O'chirishdan oldin ko'rsatiladigan hisob */
export async function branchPurgeSummary(id: string): Promise<PurgeSummary> {
  const s = await requireSession();
  if (s.role !== ROLES.DIRECTOR) return { students: 0, groups: 0, users: 0, leads: 0, payments: 0 };
  const [students, groups, users, leads, payments] = await Promise.all([
    prisma.student.count({ where: { branchId: id } }),
    prisma.group.count({ where: { branchId: id } }),
    prisma.user.count({ where: { branchId: id } }),
    prisma.lead.count({ where: { branchId: id } }),
    prisma.payment.count({ where: { student: { branchId: id } } }),
  ]);
  return { students, groups, users, leads, payments };
}

export async function forceDeleteBranch(id: string, confirmName: string): Promise<{ ok?: boolean; error?: string; deleted?: PurgeSummary }> {
  const s = await requireSession();
  if (s.role !== ROLES.DIRECTOR) return { error: tr(s.locale, { uz: "Faqat direktor o'chira oladi", ru: "Может удалить только директор", en: "Only the director can delete", de: "Nur der Direktor kann löschen" }) };

  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!branch) return { error: tr(s.locale, { uz: "Filial topilmadi", ru: "Филиал не найден", en: "Branch not found", de: "Filiale nicht gefunden" }) };
  if (confirmName.trim().toLowerCase() !== branch.name.trim().toLowerCase()) {
    return { error: tr(s.locale, { uz: "Tasdiqlash uchun filial nomini aynan yozing", ru: "Для подтверждения введите точное название филиала", en: "Type the exact branch name to confirm", de: "Zur Bestätigung den genauen Filialnamen eingeben" }) };
  }
  // O'zining filialini o'chirmasin — seans shu filialga bog'langan bo'lsa ishlash buziladi
  if (s.branchId === id) {
    return { error: tr(s.locale, { uz: "Hozir shu filialdasiz — avval yuqoridan boshqa filialga o'ting", ru: "Вы сейчас в этом филиале — сначала переключитесь на другой", en: "You are in this branch now — switch to another one first", de: "Sie sind gerade in dieser Filiale — wechseln Sie zuerst" }) };
  }

  const summary = await branchPurgeSummary(id);
  const students = await prisma.student.findMany({ where: { branchId: id }, select: { id: true, userId: true } });
  const studentIds = students.map((x) => x.id);
  const loginIds = students.map((x) => x.userId).filter((x): x is string => !!x);

  await prisma.$transaction(async (tx) => {
    // O'quvchilar: kaskadsiz bog'lanishlarni uzamiz, to'lovlarni o'chiramiz, keyin o'zlarini
    if (studentIds.length) {
      await tx.lead.updateMany({ where: { studentId: { in: studentIds } }, data: { studentId: null } });
      await tx.task.updateMany({ where: { studentId: { in: studentIds } }, data: { studentId: null } });
      await tx.payment.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.student.deleteMany({ where: { id: { in: studentIds } } });
    }
    // Guruhlar — GroupStudent/Lesson/Assignment kaskad; Task/SeasonalAssessment/Lead.groupId — null
    await tx.group.deleteMany({ where: { branchId: id } });
    // Uziladi, o'chmaydi
    await tx.user.updateMany({ where: { branchId: id }, data: { branchId: null } });
    await tx.lead.updateMany({ where: { branchId: id }, data: { branchId: null } });
    await tx.marketItem.updateMany({ where: { branchId: id }, data: { branchId: null } });
    await tx.branch.delete({ where: { id } });
  }, { timeout: 120_000, maxWait: 15_000 });

  // O'quvchilarning kirish hisoblari — tranzaksiyadan tashqarida, birma-bir (boshqa yozuvlar ushlab tursa ham to'xtamaydi)
  for (const uid of loginIds) await prisma.user.delete({ where: { id: uid } }).catch(() => {});

  await writeAudit({
    actorId: s.userId,
    action: "DELETE",
    entityType: "Branch",
    entityId: id,
    oldValue: { name: branch.name, ...summary },
    reason: `Filial BARCHA ma'lumotlari bilan o'chirildi: ${branch.name}`,
  });

  revalidatePath("/branches");
  revalidatePath("/students");
  revalidatePath("/groups");
  revalidatePath("/crm");
  return { ok: true, deleted: summary };
}

/* ─── Filialsiz (eski) yozuvlarni filialga biriktirish ───────────────────
   2026-09-17 dan filial doirasi QAT'IY: faol filialda faqat o'sha filial
   yozuvlari ko'rinadi. Ilgari filialsiz yaratilgan xodim/o'quvchi/guruh...
   hech qaysi filialda chiqmaydi — shu yerdan bir bosishda biriktiriladi.
   (Market sovg'alari ataylab umumiy — ular ro'yxatga kirmaydi.)            */

export interface UnassignedCounts { users: number; students: number; groups: number; rooms: number; leads: number; vacancies: number; expenses: number; total: number }

export async function unassignedCounts(): Promise<UnassignedCounts> {
  const s = await requireSession();
  const empty: UnassignedCounts = { users: 0, students: 0, groups: 0, rooms: 0, leads: 0, vacancies: 0, expenses: 0, total: 0 };
  if (!can(s.role)) return empty;

  const w = { branchId: null } as const;
  const [users, students, groups, rooms, leads, vacancies, expenses] = await Promise.all([
    // O'quvchi/ota-ona hisoblari filialsiz bo'lishi normal — ular ro'yxatga kirmaydi
    prisma.user.count({ where: { branchId: null, role: { notIn: [ROLES.STUDENT, ROLES.PARENT] } } }),
    prisma.student.count({ where: w }),
    prisma.group.count({ where: w }),
    prisma.room.count({ where: w }),
    prisma.lead.count({ where: w }),
    prisma.vacancy.count({ where: w }),
    prisma.expense.count({ where: w }),
  ]);
  const total = users + students + groups + rooms + leads + vacancies + expenses;
  return { users, students, groups, rooms, leads, vacancies, expenses, total };
}

export async function assignUnassignedToBranch(branchId: string): Promise<{ ok?: boolean; error?: string; moved?: number }> {
  const s = await requireSession();
  if (!can(s.role)) return { error: tr(s.locale, { uz: "Ruxsat yo'q", ru: "Нет доступа", en: "No permission", de: "Keine Berechtigung" }) };

  const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true, name: true } });
  if (!branch) return { error: tr(s.locale, { uz: "Filial topilmadi", ru: "Филиал не найден", en: "Branch not found", de: "Filiale nicht gefunden" }) };

  const before = await unassignedCounts();
  const data = { branchId: branch.id };
  await prisma.$transaction([
    prisma.user.updateMany({ where: { branchId: null, role: { notIn: [ROLES.STUDENT, ROLES.PARENT] } }, data }),
    prisma.student.updateMany({ where: { branchId: null }, data }),
    prisma.group.updateMany({ where: { branchId: null }, data }),
    prisma.room.updateMany({ where: { branchId: null }, data }),
    prisma.lead.updateMany({ where: { branchId: null }, data }),
    prisma.vacancy.updateMany({ where: { branchId: null }, data }),
    prisma.expense.updateMany({ where: { branchId: null }, data }),
  ]);

  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Branch", entityId: branch.id, newValue: { assigned: before }, reason: `Filialsiz yozuvlar biriktirildi: ${branch.name}` });
  revalidatePath("/", "layout");
  return { ok: true, moved: before.total };
}
