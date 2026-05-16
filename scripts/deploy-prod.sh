#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
BRANCH="main"

echo "Pulling latest changes from origin/${BRANCH}..."
git fetch origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "Building Docker images..."
docker compose -f "${COMPOSE_FILE}" build

echo "Starting database..."
docker compose -f "${COMPOSE_FILE}" up -d postgres

echo "Running production migrations..."
docker compose -f "${COMPOSE_FILE}" run --rm api pnpm migration:run:prod

echo "Starting application services..."
docker compose -f "${COMPOSE_FILE}" up -d

echo "Current service status:"
docker compose -f "${COMPOSE_FILE}" ps
