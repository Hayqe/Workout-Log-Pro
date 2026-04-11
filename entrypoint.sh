#!/bin/sh
set -e

echo "Running database migrations..."
pnpm --filter @workspace/db run push

echo "Seeding system data..."
pnpm --filter @workspace/db run seed

echo "Starting Stroxx..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
