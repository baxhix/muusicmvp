#!/bin/sh
# Web container entrypoint. Runs DB migrations BEFORE handing off to
# the Next.js server, so a deploy that adds new tables doesn't need
# a separate manual migration step (the most common cause of "deploy
# looks green but the API is 500'ing" in this project).
#
# FAIL-HARD CONTRACT (post-incidente 0035 Aquisição)
# ──────────────────────────────────────────────────
# Versão antiga deste script tinha `|| { echo "..."; }` em volta do
# `node migrate.mjs` — qualquer falha era ENGOLIDA e o Next.js subia
# mesmo com schema fora de sync. O resultado prático foi:
#   - migration 0035 não rodou silenciosamente
#   - código novo referenciava users.signup_link_id
#   - login retornava 500 em prod sem alerta nenhum
#   - bug descoberto só por usuário reportando
#
# Agora: `set -e` no topo + `node migrate.mjs` DIRETO. Se migrate
# falha → script aborta → container exit não-zero → Docker reinicia
# → health-check eventualmente marca unhealthy → alerta dispara.
#
# Ferramentas que ajudam a diagnosticar:
#   - migrate.mjs faz pre-flight (detecta SQL files sem entrada no
#     _journal.json) ANTES de tentar rodar, com erro explícito.
#   - drizzle migrator é idempotente — se for restart-loop por
#     `table already exists`, edite a migration ou aplique manual:
#       docker compose exec -T postgres psql -U muusic -d muusic \
#         < drizzle/NNNN_<name>.sql
#     e adicione entrada no _journal.json + commit.

set -e

echo "[boot] running database migrations…"
node /app/scripts/migrate.mjs

echo "[boot] starting Next.js server…"
exec node /app/server.js
