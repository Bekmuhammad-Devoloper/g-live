#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# FINANCE V2 — PRE-CUTOVER SIMULYATSIYA (prod ma'lumotining NUSXASIDA).
#
# PROD BAZAGA YOZMAYDI. Prod servisga TEGMAYDI. /opt/gl-edu checkout'iga tegmaydi.
# Yozadi: /opt/gl-edu/backups/*.bak(+.json) (backup, protected), /tmp/gl-finance-dryrun (klon + nusxalar + loglar).
#
# Bosqichlar (har biri vaqt bilan):
#   1 klon (finance-v2) + npm ci + generate         8 backfill DRY-RUN (billing/payments/expenses/salary)
#   2 backup (VACUUM INTO, integrity, protected)    9 backfill REAL (nusxada) + verify + V2 sonlar (A)
#   3 restore rehearsal                            10 backfill IKKINCHI marta → sonlar (B) — A=B (idempotency)
#   4 nusxa + integrity + snapshot (pre)           11 build (klon) + app start (port 3998) — flag OFF smoke
#   5 drift: nusxa ↔ 0_baseline (bo'sh bo'lishi shart)   12 flag ON smoke + vaqtlar + perf-probe → flag OFF smoke
#   6 baseline adoption + migrate deploy (nusxada)  13 rollback: backup → restore → integrity → snapshot = pre → legacy app (port 3997) smoke
#   7 reconciliation (pre ↔ post)                  14 tozalash + vaqt jadvali
#
#   Ishga tushirish (CI): .github/workflows/server-audit.yml (finance-v2 ref) — scp + bash
# ════════════════════════════════════════════════════════════════════
set -uo pipefail
APP=${GL_APP:-/opt/gl-edu}            # GL_APP/GL_DRY — faqat lokal simulyatsiya uchun
DRY=${GL_DRY:-/tmp/gl-finance-dryrun}
WORK=$DRY/work
REF=${FINANCE_REF:-finance-v2}
PORT_V2=3998
PORT_LEGACY=3997
SECRET="precutover-$(date +%s)"
COOKIE=gl_session
PROD_DB=$APP/prisma/dev.db
FAILS=()
STOP=0
declare -A T_START T_DUR
declare -a ORDER

