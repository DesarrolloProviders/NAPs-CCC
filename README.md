# NAPs CCC — consulta de NAPs y disponibilidad (Next.js)

Reemplazo en Next.js 16 de la app PHP de NAPs de CCC. Permite **buscar NAPs por dirección, por coordenadas y radio** (o haciendo click en el mapa),
verlas en lista y mapa, y abrir el detalle con los **puertos en vivo** (sistema de abonados spi40 + estado en la OLT).

**Es una app de solo consulta**: no reserva, libera ni instala puertos — eso se maneja en otro sistema. Lo único que escribe son
usuarios y sesiones en su propia base.

## Arquitectura en una página

| Pieza | Qué es | Dónde |
|---|---|---|
| PostGIS de NAPs | Base `cccqgis`, tabla `nap_con_disponibilidad` (QGIS). **Solo lectura** (`default_transaction_read_only`). | `src/lib/gis/` |
| spi40 | Webservice del sistema de abonados (`webservice.php?request=<base64 JSON>`). Puertos, clientes y ONTs por NAP. | `src/lib/spi40/` |
| OLT | `ftth.tools_box.php?function=ont-data` → estado online por MAC. Lento (7-25 s por ONT): consulta diferida, paralela y con caché. | `src/lib/olt/` |
| Base propia | PostgreSQL 16: usuarios/sesiones (better-auth). Migraciones con Drizzle. Las tablas `reservas`/`reserva_eventos` quedan como archivo histórico, sin uso. | `src/db/`, `drizzle/` |
| Auth | better-auth (email + contraseña, sin registro público), roles `admin` / `usuario` vía plugin admin, cookie `naps.session_token`. | `src/lib/auth/` |
| UI | App Router, Server Components + Server Actions, shadcn/ui (Base UI), Tailwind 4, Leaflet + OpenStreetMap. | `src/app/`, `src/features/` |
| Direcciones | Geocodificación calle+número con Nominatim (OSM) **desde el navegador**, para no depender de que el servidor tenga salida a internet. | `src/lib/geo/geocodificar.ts` |

Regla de estado de un puerto (heredada del legacy `online_ff.php`): **online > ocupado > libre**, calculada solo con lo que
informan spi40 y la OLT.

## Desarrollo

Requisitos: Node 24, Docker Desktop y **acceso a la red interna** (LAN o VPN): la app consulta el servidor PostGIS real, spi40 y la
OLT también en desarrollo. El PostGIS es de **solo lectura** para la app (rol con `GRANT SELECT` + `default_transaction_read_only`),
así que desarrollar contra el servidor real no tiene riesgo; lo único que escribe la app es su base propia (`app-db`, local).

```bash
cp .env.db.example .env.db           # claves del Postgres propio (en dev pueden quedar simples; APP_DATABASE_URL debe coincidir)
docker compose up -d app-db          # Postgres propio en 127.0.0.1:5440 (compose.override.yml)
cp .env.example .env.local           # completar: GIS_DATABASE_URL (host y clave del servidor GIS), spi40/OLT, secretos
npm install
npm run db:migrate
npm run seed:admin                   # crea ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD
npm run dev                          # http://localhost:3110
```

Los puertos 3000, 3100, 5432 y 5433 están ocupados por otros proyectos en esta PC; por eso 3110 / 5440.

Las claves de `.env.db` solo se aplican al **crear** el volumen `app-db-data`: si el volumen ya existe con otras, o se mantienen
las viejas en `.env.db`, o se recrea el volumen (`docker compose down -v` borra usuarios y sesiones locales).

### Scripts útiles

| Comando | Para qué |
|---|---|
| `npm run typecheck` · `npm run lint` · `npm test` | tipos, lint, tests unitarios (vitest) |
| `npm run test:integration` | tests contra el PostGIS real, solo lectura (búsqueda por radio, localidades). Las cantidades esperadas (19 NAPs, 8 puertos) son las de la red real al 2026-09-09 |
| `npm run test:e2e` | Playwright (Chromium) contra el dev server: login, búsqueda (incluye click en el mapa) y detalle |
| `npm run probe:gis -- -26.8419 -65.1622 500` | búsqueda por radio directa contra el GIS (19 NAPs al 2026-09-09) |
| `npm run probe:spi40 -- 22024 303-01-08-N08-1-E` | puertos de una NAP en spi40 (`--save-fixture` guarda la respuesta) |
| `npm run probe:olt -- --nap 303-01-08-N08-1-E` | estado OLT de las ONTs de una NAP |

