import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const RANK = { LOST: 0, NEW: 1, IN_PROGRESS: 2, CONTACTED: 3, TEST: 4, OFFER: 5, AWAITING_PAYMENT: 6, PAID: 7, WON: 8 };
const rank = (l) => (RANK[l.stage] ?? 1) - (l.archivedAt ? 0.5 : 0);
const FILL = ["email", "telegram", "studyFormat", "source", "interestCourse", "age", "level", "budget", "preferredTime", "managerId", "testSet", "testLevel", "testPct", "testPassed", "testedAt", "utmSource", "utmCampaign", "utmMedium"];

async function main() {
  const groups = await prisma.lead.groupBy({ by: ["phone", "branchId"], _count: { _all: true }, having: { phone: { _count: { gt: 1 } } } });
  let merged = 0, removed = 0, skipped = 0;
  for (const g of groups) {
    const leads = await prisma.lead.findMany({ where: { phone: g.phone, branchId: g.branchId }, orderBy: { createdAt: "desc" } });
    const students = leads.filter((l) => l.studentId);
    const primary = students[0] ?? [...leads].sort((a, b) => rank(b) - rank(a) || b.createdAt - a.createdAt)[0];
    const extras = leads.filter((l) => l.id !== primary.id && !l.studentId);
    if (extras.length === 0) { skipped++; continue; }

    const fill = {};
    for (const f of FILL) {
      if (primary[f] == null || primary[f] === "") {
        const src = extras.find((e) => e[f] != null && e[f] !== "");
        if (src) fill[f] = src[f];
      }
    }
    const notes = [primary.note, ...extras.map((e) => e.note)].filter((n) => n && n.trim());
    const note = Array.from(new Set(notes)).join("\n---\n") || null;
    const summary = `Takroriy lidlar birlashtirildi: ${extras.length} ta (${extras.map((e) => `${e.fullName}, ${e.stage}, ${e.createdAt.toISOString().slice(0, 10)}`).join("; ")})`;

    console.log(`${g.phone} [${g.branchId ?? "filialsiz"}] → qoladi: ${primary.fullName} (${primary.stage}${primary.studentId ? ", o'quvchi" : ""}), o'chadi: ${extras.length}`);
    merged++; removed += extras.length;
    if (!APPLY) continue;

    const ids = extras.map((e) => e.id);
    await prisma.$transaction([
      prisma.leadActivity.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primary.id } }),
      prisma.call.updateMany({ where: { leadId: { in: ids } }, data: { leadId: primary.id } }),
      prisma.lead.update({ where: { id: primary.id }, data: { ...fill, note, activities: { create: { type: "note", result: summary } } } }),
      prisma.lead.deleteMany({ where: { id: { in: ids } } }),
      prisma.auditLog.create({ data: { action: "MERGE", entityType: "Lead", entityId: primary.id, oldValue: JSON.stringify(extras.map((e) => ({ id: e.id, fullName: e.fullName, stage: e.stage, createdAt: e.createdAt }))), reason: "Takroriy lidlarni birlashtirish (ariza formasi dublikatlari)" } }),
    ]);
  }
  console.log(`\n${APPLY ? "BAJARILDI" : "SINOV"}: ${merged} guruh birlashtiriladi, ${removed} ta ortiqcha lid o'chiriladi, ${skipped} guruhda o'zgarish yo'q (faqat o'quvchilar).`);
}

main().finally(() => prisma.$disconnect());
