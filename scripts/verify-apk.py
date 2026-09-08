# Chiqarishdan oldingi tekshiruv: yangi APK eski ilova ustiga o'rnatiladimi
# va ichida kerakli narsalar bormi.
#
#   python3 verify-apk.py <yangi.apk> <hozir_chiqarilgan.apk>
#
# Versiya TENGLIGI emas, OSHGANI tekshiriladi: Android versionCode kichik
# yoki teng bo'lsa o'rnatishdan bosh tortadi.
import sys, zipfile, struct, subprocess, re, os

NEW = sys.argv[1] if len(sys.argv) > 1 else "/opt/gl-edu/apk/cap-build/android/app/build/outputs/apk/release/app-release.apk"
CUR = sys.argv[2] if len(sys.argv) > 2 else "/opt/gl-edu/apk/germaniya-live.apk"
BT = "/home/uzbekmen94/.bubblewrap/android_sdk/build-tools/36.1.0"
AAPT, SIGNER = BT + "/aapt2", BT + "/apksigner"
EXPECTED_SIG = "2a2ffe32b1dabe162698f12f0637caaf99e5d48a5c52e045e89955d7680ef34c"

ok = True
def check(name, cond, detail=""):
    global ok
    print(("OK  " if cond else "XATO") + "  " + name + ("  " + detail if detail else ""))
    if not cond: ok = False

def version(path):
    out = subprocess.run([AAPT, "dump", "badging", path], capture_output=True, text=True).stdout
    m = re.search(r"versionCode='(\d+)' versionName='([^']+)'", out)
    return (int(m.group(1)), m.group(2)) if m else (None, None)

nc, nn = version(NEW)
cc, cn = version(CUR) if os.path.exists(CUR) else (None, None)
check("versiya oshgan", nc is not None and (cc is None or nc > cc),
      f"{cn or '-'} (kod {cc or '-'})  ->  {nn} (kod {nc})")

env = {"PATH": "/opt/gl-edu/apk/jdk21/bin:/usr/bin:/bin"}
sig = subprocess.run([SIGNER, "verify", "--print-certs", NEW], capture_output=True, text=True, env=env).stdout
m = re.search(r"SHA-256 digest: ([0-9a-f]+)", sig)
check("imzo o'sha kalit", bool(m) and m.group(1) == EXPECTED_SIG, m.group(1)[:20] + "..." if m else "topilmadi")

z = zipfile.ZipFile(NEW)
names = z.namelist()
check("ScreenGuard klassi", any(n.endswith(".dex") and b"ScreenGuard" in z.read(n) for n in names))

perms = subprocess.run([AAPT, "dump", "permissions", NEW], capture_output=True, text=True).stdout
for need in ("INTERNET", "RECORD_AUDIO"):
    check(f"ruxsat {need}", need in perms)

res = subprocess.run([AAPT, "dump", "resources", NEW], capture_output=True, text=True).stdout
m = re.search(r"mipmap/ic_launcher\n(?:.*\n){0,12}?.*\(anydpi-v26\) \(file\) (res/[^ ]+\.xml)", res)
xml = subprocess.run([AAPT, "dump", "xmltree", NEW, "--file", m.group(1)], capture_output=True, text=True).stdout if m else ""
check("adaptiv ikonka inset siz", bool(m) and "inset" not in xml and "adaptive-icon" in xml)

m = re.search(r"mipmap/ic_launcher_foreground\n(?:.*\n){0,12}?.*\(xxxhdpi\) \(file\) (res/[^ ]+\.png)", res)
if m:
    w, h = struct.unpack(">II", z.read(m.group(1))[16:24])
    check("xxxhdpi qatlam 432px", (w, h) == (432, 432), f"{w}x{h}")
else:
    check("xxxhdpi qatlam", False, "topilmadi")

sys.exit(0 if ok else 1)
