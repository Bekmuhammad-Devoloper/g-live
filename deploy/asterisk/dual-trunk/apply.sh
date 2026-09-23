#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# IKKI RAQAM (550552277 + 550552022) BIR IP'DAN — qo'llash skripti (server A)
#
#   sudo bash deploy/asterisk/dual-trunk/apply.sh
#
# Nima qiladi (idempotent — qayta ishga tushirsa bo'ladi):
#   1) /etc/asterisk va /etc/asterisk-glive ni /root/asterisk-backup-<vaqt>/ ga zaxiralaydi
#   2) ESKI Asterisk (2277 ishlayotgan): 2022 uchun alohida trunk (auth+registration
#      line=yes+endpoint) va dialplan qo'shadi — #include orqali, mavjud fayllarga
#      faqat BIR qator qo'shiladi; 2277 konfigi o'zgarmaydi
#   3) asterisk-glive: provayderga o'z registratsiyasini O'CHIRADI (agar bo'lsa),
#      relay endpointlarini qo'shadi, chiquvchi trunkni gl-oldast'ga o'tkazadi
#   4) Ikkala instansda pjsip/dialplan reload, holatni ko'rsatadi
#
# QAYTARISH: sudo bash deploy/asterisk/dual-trunk/rollback.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OLD=/etc/asterisk
GL=/etc/asterisk-glive
TS="$(date +%Y%m%d-%H%M%S)"
BK="/root/asterisk-backup-$TS"
OLD_CLI=(asterisk -rx)
GL_CLI=(asterisk -C "$GL/asterisk.conf" -rx)

say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "root kerak: sudo bash $0"; exit 1; }
[[ -f "$OLD/pjsip.conf" && -f "$GL/pjsip.conf" ]] || { echo "Asterisk konfiglari topilmadi ($OLD, $GL)"; exit 1; }

# ── 1) Zaxira ────────────────────────────────────────────────────────────────
say "Zaxira → $BK"
mkdir -p "$BK"
cp -a "$OLD" "$BK/asterisk"
cp -a "$GL"  "$BK/asterisk-glive"
ok "zaxira olindi"

# ── 2) ESKI Asterisk: 2022 trunki ────────────────────────────────────────────
say "Eski Asterisk: 2022 trunki (line=yes) + dialplan"
mkdir -p "$OLD/gl-dual"
install -m 0644 "$HERE/old-pjsip-2022.conf"      "$OLD/gl-dual/pjsip-2022.conf"
install -m 0644 "$HERE/old-extensions-2022.conf" "$OLD/gl-dual/extensions-2022.conf"

# Avvalgi urinishlardagi (2026-08-12) dublikat bloklar bo'lsa — konflikt bo'lmasin
for sec in gl2022-auth gl2022-registration gl-newast gl-newast-aor; do
  if grep -q "^\[$sec\]" "$OLD/pjsip.conf"; then
    warn "pjsip.conf ichida eski [$sec] bloki bor — gl-dual bilan dublikat bo'ladi. Avval o'sha eski blokni olib tashlang (zaxira: $BK)."
    DUP=1
  fi
done
if grep -q "^exten => 550552022," "$OLD/extensions.conf"; then
  warn "extensions.conf ichida eski 'exten => 550552022' bor — dublikat. Avval olib tashlang."
  DUP=1
fi
[[ -z "${DUP:-}" ]] || { echo "Dublikatlar bor — to'xtatildi (hech narsa o'zgartirilmadi, faqat zaxira olindi)."; exit 2; }

grep -q '^#include gl-dual/pjsip-2022.conf' "$OLD/pjsip.conf" \
  || printf '\n; GL-EDU: 2022 trunki (deploy/asterisk/dual-trunk)\n#include gl-dual/pjsip-2022.conf\n' >> "$OLD/pjsip.conf"
grep -q '^#include gl-dual/extensions-2022.conf' "$OLD/extensions.conf" \
  || printf '\n; GL-EDU: 2022 dialplan (deploy/asterisk/dual-trunk)\n#include gl-dual/extensions-2022.conf\n' >> "$OLD/extensions.conf"
ok "include qatorlari qo'shildi"

# ── 3) asterisk-glive: provayderga registratsiya YO'Q, relay + chiquvchi ────
say "asterisk-glive: relay endpointlar, chiquvchi trunk → gl-oldast"
mkdir -p "$GL/gl-dual"
install -m 0644 "$HERE/glive-pjsip-relay.conf" "$GL/gl-dual/pjsip-relay.conf"

