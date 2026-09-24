#!/usr/bin/env bash
# AQLLI TAQSIMOTni qaytarish:  sudo bash rollback.sh
#   eski Asterisk: from-trunk'dagi Gosub qatorlari va #include gl-smart/* olib tashlanadi
#   (route-lookup URL va RECORD_FILE tuzatishlari qoladi — ular Imkon CRM uchun kerak)
#   glive: #include olib tashlanadi, TRUNK=gl-trunk
set -euo pipefail
OLD=/etc/asterisk; GL=/etc/asterisk-glive
[[ $EUID -eq 0 ]] || { echo "root kerak: sudo bash $0"; exit 1; }

sed -i '/^exten => _X.,1,Gosub(gl-smart-route,${EXTEN},1)$/d; /^exten => s,1,Gosub(gl-smart-route,s,1)$/d' "$OLD/extensions.conf"
sed -i 's/^ same => n,NoOp(Inbound: ${CALLERID(num)})$/exten => _X.,1,NoOp(Inbound: ${CALLERID(num)})/; s/^ same => n,NoOp(Inbound s: ${CALLERID(num)})$/exten => s,1,NoOp(Inbound s: ${CALLERID(num)})/' "$OLD/extensions.conf"
sed -i "/^; GL-EDU: glive ko'prigi (deploy\/asterisk\/smart-routing)$/d; /^#include gl-smart\/pjsip-bridge.conf$/d" "$OLD/pjsip.conf"
sed -i "/^; GL-EDU: 2022 faqat chiquvchi, registratsiyasiz (deploy\/asterisk\/smart-routing)$/d; /^#include gl-smart\/pjsip-2022-outbound.conf$/d" "$OLD/pjsip.conf"
sed -i '/^; GL-EDU: aqlli taqsimot (deploy\/asterisk\/smart-routing)$/d; /^#include gl-smart\/extensions-smart.conf$/d' "$OLD/extensions.conf"
rm -rf "$OLD/gl-smart"

sed -i '/^; GL-EDU: eski Asterisk orqali chiquvchi (deploy\/asterisk\/smart-routing)$/d; /^#include gl-smart\/pjsip-relay.conf$/d' "$GL/pjsip.conf"
rm -rf "$GL/gl-smart"
sed -i 's/^TRUNK=gl-oldast.*$/TRUNK=gl-trunk/' "$GL/extensions.conf"

asterisk -rx "pjsip reload" >/dev/null; asterisk -rx "dialplan reload" >/dev/null
asterisk -C "$GL/asterisk.conf" -rx "pjsip reload" >/dev/null; asterisk -C "$GL/asterisk.conf" -rx "dialplan reload" >/dev/null
echo "Qaytarildi."; asterisk -rx "dialplan show from-trunk" | grep -c Gosub || true; asterisk -rx "pjsip show registrations" | grep -E "Registered|Unregistered" || true
