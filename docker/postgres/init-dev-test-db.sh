#!/usr/bin/env sh
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'EOSQL'
SELECT 'CREATE DATABASE authcore_development'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'authcore_development')\gexec

SELECT 'CREATE DATABASE authcore_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'authcore_test')\gexec
EOSQL
