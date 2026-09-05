#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# ANDROID ILOVASI (APK) — saytdan yig'iladi
#
#   B serverda:  bash /opt/gl-edu/scripts/build-apk.sh
#
# Ilova TWA (Trusted Web Activity) usulida: Android ilovasi ichida
# germaniya.live/student ochiladi, lekin brauzer manzil qatorisiz.
# Sayt yangilansa ilova ham yangilanadi — APK ni qayta tarqatish shart
# emas. APK ni faqat ilova nomi/ikonkasi yoki manzili o'zgarsa qayta
# yig'ish kerak.
#
# DIQQAT: ikonka APK ichiga YIG'ISH PAYTIDA joylanadi. Ikonka o'zgarganda
# shu skriptni qayta ishga tushirish VA appVersionCode ni oshirish kerak,
# aks holda telefon eski nusxani yangilanish deb bilmaydi.
# 1.1.0 / code 2 — ilova ikonkasi wordmark'dan "G + burgut" monogrammasiga
# almashtirildi (2026-09-04).
#
# Imzo kaliti: /opt/gl-edu/apk/android.keystore (gitga TUSHMAYDI).
# Kalit yo'qolsa ilovani yangilab bo'lmaydi — ZAXIRALAB QO'YING:
#   scp uzbekmen94@SERVER:/opt/gl-edu/apk/android.keystore .
#   scp uzbekmen94@SERVER:/opt/gl-edu/apk/keystore.pass .
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

# Yo'llar sozlanadigan: xuddi shu skript ham B SERVERDA, ham GITHUB ACTIONS
# runner'ida ishlaydi (ikkalasi ham Linux). Shu sabab yig'ish mantig'i bitta
# joyda qoladi — ikki xil nusxa vaqt o'tib bir-biridan uzilib ketmaydi.
BW="${BW_HOME:-$HOME/.bubblewrap}"
WORK="${APK_WORK:-/opt/gl-edu/apk}"
ENV_FILE="${GL_ENV:-/opt/gl-edu/.env}"
TWA="$WORK/twa"
HOST=https://germaniya.live
PKG=live.germaniya.app

JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.11_9.tar.gz"
SDK_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
BUILD_TOOLS="36.1.0"   # bubblewrap shu versiyani talab qiladi
PLATFORM="android-36"

mkdir -p "$BW" "$TWA"

