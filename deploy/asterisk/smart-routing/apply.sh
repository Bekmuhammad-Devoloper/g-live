#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# AQLLI TAQSIMOT — bitta trunk (2277), ikki tizim teng.  sudo bash apply.sh
#   1) zaxira → /root/asterisk-backup-<vaqt>/
#   2) eski Asterisk: gl-newast ko'prik (#include), from-trunk-smart + from-glive (#include),
#      'uztelecom' endpoint konteksti from-trunk → from-trunk-smart
#   3) glive: gl-oldast (#include), TRUNK=gl-oldast, provayder registratsiyasi yo'qligini tekshiradi
#   4) reload + holat
# QAYTARISH: sudo bash rollback.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OLD=/etc/asterisk; GL=/etc/asterisk-glive
TS="$(date +%Y%m%d-%H%M%S)"; BK="/root/asterisk-backup-$TS"
GL_CLI=(asterisk -C "$GL/asterisk.conf" -rx)
say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }; ok(){ printf '\033[1;32m✓ %s\033[0m\n' "$*"; }; warn(){ printf '\033[1;33m! %s\033[0m\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "root kerak: sudo bash $0"; exit 1; }

say "Zaxira → $BK"; mkdir -p "$BK"; cp -a "$OLD" "$BK/asterisk"; cp -a "$GL" "$BK/asterisk-glive"; ok "olindi"

# Qoldiqlar (dual-trunk yoki avgust) bo'lsa — to'xtaymiz
for sec in gl2022-registration gl-newast gl-newast-aor gl-newast-identify; do
  grep -q "^\[$sec\]" "$OLD/pjsip.conf" && { warn "eski pjsip.conf da [$sec] bor — avval olib tashlang"; DUP=1; }
done
grep -q "gl-dual" "$OLD/pjsip.conf" "$OLD/extensions.conf" && { warn "gl-dual include qoldig'i bor — avval dual-trunk/rollback.sh"; DUP=1; }
grep -q "^\[from-trunk-smart\]" "$OLD/extensions.conf" && { warn "from-trunk-smart allaqachon extensions.conf ichida"; DUP=1; }
[[ -z "${DUP:-}" ]] || { echo "To'xtatildi — hech narsa o'zgartirilmadi (zaxira olindi)."; exit 2; }

say "Eski Asterisk: ko'prik + smart dialplan"
mkdir -p "$OLD/gl-smart"
install -m 0644 "$HERE/old-pjsip-bridge.conf"     "$OLD/gl-smart/pjsip-bridge.conf"
install -m 0644 "$HERE/old-extensions-smart.conf" "$OLD/gl-smart/extensions-smart.conf"
grep -q '^#include gl-smart/pjsip-bridge.conf' "$OLD/pjsip.conf" \
  || printf '\n; GL-EDU: glive ko\x27prigi (deploy/asterisk/smart-routing)\n#include gl-smart/pjsip-bridge.conf\n' >> "$OLD/pjsip.conf"
grep -q '^#include gl-smart/extensions-smart.conf' "$OLD/extensions.conf" \
  || printf '\n; GL-EDU: aqlli taqsimot (deploy/asterisk/smart-routing)\n#include gl-smart/extensions-smart.conf\n' >> "$OLD/extensions.conf"

# 'uztelecom' endpoint konteksti → from-trunk-smart (faqat shu blok ichida)
python3 - "$OLD/pjsip.conf" <<'PY'
import re,sys
p=sys.argv[1]; s=open(p).read()
def fix(m):
    blk=m.group(0)
    if re.search(r'(?m)^context=from-trunk-smart\s*$', blk): return blk
    blk2,n=re.subn(r'(?m)^context=from-trunk\s*$', 'context=from-trunk-smart   ; GL-SMART (asli: from-trunk)', blk)
    if n==0: print("DIQQAT: [uztelecom] ichida context=from-trunk topilmadi"); sys.exit(3)
    return blk2
s2,n=re.subn(r'(?ms)^\[uztelecom\]\n.*?(?=^\[|\Z)', fix, s, count=1)
if n==0: print("DIQQAT: [uztelecom] endpoint bloki topilmadi"); sys.exit(3)
open(p,'w').write(s2); print("uztelecom.context → from-trunk-smart")
PY
ok "eski Asterisk tayyor"

say "asterisk-glive: gl-oldast + TRUNK=gl-oldast"
mkdir -p "$GL/gl-smart"
install -m 0644 "$HERE/glive-pjsip-relay.conf" "$GL/gl-smart/pjsip-relay.conf"
grep -q '^\[gl-oldast\]' "$GL/pjsip.conf" && warn "glive pjsip.conf da gl-oldast allaqachon bor (dublikat bo'lishi mumkin)"
grep -q '^#include gl-smart/pjsip-relay.conf' "$GL/pjsip.conf" \
  || printf '\n; GL-EDU: eski Asterisk orqali chiquvchi (deploy/asterisk/smart-routing)\n#include gl-smart/pjsip-relay.conf\n' >> "$GL/pjsip.conf"
sed -i 's/^TRUNK=gl-trunk.*$/TRUNK=gl-oldast   ; GL-SMART: eski Asterisk → 2277 trunki/' "$GL/extensions.conf"
grep -q '^\[gl-relay-in\]' "$GL/pjsip.conf" || warn "glive'da gl-relay-in YO'Q — kiruvchi relay ishlamaydi (deploy/asterisk/glive-relay-in.conf qo'shing)"
grep -qE '^\[gl-registration\]' "$GL/pjsip.conf" && warn "glive'da gl-registration BOR — provayderga registratsiya to'qnashuv beradi, o'chiring"
ok "glive tayyor"

say "Reload"
asterisk -rx "pjsip reload" >/dev/null; asterisk -rx "dialplan reload" >/dev/null
"${GL_CLI[@]}" "pjsip reload" >/dev/null; "${GL_CLI[@]}" "dialplan reload" >/dev/null
sleep 4
say "Eski: uztelecom konteksti"; asterisk -rx "pjsip show endpoint uztelecom" | grep -E "^ *context"
say "Eski: registratsiya (faqat 2277)"; asterisk -rx "pjsip show registrations" | grep -E "Registered|Unregistered|Rejected" || true
say "Eski: smart dialplan"; asterisk -rx "dialplan show from-trunk-smart" | head -14
say "Eski: gl-newast"; asterisk -rx "pjsip show aor gl-newast-aor" | grep -E "Contact:" | tail -1
say "GL EDU tunnel / known API"; curl -s -m 3 -w " [%{http_code}]\n" "http://127.0.0.1:3010/api/telephony/known?phone=998900000000" || true
say "glive: TRUNK"; grep -n "^TRUNK=" "$GL/extensions.conf"; "${GL_CLI[@]}" "pjsip show aor gl-oldast-aor" | grep -E "Contact:" | tail -1
cat <<EOF

════════════════════════════════════════════════════════════════════════════
 TAYYOR. Sinov (real telefon):
   • GL EDU'da lid bo'lgan raqamdan 2277 ga → GL EDU operatori jiringlaydi
   • eski CRM'dagi mijoz raqamidan 2277 ga → eski CRM operatori
   • hech qayerda yo'q raqamdan 2277 ga → eski CRM (DID qoidasi)
   • GL EDU'dan chiquvchi → mijozda 2277 ko'rinadi
 Kuzatish: asterisk -rvvv → "SMART: GL_KNOWN=[..] OLD_OP=[..]" qatori qarorni ko'rsatadi
 Qaytarish: sudo bash $HERE/rollback.sh   (zaxira: $BK)
════════════════════════════════════════════════════════════════════════════
EOF
