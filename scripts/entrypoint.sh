#!/bin/sh
# Web container entrypoint. Runs DB migrations BEFORE handing off to
# the Next.js server, so a deploy that adds new tables doesn't need
# a separate manual migration step (the most common cause of "deploy
# looks green but the API is 500'ing" in this project).
#
# Migration script is intentionally non-fatal — see scripts/migrate.mjs.

set -e

echo "[boot] running database migrations…"
node /app/scripts/migrate.mjs

echo "[boot] starting Next.js server…"
exec node /app/server.js
