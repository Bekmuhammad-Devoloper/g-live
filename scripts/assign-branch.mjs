// Filialga biriktirilmagan (branchId = null) eski yozuvlarni asosiy filialga
// biriktiradi. Filial izolyatsiyasi joriy qilingach (2026-08-24) kerak bo'ldi:
// biriktirilmagan yozuv HAR filialda ko'rinib qolardi.
//
// Ishlatish:
//   node --env-file=.env scripts/assign-branch.mjs            (ko'rish — hech narsa yozilmaydi)
//   node --env-file=.env scripts/assign-branch.mjs --apply    (haqiqiy yozish)
//   node --env-file=.env scripts/assign-branch.mjs --apply --branch "Qibray"
//
// Filial berilmasa — eng birinchi yaratilgan faol filial tanlanadi.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const wantIdx = args.indexOf("--branch");
const wantName = wantIdx >= 0 ? args[wantIdx + 1] : null;

// branchId maydoni bor barcha modellar
const MODELS = ["lead", "student", "group", "room", "user", "vacancy", "expense", "task", "blockTest"];

const branches = await prisma.branch.findMany({
  where: { isActive: true },
  select: { id: true, name: true },
  orderBy: { createdAt: "asc" },
});
if (branches.length === 0) {
  console.error("Faol filial topilmadi.");
  process.exit(1);
}

const target = wantName ? branches.find((b) => b.name === wantName) : branches[0];
if (!target) {
  console.error(`"${wantName}" nomli faol filial yo'q. Mavjudlari: ${branches.map((b) => b.name).join(", ")}`);
  process.exit(1);
}

console.log(`Maqsad filial: ${target.name}`);
console.log(apply ? "Rejim: YOZISH (--apply)" : "Rejim: faqat ko'rish (yozish uchun --apply qo'shing)");
console.log("");

let total = 0;
for (const m of MODELS) {
  const count = await prisma[m].count({ where: { branchId: null } });
  if (count === 0) {
    console.log(`${m.padEnd(11)} — filialsiz yozuv yo'q`);
    continue;
  }
  total += count;
  if (apply) {
    const res = await prisma[m].updateMany({ where: { branchId: null }, data: { branchId: target.id } });
    console.log(`${m.padEnd(11)} → ${res.count} ta yozuv "${target.name}" ga biriktirildi`);
  } else {
    console.log(`${m.padEnd(11)} → ${count} ta yozuv biriktiriladi`);
  }
}

console.log("");
console.log(apply ? `Tayyor. Jami ${total} ta yozuv.` : `Jami ${total} ta yozuv o'zgaradi. Yozish uchun: --apply`);
await prisma.$disconnect();
