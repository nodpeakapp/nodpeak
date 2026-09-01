#!/bin/sh
set -e

DB_PATH="${DATABASE_URL#file:}"
DB_DIR="$(dirname "$DB_PATH")"
mkdir -p "$DB_DIR"

# ── Restore from Litestream if the volume is empty ───────────
if [ "${LITESTREAM_ENABLED}" = "true" ] && [ ! -f "$DB_PATH" ]; then
  echo "[nodpeak] no local database — attempting Litestream restore"
  litestream restore -if-replica-exists -config /etc/litestream.yml "$DB_PATH" || \
    echo "[nodpeak] no replica found, starting fresh"
fi

# ── Apply schema (idempotent; SQLite, no migration history) ──
echo "[nodpeak] applying database schema"
./node_modules/.bin/prisma db push \
  --schema=./apps/web/prisma/schema.prisma \
  --skip-generate \
  --accept-data-loss

# ── Run ──────────────────────────────────────────────────────
if [ "${LITESTREAM_ENABLED}" = "true" ]; then
  echo "[nodpeak] starting under Litestream replication"
  exec litestream replicate -config /etc/litestream.yml -exec "$*"
else
  echo "[nodpeak] starting"
  exec "$@"
fi
