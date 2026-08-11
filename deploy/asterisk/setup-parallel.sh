#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# GL-EDU — IKKINCHI (parallel) Asterisk nusxasi
# Eski ishlayotgan tizimga (trunk 550552277, /etc/asterisk, 5060/5038/8088)
# UMUMAN TEGMAYDI. Hammasi alohida port/papka/servisda.
#   sudo bash setup-parallel.sh
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

TAG="glive"
ETC="/etc/asterisk-${TAG}"
RUN="/var/run/asterisk-${TAG}"
LOG="/var/log/asterisk-${TAG}"
SPOOL="/var/spool/asterisk-${TAG}"
DB="/var/lib/asterisk-${TAG}"
REC="${SPOOL}/recording"

TRUNK_IP="10.66.30.204"      # ens4 (SIP VLAN)
PUBLIC_IP="89.126.208.123"   # ens3 (brauzer/WebRTC)
SIP_SERVER="10.77.37.4"
SIP_PORT="5062"              # YANGI (eski 5060 tegilmaydi)
AMI_PORT="5039"              # YANGI (eski 5038)
WS_PORT="8090"; WSS_PORT="8091"
RTP_START="20001"; RTP_END="30000"
TRUNK_USER="550552022"
TRUNK_PASS="550552022"
NUM_OP=10
OP_PREFIX="glive"            # glive1..glive10 (eski operator1..10 bilan to'qnashmaydi)
CRM_URL="http://127.0.0.1:3010"   # GL-EDU (Next.js) porti

echo "══ 0. Eski tizim holati (o'zgarmasligi kerak) ══"
sudo asterisk -rx "pjsip show registrations" | sed -n '1,8p' || true

echo "══ 1. Papkalar ══"
[ -d "$ETC" ] && { echo "XATO: $ETC allaqachon bor. To'xtatildi."; exit 1; }
cp -a /etc/asterisk "$ETC"
mkdir -p "$RUN" "$LOG" "$SPOOL" "$DB" "$REC" "$ETC/keys"
chown -R asterisk:asterisk "$RUN" "$LOG" "$SPOOL" "$DB" "$ETC"

echo "══ 2. Sirlar ══"
gen(){ openssl rand -hex 16; }
AMI_PASS="$(gen)"
declare -a OP; for i in $(seq 1 $NUM_OP); do OP[$i]="$(gen)"; done

echo "══ 3. DTLS sertifikat (WebRTC) ══"
openssl req -x509 -newkey rsa:2048 -keyout "$ETC/keys/asterisk.key" \
  -out "$ETC/keys/asterisk.crt" -days 3650 -nodes -subj "/CN=${PUBLIC_IP}" 2>/dev/null
