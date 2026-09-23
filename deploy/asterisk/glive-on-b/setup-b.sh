#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 3-YO'L: 550552022 ni GCP serveridan (B, 34.179.202.164 — BOSHQA IP) ko'tarish.
# Uztelecom bir IP = bir trunk qiladi; B'ning IP'si boshqa → 2277 (A) bilan to'qnashmaydi.
#
# SHART (Uztelecom'dan olinadi):
#   SIP_SERVER — 2022 akkaunti INTERNETDAN ulanadigan SIP server (SBC) manzili
#                (ichki 10.77.37.4 internetdan yopiq, u ishlamaydi)
# SHART (GCP konsolida, firewall): UDP 5060 (SIP), UDP 10000-20000 (RTP) — 0.0.0.0/0
#
#   sudo bash setup-b.sh <SIP_SERVER> [SIP_PORT=5060]
#   masalan: sudo bash setup-b.sh sbc.uztelecom.uz
#
# Nima qiladi: Asterisk 20 (apt) → /etc/asterisk: trunk 2022 (registratsiya + auth),
# glive1…glive10 WebRTC operatorlari (parollar /opt/gl-edu/.env dagi SIP_OPERATOR{N}_PASS —
# ilova o'zgarmaydi), AMI 5038 (ilova .env: ASTERISK_HOST=127.0.0.1:5038), dialplan
# gl-from-trunk (route-lookup 127.0.0.1:3000) / gl-from-internal (chiquvchi 2022).
# Eski A serveriga TEGMAYDI. Sinov muvaffaqiyatli bo'lsa: WSS_URL/TURN ni B'ga o'tkazish
# (sip.germaniya.live → 34.179.202.164) va A'dagi smart-routing relayini B'ga burash — keyingi qadam.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
SIP_SERVER="${1:?Uztelecom internet SIP server manzili kerak (masalan sbc.uztelecom.uz)}"
SIP_PORT="${2:-5060}"
PUBLIC_IP="$(curl -s -m 5 ifconfig.me || echo 34.179.202.164)"
LOCAL_IP="$(hostname -I | awk '{print $1}')"
ENVF=/opt/gl-edu/.env
TRUNK_USER="550552022"; TRUNK_PASS="550552022"
ETC=/etc/asterisk; NUM_OP=10; OP_PREFIX="glive"
say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "root kerak: sudo bash $0 ..."; exit 1; }
[[ -f $ENVF ]] || { echo "$ENVF topilmadi"; exit 1; }

say "SIP server tekshiruvi: $SIP_SERVER:$SIP_PORT"
SIP_IP=$(getent ahostsv4 "$SIP_SERVER" | awk '{print $1; exit}')
[[ -n "$SIP_IP" ]] || { echo "DNS topilmadi: $SIP_SERVER"; exit 1; }
echo "  → $SIP_IP"

say "Asterisk o'rnatish (apt)"
if ! command -v asterisk >/dev/null; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq asterisk >/dev/null
fi
systemctl stop asterisk || true
[[ -d $ETC.orig ]] || cp -a $ETC $ETC.orig

say "Operator parollari (.env dan — ilova o'zgarmaydi)"
declare -a OP
for i in $(seq 1 $NUM_OP); do
  OP[$i]="$(grep -E "^SIP_OPERATOR${i}_PASS=" $ENVF | cut -d= -f2- | tr -d '"')"
  [[ -n "${OP[$i]}" ]] || { echo "SIP_OPERATOR${i}_PASS .env da yo'q"; exit 1; }
done
AMI_PASS="$(grep -E '^ASTERISK_AMI_PASS=|^AMI_PASS=' $ENVF | head -1 | cut -d= -f2- | tr -d '"')"
[[ -n "$AMI_PASS" ]] || AMI_PASS="$(openssl rand -hex 16)"

