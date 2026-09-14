# Imagen de producción de naps-ccc-nextjs (Next.js standalone).
# Build:  docker compose -f compose.yml --profile prod build      (o docker/deploy.sh, que taguea con el sha de git)
# Run:    docker compose -f compose.yml --profile prod up -d
#
# Imágenes base fijadas por digest (node:24-alpine acá; postgres y nginx en compose.yml): dos builds del mismo commit
# producen la misma imagen. Para actualizar: `docker buildx imagetools inspect node:24-alpine` y reemplazar el digest.

FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# El lock se genera en Linux (docker/regenerar-lock.sh) para que incluya las dependencias opcionales de esta plataforma.
RUN npm ci --no-audit --no-fund

FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS build
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
    BETTER_AUTH_URL=https://build.invalid
RUN npm run build

FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS runtime
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=America/Argentina/Tucuman \
    APP_VERSION=${APP_VERSION}
# Sin curl ni otras herramientas de red en la imagen final: el healthcheck usa node.
RUN apk add --no-cache tzdata && addgroup -S app && adduser -S app -G app

# Salida standalone (incluye solo las dependencias trazadas: drizzle-orm, postgres, better-auth, ...) + estáticos
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Migraciones SQL y utilitarios de arranque en JS plano. El trazado del standalone solo copia los archivos que la app
# importa, así que drizzle-orm se copia completo (el migrator no está trazado); no tiene dependencias propias.
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --chown=app:app docker/entrypoint.sh docker/migrate.mjs docker/seed-admin.mjs ./docker/
RUN chmod +x ./docker/entrypoint.sh

USER app
EXPOSE 3000
# Chequeo superficial (solo la base propia): una caída del PostGIS remoto no debe reiniciar la app.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker/entrypoint.sh"]
