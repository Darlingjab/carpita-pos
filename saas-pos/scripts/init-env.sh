#!/usr/bin/env bash
# Crea .env.local desde .env.example y abre Supabase para pegar las claves.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  echo "Ya existe .env.local — no lo sobrescribo."
  echo "Edita ese archivo y rellena las variables que falten (ver .env.example)."
else
  cp .env.example .env.local
  echo "Creado .env.local a partir de .env.example. Completá las claves de Supabase."
fi

echo ""
echo "En Supabase → Project settings → API:"
echo "  Project URL     → NEXT_PUBLIC_SUPABASE_URL"
echo "  anon public     → NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  service_role    → SUPABASE_SERVICE_ROLE_KEY (solo servidor; nunca en el cliente)"
echo ""

if command -v open >/dev/null 2>&1; then
  open "https://supabase.com/dashboard/projects"
fi
