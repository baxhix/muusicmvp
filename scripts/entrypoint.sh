#!/bin/sh
# Web container entrypoint. Runs DB migrations BEFORE handing off to
# the Next.js server, so a deploy that adds new tables doesn't need
# a separate manual migration step (the most common cause of "deploy
# looks green but the API is 500'ing" in this project).
#
# CRITICAL: the migrate step is best-effort. Any failure (missing
# module in the standalone bundle, schema drift, network blip) MUST
# NOT prevent the server from starting — otherwise we trade a single
# broken feature for an entire site outage. Hence no `set -e` and an
# explicit `|| true` swallow around the migrate call.

echo "[boot] running database migrations…"
node /app/scripts/migrate.mjs || {
  echo "[boot] migrate exited non-zero — continuing anyway (feature-level errors will surface at request time)"
}

echo "[boot] starting Next.js server…"
exec node /app/server.js
