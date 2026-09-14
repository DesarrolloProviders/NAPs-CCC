# NAPs CCC — entrega para IT

**En una línea:** el proyecto corre entero en Docker y deja la aplicación escuchando en **`127.0.0.1:3110`** del servidor.
Lo único que hace IT fuera de Docker es publicar **`https://nap.viaccc.com`** hacia ese puerto con el Apache que ya está,
usando el certificado que ya existe. Nada más se instala en el host.

El detalle técnico está en el [README](README.md); acá está solo lo que hay que hacer, en orden.

## Qué se entrega

- Una aplicación web de **solo consulta** de NAPs (reemplaza el buscador `qgis/buscar_naps.php` del sistema PHP): busca NAPs
  por dirección, coordenadas o click en el mapa y muestra los puertos de cada NAP en vivo (spi40 + estado en la OLT).
- Dos contenedores: `app` (Node/Next.js) y `app-db` (PostgreSQL propio, solo usuarios y sesiones). Un script,
  `docker/deploy.sh`, que los construye, los levanta y los verifica.
- **Solo lee** el PostGIS de NAPs (`cccqgis`), spi40 y la OLT. No escribe en ninguna base existente.
- Usuarios con email y contraseña; un `admin` los crea desde la UI. No hay registro público.

## Requisitos del servidor (lab-CCC-NAPs, 172.20.1.2)

| Requisito | Detalle |
|---|---|
| Docker Engine + Compose v2 | `docker compose version` debe responder. Instalación oficial: https://docs.docker.com/engine/install/. El usuario que corre `deploy.sh` no necesita sudo, pero sí estar en el grupo `docker` (`sudo usermod -aG docker <usuario>` y volver a iniciar sesión; probar con `docker ps`). |
| `git` | para clonar y actualizar el repo. Si el repo de GitHub es privado, el `clone` pide usuario y un token de acceso personal. |
| Salida a internet **solo para el build** | Docker Hub y el registro de npm, la primera vez y en cada actualización. En operación no hace falta. |
| Red interna | el servidor ya llega al PostGIS (`192.168.100.212:5432`), a spi40 y a la OLT (`192.168.43.100`): es la misma red que usa el legacy. |
| DNS y certificado | `nap.viaccc.com` ya apunta a este servidor y el certificado ya está en `/etc/letsencrypt/live/nap.viaccc.com/`. IT lo sigue renovando como hasta ahora. No hay que tocar nada. |
| Rol de solo lectura en el PostGIS | ver "Requisitos fuera del repo" en el README (SQL exacto). Hasta que exista, la app fuerza solo lectura desde su lado. |

## Instalación (una vez)

```bash
git clone https://github.com/DesarrolloProviders/NAPs-CCC.git ~/naps-ccc && cd ~/naps-ccc

cp .env.compose.example .env        # ya trae PUBLIC_HOST=nap.viaccc.com, COMPOSE_PROFILES=prod, APP_PORT=3110
cp .env.db.example .env.db          # dos contraseñas: openssl rand -base64 24
cp .env.docker.example .env.docker  # completar según la tabla de abajo
chmod 600 .env.db .env.docker
```

En `.env.docker` completar:

| Variable | Valor |
|---|---|
| `APP_DATABASE_URL` | `postgres://naps_app:<NAPS_APP_PASSWORD de .env.db>@app-db:5432/naps_ccc` |
| `GIS_DATABASE_URL` | `postgres://<rol solo lectura>:<clave>@192.168.100.212:5432/cccqgis` |
| `SPI40_BASE_URL` · `OLT_BASE_URL` | las URLs internas de spi40 y de `ftth.tools_box.php` (las mismas que usa el legacy) |
| `BETTER_AUTH_URL` | `https://nap.viaccc.com` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `HEALTH_TOKEN` | `openssl rand -hex 32` (para el monitoreo profundo) |
| `ADMIN_SEED_EMAIL` · `ADMIN_SEED_PASSWORD` | el primer administrador; **borrar las dos líneas después del primer login** |

Desplegar:

```bash
docker/deploy.sh
```

El script verifica los archivos de entorno, hace backup de la base propia si ya existe, construye la imagen etiquetada con el
commit, levanta `app-db` y `app`, espera el healthcheck y hace un smoke test. Al arrancar, la app aplica sus migraciones y crea
el administrador inicial. **Nada cambia todavía para los usuarios**: la app corre en `127.0.0.1:3110` y `nap.viaccc.com` sigue
mostrando el legacy. Comprobar desde el servidor:

```bash
curl -s http://127.0.0.1:3110/api/health      # {"status":"ok",...}
```

