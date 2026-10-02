#!/usr/bin/env bash
# Applies the migrations + seed to a throwaway local Postgres and runs the RLS tests.
# Usage: scripts/test-rls.sh   (needs Postgres binaries: initdb, pg_ctl, psql)
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PORT:-54329}"
SOCK="$DATA/sock"; mkdir -p "$SOCK"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DATA"; RUN_AS=(sudo -u postgres); fi

cleanup() { "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PGBIN/initdb" -D "$DATA/db" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$DATA/log" start >/dev/null

PSQL=("${RUN_AS[@]}" "$PGBIN/psql" -h "$SOCK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase/tests/_supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed.sql
"${PSQL[@]}" -f supabase/seed.sql   # seed must be re-runnable
"${PSQL[@]}" -t -f supabase/tests/rls_test.sql
