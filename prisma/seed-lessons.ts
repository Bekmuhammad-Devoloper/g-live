// Ishlab berilgan soatlar demo: qo'shimcha o'qituvchi/guruh/darslar (iyul oyiga).
// Idempotent: "auto:" prefiksli darslar qayta yaratiladi. Ishga: npx tsx prisma/seed-lessons.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("12345678", 10);
  const branch = await prisma.branch.findFirst();
  const program = await prisma.program.findFirst();
  if (!program) {
    console.log("Dastur (program) topilmadi — avval asosiy seed'ni ishga tushiring.");
    return;
  }

  const mkT = (fullName: string, email: string, phone: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { fullName, email, phone, role: "TEACHER", passwordHash, branchId: branch?.id, locale: "uz" },
    });

  const t1 = await prisma.user.findFirst({ where: { role: "TEACHER" }, orderBy: { createdAt: "asc" } });
  const t2 = await mkT("Kamola Yusupova", "kamola@gl.uz", "+998 90 123 45 67");
  const t3 = await mkT("Bobur Aliyev", "bobur@gl.uz", "+998 90 234 56 78");
  const teachers = [t1, t2, t3].filter(Boolean) as { id: string }[];

  const groups = await prisma.group.findMany();
  const specs = [
    { name: "A2 kechki (Se-Pa-Sh)", teacherId: t2.id, room: "301-xona", levelCode: "A2.1" },
    { name: "B1 kunduzgi (Du-Ch-Ju)", teacherId: t3.id, room: "105-xona", levelCode: "B1.1" },
  ];
  for (const g of specs) {
    const ex = await prisma.group.findFirst({ where: { name: g.name } });
    if (!ex) {
      groups.push(
        await prisma.group.create({
          data: { name: g.name, programId: program.id, teacherId: g.teacherId, branchId: branch?.id, levelCode: g.levelCode, room: g.room, status: "ACTIVE", capacity: 12, startDate: new Date("2026-07-01") },
        })
      );
    }
  }

  await prisma.lesson.deleteMany({ where: { topic: { startsWith: "auto:" } } });
  const days = [2, 4, 7, 9, 11, 14, 16, 18, 21];
  let count = 0;
  for (const g of groups) {
    for (const d of days) {
      if (Math.random() < 0.35) continue; // biroz siyrak
      await prisma.lesson.create({
        data: {
          groupId: g.id,
          topic: `auto: iyul ${d}`,
          startsAt: new Date(2026, 6, d, 9, 0, 0),
          endsAt: new Date(2026, 6, d, 10, 30, 0),
        },
      });
      count++;
    }
  }

  console.log(`✅ ${count} dars, ${groups.length} guruh, ${teachers.length} o'qituvchi.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
