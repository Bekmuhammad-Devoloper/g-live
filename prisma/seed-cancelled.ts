// Demo bekor qilingan to'lovlar (idempotent). Ishga tushirish: npx tsx prisma/seed-cancelled.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Faqat demo (isManual) bekor qilinganlarni tozalaymiz — qayta ishga tushirish uchun
  await prisma.payment.deleteMany({ where: { status: "CANCELLED", note: "demo-cancelled" } });

  const students = await prisma.student.findMany({
    where: { enrollments: { some: {} } },
    select: { id: true },
    take: 4,
  });

  const reasons = [
    "O'quvchi kursni tark etdi",
    "Xato summa kiritilgan",
    "Dublikat to'lov",
    "Ota-ona qaytarishni so'radi",
  ];
  const amounts = [300000, 500000, 1200000, 800000];

  let i = 0;
  for (const s of students) {
    await prisma.payment.create({
      data: {
        studentId: s.id,
        amount: amounts[i % amounts.length],
        method: "CASH",
        status: "CANCELLED",
        isManual: true,
        note: "demo-cancelled",
        cancelledAt: new Date(Date.now() - i * 86400000),
        cancelReason: reasons[i % reasons.length],
      },
    });
    i++;
  }

  const total = await prisma.payment.count({ where: { status: "CANCELLED" } });
  console.log(`✅ ${total} ta bekor qilingan to'lov (demo: ${students.length}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