# glive o'zi provayderga registratsiya qilsa 2022 o'zi-o'zi bilan to'qnashadi — o'chiramiz
if grep -qE '^\[gl-registration\]' "$GL/pjsip.conf"; then
  python3 - "$GL/pjsip.conf" <<'PY'
import re,sys
p=sys.argv[1]; s=open(p).read()
# [gl-registration] blokini (keyingi [ gacha) izohga olamiz
s=re.sub(r'(?ms)^\[gl-registration\]\n(.*?)(?=^\[|\Z)', lambda m: ';; GL-DUAL: o\'chirildi (2022 ni eski Asterisk registratsiya qiladi)\n' + ''.join(';'+l+'\n' for l in ('[gl-registration]\n'+m.group(1)).splitlines()), s, count=1)
open(p,'w').write(s)
PY
  ok "gl-registration izohga olindi"
fi
# Mavjud gl-relay-in bloki (2026-08-12) bo'lsa — dublikat bo'lmasin, faylimizdan chiqaramiz
if grep -q '^\[gl-relay-in\]' "$GL/pjsip.conf"; then
  python3 - "$GL/gl-dual/pjsip-relay.conf" <<'PY'
import re,sys
p=sys.argv[1]; s=open(p).read()
s=re.sub(r'(?ms)^\[gl-relay-in\]\n.*?(?=^\[gl-oldast\])', '', s, count=1)
open(p,'w').write(s)
PY
  warn "glive pjsip.conf da gl-relay-in allaqachon bor — faqat gl-oldast qo'shildi"
fi
grep -q '^#include gl-dual/pjsip-relay.conf' "$GL/pjsip.conf" \
  || printf '\n; GL-EDU: eski Asterisk bilan ko\x27prik (deploy/asterisk/dual-trunk)\n#include gl-dual/pjsip-relay.conf\n' >> "$GL/pjsip.conf"

# Chiquvchi: gl-from-internal TRUNK=gl-trunk → gl-oldast (eski Asterisk orqali 2022)
if grep -qE '^TRUNK=gl-trunk' "$GL/extensions.conf"; then
  sed -i 's/^TRUNK=gl-trunk/TRUNK=gl-oldast   ; GL-DUAL: eski Asterisk → 2022 trunki/' "$GL/extensions.conf"
  ok "glive chiquvchi trunk → gl-oldast"
fi

# ── 4) Reload + holat ────────────────────────────────────────────────────────
say "Reload"
"${OLD_CLI[@]}" "pjsip reload"    >/dev/null; "${OLD_CLI[@]}" "dialplan reload" >/dev/null
"${GL_CLI[@]}"  "pjsip reload"    >/dev/null; "${GL_CLI[@]}"  "dialplan reload" >/dev/null
sleep 6

say "ESKI Asterisk — registratsiyalar (ikkalasi Registered bo'lishi kerak)"
"${OLD_CLI[@]}" "pjsip show registrations"
say "ESKI Asterisk — 2022 endpoint"
"${OLD_CLI[@]}" "pjsip show endpoint gl2022" | sed -n '1,25p'
say "ESKI Asterisk — Contact'da ;line= bormi (line=yes ishlayotganini ko'rsatadi)"
"${OLD_CLI[@]}" "pjsip show registration gl2022-registration" | grep -iE 'line|contact|status' || true
say "asterisk-glive — registratsiya BO'LMASLIGI kerak, gl-oldast Avail bo'lsin"
"${GL_CLI[@]}" "pjsip show registrations"
"${GL_CLI[@]}" "pjsip show aor gl-oldast-aor" | grep -iE 'contact|Avail|Unavail' || true

cat <<EOF

════════════════════════════════════════════════════════════════════════════
 TAYYOR. Endi REAL sinov (ikkalasini ham 2–3 marta, ketma-ket va bir vaqtda):
   1) Telefondan 550552277 ga qo'ng'iroq → eski CRM operatori jiringlaydi
   2) Telefondan 550552022 ga qo'ng'iroq → GL EDU (glive) operatori jiringlaydi
   3) Ikkalasiga BIR VAQTDA → ikkalasi ham jiringlaydi (adashmaydi)
   4) GL EDU'dan chiquvchi → telefonda 550552022 ko'rinadi
   5) Eski CRM'dan chiquvchi → telefonda 550552277 ko'rinadi
 Kuzatish:  asterisk -rvvv   (eski)   |   asterisk -C $GL/asterisk.conf -rvvv (glive)
            pjsip set logger on   — INVITE'da Request-URI/To qaysi raqam kelayotganini ko'rsatadi
 Muammo bo'lsa: sudo bash $HERE/rollback.sh   (zaxira: $BK)
════════════════════════════════════════════════════════════════════════════
EOF
