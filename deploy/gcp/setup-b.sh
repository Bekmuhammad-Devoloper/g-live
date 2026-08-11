#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# B SERVER (GCP 34.179.202.164) — bir martalik tayyorlash
#
# Ishlatish (B serverda):  sudo bash setup-b.sh
#
# Nima qiladi:
#   1. Node.js 22 LTS + kerakli paketlar
#   2. /opt/gl-edu papka
#   3. A serverga ulanish uchun SSH kalit (gl-a) yaratadi va
#      OCHIQ qismini ekranga chiqaradi — u A'ga qo'shilishi kerak
#   4. systemd servislar (hali yoqilmaydi — push.sh dan keyin):
#        gl-tunnel  — A bilan doimiy SSH kanal:
#                       -L 5039  → A dagi AMI (ami-worker uchun)
#                       -L 3012  → A dagi yozuvlar mini-servisi
#                       -R 3010  → A'da 127.0.0.1:3010 = B'dagi ilova
#                                  (dialplan route-lookup shu orqali ishlaydi)
#        gl-edu     — Next.js ilova (port 3000)
#        gl-ami     — ami-worker (qo'ng'iroq tarixi)
#        gl-cdr     — sync-cdr har 10 daqiqada (timer)
#
# ⚠️ A serverdagi eski CRM'ga HECH QANDAY aloqasi yo'q.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

A_HOST="ubuntu@89.126.208.123"
APP=/opt/gl-edu

echo "── 1/4 Node.js 22 ──"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
apt-get install -y -qq rsync openssh-client curl >/dev/null
node -v

echo "── 2/4 Papka va foydalanuvchi huquqlari ──"
mkdir -p $APP
# Skriptni ishga tushirgan (sudo ortidagi) foydalanuvchi egalik qiladi
OWNER="${SUDO_USER:-$(whoami)}"
chown -R "$OWNER":"$OWNER" $APP

echo "── 3/4 A serverga SSH kalit ──"
KEYDIR=$(eval echo "~$OWNER")/.ssh
mkdir -p "$KEYDIR" && chown "$OWNER":"$OWNER" "$KEYDIR" && chmod 700 "$KEYDIR"
if [ ! -f "$KEYDIR/gl-a" ]; then
  sudo -u "$OWNER" ssh-keygen -t ed25519 -N "" -f "$KEYDIR/gl-a" -C "gl-b-to-a" >/dev/null
fi

echo "── 4/4 systemd servislar ──"
cat > /etc/systemd/system/gl-tunnel.service <<EOF
[Unit]
Description=GL-EDU: A server bilan SSH kanal (AMI + yozuvlar + route-lookup)
After=network-online.target
Wants=network-online.target

[Service]
User=$OWNER
ExecStart=/usr/bin/ssh -N -i $KEYDIR/gl-a \\
  -o BatchMode=yes -o StrictHostKeyChecking=accept-new \\
  -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \\
  -o ExitOnForwardFailure=yes \\
  -L 5039:127.0.0.1:5039 \\
  -L 3012:127.0.0.1:3012 \\
  -R 3010:127.0.0.1:3000 \\
  $A_HOST
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/gl-edu.service <<EOF
[Unit]
Description=GL-EDU CRM (Next.js, port 3000)
After=network.target gl-tunnel.service

[Service]
User=$OWNER
WorkingDirectory=$APP
ExecStart=/usr/bin/npx next start -p 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/gl-ami.service <<EOF
[Unit]
Description=GL-EDU AMI worker (qo'ng'iroq tarixi)
After=gl-tunnel.service

[Service]
User=$OWNER
WorkingDirectory=$APP
ExecStart=/usr/bin/node --env-file=.env scripts/ami-worker.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/gl-cdr.service <<EOF
[Unit]
Description=GL-EDU CDR sinxronizatsiyasi (bir martalik)

[Service]
Type=oneshot
User=$OWNER
WorkingDirectory=$APP
ExecStart=/usr/bin/node --env-file=.env scripts/sync-cdr.mjs
EOF

cat > /etc/systemd/system/gl-cdr.timer <<EOF
[Unit]
Description=GL-EDU CDR sinxronizatsiyasi — har 10 daqiqada

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload

echo ""
echo "════════════════════════════════════════════════════"
echo "TAYYOR. Endi bu OCHIQ kalitni A serverga qo'shish kerak"
echo "(laptopdagi Claude buni avtomatik qiladi):"
echo ""
cat "$KEYDIR/gl-a.pub"
echo "════════════════════════════════════════════════════"
