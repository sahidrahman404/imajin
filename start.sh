#!/bin/bash
set -e

echo "Starting database setup..."

echo "Generating migration cache..."
pnpm migration:cache

echo "Running migrations..."
pnpm migration:up

#echo "Running seeders..."
#pnpm seed

echo "Starting application..."
exec pnpm start