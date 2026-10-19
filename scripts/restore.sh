#!/usr/bin/env bash
# Restore a SQLite snapshot over the live database.
#   ./scripts/restore.sh data/backups/gastos-2026-09-07.db
# Stops the app, keeps a copy of the current DB as data/gastos.db.replaced-<time>, swaps, restarts.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-}"
if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "usage: $0 <backup.db>"; echo; echo "available:"; ls -1 data/backups 2>/dev/null || true; exit 1
fi
read -r -p "Replace data/gastos.db with $SRC? [y/N] " ok
[[ "$ok" == "y" || "$ok" == "Y" ]] || exit 1
docker compose stop gastos
stamp=$(date +%Y%m%d-%H%M%S)
[[ -f data/gastos.db ]] && cp data/gastos.db "data/gastos.db.replaced-$stamp"
rm -f data/gastos.db-wal data/gastos.db-shm
cp "$SRC" data/gastos.db
docker compose start gastos
echo "restored from $SRC (previous DB kept as data/gastos.db.replaced-$stamp)"
