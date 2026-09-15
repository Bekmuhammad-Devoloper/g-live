#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# B SERVERNI GIT ORQALI YANGILASH — bitta buyruq, hammasi bir butun.
#
#   B serverda:            bash /opt/gl-edu/deploy/gcp/update-b.sh
#   Laptopdan (qo'lda):    ssh -i ~/.ssh/gl-gcp uzbekmen94@34.179.202.164 \
#                            "bash /opt/gl-edu/deploy/gcp/update-b.sh"
#   CI/CD (GitHub Actions) ham aynan shu skriptni chaqiradi.
#
# Oqim (Finance V2, Phase 2 — B3):
#   deploy lock → git → bog'liqliklar → prisma generate →
#   BAZA: preflight → backup (VACUUM INTO + integrity + sonlar + metadata) →
#         baseline tekshiruvi (drift bo'lsa STOP) → prisma migrate deploy →
#         post-check (baza = schema) → reconciliation (legacy metrikalar teng) →
#   build (yon papkaga) → almashtirish → restart → health check (yiqilsa orqaga).
#
# `prisma db push` ENDI ISHLATILMAYDI. Migratsiya yiqilsa: build/restart
# bo'lmaydi, kod eski commitga qaytadi, sayt eski nusxada ishlashda davom etadi,
# backup /opt/gl-edu/backups ichida (metadata .json bilan).
# .env va prisma/dev.db ga to'g'ridan-to'g'ri TEGILMAYDI (ular .gitignore'da).
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
APP=/opt/gl-edu
BACKUP_DIR="$APP/backups"
WORK_DIR="/tmp/gl-migrate"
cd "$APP"

echo "══ 0/7 Deploy qulfi ══"
# Bir vaqtda ikkita deploy ishlamasin (CI concurrency + qo'lda ishga tushirish)
exec 9>"$APP/.deploy.lock"
if ! flock -n 9; then
  echo "❌ Boshqa deploy ishlayapti ($APP/.deploy.lock) — bu ishga tushirish to'xtatildi"
  exit 1
fi

echo "══ 1/7 Git yangilanishi ══"
OLD=$(git rev-parse HEAD)
git fetch origin main
git reset --hard origin/main
NEW=$(git rev-parse HEAD)
if [ "$OLD" = "$NEW" ]; then
  echo "Yangi commit yo'q ($(git log --oneline -1)) — baribir tekshiriladi"
else
  echo "Yangilandi: ${OLD:0:7} → ${NEW:0:7}"
  git log --oneline "${OLD}..${NEW}" | head -10
fi

# Kodni eski commitga qaytarish (.next tegilmaydi → sayt eski nusxada ishlayveradi)
rollback_code() {
  echo "↩  Kod eski commitga qaytarilmoqda: ${OLD:0:7}"
  git reset --hard "$OLD" >/dev/null
}

echo "══ 2/7 Bog'liqliklar ══"
# package-lock o'zgargan bo'lsagina npm ci (vaqt tejaladi)
if [ "$OLD" != "$NEW" ] && git diff --name-only "$OLD" "$NEW" | grep -q "package-lock.json"; then
  npm ci --no-audit --no-fund 2>&1 | tail -1
else
  echo "package-lock o'zgarmagan — o'tkazib yuborildi"
fi

echo "══ 3/7 Prisma client ══"
npx prisma generate 2>&1 | grep -E "Generated" || true

echo "══ 4/7 Baza: backup → baseline → migrate deploy → post-check → reconciliation ══"
# Preflight: baza va skript joyida bo'lishi shart
if [ ! -f "$APP/prisma/dev.db" ]; then echo "❌ $APP/prisma/dev.db topilmadi"; rollback_code; exit 1; fi
if [ ! -f "$APP/scripts/finance-v2/migrate-safe.ts" ] || [ ! -x "$APP/node_modules/.bin/tsx" ]; then
  echo "❌ migrate-safe.ts yoki tsx topilmadi — deploy to'xtatildi (db push ishlatilmaydi)"; rollback_code; exit 1
fi
mkdir -p "$BACKUP_DIR" "$WORK_DIR"
# migrate-safe: backup verify o'tmasa migratsiya BOSHLANMAYDI; drift bo'lsa STOP;
# migrate deploy'dan keyin sxema va legacy pul metrikalari tekshiriladi.
if ! "$APP/node_modules/.bin/tsx" scripts/finance-v2/migrate-safe.ts \
      --backup-dir "$BACKUP_DIR" --workdir "$WORK_DIR" --label "deploy-${NEW:0:7}" 2>&1 | grep -vE "deprecated|pris.ly/prisma-config" | tail -60; then
  echo "❌ BAZA bosqichi yiqildi — ilova YANGI sxema kutadigan nusxaga qayta ishga tushirilmaydi"
  echo "   Backup: $BACKUP_DIR (metadata .json). Tiklash: scripts/finance-v2/restore-rehearsal.ts bilan tekshirib, faylni almashtiring."
  rollback_code
  exit 1
fi

echo "══ 5/7 Build ══"
# Ishlab turgan .next ga TEGMAYMIZ: avval yangisini yon papkaga yig'amiz.
# Build yiqilsa — sayt eski, ishlaydigan nusxada qolaveradi (baza additive
# migratsiyalangan — eski kod yangi jadval/ustunlarni ishlatmaydi, buzilmaydi).
rm -rf .next-build
if ! NEXT_DIST_DIR=.next-build npx next build 2>&1 | tail -20; then
  echo "❌ Build yiqildi — sayt eski nusxada ishlashda davom etmoqda"
  rm -rf .next-build
  rollback_code
  exit 1
fi
# Muvaffaqiyatli build → tez almashtirish (bir necha millisekund)
rm -rf .next-old
[ -d .next ] && mv .next .next-old
mv .next-build .next

echo "══ 6/7 Servislarni qayta ishga tushirish ══"
sudo systemctl restart gl-edu gl-ami
sleep 4

# Sog'liq tekshiruvi — ko'tarilmasa AVVALGI nusxaga qaytamiz
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://127.0.0.1:3000/login || echo 000)
if [ "$CODE" != "200" ]; then
  echo "⚠️  Yangi nusxa javob bermadi (HTTP $CODE) — ORQAGA QAYTARILMOQDA"
  if [ -d .next-old ]; then
    rm -rf .next && mv .next-old .next
    rollback_code
    sudo systemctl restart gl-edu gl-ami
    sleep 4
    echo "Qaytarildi: $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://127.0.0.1:3000/login)"
  fi
  exit 1
fi

rm -rf .next-old
systemctl is-active gl-edu gl-ami gl-tunnel
echo "Sayt: HTTP $CODE"

echo ""
echo "══ 7/7 ✅ Yangilash tugadi: $(git log --oneline -1) ══"
