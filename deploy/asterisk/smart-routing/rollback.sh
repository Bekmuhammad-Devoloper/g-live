#!/usr/bin/env bash
# AQLLI TAQSIMOTni qaytarish:  sudo bash rollback.sh
#   eski Asterisk: uztelecom.context → from-trunk, #include gl-smart/* olib tashlanadi
#   glive: #include olib tashlanadi, TRUNK=gl-trunk
set -euo pipefail
OLD=/etc/asterisk; GL=/etc/asterisk-glive
[[ $EUID -eq 0 ]] || { echo "root kerak: sudo bash $0"; exit 1; }

sed -i 's/^context=from-trunk-smart .*$/context=from-trunk/' "$OLD/pjsip.conf"
sed -i "/^; GL-EDU: glive ko'prigi (deploy\/asterisk\/smart-routing)$/d; /^#include gl-smart\/pjsip-bridge.conf$/d" "$OLD/pjsip.conf"
sed -i '/^; GL-EDU: aqlli taqsimot (deploy\/asterisk\/smart-routing)$/d; /^#include gl-smart\/extensions-smart.conf$/d' "$OLD/extensions.conf"
rm -rf "$OLD/gl-smart"

sed -i '/^; GL-EDU: eski Asterisk orqali chiquvchi (deploy\/asterisk\/smart-routing)$/d; /^#include gl-smart\/pjsip-relay.conf$/d' "$GL/pjsip.conf"
rm -rf "$GL/gl-smart"
sed -i 's/^TRUNK=gl-oldast.*$/TRUNK=gl-trunk/' "$GL/extensions.conf"

asterisk -rx "pjsip reload" >/dev/null; asterisk -rx "dialplan reload" >/dev/null
asterisk -C "$GL/asterisk.conf" -rx "pjsip reload" >/dev/null; asterisk -C "$GL/asterisk.conf" -rx "dialplan reload" >/dev/null
echo "Qaytarildi."; asterisk -rx "pjsip show endpoint uztelecom" | grep -E "^ *context"; asterisk -rx "pjsip show registrations" | grep -E "Registered|Unregistered" || true
