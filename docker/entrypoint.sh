#!/bin/sh
set -e

echo "Applying database migrations..."
bunx prisma migrate deploy

echo "Starting NestJS Secure..."
exec bun dist/main.js
