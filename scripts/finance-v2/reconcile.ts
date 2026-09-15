// Reconciliation: snapshot olish yoki ikki snapshot'ni solishtirish.
//   npx tsx scripts/finance-v2/reconcile.ts snapshot --out before.json [--db /abs/dev.db]
//   npx tsx scripts/finance-v2/reconcile.ts compare --before before.json --after after.json
import { readFileSync, writeFileSync } from "node:fs";
import { compareSnapshots, snapshotFile, type ReconcileSnapshot } from "@/lib/finance/ops/reconcile";
import { fail, parseArgs, printJson, resolveDbPath } from "./_cli";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (cmd === "snapshot") {
    const snap = await snapshotFile(resolveDbPath(args));
    if (typeof args.out === "string") writeFileSync(args.out, JSON.stringify(snap, null, 2));
    printJson("snapshot", snap);
    return;
  }
  if (cmd === "compare") {
    const before = JSON.parse(readFileSync(String(args.before), "utf8")) as ReconcileSnapshot;
    const after = JSON.parse(readFileSync(String(args.after), "utf8")) as ReconcileSnapshot;
    const report = compareSnapshots(before, after);
    printJson("reconcile", report);
    if (!report.ok) fail(`UNEXPECTED farqlar: pul ${report.unexpectedMoney}, sonlar ${report.unexpectedCounts}`);
    console.log("✓ reconciliation: farq yo'q yoki faqat kutilgan");
    return;
  }
  fail("buyruq: snapshot | compare");
}
main().catch((e) => fail(String(e?.stack ?? e)));
