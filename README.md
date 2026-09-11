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
| `npm run test:integration` | tests contra el PostGIS local (búsqueda por radio, localidades) |
| `npm run test:e2e` | Playwright (Chromium) contra el dev server: login, búsqueda (incluye click en el mapa) y detalle |
| `npm run probe:gis -- -26.8419 -65.1622 500` | búsqueda por radio directa (19 NAPs en el dump actual) |
| `npm run probe:spi40 -- 22024 303-01-08-N08-1-E` | puertos de una NAP en spi40 (`--save-fixture` guarda la respuesta) |
| `npm run probe:olt -- --nap 303-01-08-N08-1-E` | estado OLT de las ONTs de una NAP |

### Endpoints

- `GET /api/health` (200/503 según bases; `?deep=1` prueba spi40 y OLT)
- `GET /api/naps/[idNap]/olt` (estado online por MAC, requiere sesión, `?refresh=1`)
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
