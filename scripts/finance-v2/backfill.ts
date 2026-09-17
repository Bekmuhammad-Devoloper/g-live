// Legacy → V2 backfill. Idempotent, bosqichma-bosqich.
//   npx tsx scripts/finance-v2/backfill.ts --stage billing|payments|preserve-legacy|verify|salary|expenses|legacy-invariant [--dry-run] [--db /abs/dev.db] [--upTo 2026-10] [--allow-unpriced]
import { backfillBilling, backfillExpenses, backfillPayments, backfillSalary, verifyDebt } from "@/lib/finance/ops/backfill";
import { legacyPreservationInvariant, preserveLegacyPayments } from "@/lib/finance/legacy/preserve";
import { openSqlite } from "@/lib/finance/ops/sqlite";
import { parseYearMonthKey } from "@/lib/finance/period";
import { fail, parseArgs, printJson, resolveDbPath, stubServerOnly } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = typeof args.stage === "string" ? args.stage : fail("--stage kerak (billing)");
  const client = openSqlite(resolveDbPath(args));
  const dryRun = args["dry-run"] === true;
  const upTo = typeof args.upTo === "string" ? parseYearMonthKey(args.upTo) : undefined;
  try {
    if (stage === "billing") {
      const r = await backfillBilling(client, { dryRun, upTo, allowUnpriced: args["allow-unpriced"] === true, log: (l) => console.log(l) });
      printJson("backfill:billing", r);
      console.log(dryRun ? "✓ dry-run (yozilmadi)" : "✓ billing backfill tugadi");
      return;
    }
    if (stage === "payments") {
      const r = await backfillPayments(client, { dryRun, upTo, log: (l) => console.log(l) });
      printJson("backfill:payments", r);
      console.log(dryRun ? "✓ dry-run (yozilmadi)" : "✓ payments backfill tugadi");
      return;
    }
    if (stage === "expenses") {
      const r = await backfillExpenses(client, { dryRun });
      printJson("backfill:expenses", r);
      console.log(dryRun ? "✓ dry-run (yozilmadi)" : "✓ expenses backfill tugadi");
      return;
    }
    if (stage === "salary") {
      const r = await backfillSalary(client, { dryRun });
      printJson("backfill:salary", r);
      console.log(dryRun ? "✓ dry-run (yozilmadi)" : "✓ salary backfill tugadi");
      return;
    }
    if (stage === "preserve-legacy") {
      // Legacy real to'lovlarni SAQLASH: klassifikatsiya + dalil dossyesi + HISTORICAL belgisi (kredit emas) + ko'rib chiqish yozuvi.
      // Hech qanday summa/sana o'zgarmaydi, hech narsa o'chirilmaydi, earning taxmin qilinmaydi.
      const r = await preserveLegacyPayments(client, { dryRun, actorId: typeof args.actor === "string" ? args.actor : null });
      printJson("backfill:preserve-legacy", r);
      const inv = await legacyPreservationInvariant(client);
      printJson("legacy-invariant", inv);
      if (!dryRun && !inv.ok) fail(`LEGACY PRESERVATION INVARIANT BUZILGAN: lost=${inv.lostAmount} dup=${inv.duplicateLedger} fakeCredit=${inv.fakeCreditCount} unposted=${inv.unposted}`);
      console.log(dryRun ? `✓ dry-run: ${r.candidates} ta legacy to'lov (${r.legacyTotal} so'm) — ${r.needsReview} ta ko'rib chiqiladi` : `✓ saqlandi: ${r.candidates} ta legacy to'lov, ${r.legacyTotal} = ${r.preservedTotal} so'm; HISTORICAL +${r.markedHistorical}; ko'rib chiqish ${r.needsReview} (${r.needsReviewAmount} so'm); lost=${inv.lostAmount} dup=${inv.duplicateLedger}`);
      return;
    }
    if (stage === "legacy-invariant") {
      const inv = await legacyPreservationInvariant(client);
      printJson("legacy-invariant", inv);
      if (!inv.ok) fail("LEGACY PRESERVATION INVARIANT BUZILGAN");
      console.log(`✓ invariant: ${inv.legacyCount} to'lov, ${inv.legacyTotal} = ${inv.preservedTotal} so'm; ledger IN ${inv.ledgerInCount} (${inv.ledgerInTotal}); lost 0; dup 0; soxta kredit 0`);
      return;
    }
    if (stage === "verify") {
      // Legacy formula — o'sha bazadan (DATABASE_URL shu bazaga yo'naltirilgan bo'lishi kerak)
      process.env.DATABASE_URL = `file:${resolveDbPath(args)}`;
      stubServerOnly(); // `import "server-only"` — CLI (tsx) da alias yo'q, bo'sh modulga yo'naltiriladi
      const { computeDebts } = await import("@/lib/debt");
      const ids = (await client.student.findMany({ select: { id: true } })).map((s) => s.id);
      const legacy = await computeDebts(ids);
      const r = await verifyDebt(client, new Map([...legacy.entries()].map(([k, v]) => [k, { debt: v.debt, credit: v.credit }])));
      printJson("verify", { ...r, rows: r.rows.filter((x) => x.classification !== "EQUAL") });
      if (!r.paidTotalsMatch || r.unexpected > 0) fail(`UNEXPECTED: paidTotalsMatch=${r.paidTotalsMatch}, unexpected=${r.unexpected}`);
      console.log("✓ verify: farqlar faqat kutilgan (S2/refund) yoki yo'q");
      return;
    }
    fail(`noma'lum bosqich: ${stage}`);
  } finally {
    await client.$disconnect();
  }
}
main().catch((e) => fail(String(e?.stack ?? e)));
