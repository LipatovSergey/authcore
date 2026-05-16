#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BRANCH="main"

echo "Pulling latest changes from origin/${BRANCH}..."
git fetch origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "Building Docker images..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build

echo "Starting database..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d postgres

echo "Running production migrations..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm api pnpm migration:run:prod

echo "Starting application services..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

echo "Current service status:"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
