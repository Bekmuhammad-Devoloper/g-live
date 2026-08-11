import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function code(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
const d = (iso: string) => new Date(iso + "T09:00:00");

interface L { platform: string; views: number; submissions: number; isActive: boolean; utmSource?: string }
interface V { title: string; company?: string; country?: string; countryCode?: string; jobTitle?: string; salary?: string; createdAt: string; links: L[] }

const DATA: V[] = [
  { title: "qassobchilik", company: "GL", country: "Germaniya", countryCode: "de", jobTitle: "Qassob", salary: "2800 EUR", createdAt: "2026-07-16", links: [{ platform: "other", views: 6662, submissions: 1233, isActive: true }] },
  { title: "qassobchilik", country: "Germaniya", countryCode: "de", jobTitle: "Qassob", createdAt: "2026-07-06", links: [{ platform: "telegram", views: 43, submissions: 12, isActive: true }] },
  { title: "instagram", company: "instagram", country: "Bolgariya", countryCode: "bg", createdAt: "2026-06-18", links: [{ platform: "instagram", views: 1502, submissions: 21, isActive: true }] },
  { title: "Qurilish sohasi", company: "Qurilish sohasi", country: "Bolgariya", countryCode: "bg", jobTitle: "Quruvchi", salary: "1900 EUR", createdAt: "2026-05-21", links: [{ platform: "telegram", views: 107, submissions: 33, isActive: true }] },
  { title: "Qurilish sohasi", company: "BG GLOBAL", country: "Bolgariya", countryCode: "bg", createdAt: "2026-05-20", links: [{ platform: "instagram", views: 5, submissions: 0, isActive: false }] },
  { title: "Yo'l qurilishi va asfalt zavodi uchun", country: "Mongoliya", countryCode: "mn", createdAt: "2026-05-14", links: [{ platform: "telegram", views: 1, submissions: 0, isActive: false }] },
  { title: "Yo'l qurilishi va asfalt zavodi uchun", company: "MNG", country: "Mongoliya", countryCode: "mn", createdAt: "2026-05-13", links: [
    { platform: "instagram", views: 4, submissions: 0, isActive: false },
    { platform: "telegram", views: 14, submissions: 1, isActive: false },
  ] },
  { title: "Nomalum", company: "MNG", createdAt: "2026-05-13", links: [{ platform: "telegram", views: 1, submissions: 0, isActive: false }] },
  { title: "Nomalum", company: "MNG german", createdAt: "2026-05-13", links: [{ platform: "other", views: 1, submissions: 0, isActive: false }] },
];

async function main() {
  const existing = await prisma.vacancyLink.count();
  if (existing > 0) {
    console.log(`Havolalar allaqachon mavjud (${existing} ta) — seed o'tkazib yuborildi.`);
    return;
  }
  const author = await prisma.user.findFirst({ where: { role: { in: ["DIRECTOR", "ADMIN", "DEPUTY_DIRECTOR"] } }, select: { id: true, fullName: true, branchId: true } });

  for (const v of DATA) {
    const vac = await prisma.vacancy.create({
      data: {
        title: v.title, company: v.company ?? null, country: v.country ?? null, countryCode: v.countryCode ?? null,
        jobTitle: v.jobTitle ?? null, salary: v.salary ?? null,
        branchId: author?.branchId ?? null, createdById: author?.id ?? null, createdByName: author?.fullName ?? "System",
        createdAt: d(v.createdAt), updatedAt: d(v.createdAt),
      },
    });
    for (const l of v.links) {
      await prisma.vacancyLink.create({
        data: {
          code: code(), platform: l.platform, vacancyId: vac.id,
          views: l.views, submissions: l.submissions, isActive: l.isActive,
          utmSource: l.utmSource ?? l.platform,
          createdById: author?.id ?? null, createdByName: author?.fullName ?? "System",
          createdAt: d(v.createdAt), updatedAt: d(v.createdAt),
        },
      });
    }
  }
  const links = await prisma.vacancyLink.count();
  console.log(`Seed tayyor: ${DATA.length} vakansiya, ${links} havola.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
