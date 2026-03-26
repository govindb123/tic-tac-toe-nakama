#!/bin/sh
set -e

/nakama/nakama migrate up --database.address="$DATABASE_URL"

exec /nakama/nakama \
  --name nakama1 \
  --database.address="$DATABASE_URL" \
  --logger.level DEBUG \
  --runtime.js_entrypoint match_handler.js
