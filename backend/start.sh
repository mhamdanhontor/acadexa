#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "--- Running database migrations (Alembic) ---"
alembic upgrade head

echo "--- Seeding initial database records (Admin, Roles, Templates) ---"
python seed.py

echo "--- Starting Acadexa FastAPI server ---"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
