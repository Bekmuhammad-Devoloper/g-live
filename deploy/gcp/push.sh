#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# LAPTOPDAN B (GCP) GA DEPLOY
#
#   bash deploy/gcp/push.sh            # to'liq: kod + build + servislar
#   bash deploy/gcp/push.sh --with-db  # + lokal bazani ham ko'chirish
#                                        (B'dagi baza USTIDAN yoziladi!)
#
# Talab: ~/.ssh/gl-gcp kaliti B'ga qo'shilgan bo'lishi kerak.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

B="uzbekmen94@34.179.202.164"
KEY="$HOME/.ssh/gl-gcp"
APP=/opt/gl-edu
SSH="ssh -i $KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new"

cd "$(dirname "$0")/../.."   # loyiha ildizi

echo "── Kod yuklanmoqda (rsync) ──"
rsync -az --delete \
  -e "$SSH" \
  --exclude node_modules --exclude .next --exclude dev.log \
  --exclude "*.log" --exclude "prisma/dev.db*" --exclude ".session-token" \
  ./ "$B:$APP/"

echo "── .env tayyorlanmoqda ──"
# Lokal .env asos, B'ga xos qiymatlar ustidan yoziladi:
#   AMI/yozuvlar — tunnel orqali (127.0.0.1), baza — B'ning o'zida
python - <<'PY'
import io, re
s = io.open(".env", encoding="utf-8").read()
def setvar(text, key, val):
    line = f'{key}="{val}"'
    if re.search(rf"^{key}=", text, re.M):
        return re.sub(rf"^{key}=.*$", line, text, flags=re.M)
    return text.rstrip() + "\n" + line + "\n"
for k, v in [
    ("DATABASE_URL", "file:./dev.db"),
    ("ASTERISK_HOST", "127.0.0.1"),
    ("ASTERISK_AMI_PORT", "5039"),
    ("RECORDINGS_PROXY", "http://127.0.0.1:3012"),
    ("TELEPHONY_SSH_HOST", "ubuntu@89.126.208.123"),
    ("TELEPHONY_SSH_KEY", "/home/uzbekmen94/.ssh/gl-a"),
    ("NODE_ENV", "production"),
]:
    s = setvar(s, k, v)
io.open("deploy/gcp/.env.b", "w", encoding="utf-8", newline="\n").write(s)
print("deploy/gcp/.env.b yozildi")
PY
rsync -az -e "$SSH" deploy/gcp/.env.b "$B:$APP/.env"
rm -f deploy/gcp/.env.b

if [ "${1:-}" = "--with-db" ]; then
  echo "── Baza ko'chirilmoqda (B'dagisi ustidan yoziladi!) ──"
  $SSH "$B" "mkdir -p $APP/prisma && [ -f $APP/prisma/dev.db ] && cp $APP/prisma/dev.db $APP/prisma/dev.db.backup-\$(date +%Y%m%d-%H%M%S) || true"
  rsync -az -e "$SSH" prisma/dev.db "$B:$APP/prisma/dev.db"
fi

echo "── B'da o'rnatish va build ──"
$SSH "$B" "cd $APP && npm ci --no-audit --no-fund 2>&1 | tail -2 && npx prisma generate 2>&1 | tail -1 && npx prisma db push --skip-generate 2>&1 | tail -1 && npx next build 2>&1 | tail -5"

echo "── Servislar ──"
$SSH "$B" "sudo systemctl enable --now gl-tunnel gl-edu gl-ami gl-cdr.timer && sleep 3 && systemctl is-active gl-tunnel gl-edu gl-ami && curl -s -o /dev/null -w 'B ilova: HTTP %{http_code}\n' http://127.0.0.1:3000/login"

echo ""
echo "✅ Deploy tugadi: http://34.179.202.164:3000"
