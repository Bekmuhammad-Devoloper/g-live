#!/bin/bash
# GL EDU — o'quv markazlari nusxalarini boshqarish (root). Dev panel `sudo -n gl-center ...` orqali chaqiradi.
# O'rnatish: update-b.sh har deployda /usr/local/sbin/gl-center ga nusxalaydi.
#
# Tuzilma:  /opt/centers/<slug>/{env, env.blank, data/db.sqlite, uploads/, upload-parts/, backups/}
#           systemd: gl-center@<slug>.service (WorkingDirectory=/opt/gl-edu — umumiy build)
#           nginx:   /etc/nginx/sites-available/gl-center-<slug>  (<slug>.germaniya.live)
set -euo pipefail
ROOT=/opt/centers
APP=/opt/gl-edu
MAIN_ENV=$APP/.env
# Markazlar asosiy .env dan faqat shularni meros oladi; qolgan hamma kalit (SIP parollari,
# AMI, TURN, telefoniya kalitlari, AUTH_SECRET ...) env.blank orqali bo'sh qiymat bilan yopiladi.
SHARED_KEYS="NEXT_SERVER_ACTIONS_ENCRYPTION_KEY GEMINI_API_KEY"

die() { echo "XATO: $*" >&2; exit 1; }
slug_ok() { [[ "${1:-}" =~ ^[a-z0-9][a-z0-9-]{1,30}$ ]] || die "noto'g'ri slug: ${1:-}"; [ "$1" != "dev" ] && [ "$1" != "www" ] && [ "$1" != "sip" ] || die "band nom: $1"; }
host_ok() { [[ "${1:-}" =~ ^[a-z0-9.-]{3,80}$ ]] || die "noto'g'ri manzil: ${1:-}"; }
port_ok() { [[ "${1:-}" =~ ^3[0-9]{3}$ ]] || die "noto'g'ri port: ${1:-}"; }

