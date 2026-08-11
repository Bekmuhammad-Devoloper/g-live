// Demo ma'lumotlar bilan bazani to'ldirish.
// Ishga tushirish: npm run db:seed   (yoki to'liq qayta: npm run db:reset)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("12345678", 10);

  // ─── Filial ─── (seed qayta ishga tushsa dublikat yaratilmasin)
  const branch = (await prisma.branch.findFirst({ where: { name: "Chilonzor filiali" } })) ?? await prisma.branch.create({
    data: { name: "Chilonzor filiali", address: "Toshkent, Chilonzor", phone: "+998 71 200 00 00" },
  });

  // ─── Xodimlar ───
  const mk = (fullName: string, email: string, role: string, phone: string) =>
    prisma.user.create({
      data: { fullName, email, role, phone, passwordHash, branchId: branch.id, locale: "uz" },
    });

  const director = await mk("Aziz Karimov", "director@gl.uz", "DIRECTOR", "+998 90 111 11 11");
  const deputy = await mk("Dilnoza Yusupova", "deputy@gl.uz", "DEPUTY_DIRECTOR", "+998 90 222 22 22");
  const manager = await mk("Sardor Aliyev", "operator@gl.uz", "OPERATOR", "+998 90 333 33 33");
  const teacher = await mk("Nigora Rashidova", "teacher@gl.uz", "TEACHER", "+998 90 444 44 44");
  await mk("Admin", "admin@gl.uz", "ADMIN", "+998 90 999 99 99");

  // ─── O'quvchi (user + profil) ───
  const studentUser = await prisma.user.create({
    data: {
      fullName: "Jasur To'raev",
      email: "student@gl.uz",
      role: "STUDENT",
      phone: "+998 90 555 55 55",
      passwordHash,
      branchId: branch.id,
    },
  });
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      fullName: "Jasur To'raev",
      phone: "+998 90 555 55 55",
      currentLevel: "A1.2",
      eduStatus: "ACTIVE",
      branchId: branch.id,
    },
  });

  // ─── Ota-ona (user + profil, o'quvchiga bog'langan) ───
  const parentUser = await prisma.user.create({
    data: {
      fullName: "Botir To'raev",
      email: "parent@gl.uz",
      role: "PARENT",
      phone: "+998 90 666 66 66",
      passwordHash,
      branchId: branch.id,
    },
  });
  const parent = await prisma.parent.create({
    data: { userId: parentUser.id, fullName: "Botir To'raev", phone: "+998 90 666 66 66" },
  });
  await prisma.studentParent.create({
    data: { studentId: student.id, parentId: parent.id, relation: "ota" },
  });

  // Qo'shimcha o'quvchilar (guruhni to'ldirish uchun, user'siz)
  const extraStudents = await Promise.all(
    ["Malika Karimova", "Bekzod Olimov", "Sevara Nazarova"].map((name) =>
      prisma.student.create({
        data: { fullName: name, eduStatus: "ACTIVE", currentLevel: "A1.2", branchId: branch.id },
      })
    )
  );

  // ─── Dastur va darajalar ───
  const program = await prisma.program.create({
    data: {
      name: "Nemis tili (A1–B2)",
      description: "CEFR asosidagi umumiy nemis tili kursi",
      gradingType: "PERCENT",
      levels: {
        create: [
          { code: "A1.1", name: "A1 — birinchi qism", order: 1, weeks: 8, academicHours: 48, passScore: 60 },
          { code: "A1.2", name: "A1 — ikkinchi qism", order: 2, weeks: 8, academicHours: 48, passScore: 60 },
          { code: "A2.1", name: "A2 — birinchi qism", order: 3, weeks: 8, academicHours: 48, passScore: 60 },
          { code: "B1.1", name: "B1 — birinchi qism", order: 4, weeks: 10, academicHours: 60, passScore: 65 },
        ],
      },
    },
  });

  // ─── Guruh + o'quvchilarni biriktirish (offline) ───
  const group = await prisma.group.create({
    data: {
      name: "A1 ertalabki (Du-Ch-Ju)",
      programId: program.id,
      teacherId: teacher.id,
      branchId: branch.id,
      levelCode: "A1.2",
      format: "OFFLINE",
      room: "204-xona",
      status: "ACTIVE",
      capacity: 12,
      startDate: new Date("2026-06-01"),
      weekdays: "1,3,5",
      startTime: "09:00",
      endTime: "10:30",
    },
  });
  for (const s of [student, ...extraStudents]) {
    await prisma.groupStudent.create({ data: { groupId: group.id, studentId: s.id } });
  }

  // ─── Onlayn guruh (masofaviy) ───
  const groupOnline = await prisma.group.create({
    data: {
      name: "A2 onlayn kechki (Se-Pa-Sh)",
      programId: program.id,
      teacherId: teacher.id,
      branchId: branch.id,
      levelCode: "A2.1",
      format: "ONLINE",
      onlineLink: "https://zoom.us/j/1234567890",
      status: "ACTIVE",
      capacity: 15,
      startDate: new Date("2026-06-15"),
      weekdays: "2,4,6",
      startTime: "18:00",
      endTime: "19:30",
    },
  });
  for (const s of [student, extraStudents[1]]) {
    await prisma.groupStudent.create({ data: { groupId: groupOnline.id, studentId: s.id } });
  }

  // ─── Dars + davomat ───
  const lesson = await prisma.lesson.create({
    data: {
      groupId: group.id,
      topic: "Perfekt (o'tgan zamon) — 1-dars",
      startsAt: new Date("2026-07-14T09:00:00"),
      endsAt: new Date("2026-07-14T10:30:00"),
    },
  });
  await prisma.attendance.create({
    data: { lessonId: lesson.id, studentId: student.id, status: "PRESENT", confirmed: true },
  });

  // ─── Lidlar (voronka) ───
  const leadData = [
    { fullName: "Kamola Ismoilova", phone: "+998 91 100 00 01", source: "telegram", stage: "NEW", budget: 1200000 },
    { fullName: "Otabek Yuldashev", phone: "+998 91 100 00 02", source: "sayt", stage: "IN_PROGRESS", budget: 1500000 },
    { fullName: "Gulnora Sobirova", phone: "+998 91 100 00 03", source: "reklama", stage: "TEST", budget: 1000000 },
    { fullName: "Rustam Qodirov", phone: "+998 91 100 00 04", source: "telefon", stage: "OFFER", budget: 1800000 },
    { fullName: "Feruza Ahmedova", phone: "+998 91 100 00 05", source: "tashrif", stage: "AWAITING_PAYMENT", budget: 1300000 },
    { fullName: "Sanjar Nabiev", phone: "+998 91 100 00 06", source: "telegram", stage: "WON", budget: 1400000 },
    { fullName: "Ozoda Rahimova", phone: "+998 91 100 00 07", source: "sayt", stage: "LOST", budget: 900000 },
  ];
  for (const l of leadData) {
    await prisma.lead.create({
      data: {
        ...l,
        interestCourse: "Nemis tili A1",
        managerId: manager.id,
        branchId: branch.id,
        utmSource: l.source,
        activities: {
          create: { authorId: manager.id, type: "note", result: "Birinchi aloqa qilindi" },
        },
      },
    });
  }

  // ─── To'lovlar ───
  // Onlayn (avtomatik)
  await prisma.payment.create({
    data: {
      studentId: student.id,
      amount: 1200000,
      method: "CLICK",
      purpose: "A1.2 kurs to'lovi",
      status: "PAID",
      transactionId: "CLICK-DEMO-0001",
      docNumber: "CHK-0001",
    },
  });
  // Qo'lda (menejer kiritgan, audit bilan)
  const manualPay = await prisma.payment.create({
    data: {
      studentId: student.id,
      amount: 300000,
      method: "CASH",
      purpose: "Qo'shimcha material",
      status: "PAID",
      isManual: true,
      authorId: manager.id,
      docNumber: "CHK-0002",
      note: "Naqd, qabul qilindi",
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: manager.id,
      action: "CREATE",
      entityType: "Payment",
      entityId: manualPay.id,
      newValue: JSON.stringify({ amount: 300000, method: "CASH", isManual: true }),
      reason: "Qo'lda to'lov (naqd)",
    },
  });

  // ─── Namunaviy vazifa + topshiriq ───
  const assignment = await prisma.assignment.create({
    data: {
      groupId: group.id,
      title: "Perfekt bilan 5 ta gap tuzing",
      type: "TEXT",
      skill: "WRITING",
      maxScore: 100,
      dueAt: new Date("2026-07-25T23:59:00"),
    },
  });
  await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      studentId: student.id,
      content: "Ich habe gestern Deutsch gelernt. ...",
      attempt: 1,
      status: "SUBMITTED",
    },
  });

  // ─── Namunaviy sertifikat (tekshiruv sahifasini ko'rsatish uchun) ───
  await prisma.certificate.create({
    data: {
      studentId: extraStudents[0].id,
      programName: "Nemis tili (A1–B2)",
      levelCode: "A2",
      result: "88%",
      number: "GL-2026-DEMO01",
      qrCode: "demo-cert-qr-0001",
      status: "ISSUED",
      issuedBy: "Dilnoza Yusupova",
    },
  });
  await prisma.student.update({ where: { id: extraStudents[0].id }, data: { eduStatus: "CERTIFIED" } });

  // ─── Shartnoma shablonlari ───
  await prisma.contractTemplate.createMany({
    data: [
      { title: "O'quv shartnomasi (standart)", type: "STANDARD", note: "Asosiy o'quv shartnomasi", isActive: true },
      { title: "Onlayn kurs shartnomasi", type: "ONLINE", note: "Masofaviy ta'lim uchun", isActive: true },
      { title: "Offline kurs shartnomasi", type: "OFFLINE", note: "Auditoriya darslari uchun", isActive: true },
      { title: "Ommaviy oferta", type: "OFFER", note: "Sayt orqali qabul", isActive: true },
      { title: "Individual dars shartnomasi", type: "INDIVIDUAL", note: "Yakka tartibdagi darslar", isActive: false },
    ],
  });

  // ─── Xodim rollari katalogi (Rollar sahifasi) — mavjudi qayta yaratilmaydi ───
  const roleCatalog = [
    { name: "Direktor", description: "Butun o'quv markazni boshqaradi", department: "Boshqaruv" },
    { name: "Direktor o'rinbosari", description: "Direktor o'rnini bosadi, boshqaruvda yordam beradi", department: "Boshqaruv" },
    { name: "Filial direktori", description: "Faqat bitta filialni ko'rib boshqaradi", department: "Boshqaruv" },
    { name: "Sotuv bo'limi rahbari (ROP)", description: "Sotuv bo'limi va operatorlarni boshqaradi", department: "Sotuv bo'limi" },
    { name: "Operator", description: "Lidlar bilan ishlaydi, qo'ng'iroq qiladi va yozib boradi", department: "Sotuv bo'limi" },
    { name: "Menejer", description: "Guruh va o'quvchilarni boshqaradi", department: "Sotuv bo'limi" },
    { name: "Marketolog", description: "Marketing va reklama bilan shug'ullanadi", department: "Marketing bo'limi" },
    { name: "Moliyachi", description: "To'lovlarni qabul qiladi", department: "Moliya bo'limi" },
    { name: "Administrator", description: "O'quvchi qabul qiladi", department: "Administrativ" },
    { name: "O'qituvchi", description: "Dars beradi", department: "Ta'lim bo'limi" },
  ];
  const haveRoles = new Set((await prisma.staffRole.findMany({ select: { name: true } })).map((r) => r.name.trim().toLowerCase()));
  for (const r of roleCatalog) {
    if (haveRoles.has(r.name.trim().toLowerCase())) continue;
    await prisma.staffRole.create({ data: { name: r.name, description: r.description, department: r.department, bossOnly: false, permissions: "", isActive: true } });
  }

  // ─── Mavsumiy baholash + natijalar ───
  const assessment = await prisma.seasonalAssessment.create({
    data: {
      title: "Qish mavsumi — oraliq baholash",
      season: "WINTER",
      year: 2026,
      groupId: group.id,
      levelCode: "A1.2",
      skill: "GENERAL",
      maxScore: 100,
      passScore: 60,
      date: new Date("2026-07-10"),
      status: "COMPLETED",
      note: "A1.2 daraja bo'yicha umumiy baholash",
    },
  });
  const scores = [
    { st: student, score: 82 },
    { st: extraStudents[0], score: 74 },
    { st: extraStudents[1], score: 55 },
    { st: extraStudents[2], score: 91 },
  ];
  for (const { st, score } of scores) {
    await prisma.seasonalResult.create({
      data: { assessmentId: assessment.id, studentId: st.id, score, passed: score >= 60 },
    });
  }

  // ─── Namunaviy bildirishnoma ───
  await prisma.notification.create({
    data: { userId: studentUser.id, title: "Xush kelibsiz!", body: "Germaniya Live tizimiga xush kelibsiz.", channel: "APP" },
  });

  console.log("   Tekshiruv sahifasi demo: /verify/demo-cert-qr-0001");
  console.log("✅ Seed tayyor. Demo hisoblar (parol: 12345678):");
  console.log("   director@gl.uz | deputy@gl.uz | manager@gl.uz | teacher@gl.uz | student@gl.uz | parent@gl.uz | admin@gl.uz");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
