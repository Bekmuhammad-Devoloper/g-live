#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# IKKI RAQAM konfigini QAYTARISH (server A):  sudo bash deploy/asterisk/dual-trunk/rollback.sh
#   • eski Asterisk: #include gl-dual/... qatorlari olib tashlanadi (2277 tegilmagan)
#   • glive: include olib tashlanadi, TRUNK=gl-trunk qaytariladi, gl-registration tiklanadi
#   • to'liq zaxiradan tiklash kerak bo'lsa: cp -a /root/asterisk-backup-<TS>/asterisk/. /etc/asterisk/
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
OLD=/etc/asterisk
GL=/etc/asterisk-glive
[[ $EUID -eq 0 ]] || { echo "root kerak: sudo bash $0"; exit 1; }

sed -i '/^; GL-EDU: 2022 trunki (deploy\/asterisk\/dual-trunk)$/d; /^#include gl-dual\/pjsip-2022.conf$/d' "$OLD/pjsip.conf"
sed -i '/^; GL-EDU: 2022 dialplan (deploy\/asterisk\/dual-trunk)$/d; /^#include gl-dual\/extensions-2022.conf$/d' "$OLD/extensions.conf"
rm -rf "$OLD/gl-dual"

sed -i "/^; GL-EDU: eski Asterisk bilan ko'prik (deploy\/asterisk\/dual-trunk)$/d; /^#include gl-dual\/pjsip-relay.conf$/d" "$GL/pjsip.conf"
rm -rf "$GL/gl-dual"
sed -i 's/^TRUNK=gl-oldast.*$/TRUNK=gl-trunk/' "$GL/extensions.conf"
# gl-registration izohini qaytarish (apply.sh izohga olgan bo'lsa)
python3 - "$GL/pjsip.conf" <<'PY'
import re,sys
p=sys.argv[1]; s=open(p).read()
s=s.replace(";; GL-DUAL: o'chirildi (2022 ni eski Asterisk registratsiya qiladi)\n","")
s=re.sub(r'(?m)^;(\[gl-registration\])$', r'\1', s)
# blok ichidagi qatorlar: ';key=value' → 'key=value' faqat [gl-registration] dan keyingi [ gacha
def unc(m):
    return m.group(1)+re.sub(r'(?m)^;(?=\w)', '', m.group(2))
s=re.sub(r'(?ms)^(\[gl-registration\]\n)(.*?)(?=^\[|\Z)', unc, s, count=1)
open(p,'w').write(s)
PY

asterisk -rx "pjsip reload" >/dev/null; asterisk -rx "dialplan reload" >/dev/null
asterisk -C "$GL/asterisk.conf" -rx "pjsip reload" >/dev/null; asterisk -C "$GL/asterisk.conf" -rx "dialplan reload" >/dev/null
echo "Qaytarildi. Holat:"
asterisk -rx "pjsip show registrations"
asterisk -C "$GL/asterisk.conf" -rx "pjsip show registrations"
