#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# 2022 ni IKKINCHI IP'dan ko'tarish (server A) — hosting VM'ga SIP VLAN'dan
# ikkinchi port (ens5) qo'shgandan KEYIN ishga tushiriladi:
#
#   sudo bash /tmp/dual-trunk/second-ip-glive.sh <YANGI_IP> [<INTERFEYS>]
#   masalan: sudo bash /tmp/dual-trunk/second-ip-glive.sh 10.66.30.211 ens5
#
# Nima qiladi:
#   1) Interfeysga IP'ni netplan orqali doimiy qo'yadi (hosting DHCP bersa — o'tkazib yuboradi)
#   2) asterisk-glive transport-external → bind=<YANGI_IP>:5062 → provayder 2022 ni
#      ALOHIDA IP'dan ko'radi (2277 avvalgidek 10.66.30.204 dan)
#   3) glive'da 2022 registratsiyasini (gl-registration/gl-auth) tiklaydi/yaratadi,
#      chiquvchi TRUNK=gl-trunk qaytariladi (eski Asterisk orqali relay kerak emas)
#   4) reload + holat. Zaxira: /root/asterisk-backup-<vaqt>/asterisk-glive
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
NEW_IP="${1:?YANGI_IP kerak, masalan 10.66.30.211}"
IFACE="${2:-ens5}"
GL=/etc/asterisk-glive
TS="$(date +%Y%m%d-%H%M%S)"; BK="/root/asterisk-backup-$TS"
GL_CLI=(asterisk -C "$GL/asterisk.conf" -rx)
say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }; ok(){ printf '\033[1;32m✓ %s\033[0m\n' "$*"; }; warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "root kerak"; exit 1; }

say "Zaxira → $BK"; mkdir -p "$BK"; cp -a "$GL" "$BK/asterisk-glive"; ok "olindi"

# ── 1) Interfeys va IP ──────────────────────────────────────────────────────
say "Interfeys $IFACE / IP $NEW_IP"
ip link show "$IFACE" >/dev/null 2>&1 || { echo "Interfeys $IFACE yo'q — hosting portni qo'shdimi? (ip -br link)"; ip -br link; exit 1; }
if ip -4 addr show "$IFACE" | grep -q "inet $NEW_IP/"; then
  ok "$NEW_IP allaqachon $IFACE da"
else
  cat > /etc/netplan/60-sip-second.yaml <<EOF
network:
  version: 2
  ethernets:
    $IFACE:
      dhcp4: false
      addresses: [$NEW_IP/24]
EOF
  chmod 600 /etc/netplan/60-sip-second.yaml
  netplan apply
  sleep 2
  ip -4 addr show "$IFACE" | grep -q "inet $NEW_IP/" && ok "IP qo'yildi" || { echo "IP qo'yilmadi"; exit 1; }
fi
say "Gateway va provayder ping (yangi IP'dan)"
ping -c2 -W2 -I "$NEW_IP" 10.66.30.1 >/dev/null && ok "gateway OK" || warn "gateway javob bermadi — port-security/route tekshiring"
ping -c2 -W2 -I "$NEW_IP" 10.77.37.4 >/dev/null && ok "provayder 10.77.37.4 OK" || warn "provayder ping yo'q (ICMP yopiq bo'lishi mumkin — REGISTER'ni kutamiz)"

# ── 2) asterisk-glive transport → yangi IP ─────────────────────────────────
say "asterisk-glive transport-external → $NEW_IP:5062"
python3 - "$GL/pjsip.conf" "$NEW_IP" <<'PY'
import re,sys
p,ip=sys.argv[1],sys.argv[2]; s=open(p).read()
def fix(m):
    blk=m.group(0)
    blk=re.sub(r'(?m)^bind=.*$', f'bind={ip}:5062', blk)
    if not re.search(r'(?m)^bind=', blk): blk=blk.rstrip('\n')+f'\nbind={ip}:5062\n'
    return blk
s2=re.sub(r'(?ms)^\[transport-external\]\n.*?(?=^\[|\Z)', fix, s, count=1)
open(p,'w').write(s2)
print("transport bind:", re.search(r'(?m)^bind=.*', re.search(r'(?ms)^\[transport-external\]\n.*?(?=^\[|\Z)', s2).group(0)).group(0))
PY

# ── 3) 2022 registratsiyasi glive'da (to'g'ridan-to'g'ri) ──────────────────
say "gl-registration / gl-auth"
python3 - "$GL/pjsip.conf" <<'PY'
import re,sys
p=sys.argv[1]; s=open(p).read()
# izohga olingan blokni tiklash
s=s.replace(";; GL-DUAL: o'chirildi (2022 ni eski Asterisk registratsiya qiladi)\n","")
s=re.sub(r'(?m)^;(\[gl-registration\])$', r'\1', s)
s=re.sub(r'(?ms)^(\[gl-registration\]\n)(.*?)(?=^\[|\Z)', lambda m: m.group(1)+re.sub(r'(?m)^;(?=\w)','',m.group(2)), s, count=1)
if '[gl-registration]' not in s:
    s=s.rstrip('\n')+'''

; 2022 — TO'G'RIDAN-TO'G'RI registratsiya (ikkinchi IP'dan; deploy/asterisk/dual-trunk/second-ip-glive.sh)
[gl-auth]
type=auth
auth_type=userpass
username=550552022
password=550552022

[gl-registration]
type=registration
transport=transport-external
outbound_auth=gl-auth
server_uri=sip:10.77.37.4
client_uri=sip:550552022@10.77.37.4
contact_user=550552022
retry_interval=60
forbidden_retry_interval=300
max_retries=10000
expiration=3600
'''
open(p,'w').write(s)
print("gl-registration:", "bor" if "[gl-registration]" in s else "YO'Q")
PY
# eski Asterisk orqali relay kerak emas — o'z trunki
sed -i 's/^TRUNK=gl-oldast.*$/TRUNK=gl-trunk/' "$GL/extensions.conf"
grep -n "^TRUNK=" "$GL/extensions.conf"

# ── 4) Reload + holat ───────────────────────────────────────────────────────
say "Reload"
"${GL_CLI[@]}" "core reload" >/dev/null; sleep 8
"${GL_CLI[@]}" "pjsip show transports" | grep -iE "transport-external|bind" || true
"${GL_CLI[@]}" "pjsip show registrations"
say "ESKI Asterisk (2277 — o'zgarmagan bo'lishi kerak)"
asterisk -rx "pjsip show registrations"
cat <<EOF

════════════════════════════════════════════════════════════════════════════
 2022 endi $NEW_IP dan, 2277 esa 10.66.30.204 dan registratsiya qiladi.
 Uztelecom'ga: "550552022 trunki endi $NEW_IP IP'sidan — shu IP'ga ruxsat/marshrut bering".
 Sinov: 2277 → eski CRM; 2022 → GL EDU; ikkalasiga bir vaqtda; chiquvchilar.
 Qaytarish: cp -a $BK/asterisk-glive/. $GL/ && asterisk -C $GL/asterisk.conf -rx "core reload"
════════════════════════════════════════════════════════════════════════════
EOF
