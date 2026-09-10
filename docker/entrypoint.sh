#!/bin/sh
# Arranque del contenedor: migraciones → admin inicial (idempotente) → servidor Next standalone.
set -e
cd /app
echo "[entrypoint] aplicando migraciones..."
node docker/migrate.mjs
echo "[entrypoint] asegurando admin inicial..."
node docker/seed-admin.mjs
echo "[entrypoint] iniciando Next.js en :$PORT"
exec node server.js
