#!/usr/bin/env bash
# Dumps the schema and the data of the Supabase database to ./backups (or the directory given).
# Needs the Supabase CLI and SUPABASE_DB_URL (Dashboard > Project Settings > Database > Connection string).
# Photos are not part of a database dump: export them from the app (More > Export data > Photos).
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the project connection string}"
OUT="${1:-backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/schema-$STAMP.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy -f "$OUT/data-$STAMP.sql"
echo "Backup written to $OUT (schema-$STAMP.sql, data-$STAMP.sql)"
