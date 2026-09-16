#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# B SERVER — FAQAT O'QISH uchun audit (Finance V2, Phase 0 SAFETY).
#
# Hech narsani o'zgartirmaydi: fayl yozmaydi, bazaga yozmaydi, servisga
# tegmaydi. Faqat holatni chop etadi: baza yo'li/hajmi/journal rejimi,
# sqlite3 CLI bor-yo'qligi, disk, backup, sxema farqi (drift).
#
#   Serverda:        bash /opt/gl-edu/deploy/gcp/audit-readonly.sh
#   CI (Actions):    .github/workflows/server-audit.yml shu skriptni yuboradi
# ════════════════════════════════════════════════════════════════════
set -u
APP=/opt/gl-edu
cd "$APP" || { echo "!! $APP topilmadi"; exit 1; }

section() { echo; echo "## $1"; }

section "Server"
echo "user=$(whoami) host=$(hostname) kernel=$(uname -r) date=$(date '+%F %T %Z')"
echo "TZ (systemd gl-edu): $(systemctl show gl-edu -p Environment 2>/dev/null | tr ' ' '\n' | grep -E '^TZ=' || echo 'ko‘rsatilmagan')"
echo "servislar: gl-edu=$(systemctl is-active gl-edu 2>/dev/null) gl-ami=$(systemctl is-active gl-ami 2>/dev/null) gl-tunnel=$(systemctl is-active gl-tunnel 2>/dev/null)"
if sudo -n true 2>/dev/null; then echo "sudo (parolsiz): HA"; else echo "sudo (parolsiz): YO'Q"; fi

section "Git"
echo "HEAD=$(git rev-parse --short HEAD) branch=$(git rev-parse --abbrev-ref HEAD) o'zgargan fayllar=$(git status --short | wc -l | tr -d ' ')"
git status --short | head -5

section "DATABASE_URL (.env)"
# Faqat sqlite kutiladi; boshqa provider bo'lsa parol yashiriladi
grep -E '^DATABASE_URL=' .env 2>/dev/null | sed -E 's#(://[^:/]+:)[^@]+@#\1***@#' || echo ".env da DATABASE_URL yo'q"

section "Baza fayllari"
ls -la prisma/ 2>/dev/null | grep -E '\.db' || echo "prisma/ da .db fayl yo'q"
echo "hajm:"; du -h prisma/dev.db* 2>/dev/null || true

section "sqlite3 CLI"
if command -v sqlite3 >/dev/null 2>&1; then
  echo "bor: $(sqlite3 --version)"
  HAVE_SQLITE=1
else
  echo "MAVJUD EMAS"
  HAVE_SQLITE=0
fi

section "Journal rejimi / sahifa / tekshiruv (read-only)"
if [ "$HAVE_SQLITE" = 1 ]; then
  sqlite3 -readonly prisma/dev.db "PRAGMA journal_mode; PRAGMA page_size; PRAGMA page_count; PRAGMA quick_check;" 2>&1 | tr '\n' ' '; echo
else
  node -e '
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient();
    (async () => {
      for (const q of ["PRAGMA journal_mode", "PRAGMA page_size", "PRAGMA page_count", "PRAGMA quick_check"]) {
        console.log(q, JSON.stringify(await p.$queryRawUnsafe(q), (_, v) => typeof v === "bigint" ? Number(v) : v));
      }
    })().catch((e) => console.error("xato:", e.message)).finally(() => p.$disconnect());
  '
fi

section "Qator sonlari va pul yig'indilari (faqat agregat)"
COUNTS_SQL="
select 'Student', count(*) from Student union all
select 'Group', count(*) from \"Group\" union all
select 'GroupStudent', count(*) from GroupStudent union all
select 'Payment', count(*) from Payment union all
select 'Expense', count(*) from Expense union all
select 'TeacherSalary', count(*) from TeacherSalary union all
select 'SalaryRule', count(*) from SalaryRule union all
select 'AuditLog', count(*) from AuditLog union all
select 'Attendance', count(*) from Attendance union all
select 'Lesson', count(*) from Lesson;"
SUMS_SQL="select status, count(*) as n, coalesce(sum(amount),0) as total, min(createdAt) as first, max(createdAt) as last from Payment group by status;"
if [ "$HAVE_SQLITE" = 1 ]; then
  sqlite3 -readonly -header -column prisma/dev.db "$COUNTS_SQL" 2>&1
  echo; sqlite3 -readonly -header -column prisma/dev.db "$SUMS_SQL" 2>&1
else
  COUNTS_SQL="$COUNTS_SQL" SUMS_SQL="$SUMS_SQL" node -e '
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient();
    (async () => {
      console.log(JSON.stringify(await p.$queryRawUnsafe(process.env.COUNTS_SQL), (_, v) => typeof v === "bigint" ? Number(v) : v));
      console.log(JSON.stringify(await p.$queryRawUnsafe(process.env.SUMS_SQL), (_, v) => typeof v === "bigint" ? Number(v) : v));
    })().catch((e) => console.error("xato:", e.message)).finally(() => p.$disconnect());
  '
fi

section "Disk"
df -h "$APP" /tmp 2>/dev/null | sed -n '1p;2p;3p'

section "Backup holati"
ls -la prisma/ 2>/dev/null | grep -iE 'backup|\.bak' || echo "prisma/ da backup fayl yo'q"
ls -ld "$APP/backups" /var/backups/gl-edu 2>/dev/null || echo "backup papkasi yo'q"