### Endpoints

- `GET /api/health` → 200/503 según la base propia, sin detalles. `?deep=1` prueba además PostGIS, spi40 y OLT: requiere
  `Authorization: Bearer $HEALTH_TOKEN` o sesión de admin; como máximo una ejecución real por minuto. Detrás de nginx solo
  responde desde redes privadas.
- `GET /api/naps/[idNap]/olt` (estado online por MAC, requiere sesión). `?refresh=1` fuerza la consulta, como máximo una vez cada
  `OLT_REFRESH_MIN_MS` por usuario y NAP (si no, responde `throttled: true` con el último valor).
- `/api/auth/*` (better-auth). Los endpoints de suplantación y borrado del plugin admin están apagados (`disabledPaths`).

## Producción (Docker)

Un solo host con Docker Compose: un frente HTTPS → `app` (Next standalone, publicada solo en `127.0.0.1:APP_PORT`) →
`app-db` (Postgres propio). La app llega al PostGIS real, a spi40 y a la OLT por la red del host (sin redes Docker especiales).
Los usuarios entran desde fuera de la LAN; el navegador solo habla con el frente HTTPS (más tiles de OSM y Nominatim, públicos).
La app no exige HTTPS por sí misma: también funciona por `http://IP:APP_PORT` dentro de la LAN (pruebas, acceso directo); las
cookies pasan a `Secure` cuando `BETTER_AUTH_URL` es `https://`.
Los **certificados los gestiona IT** (certbot en el host, en `/etc/letsencrypt/live/<host>/`, como con el legacy).

El frente HTTPS se elige con `COMPOSE_PROFILES` en `.env`:

| Escenario | `COMPOSE_PROFILES` | Quién termina TLS |
|---|---|---|
| **A. Host dedicado** (nada más escucha en 80/443) | `prod,nginx` | `nginx` del compose (`docker/nginx/naps.conf.template`), certificados desde `TLS_DIR/live/PUBLIC_HOST/` |
| **B. Servidor del legacy** (Apache ya sirve otras apps en 80/443). **Es lo que se entrega a IT: ver `ENTREGA.md`.** | `prod` | el Apache del host, con el vhost `docker/apache/naps-ccc.conf.example` reenviando a `APP_BIND:APP_PORT` (default `127.0.0.1:3110`). nginx no se levanta. |

En ambos la app recibe `X-Forwarded-For` con la IP real (rate limit del login), `X-Forwarded-Proto: https` y el `Host` original.

### Requisitos fuera del repo

| Qué | Quién |
|---|---|
| Docker Engine + Compose v2 y `git` en el host. DNS público `PUBLIC_HOST` → IP del host; firewall/NAT: solo 80 y 443 hacia el host. Egress del host al PostGIS (5432), spi40 y OLT. | IT / Redes |
| Certificado para `PUBLIC_HOST` en `/etc/letsencrypt/live/PUBLIC_HOST/{fullchain,privkey}.pem` (o la ruta que se ponga en `TLS_DIR`). Tras cada renovación: escenario A `docker compose -f compose.yml exec nginx nginx -s reload`; escenario B `systemctl reload apache2`. | IT |
| Rol **solo lectura** en el PostGIS (`GRANT CONNECT, USAGE ON SCHEMA public, SELECT ON nap_con_disponibilidad`; `ALTER ROLE ... SET default_transaction_read_only = on`). Usarlo en `GIS_DATABASE_URL`. | DBA |
| Custodia de secretos (`.env.db`, `.env.docker`) y copia de `backups/` fuera del host. | IT |

### Primer despliegue

```bash
cp .env.compose.example .env          # PUBLIC_HOST, COMPOSE_PROFILES (prod,nginx | prod), APP_PORT; TLS_DIR si no es /etc/letsencrypt
cp .env.db.example .env.db            # contraseñas del Postgres propio (openssl rand -hex 24: sin / + @, van dentro de una URL)
cp .env.docker.example .env.docker    # GIS_DATABASE_URL (rol solo lectura), spi40/OLT, BETTER_AUTH_URL=https://PUBLIC_HOST,
                                      # BETTER_AUTH_SECRET (openssl rand -base64 32), HEALTH_TOKEN, ADMIN_SEED_* (solo esta vez)
chmod 600 .env.db .env.docker
docker/deploy.sh                      # verifica .env* (y el certificado en A) → backup (si hay) → build tagueado con el sha → up -d → healthy → smoke
```

