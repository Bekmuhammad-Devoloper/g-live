#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# GERMANLIFE — GL-EDU telefoniya server sozlovi (Ubuntu 22.04)
# Serverда root sifatida:   sudo bash setup.sh
# HAR bo'limni ko'rib chiqing. Sirlar SHU YERDA generatsiya bo'ladi va
# app uchun /root/glive-telephony.env ga yoziladi.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── 0. Parametrlar (real qiymatlar) ─────────────────────────────────
PUBLIC_IP="89.126.208.123"       # brauzer (WebRTC) tomoni
TRUNK_IFACE="eth1"               # SIP trunk VLAN 200
TRUNK_LOCAL_IP="10.66.30.204"
TRUNK_GW="10.66.30.1"
TRUNK_ROUTE="10.0.0.0/8"
SIP_SERVER="10.77.37.4"
SIP_PORT="5060"
TRUNK_USER="550552022"
TRUNK_PASS="550552022"           # provayder bergan (raqam bilan bir xil)
NUM_OPERATORS=10
REC_DIR="/var/spool/asterisk/recording"
CRM_URL="http://127.0.0.1:3000"  # GL-EDU (Next.js) shu serverda ishlasin

# ── 1. Paketlar ─────────────────────────────────────────────────────
apt update
apt install -y asterisk asterisk-modules coturn ufw openssl

# ── 2. Sirlar (serverда generatsiya) ────────────────────────────────
gen(){ openssl rand -hex 16; }
AMI_PASS="$(gen)"; TURN_USER="glive_turn"; TURN_CRED="$(gen)"
declare -a OP; for i in $(seq 1 $NUM_OPERATORS); do OP[$i]="$(gen)"; done

# ── 3. Statik route (trunk tarmog'iga) ──────────────────────────────
ip route replace ${TRUNK_ROUTE} via ${TRUNK_GW} dev ${TRUNK_IFACE} || true
# Doimiy qilish (netplan) — mavjud konfigingizga qo'shing:
cat > /etc/networkd-dispatcher/routable.d/50-trunk-route <<EOF || true
#!/bin/sh
ip route replace ${TRUNK_ROUTE} via ${TRUNK_GW} dev ${TRUNK_IFACE}
EOF
chmod +x /etc/networkd-dispatcher/routable.d/50-trunk-route 2>/dev/null || true

# ── 4. Kalit + papkalar ─────────────────────────────────────────────
mkdir -p /etc/asterisk/keys
[ -f /etc/asterisk/keys/asterisk.crt ] || openssl req -x509 -newkey rsa:2048 \
  -keyout /etc/asterisk/keys/asterisk.key -out /etc/asterisk/keys/asterisk.crt \
  -days 3650 -nodes -subj "/CN=${PUBLIC_IP}"
