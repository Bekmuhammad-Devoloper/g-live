#!/bin/bash
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

BADGING="$("$AAPT" dump badging "$CUR" 2>/dev/null || true)"
BADGING="${BADGING%%$'\n'*}"
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
