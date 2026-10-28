import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const sent = await prisma.notification.findMany({
  where: { event: "MESSAGE_SENT" },
  orderBy: { createdAt: "asc" },
  select: { id: true, userId: true, body: true, createdAt: true },
});

let planned = 0;
let skipped = 0;

for (const n of sent) {
  if (!n.body?.trim()) {
    skipped++;
    continue;
  }
  const student = await prisma.student.findUnique({
    where: { userId: n.userId },
    select: {
      id: true,
      enrollments: {
        where: { isActive: true },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { group: { select: { teacherId: true } } },
      },
    },
  });
  if (!student) {
    skipped++;
    continue;
  }

  const exists = await prisma.chatMessage.findFirst({
    where: { studentId: student.id, text: n.body, fromStudent: true },
    select: { id: true },
  });
  if (exists) {
    skipped++;
    continue;
  }

  planned++;
  console.log(`  + ${n.createdAt.toISOString().slice(0, 10)} ${n.body.slice(0, 50)}`);

  if (apply) {
    await prisma.chatMessage.create({
      data: {
        studentId: student.id,
        teacherId: student.enrollments[0]?.group.teacherId ?? null,
        fromStudent: true,
        authorId: n.userId,
        text: n.body,
        createdAt: n.createdAt,
      },
    });
  }
}

console.log(`\neski xabarlar: ${sent.length} | ko'chadi: ${planned} | o'tkazildi: ${skipped}`);
if (!apply) console.log("(--apply berilmadi — baza o'zgarmadi)");

await prisma.$disconnect();
