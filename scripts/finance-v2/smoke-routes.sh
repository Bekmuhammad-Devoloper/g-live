#!/usr/bin/env bash
# Finance V2 UI smoke: vaqtinchalik SQLite + prod build + har /finance/v2 marshrutga so'rov.
# Prod'ga TEGMAYDI. Ishlatish: bash scripts/finance-v2/smoke-routes.sh   (port 3999)
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="$(pwd)/tests/.tmp/smoke"; DB="$DIR/smoke.db"; PORT=3999
rm -rf "$DIR" .next-smoke && mkdir -p "$DIR"
DATABASE_URL="file:$DB" npx prisma db push --skip-generate >/dev/null
npx tsx scripts/finance-v2/smoke-seed.ts "$DB" > "$DIR/out.json"
FORCE_BUILD=1 NEXT_DIST_DIR=.next-smoke DATABASE_URL="file:$DB" AUTH_SECRET=smoke-secret npm run build >/dev/null
git checkout -q tsconfig.json 2>/dev/null || true
(NEXT_DIST_DIR=.next-smoke DATABASE_URL="file:$DB" AUTH_SECRET=smoke-secret NODE_ENV=production npx next start -p $PORT > "$DIR/server.log" 2>&1 &)
for _ in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/login" | grep -q 200 && break; sleep 1; done
JWT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).jwt)' "$DIR/out.json")
TJWT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).teacherJwt)' "$DIR/out.json")
PID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).periodId)' "$DIR/out.json")
AID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).accountId)' "$DIR/out.json")
fail=0
# DIQQAT: zsh'da `path` o'zgaruvchisi PATH'ni buzadi — `route` ishlatiladi
for route in /finance /finance/v2 /finance/v2/payments /finance/v2/debtors /finance/v2/balances /finance/v2/salary "/finance/v2/salary/$PID" /finance/v2/salary/settings /finance/v2/accounts "/finance/v2/accounts/$AID" /finance/v2/expenses /finance/v2/refunds "/finance/v2/reports?tab=collections" "/finance/v2/reports?tab=revenue" "/finance/v2/reports?tab=expenses" "/finance/v2/reports?tab=debt" "/finance/v2/reports?tab=balances" "/finance/v2/reports?tab=salary" "/finance/v2/reports?tab=cashflow" "/finance/v2/reports?tab=pnl" /finance/v2/settings; do
  code=$(curl -s -o "$DIR/page.html" -w "%{http_code}" -H "Cookie: gl_session=$JWT" "http://127.0.0.1:$PORT$route")
  err=$(grep -c "Application error\|Internal Server Error" "$DIR/page.html" || true)
  printf "%-45s %s err=%s\n" "$route" "$code" "$err"
  [ "$code" = "200" ] && [ "$err" = "0" ] || fail=1
done
for route in /finance/v2/payments /finance/v2/accounts /finance/v2/settings; do
  code=$(curl -s -o "$DIR/page.html" -w "%{http_code}" -H "Cookie: gl_session=$TJWT" "http://127.0.0.1:$PORT$route")
  forb=$(grep -c "ruxsatingiz yo'q\|Kirish taqiqlangan" "$DIR/page.html" || true)
  printf "TEACHER %-37s %s forbidden=%s\n" "$route" "$code" "$forb"
  [ "$forb" != "0" ] || fail=1
done
pkill -f "next start -p $PORT" || true
rm -rf .next-smoke
[ "$fail" = "0" ] && echo "✓ smoke: barcha marshrutlar 200, RBAC ✓" || { echo "✗ smoke yiqildi"; exit 1; }