Escenario B, además: instalar el vhost de Apache (instrucciones en la cabecera de `docker/apache/naps-ccc.conf.example`).

Al arrancar, `app` aplica migraciones y, **solo si `ADMIN_SEED_PASSWORD` está definida y el usuario no existe**, crea el admin inicial.
Después del primer login: cambiar la contraseña por la UI, **borrar `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` de `.env.docker`** y
`docker compose -f compose.yml up -d app`. (Para forzar un reset de clave una sola vez: `ADMIN_SEED_FORCE=1`.)

### Probar en la LAN sin DNS ni certificado real (escenario A)

`PUBLIC_HOST=naps.lan`, `TLS_DIR=./docker/nginx/certs` en `.env`, un certificado autofirmado con la misma estructura que certbot,
y una entrada en `hosts`; el navegador avisará, pero las cookies `Secure` funcionan. Si 80/443 están ocupados en esa máquina,
`HTTP_PORT`/`HTTPS_PORT` en `.env` (y `BETTER_AUTH_URL=https://naps.lan:HTTPS_PORT`).

```bash
mkdir -p docker/nginx/certs/live/naps.lan
openssl req -x509 -nodes -newkey rsa:2048 -days 365 -subj "/CN=naps.lan" \
  -keyout docker/nginx/certs/live/naps.lan/privkey.pem -out docker/nginx/certs/live/naps.lan/fullchain.pem
```

### Operación

| Tarea | Cómo |
|---|---|
| Desplegar una versión nueva | `git pull && docker/deploy.sh` |
| Volver a la imagen anterior | `APP_TAG=<sha_anterior> docker compose -f compose.yml up -d app` (se conservan las 3 últimas) |
| Logs | `docker compose -f compose.yml logs -f app nginx` (JSON, rotados por Docker; el `reqId` de la app es el `X-Request-Id` del access log de nginx). En el escenario B el access log es el de Apache. |
| Certificado renovado (IT) | Escenario A: `docker compose -f compose.yml exec nginx nginx -s reload`. Escenario B: `sudo systemctl reload apache2`. |
| Backup | `docker/backup.sh` → `backups/naps_ccc_<fecha>.dump.gz`, retención 14 días. Cron sugerido: `0 3 * * * cd /ruta && docker/backup.sh >> backups/backup.log 2>&1`. **Copiar `backups/` fuera del host.** |
| Ensayar un restore (hacerlo antes de salir a producción) | `RESTORE_DB=naps_ccc_ensayo docker/restore.sh backups/<archivo>` (crear la base antes: `docker compose -f compose.yml exec app-db createdb -U naps -O naps_app naps_ccc_ensayo`) |
| Restore real | `docker/restore.sh backups/<archivo>` (detiene `app`, restaura, la vuelve a iniciar) |
| Salud | `curl -s https://PUBLIC_HOST/api/health` desde la LAN; `curl -s -H "Authorization: Bearer $HEALTH_TOKEN" 'https://PUBLIC_HOST/api/health?deep=1'` |
| Cortar el acceso externo sin tocar datos | Escenario A: `docker compose -f compose.yml stop nginx`. Escenario B: `sudo a2dissite naps-ccc && sudo systemctl reload apache2` |
| Rotar `BETTER_AUTH_SECRET` (cierra todas las sesiones) | cambiarlo en `.env.docker` y `up -d app` |
| Actualizar imágenes base | `docker buildx imagetools inspect node:24-alpine` (ídem postgres/nginx) y reemplazar los digests en `Dockerfile` / `compose.yml` |
| Cambiar dependencias | editar `package.json` y correr `docker/regenerar-lock.sh` (el lock debe generarse en Linux para `npm ci`) |

Las migraciones son solo hacia adelante: nunca editar un SQL ya aplicado; corregir con una migración nueva. `deploy.sh` hace un
backup antes de cada despliegue por si hay que volver atrás.

### Seguridad (resumen de lo que hace la app)

- Cabeceras: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (`next.config.ts`). Sin `X-Powered-By`.
- Sesión en cookie `HttpOnly`/`SameSite=Lax`, y `Secure` cuando `BETTER_AUTH_URL` es `https://` (detrás del proxy con TLS); la caché de cookie dura `AUTH_COOKIE_CACHE_S` (60 s): es lo máximo que un
  usuario dado de baja o degradado conserva el acceso. Cambiar rol o resetear contraseña cierra las sesiones del afectado.
