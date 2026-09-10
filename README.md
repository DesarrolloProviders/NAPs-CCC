# NAPs CCC — búsqueda y gestión de NAPs (Next.js)

Reemplazo en Next.js 16 de la app PHP de NAPs de CCC. Permite **buscar NAPs por coordenadas y radio**, verlas en lista y mapa,
abrir el detalle con los **puertos en vivo** (sistema de abonados spi40 + estado en la OLT), **reservar / liberar / instalar puertos**
con auditoría, y administrar usuarios con roles (admin, técnico, ventas).

## Arquitectura en una página

| Pieza | Qué es | Dónde |
|---|---|---|
| PostGIS de NAPs | Base `cccqgis`, tabla `nap_con_disponibilidad` (QGIS). **Solo lectura** (`default_transaction_read_only`). | `src/lib/gis/` |
| spi40 | Webservice del sistema de abonados (`webservice.php?request=<base64 JSON>`). Puertos, clientes y ONTs por NAP. | `src/lib/spi40/` |
| OLT | `ftth.tools_box.php?function=ont-data` → estado online por MAC. Lento (7-25 s por ONT): consulta diferida, paralela y con caché. | `src/lib/olt/` |
| Base propia | PostgreSQL 16: usuarios/sesiones (better-auth) + `reservas` + `reserva_eventos`. Migraciones con Drizzle. | `src/db/`, `drizzle/` |
| Auth | better-auth (email + contraseña, sin registro público), roles vía plugin admin, cookie `naps.session_token`. | `src/lib/auth/` |
| UI | App Router, Server Components + Server Actions, shadcn/ui (Base UI), Tailwind 4, Leaflet + OpenStreetMap. | `src/app/`, `src/features/` |

Regla de estado de un puerto (heredada del legacy `online_ff.php`): **reservado > instalado > online > ocupado > libre**.
Una sola reserva activa por puerto la garantiza un índice único parcial en la base (`reservas_activa_por_nodo_uq`).

## Desarrollo

Requisitos: Node 24, Docker Desktop, y la copia legacy en `../legacy-php` con su PostGIS levantado (expone `localhost:5441`).

```bash
docker compose -f ../legacy-php/docker-compose.yml up -d postgis   # PostGIS de NAPs (dump del servidor GIS)
docker compose up -d app-db                                        # Postgres propio en localhost:5440
cp .env.example .env.local                                         # completar secretos
npm install
npm run db:migrate
npm run seed:admin                                                 # crea ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD
npm run dev                                                        # http://localhost:3110
```

Los puertos 3000, 3100, 5432 y 5433 están ocupados por otros proyectos en esta PC; por eso 3110 / 5440 / 5441.

### Scripts útiles

| Comando | Para qué |
|---|---|
| `npm run typecheck` · `npm run lint` · `npm test` | tipos, lint, tests unitarios (vitest) |
| `npm run test:integration` | tests contra el PostGIS local y la base `naps_ccc_test` (reglas de reservas con spi40 simulado) |
| `npm run test:e2e` | Playwright (Chromium) contra el dev server: login, búsqueda, detalle, reserva/liberar/instalar |
| `npm run probe:gis -- -26.8419 -65.1622 500` | búsqueda por radio directa (19 NAPs en el dump actual) |
| `npm run probe:spi40 -- 22024 303-01-08-N08-1-E` | puertos de una NAP en spi40 (`--save-fixture` guarda la respuesta) |
| `npm run probe:olt -- --nap 303-01-08-N08-1-E` | estado OLT de las ONTs de una NAP |
| `npm run import:reservas -- ../legacy-php/db/mysql/cccgo.sql [--desde=YYYY-MM-DD] [--dry-run]` | importa reservas del legacy (idempotente) |
| `npm run vencer:reservas` | marca como vencidas las activas con fecha pasada (también `POST /api/cron/vencer-reservas` con `CRON_SECRET`) |

### Endpoints

- `GET /api/health` (200/503 según bases; `?deep=1` prueba spi40 y OLT)
- `GET /api/naps/[idNap]/olt` (estado online por MAC, requiere sesión, `?refresh=1`)
- `POST /api/cron/vencer-reservas` (`Authorization: Bearer CRON_SECRET`)
- `/api/auth/*` (better-auth)

## Producción (Docker)

```bash
cp .env.docker.example .env.docker    # completar: GIS real 192.168.100.212, secretos, BETTER_AUTH_URL pública
docker compose --profile prod up -d --build
```

El contenedor `app` aplica migraciones y asegura el admin al arrancar (`docker/entrypoint.sh`), se une a la red `legacy-php_napnet`
(para llegar a 192.168.100.212 y 192.168.43.100 según el host) y expone la app en `:3110`. Poner un reverse proxy con TLS delante
y ajustar `BETTER_AUTH_URL` a la URL pública.

## Decisiones y límites conocidos

- `disponibles` de PostGIS lo sincroniza el legacy en lote (`splitterdipo.php`) y no descuenta reservas de esta app: la lista muestra
  ese valor con su fecha; el detalle calcula los libres reales (spi40 + reservas).
- Reservar re-consulta spi40 sin caché; si spi40 no responde, **no** se reserva.
- El código de NAP se normaliza para comparar (`303_01_08` ≡ `303-01-08`), pero a spi40 se le envía el código exacto de PostGIS.
- spi40 devuelve nombres con doble codificación (mojibake): el codec los repara.
- Las reservas legacy (643, todas vencidas al importar) quedan como histórico; la transición implica apagar `reserva*.php`.
