#!/usr/bin/env bash
# Ships the committed tree (git archive HEAD) to your server over ssh and rebuilds the container.
#   GASTOS_HOST=myserver ./deploy.sh
set -euo pipefail
HOST="${GASTOS_HOST:?set GASTOS_HOST to the ssh host to deploy to}"
REMOTE_DIR="${GASTOS_DIR:-gastos}"   # relative to the remote home dir
cd "$(dirname "$0")"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Uncommitted changes present. Commit first; deploy ships HEAD only." >&2
  git status --short >&2
  exit 1
fi
git archive HEAD | ssh "$HOST" "mkdir -p ~/$REMOTE_DIR/src ~/$REMOTE_DIR/data && rm -rf ~/$REMOTE_DIR/src/* && tar -x -C ~/$REMOTE_DIR/src"
ssh "$HOST" bash -s "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
cd ~/"$1"
cp src/docker-compose.yml docker-compose.yml
mkdir -p scripts && cp src/scripts/backup.sh src/scripts/restore.sh scripts/
if [[ ! -f .env ]]; then
  cp src/.env.example .env
  echo "Created .env from example. EDIT IT: set APP_PASSWORD, SESSION_SECRET and PORT."
fi
grep -q '^BUILD_CONTEXT=' .env || echo 'BUILD_CONTEXT=./src' >> .env
docker compose up -d --build
docker image prune -f >/dev/null
REMOTE
echo "Deployed $(git rev-parse --short HEAD) to $HOST:~/$REMOTE_DIR"
