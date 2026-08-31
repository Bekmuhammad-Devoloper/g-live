#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# ANDROID ILOVASI (APK) — saytdan yig'iladi
#
#   B serverda:  bash /opt/gl-edu/scripts/build-apk.sh
#
# Ilova TWA (Trusted Web Activity) usulida yig'iladi: bu Android ilovasi
# ichida germaniya.live/student sahifasi ochiladi, lekin brauzer manzil
# qatorisiz — foydalanuvchi uchun oddiy ilova.
#
# Imzo kaliti /opt/gl-edu/apk/android.keystore da turadi va GITGA
# TUSHMAYDI. Kalit yo'qolsa ilovani yangilab bo'lmaydi (foydalanuvchi
# eskisini o'chirib, yangisini o'rnatishi kerak bo'ladi) — shuning uchun
# uni zaxiralab qo'ying.
#
# Bubblewrap kerakli JDK va Android SDK ni O'ZI yuklab oladi (~1.5 GB,
# ~/.bubblewrap ichiga). Tizimga hech narsa o'rnatilmaydi.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR=/opt/gl-edu
WORK=$APP_DIR/apk
TWA=$WORK/twa
HOST=https://germaniya.live
PKG=live.germaniya.app

mkdir -p "$TWA"
cd "$TWA"

# ── Parollar ──
# Birinchi ishga tushirishda tasodifiy parol yaratiladi va shu yerda
# saqlanadi (fayl faqat egasiga o'qiladi).
PASSFILE=$WORK/keystore.pass
if [ ! -f "$PASSFILE" ]; then
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$PASSFILE"
  chmod 600 "$PASSFILE"
  echo "Yangi imzo paroli yaratildi: $PASSFILE"
fi
export BUBBLEWRAP_KEYSTORE_PASSWORD="$(cat "$PASSFILE")"
export BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"

echo "══ 1/4 Bubblewrap ══"
if ! command -v bubblewrap >/dev/null 2>&1; then
  npm i -g @bubblewrap/cli 2>&1 | tail -2
fi

echo "══ 2/4 Sozlama ══"
# twa-manifest.json ni o'zimiz yozamiz — bubblewrap init savol bermasin
cat > "$TWA/twa-manifest.json" <<JSON
{
  "packageId": "$PKG",
  "host": "germaniya.live",
  "name": "Germaniya Live",
  "launcherName": "Germaniya Live",
  "display": "standalone",
  "themeColor": "#0e7490",
  "themeColorDark": "#0b3c4d",
  "navigationColor": "#0e7490",
  "navigationColorDark": "#0b3c4d",
  "navigationDividerColor": "#0e7490",
  "navigationDividerColorDark": "#0b3c4d",
  "backgroundColor": "#e4edf3",
  "enableNotifications": true,
  "startUrl": "/student",
  "iconUrl": "$HOST/icons/icon-512.png",
  "maskableIconUrl": "$HOST/icons/maskable-512.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": { "path": "$WORK/android.keystore", "alias": "gl" },
  "appVersionName": "1.0.0",
  "appVersionCode": $(date +%y%m%d%H),
  "shortcuts": [],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "$HOST/student.webmanifest",
  "fallbackType": "customtabs",
  "features": {},
  "alphaDependencies": { "enabled": false },
  "enableSiteSettingsShortcut": true,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "fullScopeUrl": "$HOST/student",
  "minSdkVersion": 23,
  "orientation": "portrait",
  "fingerprints": [],
  "additionalTrustedOrigins": [],
  "retainedBundles": [],
  "appVersion": "1.0.0"
}
JSON

echo "══ 3/4 Yig'ish ══"
bubblewrap build --skipPwaValidation 2>&1 | tail -25

echo "══ 4/4 Joyiga qo'yish ══"
cp "$TWA/app-release-signed.apk" "$WORK/germaniya-live.apk"
chmod 644 "$WORK/germaniya-live.apk"
ls -la "$WORK/germaniya-live.apk"

# ── Sayt bilan bog'lash uchun barmoq izi ──
# Bu qiymat .env ga ANDROID_CERT_SHA256 nomi bilan yozilishi kerak,
# aks holda ilovada brauzer manzil qatori ko'rinib qoladi.
echo ""
echo "SHA-256 barmoq izi:"
"$HOME"/.bubblewrap/jdk/*/bin/keytool -list -v \
  -keystore "$WORK/android.keystore" -alias gl \
  -storepass "$BUBBLEWRAP_KEYSTORE_PASSWORD" 2>/dev/null \
  | grep -i "SHA256:" | head -1 | sed 's/.*SHA256: *//'

echo ""
echo "✅ Tayyor: $WORK/germaniya-live.apk"
