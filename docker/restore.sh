#!/bin/sh
# Restaura un dump de docker/backup.sh sobre la base propia.
#   docker/restore.sh backups/naps_ccc_2026-09-12_0300.dump.gz            → restaura en naps_ccc (PARA la app antes)
#   RESTORE_DB=naps_ccc_ensayo docker/restore.sh backups/naps_ccc_....dump.gz → ensayo en otra base (crearla antes con createdb)
# Ensayar un restore al menos una vez antes de salir a producción y anotarlo en el README.
set -eu
cd "$(dirname "$0")/.."
ARCHIVO="${1:?Uso: docker/restore.sh <archivo.dump.gz>}"
test -f "$ARCHIVO" || { echo "[restore] no existe $ARCHIVO"; exit 1; }
DB="${RESTORE_DB:-naps_ccc}"

if [ "$DB" = "naps_ccc" ]; then
  echo "[restore] ATENCIÓN: va a reemplazar el contenido de la base de producción '$DB'."
  echo "[restore] Deteniendo la app para que no haya conexiones abiertas..."
  docker compose -f compose.yml stop app
fi

# --clean --if-exists: reemplaza los objetos existentes. La base destino debe existir.
gunzip -c "$ARCHIVO" | docker compose -f compose.yml exec -T app-db sh -c "pg_restore -U \"\$POSTGRES_USER\" -d '$DB' --clean --if-exists --no-owner --role=naps_app"
echo "[restore] restaurado $ARCHIVO en $DB"

if [ "$DB" = "naps_ccc" ]; then
  docker compose -f compose.yml --profile prod start app
  echo "[restore] app iniciada"
fi
