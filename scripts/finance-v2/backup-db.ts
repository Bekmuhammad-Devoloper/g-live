// Prod SQLite backup (B2): VACUUM INTO → integrity → sonlar → metadata → atomik nom → retention.
//   npx tsx scripts/finance-v2/backup-db.ts --dir /opt/gl-edu/backups [--label deploy-abc1234] [--protect] [--keep 10] [--db /abs/dev.db]
import { createBackup, BackupError } from "@/lib/finance/ops/backup";
import { fail, parseArgs, printJson, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = typeof args.dir === "string" ? args.dir : fail("--dir kerak");
  const sourcePath = resolveDbPath(args);
  const r = await createBackup({
    sourcePath, dir,
    label: typeof args.label === "string" ? args.label : undefined,
    protect: args.protect === true,
    keep: typeof args.keep === "string" ? Number(args.keep) : 10,
  });
  printJson("backup", { ...r.metadata, metadataPath: r.metadataPath, pruned: r.pruned });
  console.log(`✓ backup tayyor: ${r.backupPath}`);
}
main().catch((e) => fail(e instanceof BackupError ? e.message : String(e?.stack ?? e)));
