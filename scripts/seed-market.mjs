/**
 * Market uchun boshlang'ich sovg'alar. Faqat yo'q bo'lganini qo'shadi —
 * qayta yurgizilsa nusxa yaratmaydi. O'quv markazi bularni CRM dagi
 * "Market" sahifasidan tahrirlaydi yoki o'chiradi.
 *
 *   node scripts/seed-market.mjs           — nima qo'shilishini ko'rsatadi
 *   node scripts/seed-market.mjs --apply   — bazaga yozadi
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

// Narxlar tanga hisobida: 1 dars = 5, 1 baholangan vazifa = 10 tanga
const ITEMS = [
  { title: "GL ruchka", description: "Germaniya Live logotipli ruchka", price: 100, stock: null },
  { title: "Bloknot", description: "So'zlar yozib borish uchun cho'ntak bloknoti", price: 150, stock: null },
  { title: "Kofe va shirinlik", description: "O'quv markazi bufetida bir marta", price: 200, stock: null },
  { title: "Sertifikat ramkasi", description: "Sertifikatingiz uchun ramka", price: 300, stock: 20 },
  { title: "Bepul 1 dars", description: "Bir dars to'lovsiz — qo'shimcha yoki qaytarilgan dars", price: 500, stock: 10 },
  { title: "GL futbolka", description: "Logotipli futbolka (o'lchamni ma'muriyatga ayting)", price: 800, stock: 15 },
];

const existing = await prisma.marketItem.findMany({ select: { title: true } });
const have = new Set(existing.map((i) => i.title.toLowerCase()));
const missing = ITEMS.filter((i) => !have.has(i.title.toLowerCase()));

console.log(`bazada: ${existing.length} ta sovg'a | qo'shiladi: ${missing.length} ta`);
for (const i of missing) console.log(`  + ${i.title} — ${i.price} tanga`);

if (apply && missing.length) {
  await prisma.marketItem.createMany({ data: missing });
  console.log("\nqo'shildi");
} else if (!apply) {
  console.log("\n(--apply berilmadi — baza o'zgarmadi)");
}

await prisma.$disconnect();