chown -R asterisk:asterisk "$ETC/keys"; chmod 640 "$ETC/keys"/*

echo "══ 4. asterisk.conf (alohida papkalar) ══"
cat > "$ETC/asterisk.conf" <<EOF
[directories]
astetcdir => ${ETC}
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => /var/lib/asterisk
astdbdir => ${DB}
astkeydir => ${ETC}/keys
astdatadir => /usr/share/asterisk
astagidir => /var/lib/asterisk/agi-bin
astspooldir => ${SPOOL}
astrundir => ${RUN}
astlogdir => ${LOG}
astsbindir => /usr/sbin

[options]
runuser = asterisk
rungroup = asterisk
EOF

echo "══ 5. Port-egallovchi modullarni o'chirish (to'qnashuv bo'lmasin) ══"
cat >> "$ETC/modules.conf" <<'EOF'

; --- GL-EDU parallel nusxa: eski instans bilan port to'qnashuvining oldini olish ---
noload => chan_iax2.so
noload => chan_mgcp.so
noload => chan_skinny.so
noload => chan_unistim.so
noload => chan_console.so
noload => chan_alsa.so
EOF

echo "══ 6. manager.conf (AMI ${AMI_PORT}) ══"
cat > "$ETC/manager.conf" <<EOF
[general]
enabled = yes
port = ${AMI_PORT}
bindaddr = 127.0.0.1
[glive_ami]
secret = ${AMI_PASS}
permit = 127.0.0.1/255.255.255.255
read = all
write = all
EOF

echo "══ 7. http.conf (WS ${WS_PORT} / WSS ${WSS_PORT}) ══"
cat > "$ETC/http.conf" <<EOF
[general]
enabled = yes
bindaddr = 0.0.0.0
bindport = ${WS_PORT}
tlsenable = yes
tlsbindaddr = 0.0.0.0:${WSS_PORT}
tlscertfile = ${ETC}/keys/asterisk.crt
tlsprivatekey = ${ETC}/keys/asterisk.key
sessionlimit = 200
EOF

echo "══ 8. rtp.conf (${RTP_START}-${RTP_END}) ══"
cat > "$ETC/rtp.conf" <<EOF
[general]
rtpstart = ${RTP_START}
rtpend = ${RTP_END}
strictrtp = no
icesupport = yes
stunaddr = stun:${PUBLIC_IP}:3478
EOF

echo "══ 9. queues.conf ══"
cat > "$ETC/queues.conf" <<EOF
[operators]
strategy=rrmemory
timeout=25
retry=1
wrapuptime=5
ringinuse=no
joinempty=strict
leavewhenempty=strict
maxlen=10
EOF

echo "══ 10. pjsip.conf (trunk ${TRUNK_USER} @ ${SIP_PORT}) ══"
{
cat <<EOF
[global]
type=global
user_agent=GL-EDU PBX

[transport-external]
type=transport
protocol=udp
bind=${TRUNK_IP}:${SIP_PORT}
local_net=10.66.30.0/24
external_media_address=${TRUNK_IP}
external_signaling_address=${TRUNK_IP}

[transport-ws]
type=transport
protocol=ws
bind=0.0.0.0
local_net=10.66.30.0/24
external_media_address=${PUBLIC_IP}
external_signaling_address=${PUBLIC_IP}

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0
local_net=10.66.30.0/24
external_media_address=${PUBLIC_IP}
external_signaling_address=${PUBLIC_IP}

[gl-auth]
type=auth
auth_type=userpass
username=${TRUNK_USER}
password=${TRUNK_PASS}

[gl-registration]
type=registration
transport=transport-external
outbound_auth=gl-auth
server_uri=sip:${SIP_SERVER}
client_uri=sip:${TRUNK_USER}@${SIP_SERVER}
contact_user=${TRUNK_USER}
retry_interval=60
max_retries=100
expiration=3600

[gl-aor]
type=aor
contact=sip:${SIP_SERVER}:5060
qualify_frequency=60

[gl-identify]
type=identify
endpoint=gl-trunk
match=${SIP_SERVER}/32

[gl-trunk]
type=endpoint
transport=transport-external
context=gl-from-trunk
disallow=all
allow=alaw,ulaw
aors=gl-aor
outbound_auth=gl-auth
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
ice_support=no
trust_id_inbound=yes
send_rpid=yes
send_pai=yes
from_domain=${TRUNK_IP}
from_user=${TRUNK_USER}
EOF
for i in $(seq 1 $NUM_OP); do
cat <<EOF

[${OP_PREFIX}${i}]
type=aor
max_contacts=5
remove_existing=no
qualify_frequency=60
[${OP_PREFIX}${i}-auth]
type=auth
auth_type=userpass
username=${OP_PREFIX}${i}
password=${OP[$i]}
[${OP_PREFIX}${i}]
type=endpoint
transport=transport-wss
context=gl-from-internal
disallow=all
allow=ulaw,alaw,opus
auth=${OP_PREFIX}${i}-auth
aors=${OP_PREFIX}${i}
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
device_state_busy_at=1
webrtc=yes
dtls_cert_file=${ETC}/keys/asterisk.crt
dtls_private_key=${ETC}/keys/asterisk.key
callerid="${OP_PREFIX}${i}" <${OP_PREFIX}${i}>
EOF
done
} > "$ETC/pjsip.conf"

echo "══ 11. extensions.conf (alohida kontekstlar) ══"
cat > "$ETC/extensions.conf" <<EOF
[general]
static=yes
writeprotect=no
[globals]
TRUNK=gl-trunk
TRUNK_NUM=${TRUNK_USER}
RECORD_DIR=${REC}
CRM_URL=${CRM_URL}

[gl-from-internal]
exten => _998XXXXXXXXX,1,Set(CALLERID(num)=\${TRUNK_NUM})
 same => n,Set(RECORD_FILE=\${RECORD_DIR}/\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)}-\${CALLERID(num)}-\${EXTEN})
 same => n,MixMonitor(\${RECORD_FILE}.wav,b)
 same => n,Dial(PJSIP/\${EXTEN}@\${TRUNK},60,tTkK)
 same => n,StopMixMonitor()
 same => n,Hangup()
exten => _0XXXXXXXXX,1,Goto(gl-from-internal,998\${EXTEN:1},1)
exten => _8XXXXXXXXX,1,Goto(gl-from-internal,998\${EXTEN:1},1)
exten => _XXXXXXXXX,1,Goto(gl-from-internal,998\${EXTEN},1)

[gl-from-trunk]
exten => _X.,1,NoOp(GL Inbound \${CALLERID(num)} -> \${EXTEN})
 same => n,Answer()
 same => n,Set(OP=\${CURL(\${CRM_URL}/api/telephony/route-lookup?phone=\${CALLERID(num)})})
 same => n,GotoIf(\$["\${OP}" = ""]?queue)
 same => n,GotoIf(\$["\${DEVICE_STATE(PJSIP/\${OP})}" != "NOT_INUSE"]?queue)
 same => n,Set(RECORD_FILE=\${RECORD_DIR}/\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)}-\${CALLERID(num)}-\${OP})
 same => n,MixMonitor(\${RECORD_FILE}.wav,b)
 same => n,Dial(PJSIP/\${OP},20,tTkK)
 same => n,StopMixMonitor()
 same => n,GotoIf(\$["\${DIALSTATUS}" = "ANSWER"]?done)
 same => n(queue),Set(RECORD_FILE=\${RECORD_DIR}/\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)}-incoming-\${CALLERID(num)}-queue)
 same => n,MixMonitor(\${RECORD_FILE}.wav,b)
 same => n,Queue(operators,tTkKr,,,120)
 same => n,StopMixMonitor()
 same => n,Hangup()
 same => n(done),Hangup()
exten => s,1,Goto(gl-from-trunk,_X.,1)
EOF

chown -R asterisk:asterisk "$ETC"
mkdir -p "$REC"; chown -R asterisk:asterisk "$SPOOL"

echo "══ 12. systemd servis (asterisk-${TAG}) ══"
cat > /etc/systemd/system/asterisk-${TAG}.service <<EOF
[Unit]
Description=Asterisk PBX — GL-EDU parallel nusxa (trunk ${TRUNK_USER})
After=network.target
[Service]
Type=simple
User=asterisk
Group=asterisk
ExecStart=/usr/sbin/asterisk -f -C ${ETC}/asterisk.conf
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable asterisk-${TAG}
systemctl restart asterisk-${TAG}
sleep 6

echo "══ 13. .env qiymatlari → /root/glive-telephony.env ══"
{
echo "PUBLIC_HOST=${PUBLIC_IP}"
echo "SIP_DOMAIN=${PUBLIC_IP}"
echo "WS_URL=ws://${PUBLIC_IP}:${WS_PORT}/ws"
echo "WSS_URL=wss://${PUBLIC_IP}:${WSS_PORT}/ws"
echo "ASTERISK_HOST=127.0.0.1"
echo "ASTERISK_AMI_PORT=${AMI_PORT}"
echo "ASTERISK_AMI_USER=glive_ami"
echo "ASTERISK_AMI_PASS=${AMI_PASS}"
echo "ASTERISK_RECORDING_DIR=${REC}"
echo "SIP_TRUNK_USERNAME=${TRUNK_USER}"
echo "SIP_TRUNK_PASSWORD=${TRUNK_PASS}"
echo "SIP_TRUNK_CALLER_ID=${TRUNK_USER}"
for i in $(seq 1 $NUM_OP); do echo "SIP_OPERATOR${i}_PASS=${OP[$i]}"; done
echo "# Operator sipExtension qiymatlari: ${OP_PREFIX}1 ... ${OP_PREFIX}${NUM_OP}"
} > /root/glive-telephony.env
chmod 600 /root/glive-telephony.env

echo ""
echo "════════ NATIJA ════════"
echo "── YANGI nusxa (GL-EDU):"
asterisk -rx "pjsip show registrations" -C "$ETC/asterisk.conf" 2>/dev/null || \
  echo "   (CLI: sudo asterisk -r -C ${ETC}/asterisk.conf)"
echo ""
echo "── ESKI tizim (o'zgarmagan bo'lishi kerak):"
asterisk -rx "pjsip show registrations" 2>/dev/null | sed -n '3,6p'
echo ""
echo "App .env: /root/glive-telephony.env"
