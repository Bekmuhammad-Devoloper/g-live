// Xavfsiz migratsiya (B3): backup → baseline (drift bo'lsa STOP) → migrate deploy → post-check → reconciliation.
//   REAL:    npx tsx scripts/finance-v2/migrate-safe.ts --backup-dir /opt/gl-edu/backups --workdir /tmp/gl-migrate [--label deploy-abc] [--protect]
//   DRY-RUN: npx tsx scripts/finance-v2/migrate-safe.ts --dry-run --backup-dir … --workdir …   (jonli bazaga TEGMAYDI — nusxada)
import { dryRunMigrate, MigrateError, safeMigrate } from "@/lib/finance/ops/migrate";
import { REPO_ROOT, fail, parseArgs, printJson, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupDir = typeof args["backup-dir"] === "string" ? args["backup-dir"] : fail("--backup-dir kerak");
  const workDir = typeof args.workdir === "string" ? args.workdir : fail("--workdir kerak");
  const dbPath = resolveDbPath(args);
  const common = { dbPath, backupDir, workDir, repoRoot: REPO_ROOT, label: typeof args.label === "string" ? args.label : undefined, protectBackup: args.protect === true };

  if (args["dry-run"] === true) {
    const r = await dryRunMigrate(common);
    printJson("dry-run", {
      backup: r.backup?.backupPath ?? null, baseline: r.baseline, status: r.statusOutput.trim(), deploy: r.deployOutput.trim(),
      postDriftEmpty: true, before: r.before, after: r.after, reconcile: r.reconcile,
    });
    console.log("✓ DRY-RUN muvaffaqiyatli (jonli baza o'zgarmadi)");
    return;
  }
  const r = await safeMigrate(common);
  printJson("migrate", {
    backup: r.backup?.backupPath ?? null, baseline: r.baseline, status: r.statusOutput.trim(), deploy: r.deployOutput.trim(),
    postDriftEmpty: true, reconcile: r.reconcile,
  });
  console.log("✓ migratsiya muvaffaqiyatli, post-check va reconciliation o'tdi");
}
main().catch((e) => fail(e instanceof MigrateError ? e.message : String(e?.stack ?? e)));
