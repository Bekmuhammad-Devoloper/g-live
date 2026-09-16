#!/usr/bin/env bash
# Sxema ↔ migratsiyalar mosligi (CI qo'riqchisi). `db push` prod'da yo'q: har sxema o'zgarishi migratsiya fayli bilan kelishi shart.
#   prisma/migrations (baseline + core + keyingilar) → sxema bilan farq bo'lsa FAIL va yo'riqnoma.
set -euo pipefail
cd "$(dirname "$0")/../.."
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
export DATABASE_URL="file:$W/shadow.db"
OUT=$(npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "file:$W/shadow2.db" --script 2>/dev/null || true)
if echo "$OUT" | grep -q "empty migration"; then
  echo "✓ migratsiyalar sxemaga mos ($(ls prisma/migrations | grep -c '^[0-9]') ta migratsiya)"
  exit 0
fi
echo "✗ prisma/schema.prisma o'zgargan, lekin migratsiya fayli yo'q. Kerakli SQL:"
echo "$OUT" | head -40
echo
echo "Yo'riqnoma: npx prisma migrate dev --name <tavsif>  →  SQL'ni ko'rib chiqing  →  commit. (db push prod'da ishlatilmaydi.)"
exit 1
