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
#         ilova to'xtaydi → baseline tekshiruvi (drift bo'lsa STOP) →
#         prisma migrate deploy → post-check (baza = schema) → reconciliation →
#         ilova (eski build) ishga tushadi →
#   build (yon papkaga) → almashtirish → restart → health check (yiqilsa orqaga).
#
# `prisma db push` ENDI ISHLATILMAYDI. Migratsiya yiqilsa: baza tekshirilgan
# backup'dan AVTOMATIK tiklanadi (Prisma SQLite'da yiqilgan migratsiya rollback
# bo'lmaydi — qisman qoladi), kod eski commitga qaytadi, ilova eski nusxada
# ishga tushadi. Backup /opt/gl-edu/backups ichida (metadata .json bilan).
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

echo "══ 4/7 Baza: backup → (ilova to'xtaydi) → baseline → migrate deploy → post-check → reconciliation ══"
# Preflight: baza va skriptlar joyida bo'lishi shart
if [ ! -f "$APP/prisma/dev.db" ]; then echo "❌ $APP/prisma/dev.db topilmadi"; rollback_code; exit 1; fi
if [ ! -f "$APP/scripts/finance-v2/migrate-safe.ts" ] || [ ! -x "$APP/node_modules/.bin/tsx" ]; then
  echo "❌ migrate-safe.ts yoki tsx topilmadi — deploy to'xtatildi (db push ishlatilmaydi)"; rollback_code; exit 1
fi
mkdir -p "$BACKUP_DIR" "$WORK_DIR"
TSX="$APP/node_modules/.bin/tsx"

# 4a. Migratsiya paytida ilova TO'XTATILADI: Prisma SQLite'da yiqilgan migratsiya rollback
#     bo'lmaydi (qisman qo'llanadi), jadval qayta qurish paytida jonli yozuvlar bo'lmasin.
#     Backup ham ILOVA TO'XTAGANDAN KEYIN olinadi — backup va migratsiya orasida birorta yozuv yo'qolmasin.
#     Migratsiya bir necha soniya (baza ~2 MB).
# gl-ami (qo'ng'iroq tarixini bazaga yozadi) ham to'xtatiladi — migratsiya paytida bazaga yozuvchi qolmasin
sudo systemctl stop gl-edu gl-ami
# Yiqilish yo'li: kod eski commit'ga qaytariladi va Prisma client ESKI sxema uchun qayta yaratiladi
# (yangi client eski bazadan yo'q ustunlarni so'raydi), keyin servislar ishga tushiriladi.
start_old_app() {
  rollback_code
  npx prisma generate 2>&1 | grep -E "Generated" || true
  sudo systemctl start gl-edu gl-ami
  sleep 3
  echo "Ilova eski nusxada: $(curl -s -o /dev/null -w 'HTTP %{http_code}' --max-time 20 http://127.0.0.1:3000/login || echo 000)"
}
if ! BK_OUT=$("$TSX" scripts/finance-v2/backup-db.ts --dir "$BACKUP_DIR" --label "deploy-${NEW:0:7}" 2>&1); then
  echo "$BK_OUT" | grep -vE "deprecated|pris.ly/prisma-config" | tail -20
  echo "❌ Backup yiqildi — migratsiya boshlanmadi (baza o'zgarmagan)"; start_old_app; exit 1
fi
BK=$(echo "$BK_OUT" | sed -n 's/^✓ backup tayyor: //p' | tail -1)
if [ -z "$BK" ] || [ ! -f "$BK" ]; then echo "$BK_OUT" | tail -20; echo "❌ Backup fayli aniqlanmadi"; start_old_app; exit 1; fi
echo "backup: $BK"

# 4b. Migratsiya
if ! "$TSX" scripts/finance-v2/migrate-safe.ts --no-backup --workdir "$WORK_DIR" 2>&1 | grep -vE "deprecated|pris.ly/prisma-config" | tail -60; then
  echo "❌ MIGRATSIYA YIQILDI — baza tekshirilgan backup'dan avtomatik tiklanmoqda: $BK"
  if "$TSX" scripts/finance-v2/restore-db.ts --backup "$BK" --db "$APP/prisma/dev.db" --i-stopped-the-app 2>&1 | tail -5; then
    echo "↩  Baza tiklandi (migratsiyadan oldingi holat)"
    start_old_app
  else
    # Qisman migratsiyalangan bazada ilova ISHGA TUSHIRILMAYDI — keyingi yozuvlar qo'lda tiklashda yo'qolardi
    echo "!!! AVTOMATIK TIKLASH YIQILDI — ILOVA TO'XTATILGAN HOLDA QOLDIRILDI (qisman migratsiyalangan bazada ishga tushirilmaydi)"
    echo "!!! QO'LDA: tsx scripts/finance-v2/restore-db.ts --backup $BK --db $APP/prisma/dev.db --i-stopped-the-app; keyin: git reset --hard $OLD; npx prisma generate; sudo systemctl start gl-edu gl-ami"
    rollback_code
  fi
  exit 1
fi
# Migratsiya muvaffaqiyatli — eski build additive sxema bilan ishlaydi; build tugaguncha ilova ishlab tursin
sudo systemctl start gl-edu gl-ami
sleep 3
CODE0=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://127.0.0.1:3000/login || echo 000)
echo "Migratsiyadan keyin eski nusxa: HTTP $CODE0"

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
