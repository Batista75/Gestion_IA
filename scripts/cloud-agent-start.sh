#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

prepare_only=0
if [[ "${1:-}" == "--prepare" ]]; then
  prepare_only=1
fi

if ! pg_isready -h 127.0.0.1 -p 5432 -q; then
  sudo pg_ctlcluster 16 main start
fi

ready=0
for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p 5432 -q; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "PostgreSQL n’accepte pas les connexions sur 127.0.0.1:5432." >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ubuntu') THEN
    CREATE ROLE ubuntu WITH LOGIN SUPERUSER PASSWORD 'gestion_ia_local';
  ELSE
    ALTER ROLE ubuntu WITH LOGIN SUPERUSER PASSWORD 'gestion_ia_local';
  END IF;
END
$$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'gestion_ia'" | grep -q 1; then
  sudo -u postgres createdb -O ubuntu gestion_ia
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

npx prisma migrate deploy

if [[ "$prepare_only" -eq 1 ]]; then
  echo "PostgreSQL est prêt et les migrations sont appliquées."
  exit 0
fi

if (echo >/dev/tcp/127.0.0.1/3847) >/dev/null 2>&1; then
  echo "L’interface écoute déjà sur le port 3847."
  exit 0
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3847
