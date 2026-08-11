// Qo'ng'iroqlar markazi uchun demo ma'lumot (idempotent — qayta ishga tushirsa bo'ladi).
// Ishga tushirish: npx tsx prisma/seed-calls.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

async function main() {
  await prisma.call.deleteMany();

  const operators = await prisma.user.findMany({
    where: { role: { in: ["MANAGER", "TEACHER", "DEPUTY_DIRECTOR", "ADMIN"] } },
    select: { id: true, fullName: true },
  });
  const leads = await prisma.lead.findMany({ select: { id: true, fullName: true, phone: true } });

  const now = Date.now();
  const N = 52;
  const comments = ["Qayta bog'lanish kerak", "Narx so'radi", "Keyinroq keladi", "Test darsga yozildi", "Manzil so'radi"];

  const rows = Array.from({ length: N }, (_, i) => {
    const startedAt = new Date(now - randInt(5, 46 * 60) * 60 * 1000); // oxirgi ~46 soat
    const direction = Math.random() < 0.62 ? "INCOMING" : "OUTGOING";

    const r = Math.random();
    const status =
      r < 0.5 ? "ANSWERED" : r < 0.78 ? "MISSED" : r < 0.88 ? "NO_ANSWER" : r < 0.95 ? "BUSY" : "CANCELLED";

    const answered = status === "ANSWERED";
    const duration = answered ? randInt(18, 385) : 0;

    const lead = Math.random() < 0.7 && leads.length ? pick(leads) : null;
    const phone = lead
      ? lead.phone
      : `+998 9${randInt(0, 9)} ${randInt(100, 999)}-${randInt(10, 99)}-${randInt(10, 99)}`;

    // Kiruvchi javob berilmagan qo'ng'iroqning bir qismi operatorsiz (Belgilanmagan)
    const unassigned = !answered && direction === "INCOMING" && Math.random() < 0.35;
    const op = unassigned || operators.length === 0 ? null : pick(operators);

    const answeredAt = answered ? new Date(startedAt.getTime() + randInt(2, 12) * 1000) : null;
    const endedAt = new Date(
      (answeredAt ? answeredAt.getTime() : startedAt.getTime()) + duration * 1000 + (answered ? 0 : randInt(3, 18) * 1000)
    );

    const callbackStatus =
      status === "MISSED"
        ? Math.random() < 0.6
          ? "PENDING"
          : Math.random() < 0.5
            ? "CALLED_BACK"
            : "NOT_NEEDED"
        : "NONE";

    return {
      direction,
      status,
      operatorId: op?.id ?? null,
      operatorName: op?.fullName ?? null,
      leadId: lead?.id ?? null,
      contactName: lead?.fullName ?? null,
      phone,
      duration,
      recordingUrl: answered ? `demo://recording/${i}` : null,
      comment: Math.random() < 0.16 ? pick(comments) : null,
      callbackStatus,
      callbackAt: callbackStatus === "CALLED_BACK" ? new Date() : null,
      startedAt,
      answeredAt,
      endedAt,
      createdAt: startedAt,
    };
  });

  await prisma.call.createMany({ data: rows });
  const total = await prisma.call.count();
  console.log(`✅ ${total} ta demo qo'ng'iroq yaratildi (${operators.length} operator, ${leads.length} lid).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
