#!/bin/sh
# Despliegue en el host de producción:
#   1. backup de la base propia (por si una migración sale mal)
#   2. build de la imagen tagueada con el sha de git (APP_TAG) → permite volver atrás con la imagen anterior
#   3. up -d y espera a que el contenedor esté healthy
#   4. smoke test (app por loopback y, si corresponde, nginx)
# Los servicios que se levantan salen de COMPOSE_PROFILES en .env: "prod,nginx" (nginx hace de frente HTTPS) o "prod"
# (el Apache/otro proxy del host reenvía a 127.0.0.1:APP_PORT; ver docker/apache/naps-ccc.conf.example).
# Rollback a la imagen anterior:  APP_TAG=<sha_anterior> docker compose -f compose.yml up -d app
set -eu
cd "$(dirname "$0")/.."

APP_TAG="${APP_TAG:-$(git rev-parse --short HEAD)}"
export APP_TAG
if [ -n "$(git status --porcelain)" ]; then
  echo "[deploy] ATENCIÓN: hay cambios sin commitear; la imagen $APP_TAG no coincide exactamente con el commit."
fi
for f in .env .env.db .env.docker; do
  test -f "$f" || { echo "[deploy] falta $f (ver ${f}.example)"; exit 1; }
done

leer() { sed -n "s/^$1=//p" .env | tail -1; }
PUBLIC_HOST="$(leer PUBLIC_HOST)"
test -n "$PUBLIC_HOST" || { echo "[deploy] PUBLIC_HOST no está definido en .env (hostname público)"; exit 1; }
COMPOSE_PROFILES="$(leer COMPOSE_PROFILES)"
test -n "$COMPOSE_PROFILES" || { echo "[deploy] COMPOSE_PROFILES no está definido en .env (prod,nginx | prod)"; exit 1; }
export COMPOSE_PROFILES
APP_PORT="$(leer APP_PORT)"; APP_PORT="${APP_PORT:-3110}"
HTTPS_PORT="$(leer HTTPS_PORT)"; HTTPS_PORT="${HTTPS_PORT:-443}"
case ",$COMPOSE_PROFILES," in *,nginx,*) CON_NGINX=1 ;; *) CON_NGINX=0 ;; esac

if [ "$CON_NGINX" = 1 ]; then
  TLS_DIR="$(leer TLS_DIR)"; TLS_DIR="${TLS_DIR:-/etc/letsencrypt}"
  for f in fullchain.pem privkey.pem; do
    test -r "$TLS_DIR/live/$PUBLIC_HOST/$f" || {
      echo "[deploy] falta $TLS_DIR/live/$PUBLIC_HOST/$f (certificado, lo provee IT; para la LAN uno autofirmado, ver README)"; exit 1; }
  done
else
  echo "[deploy] sin nginx: el proxy del host debe reenviar https://$PUBLIC_HOST → http://127.0.0.1:$APP_PORT"
fi

echo "[deploy] backup previo..."
docker compose -f compose.yml ps --status running app-db >/dev/null 2>&1 && docker/backup.sh || echo "[deploy] app-db no está corriendo: sin backup previo (primer despliegue)"

echo "[deploy] build naps-ccc-app:$APP_TAG ..."
docker compose -f compose.yml build --pull app

echo "[deploy] up ($COMPOSE_PROFILES) ..."
docker compose -f compose.yml up -d

echo "[deploy] esperando healthcheck de app ..."
estado=desconocido
for i in $(seq 1 30); do
  estado="$(docker inspect --format '{{.State.Health.Status}}' naps-ccc-app 2>/dev/null || echo desconocido)"
  [ "$estado" = "healthy" ] && break
  sleep 5
done
if [ "$estado" != "healthy" ]; then
  echo "[deploy] la app no quedó healthy ($estado). Logs:"
  docker compose -f compose.yml logs --tail 50 app
  exit 1
fi

echo "[deploy] smoke test: app en 127.0.0.1:$APP_PORT ..."
docker compose -f compose.yml exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(t=>{console.log(t);process.exit(t.includes('\"ok\"')?0:1)}).catch(e=>{console.error(e.message);process.exit(1)})"
if [ "$CON_NGINX" = 1 ]; then
  echo "[deploy] smoke test: nginx ..."
  docker compose -f compose.yml exec -T nginx nginx -t
  if command -v curl >/dev/null 2>&1; then
    curl -sk --max-time 10 --resolve "$PUBLIC_HOST:$HTTPS_PORT:127.0.0.1" "https://$PUBLIC_HOST:$HTTPS_PORT/api/health" && echo
  else
    echo "[deploy] (sin curl en el host: probar a mano https://$PUBLIC_HOST/api/health desde la LAN)"
  fi
fi
echo "[deploy] OK: naps-ccc-app:$APP_TAG desplegada"

# Limpieza: conservar las 3 imágenes más recientes de la app.
docker images naps-ccc-app --format '{{.Tag}} {{.CreatedAt}}' | grep -v '^local ' | sort -k2 -r | awk 'NR>3 {print $1}' \
  | xargs -r -n1 -I{} docker rmi "naps-ccc-app:{}" >/dev/null 2>&1 || true
