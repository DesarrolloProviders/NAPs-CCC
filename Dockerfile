# Imagen de producción de naps-ccc-nextjs (Next.js standalone).
# Build:  docker compose --profile prod build
# Run:    docker compose --profile prod up -d   (usa .env.docker; la app queda en :3110 del host)

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm install` (no `npm ci`): el lock generado en Windows omite dependencias opcionales de Linux (sharp/emnapi)
RUN npm install --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variables mínimas para que `next build` valide env.ts (los valores reales van en runtime)
ENV APP_DATABASE_URL=postgres://build:build@localhost:5432/build \
    GIS_DATABASE_URL=postgres://build:build@localhost:5432/build \
    SPI40_BASE_URL=http://localhost/ws.php \
    OLT_BASE_URL=http://localhost/olt.php \
    BETTER_AUTH_SECRET=build-secret-build-secret-build-secret-00 \
    BETTER_AUTH_URL=http://localhost:3110 \
    ADMIN_SEED_EMAIL=build@example.com \
    ADMIN_SEED_PASSWORD=build-password \
    CRON_SECRET=build-secret
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=America/Argentina/Tucuman
RUN apk add --no-cache tzdata curl && addgroup -S app && adduser -S app -G app

# Salida standalone (incluye solo las dependencias trazadas: drizzle-orm, postgres, better-auth, ...) + estáticos
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Migraciones SQL y utilitarios de arranque en JS plano (usan los módulos ya presentes en node_modules del standalone)
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --chown=app:app docker/entrypoint.sh docker/migrate.mjs docker/seed-admin.mjs ./docker/
RUN chmod +x ./docker/entrypoint.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD curl -fsS http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker/entrypoint.sh"]
