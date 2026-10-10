// Yangi o'quv markazi bazasini boshlang'ich holatga keltiradi (Dev panel chaqiradi).
// Ishga tushirish: /opt/gl-edu papkasida, markaz muhiti bilan:
//   DATABASE_URL=file:/opt/centers/<slug>/data/db.sqlite \
//   CENTER_NAME="..." DIRECTOR_NAME="..." DIRECTOR_EMAIL="..." DIRECTOR_PASSWORD="..." [DIRECTOR_PHONE=...] \
//   [TEMPLATE_DB=/opt/gl-edu/prisma/dev.db] node scripts/center-init.mjs
// Sxema avval `prisma db push` bilan yaratilgan bo'lishi kerak. Skript idempotent: qayta
// ishga tushirilsa direktor/filial takror yaratilmaydi. Natija — oxirgi qatorda JSON.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const env = (k, req = true) => {
  const v = (process.env[k] ?? "").trim();
  if (req && !v) { console.error(`${k} berilmagan`); process.exit(2); }
  return v;
};
const centerName = env("CENTER_NAME");
const directorName = env("DIRECTOR_NAME");
const directorEmail = env("DIRECTOR_EMAIL").toLowerCase();
const directorPassword = env("DIRECTOR_PASSWORD");
const directorPhone = env("DIRECTOR_PHONE", false) || null;
const templateDb = env("TEMPLATE_DB", false);

const prisma = new PrismaClient();
try {
  // Asosiy markazdan umumiy ma'lumotnomalar: o'quv darajalari, yulduz darajalari,
  // xodim lavozimlari va o'quvchi kabineti bo'limlari sozlamalari. Kurslar, xonalar,
  // shartnomalar, telefoniya — markazga xos, ko'chirilmaydi.
  if (templateDb) {
    const empty = (await prisma.studyLevel.count()) === 0;
    if (empty) {
      await prisma.$executeRawUnsafe(`ATTACH DATABASE '${templateDb.replace(/'/g, "''")}' AS tpl`);
      for (const t of ["StudyLevel", "StarRank", "StaffRole"]) {
        await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO "${t}" SELECT * FROM tpl."${t}"`);
      }
      await prisma.$executeRawUnsafe(`INSERT OR IGNORE INTO "Setting" SELECT * FROM tpl."Setting" WHERE key LIKE 'portal.%' OR key = 'rates.cbu'`);
      await prisma.$executeRawUnsafe(`DETACH DATABASE tpl`);
    }
  }

  let branch = await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) branch = await prisma.branch.create({ data: { name: centerName, phone: directorPhone } });

  let director = await prisma.user.findUnique({ where: { email: directorEmail } });
  if (!director) {
    director = await prisma.user.create({
      data: {
        fullName: directorName, email: directorEmail, phone: directorPhone,
        passwordHash: await bcrypt.hash(directorPassword, 10), plainPassword: directorPassword,
        role: "DIRECTOR", branchId: branch.id, position: "Direktor",
      },
    });
  }

  await prisma.setting.upsert({ where: { key: "brand.name" }, create: { key: "brand.name", value: centerName }, update: {} });
  await prisma.setting.upsert({ where: { key: "receipt.orgName" }, create: { key: "receipt.orgName", value: centerName }, update: {} });

  console.log(JSON.stringify({ ok: true, branchId: branch.id, directorId: director.id }));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  console.log(JSON.stringify({ ok: false }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
