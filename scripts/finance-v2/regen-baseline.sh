#!/usr/bin/env bash
# 0_baseline ni qayta yaratish: baseline = BERILGAN ref'dagi (odatda origin/main = prod `db push` holati) sxema.
# Core migratsiya o'zgarmasligi shart (faqat qo'shimcha). Baseline+core ↔ joriy sxema farqi bo'sh bo'lishi shart.
#   bash scripts/finance-v2/regen-baseline.sh [origin/main]
set -euo pipefail
cd "$(dirname "$0")/../.."
REF=${1:-origin/main}
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
export DATABASE_URL="file:$W/shadow.db"
git show "$REF:prisma/schema.prisma" > "$W/main-schema.prisma"
npx prisma migrate diff --from-empty --to-schema-datamodel "$W/main-schema.prisma" --script 2>/dev/null > "$W/baseline.sql"
mkdir -p "$W/mig/0_baseline"; cp "$W/baseline.sql" "$W/mig/0_baseline/migration.sql"; cp prisma/migrations/migration_lock.toml "$W/mig/"
CORE=$(npx prisma migrate diff --from-migrations "$W/mig" --to-schema-datamodel prisma/schema.prisma --script --shadow-database-url "file:$W/shadow2.db" 2>/dev/null)
CUR=$(grep -v '^--' prisma/migrations/20260915000000_finance_v2_core/migration.sql | sed '/^$/d')
if [ "$(echo "$CORE" | grep -v '^--' | sed '/^$/d')" != "$CUR" ]; then
  if [ "${2:-}" = "--regen-core" ]; then
    echo "$CORE" > prisma/migrations/20260915000000_finance_v2_core/migration.sql; echo "ℹ core migratsiya qayta yaratildi (--regen-core; prod'da hali qo'llanmagan)"
  else
    echo "✗ core migratsiya SQL o'zgarishi kerak bo'lardi — qo'lda ko'rib chiqing (yoki --regen-core):"; diff <(echo "$CUR") <(echo "$CORE" | grep -v '^--' | sed '/^$/d') | head -40; exit 1
  fi
fi
cp "$W/baseline.sql" prisma/migrations/0_baseline/migration.sql
OUT=$(npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "file:$W/shadow3.db" 2>/dev/null)
echo "$OUT" | grep -q "No difference" || { echo "✗ baseline+core ↔ sxema farqi bor:"; echo "$OUT" | head; exit 1; }
echo "✓ 0_baseline = $REF ($(git rev-parse --short "$REF")) sxemasi; core o'zgarmadi; zanjir ↔ sxema: farq yo'q ($(grep -c 'CREATE TABLE' prisma/migrations/0_baseline/migration.sql) jadval)"
