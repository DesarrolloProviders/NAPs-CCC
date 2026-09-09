#!/bin/bash
# Crea la base de test usada por vitest (APP_DATABASE_URL_TEST)
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE naps_ccc_test OWNER $POSTGRES_USER;"
