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
  stats)
    # Server holati (Dev panel bosh sahifasi uchun)
    echo "load=$(cut -d' ' -f1-3 /proc/loadavg)"
    free -m | awk '/^Mem:/ {print "mem_total="$2"\nmem_used="$3}'
    df -m / | awk 'NR==2 {print "disk_total="$2"\ndisk_used="$3}'
    echo "uptime=$(uptime -p)"
    ;;
  *)
    die "buyruqlar: blanks|start|stop|restart|enable|disable|status|logs|site|unsite|dev-site|backup|backup-all|main-restart|stats"
    ;;
esac
