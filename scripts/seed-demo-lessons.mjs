// Namunaviy kurs darslarini yaratadi — o'quvchi ilovasidagi "darslar yo'li"ni
// ko'rish uchun. Har dars sarlavhasi "[DEMO]" bilan boshlanadi, shuning uchun
// keyin osongina o'chirib tashlash mumkin:
//   node --env-file=.env scripts/seed-demo-lessons.mjs --clean
//
// Ishlatish:
//   node --env-file=.env scripts/seed-demo-lessons.mjs            (ko'rish)
//   node --env-file=.env scripts/seed-demo-lessons.mjs --apply    (yozish)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const clean = args.includes("--clean");

const TAG = "[DEMO]";

// Daraja → darslar (uchtadan: Unit x.1, x.2, x.3)
const PLAN = {
  A1: [
    { title: "Begrüßung und Vorstellung", topic: "hallo, guten Tag, ich heiße, wie geht es dir, tschüss, bis bald", hw: "Schreibe 5 Sätze über dich." },
    { title: "Zahlen und Farben", topic: "eins, zwei, drei, rot, blau, grün, gelb, schwarz, weiß", hw: "Zähle von 1 bis 20 laut." },
    { title: "Familie und Zuhause", topic: "Mutter, Vater, Bruder, Schwester, Haus, Wohnung, Zimmer", hw: "Beschreibe deine Familie." },
  ],
  A2: [
    { title: "Einkaufen im Supermarkt", topic: "Brot, Milch, Käse, kaufen, bezahlen, die Kasse, der Preis", hw: "Schreibe eine Einkaufsliste." },
    { title: "Termine und Uhrzeit", topic: "der Termin, halb, viertel nach, um wie viel Uhr, morgens, abends", hw: "Beschreibe deinen Tagesablauf." },
    { title: "Reisen und Verkehr", topic: "der Zug, das Flugzeug, die Fahrkarte, umsteigen, die Haltestelle", hw: "Plane eine Reise nach Berlin." },
  ],
  B1: [
    { title: "Arbeit und Beruf", topic: "die Bewerbung, der Lebenslauf, das Vorstellungsgespräch, die Erfahrung", hw: "Schreibe einen kurzen Lebenslauf." },
    { title: "Gesundheit und Arzt", topic: "die Beschwerden, das Rezept, die Versicherung, der Termin beim Arzt", hw: "Dialog beim Arzt schreiben." },
    { title: "Meinung äußern", topic: "meiner Meinung nach, ich finde, einerseits, andererseits, deshalb", hw: "Schreibe deine Meinung zum Thema Umwelt." },
  ],
  B2: [
    { title: "Medien und Digitalisierung", topic: "das Netzwerk, die Nachricht, der Datenschutz, künstliche Intelligenz", hw: "Kurzer Text: Vor- und Nachteile sozialer Medien." },
    { title: "Umwelt und Klima", topic: "der Klimawandel, erneuerbare Energie, die Nachhaltigkeit, der Müll", hw: "Argumentation über Klimaschutz." },
    { title: "Kultur und Gesellschaft", topic: "das Vorurteil, die Integration, die Tradition, die Vielfalt", hw: "Präsentation über dein Land." },
  ],
};

const group = await prisma.group.findFirst({
  where: { status: { not: "CANCELLED" }, students: { some: { isActive: true } } },
  orderBy: { createdAt: "asc" },
  select: { id: true, name: true, programId: true, program: { select: { name: true } } },
});
if (!group) {
  console.log("O'quvchisi bor guruh topilmadi.");
  process.exit(0);
}
console.log(`Guruh: ${group.name} · kurs: ${group.program.name}`);

if (clean) {
  const del = await prisma.courseLesson.deleteMany({ where: { programId: group.programId, title: { startsWith: TAG } } });
  console.log(`${del.count} ta namunaviy dars o'chirildi.`);
  await prisma.$disconnect();
  process.exit(0);
}

const rows = [];
let order = (await prisma.courseLesson.findFirst({ where: { programId: group.programId }, orderBy: { order: "desc" }, select: { order: true } }))?.order ?? 0;

for (const [level, items] of Object.entries(PLAN)) {
  for (const it of items) {
    order++;
    rows.push({
      programId: group.programId,
      order,
      levelCode: level,
      title: `${TAG} ${it.title}`,
      topic: it.topic,
      videoUrl: "https://www.youtube.com/results?search_query=deutsch+lernen+" + level,
      assignment: `Übung im Unterricht: ${it.title}`,
      homework: it.hw,
    });
  }
}

console.log(`${rows.length} ta dars ${apply ? "yaratiladi" : "yaratilishi mumkin"} (A1/A2/B1/B2 — har biriga 3 tadan)`);

if (!apply) {
  console.log("Yozish uchun: --apply");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.courseLesson.createMany({ data: rows });

// Birinchi darajadagi bir nechta darsni "o'tilgan" deb belgilaymiz — foizlar ko'rinsin
const created = await prisma.courseLesson.findMany({
  where: { programId: group.programId, title: { startsWith: TAG } },
  orderBy: { order: "asc" },
  select: { id: true, levelCode: true },
});
const taught = [
  ...created.filter((l) => l.levelCode === "A1"),          // A1 to'liq
  ...created.filter((l) => l.levelCode === "A2").slice(0, 2), // A2 dan ikkitasi
  ...created.filter((l) => l.levelCode === "B1").slice(0, 1), // B1 dan bittasi
];
// Kursning BARCHA faol guruhlariga belgilaymiz — qaysi guruhdagi o'quvchi
// kirsa ham foizlar ko'rinsin
const groups = await prisma.group.findMany({
  where: { programId: group.programId, status: { not: "CANCELLED" } },
  select: { id: true },
});
for (const g of groups) {
  for (const l of taught) {
    await prisma.groupLessonProgress.upsert({
      where: { groupId_courseLessonId: { groupId: g.id, courseLessonId: l.id } },
      update: { taught: true },
      create: { groupId: g.id, courseLessonId: l.id, taught: true },
    });
  }
}

console.log(`Tayyor: ${rows.length} dars yaratildi, ${taught.length} tasi ${groups.length} ta guruhda "o'tilgan" deb belgilandi.`);
await prisma.$disconnect();