## Publicar el puerto: `nap.viaccc.com` → `127.0.0.1:3110`

Es el único paso fuera de Docker. Hoy Apache tiene dos vhosts con `ServerName nap.viaccc.com` (`nap.viaccc.com.conf` y
`nap.viaccc.com-le-ssl.conf`) sirviendo el legacy. Hay que deshabilitarlos al habilitar el nuevo: si conviven, Apache carga
`sites-enabled` en orden alfabético y gana el legacy. Los módulos necesarios (`proxy`, `proxy_http`, `headers`, `ssl`,
`rewrite`) ya están habilitados en este servidor.

```bash
cd ~/naps-ccc
sudo cp docker/apache/naps-ccc.conf.example /etc/apache2/sites-available/naps-ccc.conf
sudo sed -i 's/naps\.example\.com/nap.viaccc.com/g' /etc/apache2/sites-available/naps-ccc.conf
sudo a2dissite nap.viaccc.com nap.viaccc.com-le-ssl
sudo a2ensite naps-ccc
sudo apachectl configtest && sudo systemctl reload apache2
```

Desde el `reload`, `https://nap.viaccc.com` muestra la app nueva. El vhost reenvía a `127.0.0.1:3110`, conserva el `Host`,
manda `X-Forwarded-Proto: https` y la IP real del cliente, y limita `/api/health` a la red interna.

**Volver al legacy** (los contenedores pueden seguir corriendo, no molestan):

```bash
sudo a2dissite naps-ccc && sudo a2ensite nap.viaccc.com nap.viaccc.com-le-ssl && sudo systemctl reload apache2
```

**Atención:** todo lo que hoy se sirve bajo `nap.viaccc.com` deja de estar ahí, no solo el buscador: `/reserva.php`, `/go/`,
`/kiosco/`, `/stc/` y lo demás que cuelga de `/var/www/html/nap`. Si algo de eso sigue en uso, darle otro nombre antes del corte
(por ejemplo `nap-legacy.viaccc.com` con los mismos dos vhosts y su propio certificado).

Si el proxy HTTPS estuviera en otra máquina y no en este servidor: `APP_BIND=<IP de LAN del servidor>` en `.env` y
`docker compose -f compose.yml up -d app`; el proxy debe mandar `X-Forwarded-Proto: https` y el `Host` original.

## Verificar

1. `https://nap.viaccc.com/login` abre con candado válido.
2. Entrar con el admin inicial → `/buscar` muestra el mapa; buscar `-26.8419, -65.1622` con radio 500 devuelve NAPs.
3. Abrir una NAP: la tabla de puertos carga (spi40) y en menos de un minuto aparece el estado online (OLT).
4. Desde la LAN: `curl -s -H "Authorization: Bearer $HEALTH_TOKEN" 'https://nap.viaccc.com/api/health?deep=1'` → `"status":"ok"`
   para `appDb`, `gis`, `spi40` y `olt`.
5. Cerrar el arranque: cambiar la contraseña del admin desde la UI, crear los usuarios reales, borrar `ADMIN_SEED_*` de
   `.env.docker` y `docker compose -f compose.yml up -d app`.

## Operar

| Tarea | Comando (desde `~/naps-ccc`) |
|---|---|
| Actualizar a una versión nueva | `git pull && docker/deploy.sh` (Apache no se toca) |
| Volver a la anterior | `APP_TAG=<sha> docker compose -f compose.yml up -d app` (quedan las 3 últimas imágenes) |
| Logs | `docker compose -f compose.yml logs -f app` |
| Backup diario (cron) | `0 3 * * * cd /home/<usuario>/naps-ccc && docker/backup.sh >> backups/backup.log 2>&1` (ruta completa, cron no expande `~`) y copiar `backups/` fuera del host |
| Restaurar | `docker/restore.sh backups/<archivo>` |
| Certificado renovado | `sudo systemctl reload apache2` (como con el legacy; Docker no interviene) |
| Apagar / encender todo | `docker compose -f compose.yml down` / `docker compose -f compose.yml up -d` (los datos quedan en el volumen `app-db-data`) |

Los secretos viven solo en `.env.db` y `.env.docker` del host. Si se pierde `.env.db` con un volumen ya creado, la base sigue
usando las contraseñas originales: no cambiarlas ahí sin cambiarlas también en Postgres.

---

*Opcional, para un host sin Apache:* el compose también trae un `nginx` propio como frente HTTPS (`COMPOSE_PROFILES=prod,nginx`,
certificado en `TLS_DIR`). No hace falta en lab-CCC-NAPs; está descrito en el README.
