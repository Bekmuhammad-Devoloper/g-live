// Backup'dan tiklash mashqi: nusxa → Prisma → integrity → sonlar/pul manba bilan.
//   npx tsx scripts/finance-v2/restore-rehearsal.ts --backup /opt/gl-edu/backups/dev.db.X.bak --workdir /tmp/gl-restore [--db /abs/dev.db]
import { restoreRehearsal, RestoreError } from "@/lib/finance/ops/restore";
import { fail, parseArgs, printJson, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupPath = typeof args.backup === "string" ? args.backup : fail("--backup kerak");
  const workDir = typeof args.workdir === "string" ? args.workdir : fail("--workdir kerak");
  let sourcePath: string | undefined;
  try { sourcePath = resolveDbPath(args); } catch { sourcePath = undefined; }
  const r = await restoreRehearsal({ backupPath, workDir, sourcePath });
  printJson("restore-rehearsal", { restoredSize: r.restoredSize, integrity: r.integrity, rowCounts: r.rowCounts, metadataMismatches: r.metadataMismatches, sourceReconcile: r.sourceReconcile, money: r.restoredSnapshot.money });
  if (r.sourceReconcile && !r.sourceReconcile.ok) fail("tiklangan nusxa manba bilan mos emas");
  console.log("✓ restore rehearsal muvaffaqiyatli — backup'dan tiklash mumkin");
}
main().catch((e) => fail(e instanceof RestoreError ? e.message : String(e?.stack ?? e)));