# ── 1. JDK ──
if [ ! -x "$BW/jdk/bin/java" ]; then
  echo "══ JDK 17 ══"
  curl -fsSL -o "$BW/jdk.tar.gz" "$JDK_URL"
  rm -rf "$BW/jdk" "$BW/jdk-x" && mkdir "$BW/jdk-x"
  tar xzf "$BW/jdk.tar.gz" -C "$BW/jdk-x"
  mv "$BW"/jdk-x/* "$BW/jdk"
  rm -rf "$BW/jdk-x" "$BW/jdk.tar.gz"
fi
export JAVA_HOME="$BW/jdk"
export PATH="$JAVA_HOME/bin:$PATH"

# ── 2. Android SDK ──
# Diqqat: bubblewrap cmdline-tools ni SDK ILDIZIDA (bin/, lib/) kutadi,
# sdkmanager esa cmdline-tools/latest/ ichida bo'lishini talab qiladi.
# Shu sabab ikkalasi ham bo'lishi uchun ildizga havola qo'yamiz.
if [ ! -x "$BW/android_sdk/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "══ Android cmdline-tools ══"
  curl -fsSL -o "$BW/cmdtools.zip" "$SDK_URL"
  rm -rf "$BW/cmd-x" && mkdir "$BW/cmd-x"
  ( cd "$BW/cmd-x" && "$JAVA_HOME/bin/jar" xf "$BW/cmdtools.zip" )
  mkdir -p "$BW/android_sdk/cmdline-tools"
  rm -rf "$BW/android_sdk/cmdline-tools/latest"
  mv "$BW/cmd-x/cmdline-tools" "$BW/android_sdk/cmdline-tools/latest"
  chmod +x "$BW/android_sdk/cmdline-tools/latest/bin/"*
  rm -rf "$BW/cmd-x" "$BW/cmdtools.zip"
fi
ln -sfn cmdline-tools/latest/bin "$BW/android_sdk/bin"
ln -sfn cmdline-tools/latest/lib "$BW/android_sdk/lib"
export ANDROID_HOME="$BW/android_sdk"

SDKMAN="$BW/android_sdk/cmdline-tools/latest/bin/sdkmanager"

# Litsenziyalar ALOHIDA qabul qilinadi va bu qadamning holati e'tiborga
# olinmaydi. Sabab: `yes` sdkmanager tugagach SIGPIPE olib 141 qaytaradi,
# `set -o pipefail` esa shuni butun skriptning xatosi deb biladi. Serverda
# litsenziyalar allaqachon qabul qilinganidan bu sezilmasdi, toza runner'da
# esa har safar shu yerda yiqilardi.
echo "══ SDK litsenziyalari ══"
yes 2>/dev/null | "$SDKMAN" --sdk_root="$BW/android_sdk" --licenses > /dev/null 2>&1 || true

# Paket o'rnatishning xatosi esa YASHIRILMAYDI — paketsiz build baribir
# yiqiladi, lekin tushunarsiz joyda. Jurnal faylga yozilib, xato bo'lsa
# oxirgi qatorlari ko'rsatiladi (sdkmanager chiqishi juda uzun).
echo "══ SDK paketlari ══"
if ! "$SDKMAN" --sdk_root="$BW/android_sdk" \
      "platform-tools" "build-tools;$BUILD_TOOLS" "platforms;$PLATFORM" > "$WORK/sdk.log" 2>&1; then
  echo "sdkmanager yiqildi:"
  tail -25 "$WORK/sdk.log"
  exit 1
fi
tail -2 "$WORK/sdk.log" | tr -d '\r' 

# Bubblewrap konfiguratsiyani QAT'IY $HOME/.bubblewrap/config.json dan
# o'qiydi. Serverda BW ham o'sha papka bo'lgani uchun bu sezilmasdi; BW_HOME
# boshqa joyga qo'yilganda esa konfig topilmay, bubblewrap "JDK o'rnataymi?"
# deb interaktiv savol berardi va CI shu yerda muzlab qolardi.
mkdir -p "$HOME/.bubblewrap"
cat > "$HOME/.bubblewrap/config.json" <<JSON
{ "jdkPath": "$BW/jdk", "androidSdkPath": "$BW/android_sdk" }
JSON

# ── 3. Imzo kaliti ──
if [ ! -f "$WORK/keystore.pass" ]; then
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$WORK/keystore.pass"
  chmod 600 "$WORK/keystore.pass"
fi
PASS="$(cat "$WORK/keystore.pass")"
export BUBBLEWRAP_KEYSTORE_PASSWORD="$PASS"
export BUBBLEWRAP_KEY_PASSWORD="$PASS"

if [ ! -f "$WORK/android.keystore" ]; then
  echo "══ Yangi imzo kaliti ══"
  "$JAVA_HOME/bin/keytool" -genkeypair -v \
    -keystore "$WORK/android.keystore" -alias gl \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Germaniya Live, OU=IT, O=Germaniya Live, L=Tashkent, C=UZ"
  chmod 600 "$WORK/android.keystore"
fi

# ── 4. Loyiha sozlamasi ──
cd "$TWA"
# Qamrov (fullScopeUrl) ATAYLAB butun sayt — "$HOST/student" EMAS.
# Qamrovdan tashqaridagi sahifani Android brauzer oynasida, manzil qatori
# bilan ochadi. Ilova /student ga kiradi, seans tugagan bo'lsa u /login ga
# yo'naltiradi — ya'ni ENG BIRINCHI ekran qamrovdan tashqarida qolib,
# ilova brauzerdek ko'rinardi. /logout va /uploads ham shunday.
cat > twa-manifest.json <<JSON
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
  "enableNotifications": false,
  "startUrl": "/student",
  "iconUrl": "$HOST/icons/icon-512.png",
  "maskableIconUrl": "$HOST/icons/maskable-512.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": { "path": "$WORK/android.keystore", "alias": "gl" },
  "appVersionName": "1.2.0",
  "appVersionCode": 3,
  "shortcuts": [],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "$HOST/student.webmanifest",
  "fallbackType": "customtabs",
  "features": {},
  "alphaDependencies": { "enabled": false },
  "enableSiteSettingsShortcut": true,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "fullScopeUrl": "$HOST/",
  "minSdkVersion": 23,
  "orientation": "portrait",
  "fingerprints": [],
  "additionalTrustedOrigins": [],
  "retainedBundles": [],
  "appVersion": "1.2.0"
}
JSON

echo "══ Yig'ish ══"
npx -y @bubblewrap/cli@latest update --skipVersionUpgrade 2>&1 | tr -d '\r' | tail -3
npx -y @bubblewrap/cli@latest build --skipPwaValidation 2>&1 | tr -d '\r' | tail -6

# ── 5. Joyiga qo'yish ──
cp "$TWA/app-release-signed.apk" "$WORK/germaniya-live.apk"
chmod 644 "$WORK/germaniya-live.apk"
ls -la "$WORK/germaniya-live.apk"

# ── 6. Sayt bilan bog'lash ──
# Barmoq izi .env dagi ANDROID_CERT_SHA256 bilan bir xil bo'lishi SHART,
# aks holda ilovada brauzer manzil qatori ko'rinib qoladi.
FP=$("$JAVA_HOME/bin/keytool" -list -v -keystore "$WORK/android.keystore" -alias gl \
  -storepass "$PASS" 2>/dev/null | grep -i "SHA256:" | head -1 | sed 's/.*SHA256: *//' | tr -d ' \r')
echo ""
echo "SHA-256: $FP"
if grep -q "ANDROID_CERT_SHA256=$FP" "$ENV_FILE" 2>/dev/null; then
  echo ".env allaqachon to'g'ri"
else
  echo "⚠️  .env ga yozing va servisni qayta ishga tushiring:"
  echo "    ANDROID_PACKAGE=$PKG"
  echo "    ANDROID_CERT_SHA256=$FP"
  echo "    sudo systemctl restart gl-edu"
fi

echo ""
echo "✅ Tayyor: $HOST/api/app/android"
