// Legacy → V2 backfill. Idempotent, bosqichma-bosqich.
//   npx tsx scripts/finance-v2/backfill.ts --stage billing [--dry-run] [--db /abs/dev.db] [--upTo 2026-10]
import { backfillBilling } from "@/lib/finance/ops/backfill";
import { openSqlite } from "@/lib/finance/ops/sqlite";
import { parseYearMonthKey } from "@/lib/finance/period";
import { fail, parseArgs, printJson, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = typeof args.stage === "string" ? args.stage : fail("--stage kerak (billing)");
  const client = openSqlite(resolveDbPath(args));
  const dryRun = args["dry-run"] === true;
  const upTo = typeof args.upTo === "string" ? parseYearMonthKey(args.upTo) : undefined;
  try {
    if (stage === "billing") {
      const r = await backfillBilling(client, { dryRun, upTo, log: (l) => console.log(l) });
      printJson("backfill:billing", r);
      console.log(dryRun ? "✓ dry-run (yozilmadi)" : "✓ billing backfill tugadi");
      return;
    }
    fail(`noma'lum bosqich: ${stage}`);
  } finally {
    await client.$disconnect();
  }
}
main().catch((e) => fail(String(e?.stack ?? e)));
