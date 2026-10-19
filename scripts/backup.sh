#!/usr/bin/env bash
# Manual SQLite snapshot from the host. Result lands in ./data/backups/.
#   ./scripts/backup.sh            -> gastos-<timestamp>.db
#   ./scripts/backup.sh before-x   -> gastos-before-x.db
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T gastos node scripts/backup.mjs "${1:-}"
ls -lh data/backups | tail -n +2
