#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building frontend..."
docker compose up --build frontend
echo "==> Frontend built and copied"

echo "==> Building backend..."
docker compose build backend

echo "==> Starting database..."
docker compose up -d postgres

echo "==> Waiting for postgres to be healthy..."
until docker compose exec postgres pg_isready -U dokcrm -d dokcrm; do
  echo "Waiting for postgres..."
  sleep 2
done

echo "==> Running migrations..."
docker compose run --rm backend node dist/lib/migrate.js

echo "==> Starting all services..."
docker compose up -d

echo "==> Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "==> Deploy complete!"
docker compose ps