cmd="${1:-}"; shift || true
case "$cmd" in
  blanks)
    # systemd ExecStartPre: asosiy .env kalitlarini bo'sh qiymat bilan yopadigan fayl
    slug_ok "$1"; d=$ROOT/$1; [ -d "$d" ] || die "markaz yo'q"
    tmp=$(mktemp)
    if [ -f "$MAIN_ENV" ]; then
      grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$MAIN_ENV" | tr -d '=' | sort -u | while read -r k; do
        case " $SHARED_KEYS " in *" $k "*) grep -E "^$k=" "$MAIN_ENV" | tail -1 ;; *) echo "$k=" ;; esac
      done > "$tmp"
    fi
    install -m 600 -o deploy -g deploy "$tmp" "$d/env.blank"; rm -f "$tmp"
    ;;
  start|stop|restart|enable|disable)
    slug_ok "$1"
    case "$cmd" in
      enable) systemctl enable --now "gl-center@$1" ;;
      disable) systemctl disable --now "gl-center@$1" ;;
      *) systemctl "$cmd" "gl-center@$1" ;;
    esac
    ;;
  status)
    slug_ok "$1"; systemctl is-active "gl-center@$1" || true
    ;;
  logs)
    slug_ok "$1"; n="${2:-200}"; [[ "$n" =~ ^[0-9]{1,4}$ ]] || n=200
    journalctl -u "gl-center@$1" -n "$n" --no-pager -o short-iso
    ;;
  site)
    # nginx sayt + Let's Encrypt sertifikati
    slug_ok "$1"; port_ok "$2"; host_ok "$3"
    f=/etc/nginx/sites-available/gl-center-$1
    sed -e "s/__HOST__/$3/g" -e "s/__PORT__/$2/g" "$APP/deploy/centers/nginx-center.conf" > "$f"
    ln -sf "$f" "/etc/nginx/sites-enabled/gl-center-$1"
    nginx -t && systemctl reload nginx
    certbot --nginx -d "$3" --non-interactive --agree-tos --redirect --keep-until-expiring 2>&1 | tail -3
    nginx -t && systemctl reload nginx
    ;;
  unsite)
    slug_ok "$1"
    rm -f "/etc/nginx/sites-enabled/gl-center-$1" "/etc/nginx/sites-available/gl-center-$1"
    nginx -t && systemctl reload nginx
    ;;
  dev-site)
    port_ok "$1"; host_ok "$2"
    f=/etc/nginx/sites-available/gl-dev
    sed -e "s/__HOST__/$2/g" -e "s/__PORT__/$1/g" "$APP/deploy/centers/nginx-dev.conf" > "$f"
    ln -sf "$f" /etc/nginx/sites-enabled/gl-dev
    nginx -t && systemctl reload nginx
    certbot --nginx -d "$2" --non-interactive --agree-tos --redirect --keep-until-expiring 2>&1 | tail -3
    nginx -t && systemctl reload nginx
    ;;
  backup)
    # Izchil nusxa (VACUUM INTO) — oxirgi 14 tasi saqlanadi
    slug_ok "$1"; d=$ROOT/$1; [ -f "$d/data/db.sqlite" ] || die "baza yo'q"
    mkdir -p "$d/backups"; out="$d/backups/db-$(date +%Y%m%d-%H%M%S).sqlite"
    sqlite3 "$d/data/db.sqlite" "VACUUM INTO '$out'"
    chown deploy:deploy "$out"; chmod 600 "$out"
    ls -1t "$d"/backups/db-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f
    echo "$out"
    ;;
  backup-all)
    for d in "$ROOT"/*/; do s=$(basename "$d"); [ -f "$d/data/db.sqlite" ] && "$0" backup "$s" >/dev/null || true; done
    echo ok
    ;;
  main-restart)
    # Asosiy markaz (germaniya.live) — litsenziya sanasi o'zgargach
    systemctl restart gl-edu
    ;;
  sysinfo)
    # Dev panel "Server" sahifasi uchun to'liq holat. Satr formati: <tur>|<maydonlar...>
    # Faqat o'qish: bitta qism xatosi (masalan head quvurni yopishi) qolganini to'xtatmasin
    set +e +o pipefail
    . /etc/os-release 2>/dev/null || true
    echo "kv|os|${PRETTY_NAME:-?}"
    echo "kv|kernel|$(uname -r)"
    echo "kv|hostname|$(hostname)"
    echo "kv|ip|$(curl -s -m 3 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
    echo "kv|cpu_model|$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ *//')"
    echo "kv|cpu_cores|$(nproc)"
    echo "kv|load|$(cut -d' ' -f1-3 /proc/loadavg)"
    echo "kv|uptime_s|$(cut -d. -f1 /proc/uptime)"
    echo "kv|node|$(node -v 2>/dev/null)"
    echo "kv|nginx|$(nginx -v 2>&1 | sed 's/.*nginx\///')"
    awk '/^MemTotal/{t=$2} /^MemAvailable/{a=$2} /^SwapTotal/{st=$2} /^SwapFree/{sf=$2} END{print "kv|mem_total|"t*1024"\nkv|mem_available|"a*1024"\nkv|swap_total|"st*1024"\nkv|swap_used|"(st-sf)*1024}' /proc/meminfo
    # CPU band'lik: 1 soniyalik o'lchov
    read -r _ u1 n1 s1 i1 w1 x1 y1 z1 _ < /proc/stat; sleep 1; read -r _ u2 n2 s2 i2 w2 x2 y2 z2 _ < /proc/stat
    t1=$((u1+n1+s1+i1+w1+x1+y1+z1)); t2=$((u2+n2+s2+i2+w2+x2+y2+z2))
    echo "kv|cpu_pct|$(( (100*((t2-t1)-(i2-i1))) / ((t2-t1)>0 ? (t2-t1) : 1) ))"
    df -B1 --output=target,size,used,avail -x tmpfs -x devtmpfs -x overlay -x squashfs -x efivarfs 2>/dev/null | tail -n +2 | awk '{print "disk|"$1"|"$2"|"$3"|"$4}'
    for u in gl-edu gl-ami gl-tunnel gl-cdr.timer gl-dev nginx gl-centers-backup.timer docker certbot.timer; do
      st=$(systemctl is-active "$u" 2>/dev/null || true)
      since=$(systemctl show "$u" -p ActiveEnterTimestamp --value 2>/dev/null)
      mem=$(systemctl show "$u" -p MemoryCurrent --value 2>/dev/null)
      rs=$(systemctl show "$u" -p NRestarts --value 2>/dev/null)
      echo "svc|$u|$st|$since|$mem|$rs"
    done
    for u in $(systemctl list-units --all --plain --no-legend 'gl-center@*' 2>/dev/null | awk '{print $1}'); do
      echo "svc|$u|$(systemctl is-active "$u")|$(systemctl show "$u" -p ActiveEnterTimestamp --value)|$(systemctl show "$u" -p MemoryCurrent --value)|$(systemctl show "$u" -p NRestarts --value)"
    done
    for d in /etc/letsencrypt/live/*/; do
      n=$(basename "$d"); [ -f "$d/cert.pem" ] || continue
      echo "cert|$n|$(openssl x509 -in "$d/cert.pem" -noout -enddate | cut -d= -f2)|$(openssl x509 -in "$d/cert.pem" -noout -ext subjectAltName 2>/dev/null | grep -oE 'DNS:[^,]+' | sed 's/DNS://' | tr '\n' ' ')"
    done
    # Nom oxirida: unda bo'sh joy bo'lishi mumkin ("next-server (v15...)")
    ps -eo pid,%cpu,rss,etimes,args --sort=-rss | tail -n +2 | head -10 | awk '{a=$5; for(i=6;i<=NF&&i<=7;i++) a=a" "$i; print "proc|"$1"|"$2"|"$3*1024"|"$4"|"a}'
    echo "timer|backup|$(systemctl show gl-centers-backup.timer -p LastTriggerUSec --value 2>/dev/null)|$(systemctl show gl-centers-backup.timer -p NextElapseUSecRealtime --value 2>/dev/null)"
    if command -v docker >/dev/null; then docker ps --format 'docker|{{.Names}}|{{.Status}}|{{.Image}}' 2>/dev/null; fi
    ss -tlnH 2>/dev/null | awk '{print $4}' | grep -oE '[0-9]+$' | sort -un | tr '\n' ' ' | sed 's/^/kv|ports|/'; echo
    echo "kv|last_deploy|$(git -C $APP log -1 --format='%h|%cI|%s' 2>/dev/null | tr '|' '~')"
    ;;
  stats)
    # Server holati (Dev panel bosh sahifasi uchun)
    echo "load=$(cut -d' ' -f1-3 /proc/loadavg)"
    free -m | awk '/^Mem:/ {print "mem_total="$2"\nmem_used="$3}'
    df -m / | awk 'NR==2 {print "disk_total="$2"\ndisk_used="$3}'
    echo "uptime=$(uptime -p)"
    ;;
  *)
    die "buyruqlar: blanks|start|stop|restart|enable|disable|status|logs|site|unsite|dev-site|backup|backup-all|main-restart|stats|sysinfo"
    ;;
esac
