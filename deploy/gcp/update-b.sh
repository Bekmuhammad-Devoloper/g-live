#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# B SERVERNI GIT ORQALI YANGILASH — bitta buyruq, hammasi bir butun.
#
#   B serverda:            bash /opt/gl-edu/deploy/gcp/update-b.sh
#   Laptopdan (qo'lda):    ssh -i ~/.ssh/gl-gcp uzbekmen94@34.179.202.164 \
#                            "bash /opt/gl-edu/deploy/gcp/update-b.sh"
#   CI/CD (GitHub Actions) ham aynan shu skriptni chaqiradi.
#
# Qadamlar: git pull → (kerak bo'lsa) npm ci → prisma → build → restart.
# .env va prisma/dev.db ga TEGILMAYDI (ular .gitignore'da).
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
cd /opt/gl-edu

echo "══ 1/5 Git yangilanishi ══"
OLD=$(git rev-parse HEAD)
git fetch origin main
git reset --hard origin/main
NEW=$(git rev-parse HEAD)
if [ "$OLD" = "$NEW" ]; then
  echo "Yangi commit yo'q ($(git log --oneline -1)) — baribir build tekshiriladi"
else
  echo "Yangilandi: ${OLD:0:7} → ${NEW:0:7}"
  git log --oneline "${OLD}..${NEW}" | head -10
fi

echo "══ 2/5 Bog'liqliklar ══"
# package-lock o'zgargan bo'lsagina npm ci (vaqt tejaladi)
if [ "$OLD" != "$NEW" ] && git diff --name-only "$OLD" "$NEW" | grep -q "package-lock.json"; then
  npm ci --no-audit --no-fund 2>&1 | tail -1
else
  echo "package-lock o'zgarmagan — o'tkazib yuborildi"
fi

echo "══ 3/5 Prisma ══"
npx prisma generate 2>&1 | grep -E "Generated" || true
# Sxema o'zgargan bo'lsa bazani moslaymiz (ustunlar qo'shiladi, ma'lumot saqlanadi)
npx prisma db push --skip-generate 2>&1 | tail -1

echo "══ 4/5 Build ══"
npx next build 2>&1 | tail -3

echo "══ 5/5 Servislarni qayta ishga tushirish ══"
sudo systemctl restart gl-edu gl-ami
sleep 3
systemctl is-active gl-edu gl-ami gl-tunnel
curl -s -o /dev/null -w "Sayt: HTTP %{http_code}\n" http://127.0.0.1:3000/login

echo ""
echo "✅ Yangilash tugadi: $(git log --oneline -1)"
