#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# A SERVERDA ALMASHTIRISH — B to'liq ishga tushgach bajariladi.
#
# Nima qiladi:
#   1. A'dagi ilova nusxasini to'xtatadi (gl-edu + uning ami-worker'i)
#      → 3010-port bo'shaydi
#   2. B'ning SSH kanali (-R 3010) o'sha portni egallaydi:
#      A'da 127.0.0.1:3010 endi = B'dagi ilova
#   3. Dialplan (route-lookup CURL http://127.0.0.1:3010) O'ZGARMAYDI —
#      u endi javobni B'dan oladi
#
# ⚠️ Asterisk'lar (ikkalasi ham) va eski CRM'ga TEGILMAYDI.
# Orqaga qaytish: sudo systemctl enable --now gl-edu gl-edu-ami
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

echo "── A'dagi ilova nusxasi to'xtatilmoqda ──"
sudo systemctl disable --now gl-edu.service gl-edu-ami.service

echo "── Tekshiruv ──"
sleep 2
if ss -tln | grep -q ':3010'; then
  echo "3010 hali band yoki B kanali ulangan:"
  ss -tlnp | grep ':3010' || true
else
  echo "3010 bo'sh — B kanali ulanishini kutmoqda (gl-tunnel B'da ishlashi kerak)"
fi
systemctl is-active asterisk-glive.service gl-rec.service
echo "Tayyor. Eski CRM: $(systemctl is-active asterisk.service) (tegilmadi)"
