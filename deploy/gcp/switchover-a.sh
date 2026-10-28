#!/usr/bin/env bash
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
