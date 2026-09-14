#!/bin/sh
# Backup de la base propia (usuarios, sesiones, auditoría) con pg_dump en formato custom, comprimido.
#   docker/backup.sh                → backups/naps_ccc_<fecha>.dump.gz  (retención: BACKUP_RETENCION_DIAS, default 14)
# Programar en el cron del host, p. ej.:  0 3 * * * cd /opt/naps-ccc && docker/backup.sh >> backups/backup.log 2>&1
# Copiar el directorio backups/ fuera del host (rsync, almacenamiento de objetos); un backup en el mismo disco no es un backup.
set -eu
cd "$(dirname "$0")/.."
DESTINO="${BACKUP_DIR:-backups}"
RETENCION="${BACKUP_RETENCION_DIAS:-14}"
mkdir -p "$DESTINO"
ARCHIVO="$DESTINO/naps_ccc_$(date +%Y-%m-%d_%H%M).dump.gz"

# Se usa el superusuario del contenedor (POSTGRES_USER de .env.db); pg_dump corre dentro del contenedor.
docker compose -f compose.yml exec -T app-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' | gzip > "$ARCHIVO"
test -s "$ARCHIVO" || { echo "[backup] el dump quedó vacío"; rm -f "$ARCHIVO"; exit 1; }
echo "[backup] $(date -Is) $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

find "$DESTINO" -name 'naps_ccc_*.dump.gz' -mtime +"$RETENCION" -print -delete | sed 's/^/[backup] borrado: /'
