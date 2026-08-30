"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { parseUzPhone } from "@/lib/phone";

export type Res = { ok?: boolean; error?: string };

// Tug'ilgan sanadan yoshni hisoblaymiz — ikkalasi bir-biriga zid bo'lmasin
function ageFrom(d: Date): number {
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

const safeImage = (u: string) => (/^\/uploads\/[\w.-]+$/.test(u) || /^data:image\//.test(u) ? u : null);

// O'quvchi o'z shaxsiy ma'lumotlarini tahrirlaydi.
// Guruh va daraja bu yerda o'zgarmaydi — ular o'quv jarayoni ma'lumoti,
// ma'muriyat tomonidan biriktiriladi (hisobot va davomat shularga bog'liq).
export async function updateProfile(fd: FormData): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };

  const student = await prisma.student.findUnique({ where: { userId: s.userId }, select: { id: true } });
  if (!student) return { error: "O'quvchi topilmadi" };

  const fullName = String(fd.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  if (fullName.length < 3) return { error: "Ism-familiya juda qisqa" };
  if (fullName.length > 80) return { error: "Ism-familiya juda uzun" };

  const birthRaw = String(fd.get("birthDate") ?? "").trim();
  let birthDate: Date | null = null;
  let age: number | null = null;
  if (birthRaw) {
    const d = new Date(birthRaw + "T00:00:00");
    if (Number.isNaN(d.getTime())) return { error: "Tug'ilgan sana noto'g'ri" };
    const a = ageFrom(d);
    if (a < 3 || a > 100) return { error: "Tug'ilgan sana noto'g'ri" };
    birthDate = d;
    age = a;
  }

  const phoneRaw = String(fd.get("phone") ?? "").trim();
  let phone: string | null = null;
  if (phoneRaw) {
    phone = parseUzPhone(phoneRaw);
    if (!phone) return { error: "Telefon raqami noto'g'ri" };
  }

  const phone2Raw = String(fd.get("phone2") ?? "").trim();
  let phone2: string | null = null;
  if (phone2Raw) {
    phone2 = parseUzPhone(phone2Raw);
    if (!phone2) return { error: "Qo'shimcha telefon noto'g'ri" };
  }

  const imageRaw = String(fd.get("imageUrl") ?? "").trim();
  const imageUrl = imageRaw ? safeImage(imageRaw) : null;
  if (imageRaw && !imageUrl) return { error: "Rasm manzili noto'g'ri" };

  await prisma.student.update({
    where: { id: student.id },
    data: { fullName, birthDate, age, phone, phone2, ...(imageRaw ? { imageUrl } : {}) },
  });

  revalidatePath("/student", "layout");
  return { ok: true };
}

// Profil rasmini o'chirish
export async function removePhoto(): Promise<Res> {
  const s = await requireSession();
  if (s.role !== ROLES.STUDENT) return { error: "Ruxsat yo'q" };
  const student = await prisma.student.findUnique({ where: { userId: s.userId }, select: { id: true } });
  if (!student) return { error: "O'quvchi topilmadi" };

  await prisma.student.update({ where: { id: student.id }, data: { imageUrl: null } });
  revalidatePath("/student", "layout");
  return { ok: true };
}
