#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# 2-BOSQICH: A va B ni ulash (VPN tayyor bo'lgach)
#
#   A serverda:  sudo bash 2-link.sh a     # AMI'ni VPN'ga ochish + CRM_URL
#   B serverda:  sudo bash 2-link.sh b     # ilova AMI'ga A orqali ulanadi
#
# ⚠️ ESKI TIZIMGA TEGILMAYDI: faqat /etc/asterisk-glive/* fayllari
#    o'zgaradi. /etc/asterisk (eski) va uning servisi qo'lga tegmaydi.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail
ROLE="${1:?a yoki b}"
VPN_A="10.99.0.1"; VPN_B="10.99.0.2"
ETC=/etc/asterisk-glive
APP=/home/ubuntu/gl-edu

if [ "$ROLE" = "a" ]; then
  echo "══ A: AMI'ni VPN interfeysiga ochish (internetga EMAS) ══"
  cp $ETC/manager.conf $ETC/manager.conf.bak.$(date +%s)
  # bindaddr: 127.0.0.1 → 0.0.0.0, lekin permit faqat VPN'dan
  sed -i "s|^bindaddr *=.*|bindaddr = 0.0.0.0|" $ETC/manager.conf
  sed -i "s|^permit *=.*|permit = ${VPN_B}/255.255.255.255|" $ETC/manager.conf
  grep -q "^deny" $ETC/manager.conf || sed -i "/^permit/i deny = 0.0.0.0/0.0.0.0" $ETC/manager.conf

  echo "══ A: dialplan CRM_URL → B serverга ══"
  cp $ETC/extensions.conf $ETC/extensions.conf.bak.$(date +%s)
  sed -i "s|^CRM_URL=.*|CRM_URL=http://${VPN_B}:3010|" $ETC/extensions.conf

  echo "══ A: faqat VPN'dan AMI'ga ruxsat (firewall) ══"
  iptables -C INPUT -p tcp --dport 5039 ! -s ${VPN_B} -j DROP 2>/dev/null || \
    iptables -I INPUT -p tcp --dport 5039 ! -s ${VPN_B} -j DROP
  command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true

  echo "══ A: asterisk-glive qayta yuklash (ESKI asterisk'ga TEGILMAYDI) ══"
  asterisk -C $ETC/asterisk.conf -rx "manager reload" >/dev/null 2>&1
  asterisk -C $ETC/asterisk.conf -rx "dialplan reload" >/dev/null 2>&1
  echo "   yangi trunk: $(asterisk -C $ETC/asterisk.conf -rx 'pjsip show registrations' 2>/dev/null | grep -c Registered) Registered"
  echo "   ESKI trunk : $(asterisk -rx 'pjsip show registrations' 2>/dev/null | grep -c Registered) Registered ← o'zgarmagan"

  echo "══ A: yozuvlarni B'ga uzatish uchun kalit ══"
  echo "   (B serverdan rsync tortadi — 3-bosqich)"
  echo "   Yozuvlar: $ETC → /var/spool/asterisk-glive/recording"

  echo "══ A: eski (mahalliy) GL-EDU servislarini to'xtatish ══"
  systemctl disable --now gl-edu gl-edu-ami 2>/dev/null || true
  echo "   to'xtatildi (o'chirilmadi — orqaga qaytarish mumkin)"

else
  echo "══ B: .env — AMI endi A serverда (VPN orqali) ══"
  cd $APP
  cp .env .env.bak.$(date +%s)
  sed -i "s|^ASTERISK_HOST=.*|ASTERISK_HOST=${VPN_A}|" .env
  grep -q "^ASTERISK_HOST=" .env || echo "ASTERISK_HOST=${VPN_A}" >> .env

  echo "══ B: yozuvlarni A'dan sinxronlash (har 5 daqiqa) ══"
  mkdir -p /var/spool/asterisk-glive/recording
  chown ubuntu:ubuntu /var/spool/asterisk-glive/recording
  cat > /etc/systemd/system/gl-rec-sync.service <<EOF
[Unit]
Description=GL-EDU: qo'ng'iroq yozuvlarini A serverdan tortish
[Service]
Type=oneshot
User=ubuntu
ExecStart=/usr/bin/rsync -az --ignore-existing ubuntu@${VPN_A}:/var/spool/asterisk-glive/recording/ /var/spool/asterisk-glive/recording/
EOF
  cat > /etc/systemd/system/gl-rec-sync.timer <<'EOF'
[Unit]
Description=Har 5 daqiqada yozuvlarni sinxronlash
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now gl-rec-sync.timer
  systemctl restart gl-edu gl-edu-ami
  sleep 8
  echo "   gl-edu: $(systemctl is-active gl-edu) | ami: $(systemctl is-active gl-edu-ami)"
  echo "   AMI ulanishi:"; journalctl -u gl-edu-ami -n 3 --no-pager | tail -2
fi
echo "✅ ${ROLE^^} bosqichi tugadi"