section "Node / Prisma"
echo "node=$(node -v) npm=$(npm -v)"
npx prisma --version 2>/dev/null | grep -E '^(prisma|@prisma/client)' || true

section "Sxema farqi (prod baza ↔ prisma/schema.prisma), read-only"
# Bo'sh chiqsa — baza sxemaga to'liq mos. SQL chiqsa — db push shuni bajargan bo'lardi.
npx prisma migrate diff --from-url "file:$APP/prisma/dev.db" --to-schema-datamodel prisma/schema.prisma --script 2>&1 | head -60

section "Ilova versiyasi / deploy holati"
echo "package.json version=$(node -p "require('./package.json').version" 2>/dev/null) name=$(node -p "require('./package.json').name" 2>/dev/null)"
echo "deploy qilingan commit: $(git rev-parse HEAD) ($(git log -1 --format='%ci %s' | cut -c1-90))"
echo "BUILD_ID: $(cat .next/BUILD_ID 2>/dev/null || echo 'yo‘q')  .next mtime: $(stat -c '%y' .next 2>/dev/null | cut -c1-19)"
echo "systemd gl-edu ExecStart: $(systemctl show gl-edu -p ExecStart 2>/dev/null | sed -E 's/.*argv\[\]=([^;]+);.*/\1/' | head -1)"
echo "WorkingDirectory: $(systemctl show gl-edu -p WorkingDirectory 2>/dev/null | cut -d= -f2)"
echo "uptime gl-edu: $(systemctl show gl-edu -p ActiveEnterTimestamp 2>/dev/null | cut -d= -f2)"

section "Migration holati (prod baza, read-only)"
node -e '
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  (async () => {
    const t = await p.$queryRawUnsafe("SELECT count(*) AS n FROM sqlite_master WHERE type=\"table\" AND name=\"_prisma_migrations\"");
    const has = Number(t[0].n) > 0;
    console.log("_prisma_migrations jadvali:", has ? "BOR" : "YO‘Q (db push rejimi)");
    if (has) console.log(JSON.stringify(await p.$queryRawUnsafe("SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at"), (_, v) => typeof v === "bigint" ? Number(v) : v));
    const v2 = await p.$queryRawUnsafe("SELECT count(*) AS n FROM sqlite_master WHERE type=\"table\" AND name IN (\"StudentCharge\",\"PaymentAllocation\",\"TeacherEarning\",\"FinancialTransaction\")");
    console.log("Finance V2 jadvallari:", Number(v2[0].n), "/ 4");
    const f = await p.$queryRawUnsafe("SELECT key, value FROM Setting WHERE key LIKE \"finance.%\"");
    console.log("finance.* sozlamalar:", JSON.stringify(f));
    const ic = await p.$queryRawUnsafe("PRAGMA integrity_check");
    console.log("integrity_check (to‘liq):", JSON.stringify(ic).slice(0, 200));
    const tables = await p.$queryRawUnsafe("SELECT count(*) AS n FROM sqlite_master WHERE type=\"table\"");
    console.log("jadvallar soni:", Number(tables[0].n));
  })().catch((e) => console.error("xato:", e.message)).finally(() => p.$disconnect());
'

section "Kuzatilmayotgan fayllar — FAQAT METADATA (o‘qilmaydi, bajarilmaydi, o‘zgartirilmaydi)"
git status --short --untracked-files=all 2>/dev/null | grep -v "^ M tsconfig.json" | head -20 || true
for f in _k.html _u.mjs; do
  if [ -e "$APP/$f" ]; then
    echo "-- $APP/$f"; stat -c 'owner=%U:%G mode=%A size=%s bytes mtime=%y ctime=%z' "$APP/$f" 2>/dev/null
    echo "   git kuzatuvida: $(git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo HA || echo "YO‘Q")"
    echo "   systemd/cron havolalar: $(grep -rl "$f" /etc/systemd/system /etc/cron* /var/spool/cron 2>/dev/null | tr '\n' ' ' || true)$(crontab -l 2>/dev/null | grep -c "$f" | sed 's/^/ crontab=/')"
    echo "   ishlayotgan jarayonlar: $(pgrep -af "$f" 2>/dev/null | grep -v pgrep | wc -l | tr -d ' ')"
    echo "   public/ dan servis qilinadimi: $(ls "$APP/public/$f" 2>/dev/null || echo "yo‘q")"
  else
    echo "-- $APP/$f: MAVJUD EMAS"
  fi
done
echo "ildizdagi boshqa .html/.mjs/.sh fayllar (repo'da yo'q):"; for f in "$APP"/*.html "$APP"/*.mjs "$APP"/*.sh; do [ -e "$f" ] && ! git ls-files --error-unmatch "$(basename "$f")" >/dev/null 2>&1 && stat -c '  %n owner=%U mode=%A size=%s mtime=%y' "$f"; done 2>/dev/null || true

section "Deploy trigger"
echo "GitHub Actions: push→main → ssh → $APP/deploy/gcp/update-b.sh (git reset --hard, prisma db push, next build, restart)"
echo "update-b.sh ichida backup qadam: $(grep -c -iE 'backup|\.backup' deploy/gcp/update-b.sh) ta qator (0 = yo'q)"

echo; echo "✓ audit tugadi (hech narsa o'zgartirilmadi)"
