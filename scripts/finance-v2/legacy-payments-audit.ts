// LEGACY (cutover'dan oldingi) REAL TO'LOVLAR AUDITI — FAQAT O'QIYDI. Har to'lov uchun dalil dossyesi va
// dastlabki klassifikatsiya (EXACTLY / PARTIALLY / UNATTRIBUTABLE). Dalil bo'lmasa TAXMIN QILINMAYDI.
//   npx tsx scripts/finance-v2/legacy-payments-audit.ts --db /abs/copy.db [--cutover 2026-10-01T00:00:00+05:00] [--out dossier.json]
import { writeFileSync } from "node:fs";
import { classifyLegacyPayment, collectLegacyPaymentEvidence, type LegacyPaymentDossier } from "@/lib/finance/legacy/evidence";
import { cutoverAtFrom, parseCutoverAt } from "@/lib/finance/cutover";
import { openSqlite } from "@/lib/finance/ops/sqlite";
import { fail, parseArgs, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openSqlite(resolveDbPath(args));
  try {
    const cutoverAt = typeof args.cutover === "string" ? parseCutoverAt(args.cutover) : await cutoverAtFrom(db);
    const payments = await db.payment.findMany({ where: { status: "PAID", receivedAt: { lt: cutoverAt }, OR: [{ legacyRole: null }, { legacyRole: "HISTORICAL" }] }, orderBy: [{ createdAt: "asc" }] });
    const noReceived = await db.payment.findMany({ where: { status: "PAID", receivedAt: null, legacyRole: null }, orderBy: [{ createdAt: "asc" }] }); // V2'ga kiritilmagan (backfill'dan oldin)
    const all = [...payments, ...noReceived.filter((p) => p.createdAt < cutoverAt && !payments.some((x) => x.id === p.id))];
    const dossiers: LegacyPaymentDossier[] = [];
    for (const p of all) {
      const ev = await collectLegacyPaymentEvidence(db, p.id);
      dossiers.push({ ...ev, classification: classifyLegacyPayment(ev) });
    }
    const total = all.reduce((a, p) => a + p.amount, 0);
    const byClass = { EXACTLY_ATTRIBUTABLE: 0, PARTIALLY_ATTRIBUTABLE: 0, UNATTRIBUTABLE: 0 } as Record<string, number>;
    for (const d of dossiers) byClass[d.classification.kind]++;
    console.log(`## legacy-payments-audit (cutover ${cutoverAt.toISOString()})`);
    console.log(`to'lovlar: ${all.length}  jami: ${total}  klassifikatsiya: ${JSON.stringify(byClass)}`);
    console.log("");
    console.log("| # | id | o'quvchi | filial | summa | usul | qabul (createdAt) | doc/purpose | holat | guruh dalili | xizmat oyi dalili | o'qituvchi dalili | klass | sabab |");
    console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    dossiers.forEach((d, i) => {
      const p = d.payment;
      console.log(`| ${i + 1} | ${p.id.slice(-6)} | ${d.student?.fullName ?? "?"} (${d.student?.eduStatus ?? "?"}) | ${d.branch ?? "—"} | ${p.amount} | ${p.method} | ${p.createdAt.slice(0, 10)} | ${p.docNumber ?? ""} ${p.purpose ?? ""} | ${p.legacyRole ?? "null"}${p.postedAt ? "/posted" : ""} | ${d.groupEvidence.map((g) => `${g.groupName ?? g.groupId}${g.deleted ? " (o'chirilgan)" : ""}[${g.source}]`).join("; ") || "—"} | ${d.serviceMonthEvidence.map((m) => `${m.month}[${m.source}]`).join("; ") || "—"} | ${d.teacherEvidence.map((t) => `${t.teacherName ?? t.teacherId}[${t.source}]`).join("; ") || "—"} | ${d.classification.kind} | ${d.classification.reasons.join("; ")} |`);
    });
    if (typeof args.out === "string") writeFileSync(args.out, JSON.stringify({ cutoverAt: cutoverAt.toISOString(), count: all.length, total, byClass, dossiers }, null, 2));
    console.log(`\n✓ audit tugadi (faqat o'qildi): ${all.length} to'lov, ${total} so'm`);
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => fail(String(e?.stack ?? e)));
