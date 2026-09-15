// REAL tiklash: tekshirilgan backup'ni jonli baza USTIGA qo'yadi (ilova to'xtatilgan bo'lishi shart).
//   sudo systemctl stop gl-edu
//   npx tsx scripts/finance-v2/restore-db.ts --backup /opt/gl-edu/backups/dev.db.X.bak --db /opt/gl-edu/prisma/dev.db --i-stopped-the-app
//   sudo systemctl start gl-edu
import { restoreDb, RestoreError } from "@/lib/finance/ops/restore";
import { fail, parseArgs, printJson, resolveDbPath } from "./_cli";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupPath = typeof args.backup === "string" ? args.backup : fail("--backup kerak");
  const r = await restoreDb({ backupPath, dbPath: resolveDbPath(args), appStopped: args["i-stopped-the-app"] === true });
  printJson("restore-db", r);
  console.log(`✓ baza tiklandi: ${r.dbPath} (eski fayl: ${r.brokenSavedAs})`);
}
main().catch((e) => fail(e instanceof RestoreError ? e.message : String(e?.stack ?? e)));
