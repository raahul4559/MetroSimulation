#!/usr/bin/env bash
# Idempotent local Postgres setup for the Namma Metro Simulation database.
# Creates role `metro_user` and database `metro_simulation` if they don't already exist.
# Never drops or alters existing data.
set -euo pipefail

DB_NAME="${DB_NAME:-metro_simulation}"
DB_USER="${DB_USER:-metro_user}"
DB_PASSWORD="${DB_PASSWORD:-metro_password}"
ADMIN_DB="${ADMIN_DB:-postgres}"

role_exists=$(psql -d "${ADMIN_DB}" -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")
if [ "$role_exists" != "1" ]; then
  echo "Creating role ${DB_USER}..."
  psql -d "${ADMIN_DB}" -c "CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';"
else
  echo "Role ${DB_USER} already exists, skipping."
fi

db_exists=$(psql -d "${ADMIN_DB}" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
if [ "$db_exists" != "1" ]; then
  echo "Creating database ${DB_NAME} owned by ${DB_USER}..."
  psql -d "${ADMIN_DB}" -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
else
  echo "Database ${DB_NAME} already exists, skipping."
fi

echo
echo "Done. Connection string:"
echo "  jdbc:postgresql://localhost:5432/${DB_NAME}"
echo "  user=${DB_USER} password=${DB_PASSWORD}"