say "DTLS sertifikat (WebRTC)"
mkdir -p $ETC/keys
[[ -f $ETC/keys/asterisk.crt ]] || openssl req -x509 -newkey rsa:2048 -keyout $ETC/keys/asterisk.key -out $ETC/keys/asterisk.crt -days 3650 -nodes -subj "/CN=${PUBLIC_IP}" 2>/dev/null
chown -R asterisk:asterisk $ETC/keys; chmod 640 $ETC/keys/*

say "Konfiglar"
cat > $ETC/manager.conf <<EOF
[general]
enabled=yes
port=5038
bindaddr=127.0.0.1
[glive_ami]
secret=${AMI_PASS}
read=all
write=all
EOF
cat > $ETC/http.conf <<EOF
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
tlsenable=yes
tlsbindaddr=0.0.0.0:8089
tlscertfile=${ETC}/keys/asterisk.crt
tlsprivatekey=${ETC}/keys/asterisk.key
EOF
cat > $ETC/rtp.conf <<EOF
[general]
rtpstart=10000
rtpend=20000
icesupport=yes
stunaddr=stun.l.google.com:19302
EOF
cat > $ETC/queues.conf <<EOF
[general]
persistentmembers=yes
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

{
cat <<EOF
[global]
type=global
user_agent=GL-EDU PBX (B)

[transport-external]
type=transport
protocol=udp
bind=0.0.0.0:${SIP_PORT}
local_net=${LOCAL_IP%.*}.0/24
external_media_address=${PUBLIC_IP}
external_signaling_address=${PUBLIC_IP}

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0
local_net=${LOCAL_IP%.*}.0/24
external_media_address=${PUBLIC_IP}
external_signaling_address=${PUBLIC_IP}

; ── 550552022 — INTERNET orqali (boshqa IP → 2277 bilan to'qnashmaydi) ──
[gl-auth]
type=auth
auth_type=userpass
username=${TRUNK_USER}
password=${TRUNK_PASS}

[gl-registration]
type=registration
transport=transport-external
outbound_auth=gl-auth
server_uri=sip:${SIP_SERVER}:${SIP_PORT}
client_uri=sip:${TRUNK_USER}@${SIP_SERVER}
contact_user=${TRUNK_USER}
retry_interval=60
forbidden_retry_interval=300
max_retries=10000
expiration=600

[gl-aor]
type=aor
contact=sip:${SIP_SERVER}:${SIP_PORT}
qualify_frequency=60

[gl-identify]
type=identify
endpoint=gl-trunk
match=${SIP_IP}/32

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
from_domain=${SIP_SERVER}
from_user=${TRUNK_USER}
callerid=${TRUNK_USER} <${TRUNK_USER}>
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
} > $ETC/pjsip.conf

cat > $ETC/extensions.conf <<EOF
[general]
static=yes
writeprotect=no
clearglobalvars=yes

[globals]
TRUNK=gl-trunk
TRUNK_NUM=${TRUNK_USER}
RECORD_DIR=/var/spool/asterisk/recording
CRM_URL=http://127.0.0.1:3000

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
exten => _[a-z]XXXXXX.,1,Dial(PJSIP/\${EXTEN},30)
 same => n,Hangup()

[gl-from-trunk]
exten => _X.,1,NoOp(GL Inbound \${CALLERID(num)} -> \${EXTEN})
 same => n,Answer()
 same => n,Set(CURLOPT(conntimeout)=2)
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
mkdir -p /var/spool/asterisk/recording; chown -R asterisk:asterisk /var/spool/asterisk $ETC

say "Ishga tushirish"
systemctl enable asterisk >/dev/null; systemctl restart asterisk; sleep 8
asterisk -rx "pjsip show registrations"
asterisk -rx "pjsip show transports" | grep -E "transport-external|wss"
cat <<EOF

════════════════════════════════════════════════════════════════════════════
 Registered bo'lsa — 2022 endi B (${PUBLIC_IP}) dan ishlaydi, 2277 A'da qoladi.
 Keyingi qadamlar (men qilaman):
   • ilova .env: ASTERISK_HOST=127.0.0.1:5038, AMI_PASS=${AMI_PASS:0:4}…, WS/WSS → B (sip.germaniya.live DNS → ${PUBLIC_IP}, nginx TLS)
   • gl-ami/gl-tunnel servislarini B'ning o'z Asteriskiga burash
   • A'dagi smart-routing: GL EDU lidlari uchun 2277 kiruvchini B'ga relay (SIP trunk A→B)
 Unregistered/Rejected bo'lsa — Uztelecom akkaunt internetdan ulanishga ochilmagan
 (yoki SBC manzili noto'g'ri): asterisk -rvvv → pjsip set logger on → REGISTER javobi.
════════════════════════════════════════════════════════════════════════════
EOF
