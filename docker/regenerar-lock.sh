#!/bin/sh
# Regenera package-lock.json dentro de Linux para que incluya las dependencias opcionales de esa plataforma
# (un lock generado en Windows las omite y rompe `npm ci` en el Dockerfile). Correr tras cambiar package.json.
set -eu
cd "$(dirname "$0")/.."
docker run --rm -v "$(pwd):/w" -w /w node:24-alpine sh -c "npm install --package-lock-only --no-audit --no-fund --ignore-scripts"
echo "[lock] package-lock.json regenerado; revisar el diff y commitear"
