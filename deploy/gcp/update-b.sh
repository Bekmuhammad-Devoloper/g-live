#!/usr/bin/env bash
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
if [ "$OLD" != "$NEW" ] && git diff --name-only "$OLD" "$NEW" | grep -q "package-lock.json"; then
  npm ci --no-audit --no-fund 2>&1 | tail -1
else
  echo "package-lock o'zgarmagan — o'tkazib yuborildi"
fi

echo "══ 3/5 Prisma ══"
npx prisma generate 2>&1 | grep -E "Generated" || true
npx prisma db push --skip-generate 2>&1 | tail -1

echo "══ 4/5 Build ══"
rm -rf .next-build
if ! NEXT_DIST_DIR=.next-build npx next build 2>&1 | tail -20; then
  echo "❌ Build yiqildi — sayt eski nusxada ishlashda davom etmoqda"
  rm -rf .next-build
  exit 1
fi
rm -rf .next-old
[ -d .next ] && mv .next .next-old
mv .next-build .next

echo "══ 5/5 Servislarni qayta ishga tushirish ══"
sudo systemctl restart gl-edu gl-ami
sleep 4

CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://127.0.0.1:3000/login || echo 000)
if [ "$CODE" != "200" ]; then
  echo "⚠️  Yangi nusxa javob bermadi (HTTP $CODE) — ORQAGA QAYTARILMOQDA"
  if [ -d .next-old ]; then
    rm -rf .next && mv .next-old .next
    git reset --hard "$OLD"
    sudo systemctl restart gl-edu gl-ami
    sleep 4
    echo "Qaytarildi: $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://127.0.0.1:3000/login)"
  fi
  exit 1
fi

rm -rf .next-old
systemctl is-active gl-edu gl-ami gl-tunnel

if [ -f deploy/centers/gl-center.sh ]; then
  echo "══ Markazlar ══"
  sudo install -m 755 deploy/centers/gl-center.sh /usr/local/sbin/gl-center
  for u in gl-center@.service gl-dev.service gl-centers-backup.service gl-centers-backup.timer; do
    sudo install -m 644 "deploy/centers/$u" "/etc/systemd/system/$u"
  done
  sudo systemctl daemon-reload
  sudo systemctl enable --now gl-centers-backup.timer >/dev/null 2>&1 || true
  for envf in /opt/centers/*/env; do
    [ -f "$envf" ] || continue
    slug=$(basename "$(dirname "$envf")")
    systemctl is-enabled --quiet "gl-center@$slug" 2>/dev/null || continue
    db=$(grep -E '^DATABASE_URL=' "$envf" | head -1 | cut -d= -f2- | tr -d '"')
    if DATABASE_URL="$db" npx prisma db push --skip-generate >/dev/null 2>&1; then
      sudo systemctl restart "gl-center@$slug" && echo "  $slug: yangilandi"
    else
      echo "  ⚠️  $slug: sxema yangilanmadi (markaz eski holatda ishlayapti)"
    fi
  done
  if [ -f /opt/centers/.dev.env ]; then sudo systemctl restart gl-dev && echo "  dev panel: qayta ishga tushdi"; fi
fi
echo "Sayt: HTTP $CODE"

echo ""
echo "✅ Yangilash tugadi: $(git log --oneline -1)"
