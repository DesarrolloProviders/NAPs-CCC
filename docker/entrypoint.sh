#!/bin/sh
# Arranque del contenedor: migraciones → admin inicial (solo si hay ADMIN_SEED_PASSWORD) → servidor Next standalone.
set -e
cd /app
echo "[entrypoint] aplicando migraciones..."
node docker/migrate.mjs
if [ -n "$ADMIN_SEED_PASSWORD" ]; then
  echo "[entrypoint] asegurando admin inicial..."
  node docker/seed-admin.mjs
else
  echo "[entrypoint] sin ADMIN_SEED_PASSWORD: se omite el seed del admin"
fi
echo "[entrypoint] iniciando Next.js en :$PORT"
exec node server.js
