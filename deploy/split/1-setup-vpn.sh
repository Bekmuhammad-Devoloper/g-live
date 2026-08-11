#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# 1-BOSQICH: WireGuard VPN (A ↔ B)
#
# A = 89.126.208.123 (telefoniya, Asterisk) → VPN IP 10.99.0.1
# B = ilova serveri                          → VPN IP 10.99.0.2
#
# Ishlatish:
#   A serverda:  sudo bash 1-setup-vpn.sh a  <B_PUBLIC_IP>
#   B serverda:  sudo bash 1-setup-vpn.sh b  89.126.208.123
#
# Har ikki tomonda ishga tushirilgach, kalitlar almashtiriladi (skript
# ko'rsatma beradi). Eski Asterisk/CRM bu tunnelni umuman ko'rmaydi.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

ROLE="${1:?a yoki b}"; PEER_IP="${2:?peer public IP}"
VPN_A="10.99.0.1"; VPN_B="10.99.0.2"; PORT=51820
DIR=/etc/wireguard

apt-get update -qq && apt-get install -y -qq wireguard >/dev/null
mkdir -p $DIR && chmod 700 $DIR

if [ ! -f $DIR/priv.key ]; then
  wg genkey | tee $DIR/priv.key | wg pubkey > $DIR/pub.key
  chmod 600 $DIR/priv.key
fi
MYPRIV=$(cat $DIR/priv.key); MYPUB=$(cat $DIR/pub.key)

if [ "$ROLE" = "a" ]; then MYIP=$VPN_A; PEERVPN=$VPN_B; else MYIP=$VPN_B; PEERVPN=$VPN_A; fi

# Peer kalitini kutamiz (ikkinchi ishga tushirishda beriladi)
PEERPUB="${3:-PEER_PUBLIC_KEY_KEYINROQ}"

cat > $DIR/gl.conf <<EOF
[Interface]
PrivateKey = ${MYPRIV}
Address    = ${MYIP}/24
ListenPort = ${PORT}

[Peer]
PublicKey  = ${PEERPUB}
AllowedIPs = ${PEERVPN}/32
Endpoint   = ${PEER_IP}:${PORT}
PersistentKeepalive = 25
EOF
chmod 600 $DIR/gl.conf

echo "════════════════════════════════════════"
echo "  Rol: ${ROLE^^}   VPN IP: ${MYIP}"
echo "  MENING OCHIQ KALITIM (peer'ga bering):"
echo "  ${MYPUB}"
echo "════════════════════════════════════════"

if [ "$PEERPUB" != "PEER_PUBLIC_KEY_KEYINROQ" ]; then
  systemctl enable --now wg-quick@gl 2>/dev/null || systemctl restart wg-quick@gl
  sleep 2
  echo "  VPN holati:"; wg show gl 2>/dev/null | head -6
  echo "  Peer ping: $(ping -c2 -W2 $PEERVPN >/dev/null 2>&1 && echo '✅ ISHLAYDI' || echo '⏳ peer hali sozlanmagan')"
else
  echo "  ⏳ Peer kaliti hali yo'q. Ikkinchi serverda ham shu skriptni"
  echo "     ishga tushiring, keyin kalit bilan qayta:"
  echo "     sudo bash 1-setup-vpn.sh ${ROLE} ${PEER_IP} <PEER_OCHIQ_KALITI>"
fi
