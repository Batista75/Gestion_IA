#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

prepare_only=0
if [[ "${1:-}" == "--prepare" ]]; then
  prepare_only=1
fi

missing() {
  echo "PostgreSQL ou les dépendances Node manquent sur cette machine." >&2
  echo "Dans ~/Gestion_IA :" >&2
  echo "  bash scripts/setup-ubuntu.sh" >&2
  exit 1
}

if ! command -v pg_isready >/dev/null 2>&1 || ! command -v pg_ctlcluster >/dev/null 2>&1; then
  missing
fi

if [[ ! -x node_modules/.bin/next || ! -x node_modules/.bin/prisma ]]; then
  missing
fi

if ! pg_isready -h 127.0.0.1 -p 5432 -q; then
  pg_version="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -n 1 || true)"
  if [[ -z "$pg_version" ]]; then
    missing
  fi
  sudo pg_ctlcluster "$pg_version" main start
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

db_user="$(id -un)"
if [[ ! "$db_user" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "Le compte Unix « $db_user » ne peut pas servir de rôle PostgreSQL." >&2
  exit 1
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${db_user}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE \"${db_user}\" WITH LOGIN SUPERUSER PASSWORD 'gestion_ia_local';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE \"${db_user}\" WITH LOGIN SUPERUSER PASSWORD 'gestion_ia_local';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'gestion_ia'" | grep -q 1; then
  sudo -u postgres createdb -O "$db_user" gestion_ia
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

database_url="postgresql://${db_user}:gestion_ia_local@127.0.0.1:5432/gestion_ia"
if grep -q '^DATABASE_URL=' .env; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${database_url}\"|" .env
else
  printf 'DATABASE_URL="%s"\n' "$database_url" >> .env
fi

npx prisma migrate deploy
npx prisma generate

if [[ "$prepare_only" -eq 1 ]]; then
  echo "PostgreSQL est prêt et les migrations sont appliquées."
  exit 0
fi

if (echo >/dev/tcp/127.0.0.1/3847) >/dev/null 2>&1; then
  echo "L’interface écoute déjà sur le port 3847."
  exit 0
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3847
