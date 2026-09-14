# NAPs CCC — guía de entrega para IT

Este documento es para quien va a instalar y operar la app en el servidor. El detalle técnico está en el [README](README.md);
acá está solo lo que hay que hacer, en orden.

## Qué se entrega

- Una aplicación web de **solo consulta** de NAPs (reemplaza el buscador `qgis/buscar_naps.php` del sistema PHP). Busca NAPs
  por dirección, coordenadas o click en el mapa, y muestra los puertos de cada NAP en vivo (spi40 + estado en la OLT).
- Corre **100 % en Docker**: `app` (Node/Next.js) + `app-db` (PostgreSQL propio, solo usuarios y sesiones) y, opcionalmente,
  `nginx` como frente HTTPS. No instala nada en el host fuera de Docker.
- **Solo lee** el PostGIS de NAPs (`cccqgis`), spi40 y la OLT. No escribe en ninguna base existente.
- Usuarios con email y contraseña; un `admin` los crea desde la UI. No hay registro público.

## Lo que necesita el servidor (lab-CCC-NAPs u otro)

| Requisito | Detalle |
|---|---|
| Docker Engine + Compose v2 | `docker compose version` debe responder. Instalación oficial: https://docs.docker.com/engine/install/ |
| `git` | para clonar y actualizar el repo |
| Red | el host debe llegar al PostGIS (`192.168.100.212:5432`), a spi40 y a la OLT (`192.168.43.100`), como el legacy. Entrada desde internet: solo 80 y 443. |
| DNS | un nombre público (`PUBLIC_HOST`) apuntando al host. Puede ser uno de los existentes (`nap.providers.com.ar`) si se retira el vhost legacy de ese nombre. |
| Certificado | `/etc/letsencrypt/live/PUBLIC_HOST/{fullchain,privkey}.pem`, como los actuales. Lo emite y renueva IT con certbot. |
| Rol de solo lectura en el PostGIS | ver "Requisitos fuera del repo" en el README (SQL exacto). Hasta que exista, la app fuerza solo lectura desde su lado. |

## Elegir el frente HTTPS

**Escenario B — el servidor del legacy, con Apache sirviendo otras apps en 80/443 (lo esperado en lab-CCC-NAPs):**
Apache sigue siendo el único que escucha en 80/443 y reenvía `https://PUBLIC_HOST` a la app en `127.0.0.1:3110`. Se usa el
vhost `docker/apache/naps-ccc.conf.example` (los módulos `proxy`, `proxy_http`, `headers`, `ssl`, `rewrite` ya están habilitados
en ese servidor). En `.env`: `COMPOSE_PROFILES=prod`.

**Escenario A — host dedicado, sin otro servidor web:** el `nginx` del compose ocupa 80/443 y lee el certificado de
`/etc/letsencrypt`. En `.env`: `COMPOSE_PROFILES=prod,nginx`.

## Instalación (una vez)

```bash
sudo mkdir -p /opt/naps-ccc && sudo chown "$USER" /opt/naps-ccc
git clone <URL del repo> /opt/naps-ccc && cd /opt/naps-ccc

cp .env.compose.example .env        # PUBLIC_HOST, COMPOSE_PROFILES (prod | prod,nginx), APP_PORT=3110
cp .env.db.example .env.db          # dos contraseñas: openssl rand -base64 24
cp .env.docker.example .env.docker  # ver abajo qué completar
chmod 600 .env.db .env.docker
```

En `.env.docker` completar:

| Variable | Valor |
|---|---|
| `APP_DATABASE_URL` | `postgres://naps_app:<NAPS_APP_PASSWORD de .env.db>@app-db:5432/naps_ccc` |
| `GIS_DATABASE_URL` | `postgres://<rol solo lectura>:<clave>@192.168.100.212:5432/cccqgis` |
| `SPI40_BASE_URL` · `OLT_BASE_URL` | las URLs internas de spi40 y de `ftth.tools_box.php` (las mismas que usa el legacy) |
| `BETTER_AUTH_URL` | `https://PUBLIC_HOST` (exactamente como entran los usuarios) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `HEALTH_TOKEN` | `openssl rand -hex 32` (para el monitoreo profundo) |
| `ADMIN_SEED_EMAIL` · `ADMIN_SEED_PASSWORD` | el primer administrador; **borrar las dos líneas después del primer login** |

Escenario B, además:

```bash
sudo cp docker/apache/naps-ccc.conf.example /etc/apache2/sites-available/naps-ccc.conf
sudo nano /etc/apache2/sites-available/naps-ccc.conf     # ServerName y rutas del certificado
sudo a2ensite naps-ccc && sudo apachectl configtest && sudo systemctl reload apache2
```

Desplegar:

```bash
docker/deploy.sh
```

El script verifica los archivos de entorno (y el certificado en el escenario A), hace backup de la base propia si ya existe,
construye la imagen etiquetada con el commit, levanta los servicios, espera el healthcheck y hace un smoke test. Al arrancar,
la app aplica sus migraciones y crea el administrador inicial.

## Verificar

1. `https://PUBLIC_HOST/login` abre con candado válido.
2. Entrar con el admin inicial → `/buscar` muestra el mapa; buscar `-26.8419, -65.1622` con radio 500 devuelve NAPs.
3. Abrir una NAP: la tabla de puertos carga (spi40) y en menos de un minuto aparece el estado online (OLT).
4. Desde la LAN: `curl -s -H "Authorization: Bearer $HEALTH_TOKEN" 'https://PUBLIC_HOST/api/health?deep=1'` → `"status":"ok"`
   para `appDb`, `gis`, `spi40` y `olt`.
5. Cerrar el arranque: cambiar la contraseña del admin desde la UI, crear los usuarios reales, borrar `ADMIN_SEED_*` de
   `.env.docker` y `docker compose -f compose.yml up -d app`.

## Operar

| Tarea | Comando (desde `/opt/naps-ccc`) |
|---|---|
| Actualizar a una versión nueva | `git pull && docker/deploy.sh` |
| Volver a la anterior | `APP_TAG=<sha> docker compose -f compose.yml up -d app` (quedan las 3 últimas imágenes) |
| Logs | `docker compose -f compose.yml logs -f app` |
| Backup diario (cron) | `0 3 * * * cd /opt/naps-ccc && docker/backup.sh >> backups/backup.log 2>&1` y copiar `backups/` fuera del host |
| Restaurar | `docker/restore.sh backups/<archivo>` |
| Certificado renovado | Escenario A: `docker compose -f compose.yml exec nginx nginx -s reload`. Escenario B: `sudo systemctl reload apache2` |
| Apagar / encender todo | `docker compose -f compose.yml down` / `docker compose -f compose.yml up -d` (los datos quedan en el volumen `app-db-data`) |

Los secretos viven solo en `.env.db` y `.env.docker` del host. Si se pierde `.env.db` con un volumen ya creado, la base sigue
usando las contraseñas originales: no cambiarlas ahí sin cambiarlas también en Postgres.
