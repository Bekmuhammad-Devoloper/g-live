#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# FINANCE V2 — PROD MA'LUMOTIDA DRY-RUN (Phase 2). Prod bazaga YOZMAYDI.
#
#   1. finance-v2 branch'ini /tmp/gl-finance-dryrun ga alohida klon qiladi
#      (prod checkout /opt/gl-edu ga TEGILMAYDI)
#   2. backup: VACUUM INTO /opt/gl-edu/backups (integrity + sonlar + metadata, protected)
#   3. restore rehearsal: backup'dan nusxa → Prisma → integrity → sonlar/pul manba bilan
#   4. migratsiya NUSXADA: baseline drift tekshiruvi → migrate deploy → post-check → reconciliation
#   5. nusxa o'chiriladi. Natija — logda.
#
# Prod bazaga ta'siri: faqat O'QISH (VACUUM INTO manba faylni o'zgartirmaydi).
# Serverda qoladi: /opt/gl-edu/backups/*.bak(+.json) va /tmp/gl-finance-dryrun (klon).
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
APP=/opt/gl-edu
DRY=/tmp/gl-finance-dryrun
REF=${FINANCE_REF:-finance-v2}

echo "## 0. Preflight"
echo "prod HEAD=$(git -C $APP rev-parse --short HEAD) db=$(du -h $APP/prisma/dev.db | cut -f1) journal=$(node -e "const {PrismaClient}=require('$APP/node_modules/@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$APP/prisma/dev.db'});p.\$queryRawUnsafe('PRAGMA journal_mode').then(r=>{console.log(r[0].journal_mode)}).finally(()=>p.\$disconnect())")"
df -h /tmp "$APP" | sed -n '2,3p'

echo "## 1. Klon ($REF → $DRY)"
rm -rf "$DRY"
git clone -q "$APP" "$DRY"
git -C "$DRY" fetch -q "$(git -C "$APP" remote get-url origin)" "$REF"
git -C "$DRY" checkout -q FETCH_HEAD
echo "dry-run HEAD=$(git -C "$DRY" rev-parse --short HEAD)"
cd "$DRY"
npm ci --no-audit --no-fund 2>&1 | tail -1
npx prisma generate 2>&1 | grep -E "Generated" || true

echo "## 2–4. Backup → restore rehearsal → migratsiya NUSXADA → post-check → reconciliation"
mkdir -p "$APP/backups" "$DRY/work"
node_modules/.bin/tsx scripts/finance-v2/migrate-safe.ts --dry-run \
  --db "$APP/prisma/dev.db" --backup-dir "$APP/backups" --workdir "$DRY/work" \
  --label "dryrun-$(git rev-parse --short HEAD)" --protect 2>&1 | grep -vE "deprecated|pris.ly/prisma-config"

echo "## 5. Prod baza o'zgarmaganini tasdiqlash"
node -e "const {PrismaClient}=require('$APP/node_modules/@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$APP/prisma/dev.db'});p.\$queryRawUnsafe(\"SELECT count(*) AS n FROM sqlite_master WHERE name='_prisma_migrations'\").then(r=>{console.log('_prisma_migrations jadvali (0 = hali db push rejimi, tegilmagan):', Number(r[0].n))}).finally(()=>p.\$disconnect())"
echo "backups:"; ls -la "$APP/backups" | tail -n +2
echo "✓ dry-run tugadi (prod bazaga yozilmadi)"
