// Administrator samaradorligi demo: talabalarni administratorlarga (menejerlarga)
// bog'lash — lid (WON) orqali. Idempotent. Ishga tushirish: npx tsx prisma/seed-admin.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("12345678", 10);
  const branch = await prisma.branch.findFirst();

  // 3 administrator (menejer) — mavjud manager@gl.uz + 2 ta demo
  const mk = (fullName: string, email: string, phone: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { fullName, email, phone, role: "MANAGER", passwordHash, branchId: branch?.id, locale: "uz" },
    });

  const a1 = await prisma.user.findUnique({ where: { email: "manager@gl.uz" } });
  const a2 = await mk("Aziza Karimova", "aziza@gl.uz", "+998 90 777 77 77");
  const a3 = await mk("Jahongir Toshev", "jahongir@gl.uz", "+998 90 888 88 88");
  const admins = [a1, a2, a3].filter(Boolean) as { id: string; fullName: string }[];

  const students = await prisma.student.findMany({ select: { id: true, fullName: true, phone: true, branchId: true } });

  let i = 0;
  for (const s of students) {
    const admin = admins[i % admins.length];
    const existing = await prisma.lead.findUnique({ where: { studentId: s.id } });
    if (existing) {
      await prisma.lead.update({ where: { id: existing.id }, data: { managerId: admin.id } });
    } else {
      await prisma.lead.create({
        data: {
          fullName: s.fullName,
          phone: s.phone ?? `+998 90 000 00 0${i}`,
          stage: "WON",
          interestCourse: "Nemis tili A1",
          managerId: admin.id,
          branchId: s.branchId,
          studentId: s.id,
        },
      });
    }
    i++;
  }

  console.log(`✅ ${students.length} talaba ${admins.length} administratorga bog'landi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
