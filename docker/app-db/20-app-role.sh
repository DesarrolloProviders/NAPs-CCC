#!/bin/bash
# Corre UNA vez, al inicializar el volumen de app-db.
# Crea el rol con el que se conecta la app (dueño de la base, sin superusuario): un fallo en la app
# no puede tocar otras bases ni el servidor. La contraseña viene de NAPS_APP_PASSWORD (.env.db).
set -e
: "${NAPS_APP_PASSWORD:?Definir NAPS_APP_PASSWORD en .env.db}"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-SQL
	CREATE ROLE naps_app LOGIN PASSWORD '${NAPS_APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
	ALTER DATABASE "${POSTGRES_DB}" OWNER TO naps_app;
	ALTER SCHEMA public OWNER TO naps_app;
SQL