- Rate limit de better-auth por IP real (`X-Forwarded-For` que fija nginx, sin aceptar la del cliente): 10 intentos de login por minuto por IP.
- nginx: TLS 1.2/1.3, sin versión en cabeceras, rechaza el handshake para otros nombres de host, `/api/health` solo desde redes
  privadas, access log sin query string (las búsquedas llevan coordenadas de clientes).
- `?next=` del login solo acepta rutas internas. Las Server Actions devuelven mensajes genéricos; el detalle va al log.
- Contenedor `app`: sin root, rootfs de solo lectura, `cap_drop: ALL`, `no-new-privileges`, límites de CPU/memoria, logs rotados.
- Acciones de administración registradas en la tabla `auditoria`; sesiones vencidas purgadas cada 6 h (`src/instrumentation.ts`).

## Copia local del PostGIS (opcional, para desarrollo con escritura)

Hoy no hace falta: la app solo lee del GIS. Si en el futuro se agregan funciones que **escriban** en el PostGIS (reservas de
puertos, edición de NAPs) o se quiere desarrollar sin red interna, conviene volver a una copia local:

1. La copia vive en el proyecto hermano `../legacy-php` (repo del sistema PHP): servicio `postgis` de su `docker-compose.yml`
   (`postgis/postgis:12-3.0`, contenedor `nap-postgis`), que restaura el dump de `db/postgres/` al crear el volumen y expone
   `localhost:5441`. Para refrescar los datos: reemplazar el dump (`pg_dump` del servidor GIS) y recrear el volumen
   (`docker compose -f ../legacy-php/docker-compose.yml down -v postgis && ... up -d postgis`).
2. Levantarla: `docker compose -f ../legacy-php/docker-compose.yml up -d postgis`.
3. Apuntar la app: en `.env.local`, `GIS_DATABASE_URL=postgres://<usuario del dump>:<clave>@localhost:5441/cccqgis`. Los tests de
   integración y el dev server usan esa variable; nada más cambia.
4. Si además se quiere que la **imagen de producción** corriendo en esta PC use la copia: `docker compose -f compose.yml -f
   compose.override.yml -f compose.local-gis.yml --profile prod up -d app`. Ese archivo une `app` a la red Docker
   `legacy-php_napnet`, donde el contenedor `nap-postgis` tiene la misma IP que el servidor real, así que `.env.docker` no cambia.
5. Si las nuevas funciones escriben, quitar `default_transaction_read_only` de `src/lib/gis/client.ts` y usar un rol con permisos
   de escritura **solo en la copia**; el servidor real debe seguir accediéndose con el rol de solo lectura hasta que la función
   esté probada.

## Decisiones y límites conocidos

- `disponibles` de PostGIS lo sincroniza el legacy en lote (`splitterdipo.php`) y puede estar atrasado: la lista muestra ese valor,
  y el detalle calcula los libres reales con spi40.
- El código de NAP se normaliza para comparar (`303_01_08` ≡ `303-01-08`), pero a spi40 se le envía el código exacto de PostGIS.
- spi40 devuelve nombres con doble codificación (mojibake): el codec los repara.
- Búsqueda por dirección: el campo acepta dirección, coordenadas o link de Google Maps. La dirección se resuelve con Nominatim
  (OSM) desde el navegador, acotada a Tucumán y a la localidad elegida; siempre se muestra qué dirección se resolvió y con qué
  precisión. **Cobertura real (medida 2026-09-11)**: la capital tiene altura casa por casa, el interior suele devolver solo el eje
  de la calle; por eso el punto siempre se puede corregir con un click en el mapa. Para usar otro geocodificador (uno propio o
  pago) basta con `NEXT_PUBLIC_GEOCODER_URL`, sin tocar código. Nominatim público limita a 1 consulta por segundo y prohíbe el
  autocompletado: por eso solo se consulta al apretar Buscar, con caché por consulta.
- Reservas e instalaciones salieron del alcance (se manejan en otro sistema). Las tablas `reservas` / `reserva_eventos` siguen en la
  base con las 643 filas importadas del legacy, declaradas en `src/db/schema/reservas.ts` solo para que Drizzle no las borre.