chown -R asterisk:asterisk /etc/asterisk/keys; chmod 640 /etc/asterisk/keys/*
mkdir -p ${REC_DIR}; chown -R asterisk:asterisk ${REC_DIR}

# ── 5. Asterisk konfiglari ──────────────────────────────────────────
cat > /etc/asterisk/manager.conf <<EOF
[general]
enabled = yes
port = 5038
bindaddr = 127.0.0.1
[glive_ami]
secret = ${AMI_PASS}
permit = 127.0.0.1/255.255.255.255
read = all
write = all
EOF

cat > /etc/asterisk/http.conf <<EOF
[general]
enabled = yes
bindaddr = 0.0.0.0
bindport = 8088
tlsenable = yes
tlsbindaddr = 0.0.0.0:8089
tlscertfile = /etc/asterisk/keys/asterisk.crt
tlsprivatekey = /etc/asterisk/keys/asterisk.key
sessionlimit = 200
EOF

cat > /etc/asterisk/rtp.conf <<EOF
[general]
rtpstart = 10000
rtpend = 20000
strictrtp = no
icesupport = yes
stunaddr = stun:${PUBLIC_IP}:3478
EOF

cat > /etc/asterisk/queues.conf <<EOF
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

# pjsip.conf — transportlar + trunk (eth1) + operatorlar (loop)
{
cat <<EOF
[transport-udp]
type=transport
protocol=udp
bind=${TRUNK_LOCAL_IP}:${SIP_PORT}

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

[uztelecom-auth]
type=auth
auth_type=userpass
username=${TRUNK_USER}
password=${TRUNK_PASS}

[uztelecom-registration]
type=registration
transport=transport-udp
outbound_auth=uztelecom-auth
server_uri=sip:${SIP_SERVER}
client_uri=sip:${TRUNK_USER}@${SIP_SERVER}
retry_interval=60
max_retries=100
expiration=3600

[uztelecom-aor]
type=aor
contact=sip:${SIP_SERVER}:${SIP_PORT}
qualify_frequency=30

[uztelecom-identify]
type=identify
endpoint=uztelecom
match=${SIP_SERVER}/32

[uztelecom]
type=endpoint
transport=transport-udp
context=from-trunk
disallow=all
allow=alaw,ulaw
aors=uztelecom-aor
outbound_auth=uztelecom-auth
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
trust_id_inbound=yes
send_rpid=yes
from_domain=${TRUNK_LOCAL_IP}
from_user=${TRUNK_USER}
EOF
for i in $(seq 1 $NUM_OPERATORS); do
cat <<EOF

[operator${i}]
type=aor
max_contacts=5
remove_existing=no
qualify_frequency=30
[operator${i}-auth]
type=auth
auth_type=userpass
username=operator${i}
password=${OP[$i]}
[operator${i}]
type=endpoint
transport=transport-wss
context=from-internal
disallow=all
allow=ulaw,alaw,opus
auth=operator${i}-auth
aors=operator${i}
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
device_state_busy_at=1
webrtc=yes
dtls_cert_file=/etc/asterisk/keys/asterisk.crt
dtls_private_key=/etc/asterisk/keys/asterisk.key
callerid="operator${i}" <operator${i}>
EOF
done
} > /etc/asterisk/pjsip.conf

cat > /etc/asterisk/extensions.conf <<EOF
[general]
static=yes
writeprotect=no
[globals]
TRUNK=uztelecom
TRUNK_NUM=${TRUNK_USER}
RECORD_DIR=${REC_DIR}
CRM_URL=${CRM_URL}
[from-internal]
exten => _998XXXXXXXXX,1,Set(CALLERID(num)=\${TRUNK_NUM})
 same => n,Set(RECORD_FILE=\${RECORD_DIR}/\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)}-\${CALLERID(num)}-\${EXTEN})
 same => n,MixMonitor(\${RECORD_FILE}.wav,b)
 same => n,Dial(PJSIP/\${EXTEN}@\${TRUNK},60,tTkK)
 same => n,StopMixMonitor()
 same => n,Hangup()
exten => _0XXXXXXXXX,1,Goto(from-internal,998\${EXTEN:1},1)
exten => _8XXXXXXXXX,1,Goto(from-internal,998\${EXTEN:1},1)
exten => _XXXXXXXXX,1,Goto(from-internal,998\${EXTEN},1)
[from-trunk]
exten => _X.,1,NoOp(Inbound \${CALLERID(num)})
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
exten => s,1,Goto(from-trunk,_X.,1)
EOF

# ── 6. coturn (domensiz — 3478, TLS'siz) ────────────────────────────
cat > /etc/turnserver.conf <<EOF
listening-port=3478
listening-ip=${PUBLIC_IP}
external-ip=${PUBLIC_IP}
min-port=49152
max-port=65535
realm=${PUBLIC_IP}
server-name=${PUBLIC_IP}
fingerprint
lt-cred-mech
user=${TURN_USER}:${TURN_CRED}
no-cli
no-tlsv1
no-tlsv1_1
EOF
grep -q TURNSERVER_ENABLED /etc/default/coturn && sed -i 's/.*TURNSERVER_ENABLED.*/TURNSERVER_ENABLED=1/' /etc/default/coturn || echo "TURNSERVER_ENABLED=1" >> /etc/default/coturn
systemctl enable coturn; systemctl restart coturn

# ── 7. Firewall ─────────────────────────────────────────────────────
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp
ufw allow 5060/udp; ufw allow 8088/tcp; ufw allow 8089/tcp
ufw allow 10000:20000/udp; ufw allow 3478/udp; ufw allow 3478/tcp
ufw allow 49152:65535/udp
# AMI 5038 — ochilmaydi (loopback)
yes | ufw enable || true

# ── 8. GL-EDU app uchun .env qiymatlari ─────────────────────────────
{
echo "PUBLIC_HOST=${PUBLIC_IP}"
echo "SIP_DOMAIN=${PUBLIC_IP}"
echo "WS_URL=ws://${PUBLIC_IP}:8088/ws"
echo "WSS_URL=wss://${PUBLIC_IP}:8089/ws"
echo "ASTERISK_HOST=127.0.0.1"
echo "ASTERISK_AMI_PORT=5038"
echo "ASTERISK_AMI_USER=glive_ami"
echo "ASTERISK_AMI_PASS=${AMI_PASS}"
echo "ASTERISK_RECORDING_DIR=${REC_DIR}"
echo "SIP_TRUNK_USERNAME=${TRUNK_USER}"
echo "SIP_TRUNK_PASSWORD=${TRUNK_PASS}"
echo "SIP_TRUNK_CALLER_ID=${TRUNK_USER}"
echo "TURN_USERNAME=${TURN_USER}"
echo "TURN_CREDENTIAL=${TURN_CRED}"
for i in $(seq 1 $NUM_OPERATORS); do echo "SIP_OPERATOR${i}_PASS=${OP[$i]}"; done
} > /root/glive-telephony.env
chmod 600 /root/glive-telephony.env

# ── 9. Ishga tushirish ──────────────────────────────────────────────
systemctl enable asterisk; systemctl restart asterisk
sleep 4
echo "════════════════════════════════════════════"
asterisk -rx "pjsip show registrations" || true
echo "════════════════════════════════════════════"
echo "App .env qiymatlari:  /root/glive-telephony.env"
echo "Trunk 'Registered' bo'lsa — chiquvchi/kiruvchi tayyor."
