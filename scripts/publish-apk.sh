#!/bin/bash
# Yig'ilgan APK ni saytga chiqaradi — SERVERDA ishlatiladi.
#
#   bash /opt/gl-edu/scripts/publish-apk.sh
#
# Nima qiladi:
#   1. scripts/verify-apk.py bilan tekshiradi (versiya oshganmi, imzo
#      o'sha kalitmi, kerakli ruxsat va plaginlar ichidami). Bittasi
#      o'tmasa — chiqarmaydi.
#   2. Hozirgi APK ni zaxiraga oladi (oxirgi 5 tasi saqlanadi).
#   3. Yangisini joyiga qo'yadi.
#   4. Versiyani aapt2 bilan o'qib, yonidagi .version fayliga yozadi —
#      germaniya.live/app sahifasi shu fayldan "2.7.0 (11)" ni ko'rsatadi.
#
# Nega alohida skript: ilgari chiqarish qo'lda `cp` bilan qilinardi va
# versiya fayli yozilmasdi. Sahifada faqat hajm va sana turardi, ular esa
# versiyalar orasida deyarli farq qilmaydi — foydalanuvchi "saytda haliyam
# eskisi" deb o'ylab, yangisini o'rnatmay yurdi.
set -euo pipefail

APK_DIR=/opt/gl-edu/apk
NEW="${1:-$APK_DIR/cap-build/android/app/build/outputs/apk/release/app-release.apk}"
CUR="$APK_DIR/germaniya-live.apk"
VER="$APK_DIR/germaniya-live.apk.version"
AAPT="$HOME/.bubblewrap/android_sdk/build-tools/36.1.0/aapt2"
VERIFY="$(dirname "$0")/verify-apk.py"

[ -f "$NEW" ] || { echo "Yangi APK topilmadi: $NEW"; exit 1; }

echo "══ Tekshiruv ══"
python3 "$VERIFY" "$NEW" "$CUR"

echo "══ Chiqarish ══"
if [ -f "$CUR" ]; then
  cp "$CUR" "$CUR.bak-$(date +%Y%m%d-%H%M)"
  ls -1t "$CUR".bak-* 2>/dev/null | tail -n +6 | xargs -r rm --
fi
cp "$NEW" "$CUR"
chmod 644 "$CUR"

# Versiya: "versionCode='11' versionName='2.7.0'" -> "2.7.0 (11)"
BADGING="$("$AAPT" dump badging "$CUR" 2>/dev/null | head -1)"
CODE="$(printf '%s' "$BADGING" | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p")"
NAME="$(printf '%s' "$BADGING" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")"
if [ -n "$NAME" ] && [ -n "$CODE" ]; then
  printf '%s (%s)\n' "$NAME" "$CODE" > "$VER"
  chmod 644 "$VER"
  echo "versiya: $NAME ($CODE)"
else
  rm -f "$VER"
  echo "⚠ versiya o'qilmadi — sahifa versiyasiz chiqadi"
fi

echo "✅ $(stat -c %s "$CUR") bayt — https://germaniya.live/app"