section() { echo; echo "## $1"; }
tstart() { ORDER+=("$1"); T_START["$1"]=$(date +%s); echo "▶ $1"; }
tend()   { local n="$1"; T_DUR["$n"]=$(( $(date +%s) - T_START["$n"] )); echo "◀ $n — ${T_DUR[$n]}s"; }
fail()   { FAILS+=("$1"); echo "✗ FAIL: $1"; }
stopnow(){ STOP=1; FAILS+=("STOP: $1"); echo "■ STOP: $1"; }
TSX() { node_modules/.bin/tsx "$@" < /dev/null; }
kill_port_pid() { [ -f "$1" ] && { kill "$(cat "$1")" 2>/dev/null || true; sleep 1; kill -9 "$(cat "$1")" 2>/dev/null || true; rm -f "$1"; }; }
wait_http() { for _ in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$1/login" | grep -q 200 && return 0; sleep 1; done; return 1; }
smoke() { # smoke <port> <jwt> <label> routes...
  local port=$1 jwt=$2 label=$3; shift 3; local bad=0
  for route in "$@"; do
    local out; out=$(curl -s -o "$WORK/page.html" -w "%{http_code} %{time_total}" -H "Cookie: $COOKIE=$jwt" "http://127.0.0.1:$port$route")
    local code=${out%% *} tt=${out##* }
    local err; err=$(grep -c "Application error\|Internal Server Error" "$WORK/page.html" || true)
    printf "  %-46s %s  %6.3fs err=%s\n" "$route" "$code" "$tt" "$err"
    [ "$code" = "200" ] && [ "$err" = "0" ] || bad=1
  done
  [ "$bad" = 0 ] && echo "  ✓ $label" || fail "$label smoke"
}
cleanup() {
  kill_port_pid "$WORK/app.pid"; kill_port_pid "$WORK/legacy.pid"
}
trap cleanup EXIT

section "0. Preflight (read-only)"
echo "prod HEAD=$(git -C $APP rev-parse --short HEAD) db=$(du -h $PROD_DB | cut -f1) date=$(date '+%F %T %Z')"
df -h /tmp "$APP" | sed -n '2,3p'
for p in $PORT_V2 $PORT_LEGACY; do (ss -ltn 2>/dev/null || netstat -ltn) | grep -q ":$p " && { stopnow "port $p band"; }; done
[ "$STOP" = 1 ] && exit 2

section "1. Klon ($REF → $DRY) + npm ci + prisma generate"
tstart clone
rm -rf "$DRY"; git clone -q "$APP" "$DRY"
git -C "$DRY" fetch -q "$(git -C "$APP" remote get-url origin)" "$REF"
git -C "$DRY" checkout -q FETCH_HEAD
echo "dry-run HEAD=$(git -C "$DRY" rev-parse --short HEAD)"
cd "$DRY"; mkdir -p "$WORK"
npm ci --no-audit --no-fund < /dev/null 2>&1 | tail -1
npx prisma generate < /dev/null 2>&1 | grep -E "Generated" || true
tend clone

section "2. Backup (VACUUM INTO, integrity, metadata, protected)"
tstart backup
BK_OUT=$(TSX scripts/finance-v2/backup-db.ts --db "$PROD_DB" --dir "$APP/backups" --label "precutover-$(git rev-parse --short HEAD)" --protect 2>&1 | grep -v "prisma-config\|deprecated"); echo "$BK_OUT"
BK=$(echo "$BK_OUT" | sed -n 's/.*✓ backup tayyor: //p' | tail -1)
[ -f "$BK" ] || { stopnow "backup fayli yo'q"; exit 2; }
ls -la "$BK" "$BK.json" 2>/dev/null; cat "$BK.json" 2>/dev/null | head -40
tend backup

section "3. Restore rehearsal (backup → nusxa → integrity → sonlar manba bilan)"
tstart restore-rehearsal
TSX scripts/finance-v2/restore-rehearsal.ts --backup "$BK" --db "$PROD_DB" --workdir "$WORK" 2>&1 | grep -v "prisma-config\|deprecated" || fail "restore rehearsal"
tend restore-rehearsal

section "4. Ish nusxasi + integrity + snapshot (PRE)"
COPY=$WORK/copy.db
cp "$BK" "$COPY"; rm -f "$COPY-journal"
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$COPY'});(async()=>{for(const q of ['PRAGMA integrity_check','PRAGMA journal_mode','PRAGMA foreign_key_check']){const r=await p.\$queryRawUnsafe(q);console.log(q,JSON.stringify(r,(k,v)=>typeof v==='bigint'?Number(v):v).slice(0,200))}})().finally(()=>p.\$disconnect())" < /dev/null
TSX scripts/finance-v2/reconcile.ts snapshot --db "$COPY" --out "$WORK/pre.json" 2>&1 | grep -v "prisma-config\|deprecated" | head -40
TSX scripts/finance-v2/v2-counts.ts --db "$COPY" --out "$WORK/counts-pre.json" > /dev/null 2>&1 || true
node -e "const j=require('$WORK/counts-pre.json');console.log('legacy:',JSON.stringify(j.legacy))"

section "5. Sxema drift: nusxa (prod holati) ↔ 0_baseline"
tstart drift
mkdir -p "$WORK/mig-base/0_baseline"; cp prisma/migrations/0_baseline/migration.sql "$WORK/mig-base/0_baseline/"; cp prisma/migrations/migration_lock.toml "$WORK/mig-base/"
DRIFT=$(npx prisma migrate diff --from-url "file:$COPY" --to-migrations "$WORK/mig-base" --shadow-database-url "file:$WORK/shadow-drift.db" --script < /dev/null 2>&1 | grep -v "prisma-config\|deprecated")
if echo "$DRIFT" | grep -q "empty migration"; then echo "✓ drift yo'q: prod sxemasi = 0_baseline"; else echo "$DRIFT" | head -40; stopnow "UNEXPECTED DRIFT prod ↔ 0_baseline (yuqorida)"; fi
echo "prod ↔ prod checkout schema.prisma (main): $(npx prisma migrate diff --from-url "file:$COPY" --to-schema-datamodel "$APP/prisma/schema.prisma" < /dev/null 2>&1 | grep -v 'prisma-config\|deprecated' | head -1)"
tend drift
[ "$STOP" = 1 ] && exit 2

section "6. Baseline adoption + migrate deploy + post-drift + reconciliation (NUSXADA)"
tstart migrate
TSX scripts/finance-v2/migrate-safe.ts --db "$COPY" --no-backup --workdir "$WORK" --label precutover 2>&1 | grep -v "prisma-config\|deprecated" | tail -40 || stopnow "migrate-safe nusxada yiqildi"
tend migrate
[ "$STOP" = 1 ] && exit 2
echo "migration state (nusxa):"; npx prisma migrate status --schema prisma/schema.prisma < /dev/null 2>&1 | grep -v "prisma-config\|deprecated" | tail -6 || true

section "7. Reconciliation (PRE ↔ POST migratsiya)"
TSX scripts/finance-v2/reconcile.ts snapshot --db "$COPY" --out "$WORK/post.json" > /dev/null 2>&1
TSX scripts/finance-v2/reconcile.ts compare --before "$WORK/pre.json" --after "$WORK/post.json" 2>&1 | grep -v "prisma-config\|deprecated" | tail -30 || stopnow "reconciliation UNEXPECTED (migratsiya)"
[ "$STOP" = 1 ] && exit 2

section "8. Backfill DRY-RUN (nusxada, yozmaydi)"
tstart backfill-dry
for st in billing payments expenses salary; do
  echo "--- stage $st (dry-run)"; TSX scripts/finance-v2/backfill.ts --db "$COPY" --stage "$st" --dry-run 2>&1 | grep -v "prisma-config\|deprecated" | tail -25 || fail "backfill dry-run $st"
done
TSX scripts/finance-v2/reconcile.ts snapshot --db "$COPY" --out "$WORK/post-dry.json" > /dev/null 2>&1
TSX scripts/finance-v2/reconcile.ts compare --before "$WORK/post.json" --after "$WORK/post-dry.json" 2>&1 | grep -E "✓|UNEXPECTED|ok" | tail -2 || fail "dry-run bazani o'zgartirdi"
tend backfill-dry

section "9. Backfill REAL (nusxada) → verify → V2 sonlar (A)"
tstart backfill-real
for st in billing payments verify salary expenses; do
  tstart "backfill:$st"
  TSX scripts/finance-v2/backfill.ts --db "$COPY" --stage "$st" 2>&1 | grep -v "prisma-config\|deprecated" | tail -25 || fail "backfill $st"
  tend "backfill:$st"
done
TSX scripts/finance-v2/v2-counts.ts --db "$COPY" --out "$WORK/counts-A.json" > /dev/null 2>&1 || fail "v2-counts A"
node -e "const j=require('$WORK/counts-A.json');const v=j.v2;console.log(JSON.stringify({PaymentPosted:v.PaymentPosted,PaymentPostedTotal:v.PaymentPostedTotal,StudentCharge:v.StudentCharge,StudentChargeFinalTotal:v.StudentChargeFinalTotal,PaymentAllocation:v.PaymentAllocation,AllocationTotal:v.AllocationTotal,StudentCreditTotal:v.StudentCreditTotal,TeacherEarning:v.TeacherEarning,NeedsReview:v.TeacherEarningNeedsReview,ReviewReasons:v.TeacherEarningReviewReasons,SalaryPeriod:v.SalaryPeriod,ExpensePosted:v.ExpensePosted,FinancialAccount:v.FinancialAccount,FinancialTransaction:v.FinancialTransaction,LedgerIn:v.LedgerIn,LedgerOut:v.LedgerOut,GSH:v.GroupStudentHistoryBySource,GTA:v.GroupTeacherAssignmentBySource,Dup:{c:v.DupChargeKeys,a:v.DupAllocationKeys,e:v.DupEarningKeys,l:v.DupLedgerKeys,p:v.DupPaymentKeys,x:v.DupExpenseKeys},Inv:{overAlloc:v.OverAllocatedPayments,overRefund:v.OverRefundedPayments,overPaidCharge:v.OverPaidCharges,overPaidPeriod:v.OverPaidPeriods,transferImb:v.LedgerTransferImbalance}},null,1))"
tend backfill-real
TSX scripts/finance-v2/reconcile.ts snapshot --db "$COPY" --out "$WORK/post-backfill.json" > /dev/null 2>&1
echo "--- legacy jadvallar backfill'dan keyin (pre ↔ post-backfill):"
TSX scripts/finance-v2/reconcile.ts compare --before "$WORK/pre.json" --after "$WORK/post-backfill.json" 2>&1 | grep -v "prisma-config\|deprecated" | tail -25 || fail "reconciliation pre↔backfill UNEXPECTED"

section "10. Backfill IKKINCHI marta (idempotency) → sonlar (B); A = B shart"
tstart backfill-second
for st in billing payments salary expenses; do
  TSX scripts/finance-v2/backfill.ts --db "$COPY" --stage "$st" 2>&1 | grep -E "^\{|posted|created|existing|skipped|✓|✗|UNEXPECTED" | tail -4 || fail "backfill (2) $st"
done
TSX scripts/finance-v2/v2-counts.ts --db "$COPY" --out "$WORK/counts-B.json" > /dev/null 2>&1 || fail "v2-counts B"
node -e "
const a=require('$WORK/counts-A.json'), b=require('$WORK/counts-B.json');
const strip=(o)=>JSON.parse(JSON.stringify(o,(k,v)=>k==='AuditLogFinance'||k==='AuditLog'?undefined:v));
const sa=JSON.stringify(strip(a)), sb=JSON.stringify(strip(b));
if(sa===sb){console.log('✓ idempotency: ikkinchi backfill hech narsani o\\'zgartirmadi (sonlar va pul yig\\'indilari bir xil; AuditLog istisno)');}
else{console.log('✗ idempotency: farq bor'); const A=strip(a).v2,B=strip(b).v2; for(const k of Object.keys(A)) if(JSON.stringify(A[k])!==JSON.stringify(B[k])) console.log('  ',k,JSON.stringify(A[k]),'→',JSON.stringify(B[k])); process.exit(1)}
console.log('AuditLog A→B:', a.legacy.AuditLog, '→', b.legacy.AuditLog);
" || fail "idempotency (A≠B)"
tend backfill-second

section "11. Build (klon) + app start (port $PORT_V2, nusxa baza) — FLAG OFF smoke"
tstart build
FORCE_BUILD=1 DATABASE_URL="file:$COPY" AUTH_SECRET="$SECRET" npm run build < /dev/null > "$WORK/build.log" 2>&1 && echo "✓ build ($(grep -c 'ƒ\|○' "$WORK/build.log") marshrut)" || { tail -20 "$WORK/build.log"; fail "build"; }
git checkout -q tsconfig.json 2>/dev/null || true
tend build
tstart app-start
(DATABASE_URL="file:$COPY" AUTH_SECRET="$SECRET" NODE_ENV=production TZ=Asia/Tashkent node_modules/.bin/next start -p $PORT_V2 > "$WORK/app.log" 2>&1 & echo $! > "$WORK/app.pid")
wait_http $PORT_V2 && echo "✓ app javob beradi" || { tail -20 "$WORK/app.log"; fail "app start"; }
tend app-start
JWT_D=$(TSX scripts/finance-v2/mint-session.ts --db "$COPY" --secret "$SECRET" --role DIRECTOR 2>/dev/null | tail -1)
JWT_T=$(TSX scripts/finance-v2/mint-session.ts --db "$COPY" --secret "$SECRET" --role TEACHER 2>/dev/null | tail -1)
JWT_M=$(TSX scripts/finance-v2/mint-session.ts --db "$COPY" --secret "$SECRET" --role MANAGER 2>/dev/null | tail -1)
JWT_O=$(TSX scripts/finance-v2/mint-session.ts --db "$COPY" --secret "$SECRET" --role OPERATOR 2>/dev/null | tail -1)
echo "sessiyalar: DIRECTOR=${JWT_D:+ok} TEACHER=${JWT_T:+ok} MANAGER=${JWT_M:+ok} OPERATOR=${JWT_O:+ok}"
LEGACY_ROUTES=(/dashboard /students /groups /teachers /payments /finance /finance/expenses /finance/salary /salary /branches /crm /reports /finance/v2)
FLAG_OFF_STATE=$(curl -s -H "Cookie: $COOKIE=$JWT_D" "http://127.0.0.1:$PORT_V2/finance/v2" | grep -o "Finance V2[^<]\{0,60\}" | head -1)
echo "flag holati (Setting): $(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$COPY'});p.setting.findUnique({where:{key:'finance.v2.enabled'}}).then(r=>console.log(r?r.value:'(yo\\'q → OFF)')).finally(()=>p.\$disconnect())" < /dev/null)"
tstart smoke-off
smoke $PORT_V2 "$JWT_D" "FLAG OFF legacy (DIRECTOR)" "${LEGACY_ROUTES[@]}"
echo "  /finance/v2 (flag OFF) sahifa matni: ${FLAG_OFF_STATE:-?}"
tend smoke-off

section "12. FLAG ON (nusxada) → V2 smoke (vaqtlar) + RBAC + perf-probe → FLAG OFF"
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$COPY'});p.setting.upsert({where:{key:'finance.v2.enabled'},update:{value:'true'},create:{key:'finance.v2.enabled',value:'true'}}).then(()=>console.log('flag → ON')).finally(()=>p.\$disconnect())" < /dev/null
PID=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$COPY'});p.salaryPeriod.findFirst({orderBy:{grossAmount:'desc'}}).then(r=>console.log(r?r.id:'')).finally(()=>p.\$disconnect())" < /dev/null)
AID=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$COPY'});p.financialAccount.findFirst({orderBy:{createdAt:'asc'}}).then(r=>console.log(r?r.id:'')).finally(()=>p.\$disconnect())" < /dev/null)
YM=$(date +%Y-%m)
V2_ROUTES=(/finance/v2 "/finance/v2/payments?ym=$YM" /finance/v2/debtors /finance/v2/balances "/finance/v2/salary?ym=$YM" "/finance/v2/salary/$PID" /finance/v2/salary/settings /finance/v2/accounts "/finance/v2/accounts/$AID?ym=$YM" "/finance/v2/expenses?ym=$YM" "/finance/v2/refunds?ym=$YM" "/finance/v2/reports?tab=collections&ym=$YM" "/finance/v2/reports?tab=revenue&ym=$YM" "/finance/v2/reports?tab=expenses&ym=$YM" "/finance/v2/reports?tab=debt" "/finance/v2/reports?tab=balances" "/finance/v2/reports?tab=salary&ym=$YM" "/finance/v2/reports?tab=cashflow&ym=$YM" "/finance/v2/reports?tab=pnl&ym=$YM" /finance/v2/settings)
tstart smoke-on
smoke $PORT_V2 "$JWT_D" "FLAG ON V2 (DIRECTOR, 1-so'rov)" "${V2_ROUTES[@]}"
echo "  --- 2-so'rov (isigan):"; smoke $PORT_V2 "$JWT_D" "FLAG ON V2 (DIRECTOR, 2-so'rov)" "${V2_ROUTES[@]}"
smoke $PORT_V2 "$JWT_D" "FLAG ON legacy (DIRECTOR)" "${LEGACY_ROUTES[@]}"
tend smoke-on
echo "--- RBAC (server-side, sahifa): TEACHER / MANAGER / OPERATOR"
for pair in "TEACHER:$JWT_T" "MANAGER:$JWT_M" "OPERATOR:$JWT_O"; do
  role=${pair%%:*}; jwt=${pair#*:}; [ -n "$jwt" ] || { echo "  $role: nusxada bunday faol foydalanuvchi yo'q — o'tkazildi"; continue; }
  for route in /finance/v2/payments /finance/v2/accounts /finance/v2/settings /finance/v2/salary/settings /finance/v2/salary; do
    code=$(curl -s -o "$WORK/page.html" -w "%{http_code}" -H "Cookie: $COOKIE=$jwt" "http://127.0.0.1:$PORT_V2$route")
    forb=$(grep -c "ruxsatingiz yo'q\|Kirish taqiqlangan\|Доступ запрещён\|Access denied" "$WORK/page.html" || true)
    printf "  %-9s %-30s %s forbidden=%s\n" "$role" "$route" "$code" "$forb"
  done
done
tstart perf
TSX scripts/finance-v2/perf-probe.ts --db "$COPY" --ym "$YM" 2>&1 | grep -v "prisma-config\|deprecated" | tail -60
tend perf
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$COPY'});p.setting.update({where:{key:'finance.v2.enabled'},data:{value:'false'}}).then(()=>console.log('flag → OFF')).finally(()=>p.\$disconnect())" < /dev/null
smoke $PORT_V2 "$JWT_D" "FLAG OFF (qayta) legacy (DIRECTOR)" "${LEGACY_ROUTES[@]}"
kill_port_pid "$WORK/app.pid"

section "13. ROLLBACK simulyatsiyasi: 'buzilgan' yangi baza → backup restore → integrity → snapshot = PRE → legacy app"
tstart rollback-restore
RB=$WORK/rollback.db; cp "$COPY" "$RB"   # migratsiya+backfill qilingan holat = "yangi sxema"
TSX scripts/finance-v2/restore-db.ts --backup "$BK" --db "$RB" --i-stopped-the-app 2>&1 | grep -v "prisma-config\|deprecated" | tail -5 || fail "restore-db"
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$RB'});(async()=>{console.log('integrity:',JSON.stringify(await p.\$queryRawUnsafe('PRAGMA integrity_check')));console.log('_prisma_migrations:',JSON.stringify(await p.\$queryRawUnsafe(\"select count(*) n from sqlite_master where name='_prisma_migrations'\"),(k,v)=>typeof v==='bigint'?Number(v):v));console.log('StudentCharge jadvali:',JSON.stringify(await p.\$queryRawUnsafe(\"select count(*) n from sqlite_master where name='StudentCharge'\"),(k,v)=>typeof v==='bigint'?Number(v):v))})().finally(()=>p.\$disconnect())" < /dev/null
TSX scripts/finance-v2/reconcile.ts snapshot --db "$RB" --out "$WORK/rollback.json" > /dev/null 2>&1
node -e "const a=require('$WORK/pre.json'),b=require('$WORK/rollback.json');const eq=JSON.stringify(a.counts)===JSON.stringify(b.counts)&&JSON.stringify(a.money)===JSON.stringify(b.money);console.log(eq?'✓ rollback snapshot = PRE (sonlar va pul aynan)':'✗ rollback snapshot ≠ PRE');console.log('counts:',JSON.stringify(b.counts));console.log('money:',JSON.stringify(b.money));process.exit(eq?0:1)" || fail "rollback snapshot ≠ pre"
tend rollback-restore
tstart rollback-legacy-app
LEG=$DRY/legacy; rm -rf "$LEG"; git clone -q "$APP" "$LEG"   # prod'da deploy qilingan commit (main)
echo "legacy HEAD=$(git -C "$LEG" rev-parse --short HEAD) (= prod HEAD)"
( cd "$LEG" && npm ci --no-audit --no-fund < /dev/null 2>&1 | tail -1 && npx prisma generate < /dev/null 2>&1 | grep -E "Generated" && FORCE_BUILD=1 DATABASE_URL="file:$RB" AUTH_SECRET="$SECRET" npm run build < /dev/null > "$WORK/legacy-build.log" 2>&1 && echo "✓ legacy build" ) || { tail -15 "$WORK/legacy-build.log"; fail "legacy build"; }
(cd "$LEG" && DATABASE_URL="file:$RB" AUTH_SECRET="$SECRET" NODE_ENV=production TZ=Asia/Tashkent node_modules/.bin/next start -p $PORT_LEGACY > "$WORK/legacy.log" 2>&1 & echo $! > "$WORK/legacy.pid")
wait_http $PORT_LEGACY && echo "✓ legacy app javob beradi" || { tail -20 "$WORK/legacy.log"; fail "legacy app start"; }
smoke $PORT_LEGACY "$JWT_D" "ROLLBACK legacy app (DIRECTOR)" /dashboard /students /groups /teachers /payments /finance /finance/expenses /finance/salary /salary /branches /crm /reports
kill_port_pid "$WORK/legacy.pid"
tend rollback-legacy-app

section "14. Prod tegilmaganini tasdiqlash + tozalash"
node -e "const {PrismaClient}=require('$APP/node_modules/@prisma/client');const p=new PrismaClient({datasourceUrl:'file:$PROD_DB'});(async()=>{const m=await p.\$queryRawUnsafe(\"select count(*) n from sqlite_master where name='_prisma_migrations'\");const s=await p.\$queryRawUnsafe(\"select count(*) n from sqlite_master where name='StudentCharge'\");const f=await p.\$queryRawUnsafe(\"select value from Setting where key='finance.v2.enabled'\");console.log('prod: _prisma_migrations=',Number(m[0].n),' StudentCharge jadvali=',Number(s[0].n),' flag=',f.length?f[0].value:'(yo\\'q → OFF)')})().finally(()=>p.\$disconnect())" < /dev/null
echo "prod servis: gl-edu=$(systemctl is-active gl-edu 2>/dev/null) HEAD=$(git -C $APP rev-parse --short HEAD) db=$(du -h $PROD_DB | cut -f1)"
TSX scripts/finance-v2/reconcile.ts snapshot --db "$PROD_DB" --out "$WORK/prod-now.json" > /dev/null 2>&1
node -e "const a=require('$WORK/pre.json'),b=require('$WORK/prod-now.json');console.log(JSON.stringify(a.counts)===JSON.stringify(b.counts)&&JSON.stringify(a.money)===JSON.stringify(b.money)?'✓ prod snapshot = audit boshidagi snapshot (o\\'zgarmagan)':'ℹ prod snapshot audit davomida o\\'zgargan (jonli ish — kutilgan): '+JSON.stringify(b.money))"
rm -f "$COPY" "$COPY-journal" "$RB" "$RB-journal" "$WORK"/*.db "$WORK"/*.db-journal "$WORK"/shadow*.db 2>/dev/null; rm -rf "$LEG/.next" "$DRY/.next"
echo "backups:"; ls -la "$APP/backups" | tail -n +2 | tail -5

section "VAQT JADVALI"
TOTAL=0
for n in "${ORDER[@]}"; do printf "  %-24s %5ss\n" "$n" "${T_DUR[$n]:-?}"; done
MW=$(( ${T_DUR[backup]:-0} + ${T_DUR[migrate]:-0} + ${T_DUR[backfill-real]:-0} + ${T_DUR[app-start]:-0} + 30 ))
echo "  maintenance window (backup+migrate+backfill+start+30s zaxira): ~${MW}s; rollback (restore+start): ~$(( ${T_DUR[rollback-restore]:-0} + ${T_DUR[app-start]:-0} ))s"
echo
if [ ${#FAILS[@]} -eq 0 ]; then echo "✓ PRE-CUTOVER SIMULYATSIYA: barcha bosqichlar o'tdi (prod bazaga yozilmadi)"; else echo "✗ MUAMMOLAR (${#FAILS[@]}):"; printf "  - %s\n" "${FAILS[@]}"; exit 1; fi
