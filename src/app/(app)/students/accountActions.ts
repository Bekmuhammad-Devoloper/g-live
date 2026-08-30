"use server";

import { revalidatePath } from "next/cache";
import { hashPassword, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { defaultPassword, freeLogin, translit } from "@/lib/studentLogin";
import { writeAudit } from "@/lib/audit";

// O'quvchining ilova hisobi (login/parol) — CRM dagi o'quvchi kartochkasidan
// boshqariladi. Sukut: login = ismi kichik harflarda, parol = telefon raqami.

export type Account = { login: string; password: string | null; active: boolean };
export type AccountRes = { ok?: boolean; error?: string; account?: Account };

const MANAGERS = [ROLES.DIRECTOR, ROLES.DEPUTY_DIRECTOR, ROLES.ADMIN, ROLES.MANAGER];

async function guard() {
  const s = await requireSession();
  if (!MANAGERS.includes(s.role as never)) return { s, error: "Ruxsat yo'q" };
  return { s, error: null as string | null };
}

// Kartochka ochilganda hisobni ko'rsatish (yo'q bo'lsa — bo'sh)
export async function getStudentAccount(studentId: string): Promise<AccountRes> {
  const { error } = await guard();
  if (error) return { error };

  const st = await prisma.student.findUnique({
    where: { id: studentId },
    select: { user: { select: { email: true, plainPassword: true, isActive: true } } },
  });
  if (!st) return { error: "O'quvchi topilmadi" };
  if (!st.user) return { ok: true };

  return {
    ok: true,
    account: { login: st.user.email, password: st.user.plainPassword, active: st.user.isActive },
  };
}

// Hisob yaratish yoki sukutdagi login/parolga qaytarish
export async function resetStudentAccount(studentId: string): Promise<AccountRes> {
  const { s, error } = await guard();
  if (error) return { error };

  const st = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, phone: true, branchId: true, userId: true },
  });
  if (!st) return { error: "O'quvchi topilmadi" };

  const login = await freeLogin(st.fullName, st.userId ?? undefined);
  const password = defaultPassword(st.phone);
  const passwordHash = await hashPassword(password);

  if (st.userId) {
    await prisma.user.update({
      where: { id: st.userId },
      data: { email: login, passwordHash, plainPassword: password, isActive: true },
    });
  } else {
    const user = await prisma.user.create({
      data: {
        fullName: st.fullName,
        email: login,
        phone: st.phone,
        passwordHash,
        plainPassword: password,
        role: ROLES.STUDENT,
        branchId: st.branchId ?? s.branchId,
        isActive: true,
      },
      select: { id: true },
    });
    await prisma.student.update({ where: { id: st.id }, data: { userId: user.id } });
  }

  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Student", entityId: st.id, newValue: { account: login } });
  revalidatePath("/students");
  return { ok: true, account: { login, password, active: true } };
}

// Ma'muriyat login/parolni qo'lda o'zgartiradi
export async function saveStudentAccount(studentId: string, loginRaw: string, passwordRaw: string): Promise<AccountRes> {
  const { s, error } = await guard();
  if (error) return { error };

  const login = translit(loginRaw) || loginRaw.trim().toLowerCase();
  const password = passwordRaw.trim();

  if (login.length < 3) return { error: "Login kamida 3 ta belgi bo'lsin" };
  if (/\s/.test(login)) return { error: "Loginda bo'shliq bo'lmasin" };
  if (password && password.length < 4) return { error: "Parol kamida 4 ta belgi bo'lsin" };

  const st = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, phone: true, branchId: true, userId: true },
  });
  if (!st) return { error: "O'quvchi topilmadi" };

  const busy = await prisma.user.findUnique({ where: { email: login }, select: { id: true } });
  if (busy && busy.id !== st.userId) return { error: "Bu login band" };

  if (st.userId) {
    await prisma.user.update({
      where: { id: st.userId },
      data: {
        email: login,
        ...(password ? { passwordHash: await hashPassword(password), plainPassword: password } : {}),
      },
    });
  } else {
    const pass = password || defaultPassword(st.phone);
    const user = await prisma.user.create({
      data: {
        fullName: st.fullName,
        email: login,
        phone: st.phone,
        passwordHash: await hashPassword(pass),
        plainPassword: pass,
        role: ROLES.STUDENT,
        branchId: st.branchId ?? s.branchId,
        isActive: true,
      },
      select: { id: true },
    });
    await prisma.student.update({ where: { id: st.id }, data: { userId: user.id } });
  }

  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Student", entityId: st.id, newValue: { account: login } });
  revalidatePath("/students");
  return await getStudentAccount(studentId);
}

// Hisobni vaqtincha yopish / qayta ochish
export async function toggleStudentAccount(studentId: string, active: boolean): Promise<AccountRes> {
  const { s, error } = await guard();
  if (error) return { error };

  const st = await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } });
  if (!st?.userId) return { error: "Hisob yo'q" };

  await prisma.user.update({ where: { id: st.userId }, data: { isActive: active } });
  await writeAudit({ actorId: s.userId, action: "UPDATE", entityType: "Student", entityId: studentId, newValue: { accountActive: active } });
  revalidatePath("/students");
  return await getStudentAccount(studentId);
}
