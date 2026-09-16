// Go-live readiness (CLI): nusxa/prod bazada tekshiruv — faqat o'qiydi.
//   npx tsx scripts/finance-v2/readiness.ts --db /abs/copy.db
import { financeReadiness } from "@/lib/finance/readiness";
import { openSqlite } from "@/lib/finance/ops/sqlite";
import { fail, parseArgs, printJson, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openSqlite(resolveDbPath(args));
  try {
    const r = await financeReadiness(db);
    printJson("readiness", { ready: r.ready, month: r.month, blockers: r.blockers, warnings: r.warnings, stats: r.stats, issues: r.issues.map((i) => ({ code: i.code, severity: i.severity, count: i.count, sample: i.items.slice(0, 5).map((x) => `${x.label}${x.extra ? " · " + x.extra : ""}`) })) });
    console.log(r.ready ? "✓ READINESS: READY" : `✗ READINESS: NOT READY (${r.blockers} bloker)`);
    if (!r.ready) process.exitCode = 2;
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => fail(String(e?.stack ?? e)));
