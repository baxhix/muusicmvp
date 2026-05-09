# Deploy — muusic MVP (Shared Hostinger VPS / Ubuntu 24.04)

Tailored for a VPS that **already runs other projects** behind a host nginx
on `:80/:443`. We keep our containers on `127.0.0.1` (loopback) and let the
host nginx reverse-proxy to them.

> Domain assumed: `muusic.live` + `admin.muusic.live`. Search/replace if
> different.

---

## 0. Pre-flight

DNS A records pointing to the VPS public IP:

```
muusic.live          A   <VPS_IP>
www.muusic.live      A   <VPS_IP>     (optional)
admin.muusic.live    A   <VPS_IP>
```

Confirm Docker + host nginx are present:

```bash
docker --version && docker compose version
sudo nginx -v
```

---

## 1. Clone the repo

```bash
sudo mkdir -p /opt/muusic && sudo chown $USER:$USER /opt/muusic
cd /opt/muusic
git clone git@github.com:<your-user>/muusic.git .
```

---

## 2. Configure `.env`

```bash
cp .env.example .env
nano .env
```

Required values:

| Var                  | Notes |
|----------------------|------|
| `APP_URL`            | `https://muusic.live` |
| `AUTH_SECRET`        | `openssl rand -base64 48` |
| `POSTGRES_PASSWORD`  | strong random |
| `DATABASE_URL`       | `postgres://muusic:<password>@postgres:5432/muusic` (host = service name **inside the docker network**) |
| `RESEND_API_KEY`     | resend.com |
| `EMAIL_FROM`         | `muusic <noreply@muusic.live>` (domain must be verified in Resend) |
| `MAPBOX_TOKEN`       | public or secret token |
| `SOCKET_URL`         | `https://muusic.live` |

> Note: the Postgres container is published to the host as `127.0.0.1:5433`
> for tooling (psql), but `DATABASE_URL` uses the docker network hostname
> `postgres:5432` — that's the in-network port.

---

## 3. Start Postgres, migrate, seed

```bash
docker compose up -d postgres
docker compose build socket   # socket image is the one that ships with src/ + tsx + drizzle/

# Run migrations + seed via the socket image (web standalone has no src/)
docker compose run --rm socket npx tsx src/server/db/migrate.ts
docker compose run --rm socket npx tsx src/server/db/seed.ts
```

Quick verification:

```bash
docker compose exec postgres psql -U muusic -d muusic -c "\dt"
docker compose exec postgres psql -U muusic -d muusic -c "SELECT COUNT(*) FROM tracks;"
```

---

## 4. Start the rest of the stack

```bash
docker compose up -d --build web socket admin
docker compose ps
docker compose logs --tail=40 web socket admin
```

Quick health checks (loopback only, no public exposure yet):

```bash
curl -s 127.0.0.1:3010 | head -3      # web
curl -s 127.0.0.1:3012/health         # socket → "ok"
curl -s 127.0.0.1:3011 | head -3      # admin
```

---

## 5. Install the host nginx config

```bash
sudo cp nginx/host/muusic.conf /etc/nginx/sites-available/muusic
sudo ln -sf /etc/nginx/sites-available/muusic /etc/nginx/sites-enabled/muusic
sudo mkdir -p /var/www/certbot
sudo nginx -t   # verifies config syntax
```

If the `nginx -t` output is OK:

```bash
sudo systemctl reload nginx
```

> **At this point, HTTP works but HTTPS will 404 (no cert yet).** That's
> normal — we issue certs in the next step using the HTTP virtualhost.

---

## 6. Issue Let's Encrypt certificates

```bash
sudo apt install -y certbot

sudo certbot certonly \
  --webroot -w /var/www/certbot \
  -d muusic.live -d www.muusic.live -d admin.muusic.live \
  --agree-tos -m you@example.com --no-eff-email
```

Reload nginx so the new certs are picked up:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Auto-renew + reload (already runs daily via apt's certbot.timer; just add a
deploy hook so nginx picks up renewed certs):

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
echo -e '#!/bin/sh\nsystemctl reload nginx' | \
  sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

---

## 7. Smoke test

```bash
# Magic link request
curl -X POST https://muusic.live/api/auth/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}'

# Click the link in the email → cookie set → /app loads
# Then:
curl -s --cookie "muusic_session=<copy-from-browser>" https://muusic.live/api/auth/me | jq
```

---

## 8. Promote a user to admin

```bash
docker compose exec postgres psql -U muusic -d muusic -c \
  "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

Admin panel → `https://admin.muusic.live` (currently still uses mocks
in `src/services/*.ts` — wiring to the live API is a follow-up).

---

## 9. Daily ops

```bash
# Logs
docker compose logs -f web
docker compose logs -f socket

# Update after pushing to GitHub
cd /opt/muusic
git pull && docker compose up -d --build web socket admin

# Postgres backup (cron-friendly)
docker compose exec -T postgres \
  pg_dump -U muusic muusic | gzip > /opt/backups/muusic-$(date +%F).sql.gz

# Restore
gunzip -c /opt/backups/muusic-2026-05-09.sql.gz | \
  docker compose exec -T postgres psql -U muusic -d muusic
```

---

## 10. Architecture reference

```
                            ┌──── host nginx :80/:443 ────┐
                            │  (muusic.live, admin.*,     │
                            │   plus other projects)      │
                            └────────────┬────────────────┘
                                         │
        ┌─────────────────┬──────────────┼──────────────┐
        ▼                 ▼              ▼              ▼
   127.0.0.1:3010    127.0.0.1:3012  127.0.0.1:3011  127.0.0.1:5433
        │                 │              │              │
   muusic_web        muusic_socket   muusic_admin    muusic_postgres
   (Next 3000)       (Socket.IO 3002)(Next 3001)    (PG 5432 internal)
```

- All four containers run on a private docker network (`muusic_default`).
- Host nginx reaches them via the published loopback ports.
- Postgres is unreachable from outside `127.0.0.1` (UFW + bind address).
- `web` and `socket` share `src/server/*` modules (DB, auth, chat helpers).

---

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| `web` restart-loops | `docker compose logs web` — usually a missing env var (Zod schema in `src/server/env.ts` is the source of truth) |
| `socket` rejects all connections | Cookie missing → user not logged in. Or `APP_URL` mismatch (CORS) |
| Realtime works on localhost but not in prod | Nginx must proxy WebSocket headers. They're set in `nginx/host/muusic.conf` |
| Magic link emails not arriving | Resend dashboard → Logs. Most common cause: `EMAIL_FROM` domain not verified |
| Mapbox 401 | `MAPBOX_TOKEN` missing or wrong scope. Public tokens work for geocoding |
| `track_not_in_catalog` | Add the youtubeId to `src/data/tracksCatalog.ts`, push, `docker compose run --rm web npx tsx src/server/db/seed.ts` |
| Out of memory during build | Free RAM is tight; `docker system prune -af` and build services one at a time: `docker compose build web` then `... admin` then `... socket` |
