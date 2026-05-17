# CI/CD setup (GitHub Actions → GHCR → VPS)

One-time setup for the automated deploy pipeline. After this, every push to `main` builds **only the services whose code actually changed** and rolls them out on the production VPS via SSH.

A typical chat-only commit goes from ~5 minutes (full triple-image rebuild) to **~1-2 minutes** (just the `web` image + a partial deploy).

---

## Pipeline at a glance

```
git push main
    ↓
.github/workflows/deploy.yml runs
    ├─ changes  (dorny/paths-filter)
    │   → outputs.web / .socket / .admin = "true" | "false"
    │
    ├─ build-web     (only if changes.web == 'true')
    ├─ build-socket  (only if changes.socket == 'true')   ← parallel, conditional
    ├─ build-admin   (only if changes.admin == 'true')
    │
    └─ deploy  (only if ≥1 service changed)
       └─ SSH into VPS → git pull → pull + restart ONLY changed services
```

**Path filters** (live in `deploy.yml`'s `changes` job):
- `web` rebuilds when `src/**`, `public/**`, `drizzle/**`, `next.config.*`, `package.json`, `Dockerfile.web`, `docker-compose.yml` changes.
- `socket` rebuilds when `src/server/**`, `src/lib/**`, `src/hooks/**`, `drizzle/**`, `package.json`, `Dockerfile.socket`, `docker-compose.yml` changes. UI-only changes in `src/components/**` or `src/app/**` do NOT trigger a socket rebuild.
- `admin` rebuilds when `admin/**` or `docker-compose.yml` changes.

**Concurrency control**: pushing N commits in quick succession cancels in-progress runs and only deploys the latest — no more wasted CI minutes on stale commits.

**Manual full rebuild**: trigger `workflow_dispatch` from the GitHub Actions UI and check `force_all` → rebuilds + redeploys all three services regardless of filters.

The VPS only needs to:
1. Run `git pull` so `docker-compose.yml` stays current
2. Run `docker compose pull <changed-services>` to fetch only freshly-built images
3. Run `docker compose up -d --no-build <changed-services>` to swap only affected containers

No Node, no npm, no Next.js build on the VPS.

---

## One-time setup (you do this once)

### 1. SSH key pair for the deploy action

GitHub Actions needs SSH access to the VPS. Generate a **dedicated** keypair for this — don't reuse your personal `id_rsa`.

**On your Mac:**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/muusic_deploy -N "" -C "github-actions deploy"
# This creates:
#   ~/.ssh/muusic_deploy        (private key — goes into GitHub Secrets)
#   ~/.ssh/muusic_deploy.pub    (public key — goes on the VPS)
```

**Install the public key on the VPS:**

```bash
ssh-copy-id -i ~/.ssh/muusic_deploy.pub root@srv1512639
# OR manually:
cat ~/.ssh/muusic_deploy.pub | ssh root@srv1512639 'cat >> /root/.ssh/authorized_keys'
```

**Verify:**

```bash
ssh -i ~/.ssh/muusic_deploy root@srv1512639 'echo hello from VPS'
```

You should see `hello from VPS` with no password prompt. Done.

### 2. GitHub PAT so the VPS can pull from GHCR

The GitHub Container Registry hosts private images by default. The VPS needs to `docker login ghcr.io` once so subsequent pulls work.

**Create a PAT** (https://github.com/settings/tokens/new):

- **Note:** `muusic-vps-ghcr-pull`
- **Expiration:** 1 year (or "no expiration" if you don't mind renewing later)
- **Scope:** check **`read:packages`** only — nothing else
- Click **Generate token**, copy the value (you only see it once)

**Log in on the VPS:**

```bash
ssh root@srv1512639
echo "<PASTE_PAT_HERE>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

You should see `Login Succeeded`. The credentials are saved at `/root/.docker/config.json` and persist across reboots.

### 3. Add secrets + variables in the GitHub repo

Go to **Settings → Secrets and variables → Actions** in https://github.com/baxhix/muusicmvp.

**Secrets** (sensitive — click "New repository secret" for each):

| Name | Value |
|------|-------|
| `DEPLOY_HOST` | `srv1512639` (or the public IP if hostname isn't resolvable from GitHub's runners) |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/muusic_deploy` (the **private** key, including the `-----BEGIN...` and `-----END...` lines) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Your Mapbox public token (same value already in `/opt/muusic/.env` on the VPS) |

**Variables** (non-secret — click "Variables" tab → "New repository variable"):

| Name | Value |
|------|-------|
| `APP_URL` | `https://muusic.live` |

---

## Trigger the first build

Either:

- Push any commit to `main` — the workflow runs automatically.
- OR go to **Actions → Deploy → Run workflow** in the GitHub UI for a manual trigger.

The first run takes ~3-5 min (cold cache). Subsequent runs cache aggressively → **~30-60s**.

Watch the run: **Actions** tab in the repo. The build matrix shows 3 parallel jobs (one per service), then a deploy job that SSH's into the VPS.

---

## What happens on each deploy

The workflow does, in order:

1. **Three parallel `docker build` jobs** push images to:
   - `ghcr.io/baxhix/muusicmvp-web:latest` + `:sha-<commit>`
   - `ghcr.io/baxhix/muusicmvp-socket:latest` + `:sha-<commit>`
   - `ghcr.io/baxhix/muusicmvp-admin:latest` + `:sha-<commit>`

2. **Deploy job** SSHs into the VPS and runs:
   ```bash
   cd /opt/muusic
   git pull --ff-only
   docker compose pull web socket admin
   docker compose up -d --no-build web socket admin
   docker image prune -f --filter "until=24h"
   ```

   - `git pull` keeps `docker-compose.yml` + tracked configs in sync.
   - `docker compose pull` fetches the new `:latest` for each service.
   - `up -d --no-build` swaps the running containers WITHOUT trying to build locally (which is what we want — the registry has the truth).
   - The web container's entrypoint runs `scripts/migrate.mjs` first, so any new Drizzle migrations apply automatically before the Next.js server starts.

---

## Manual operations

### Rollback to a previous version

Each build is tagged with `:sha-<commit>`, so any past deploy is retrievable.

```bash
# On the VPS:
cd /opt/muusic
WEB_IMAGE=ghcr.io/baxhix/muusicmvp-web:sha-abc1234 docker compose up -d --no-build web
# Same env-var trick for SOCKET_IMAGE / ADMIN_IMAGE.
```

Find the SHA you want under **Packages → muusicmvp-web → Versions**.

### Force a rebuild without code changes

In GitHub UI: **Actions → Deploy → Run workflow**. Picks up the latest `main` and rebuilds everything.

### Deploy outside the pipeline (emergency)

The `build:` directives in `docker-compose.yml` still work. From the VPS:

```bash
cd /opt/muusic
docker compose up -d --build web
```

Builds locally from source, ignores the registry. Same flow as before CI/CD was added.

---

## Verifying it works

After the first successful run:

```bash
ssh root@srv1512639
docker compose ps
# Should show web/socket/admin as Up + recent created timestamp

docker compose images
# Should show ghcr.io/baxhix/muusicmvp-* tags

docker compose logs web --tail=20
# Should show:
#   [boot] running database migrations…
#   [migrate] done.
#   [boot] starting Next.js server…
#   ✓ Ready in 350ms
```

---

## Troubleshooting

### `docker pull` fails on VPS with `denied: requested access to the resource is denied`

The PAT login expired or was never done. Re-run step 2 above.

### Action fails at the SSH step

- Check `DEPLOY_HOST` resolves from GitHub runners (use the public IP if the hostname doesn't work).
- Check `DEPLOY_SSH_KEY` includes the FULL private key block, headers + footers.
- Check the public key is actually in `/root/.ssh/authorized_keys` on the VPS.

### Action fails at the build step

- Check `NEXT_PUBLIC_MAPBOX_TOKEN` secret exists.
- Check `APP_URL` variable exists.
- Look at the failed step's logs in the Actions UI.

### Images stay private forever

Default GHCR visibility is private. After the first push, you can flip individual packages to public if you want anonymous pulls (won't need the PAT on the VPS anymore). Go to **GitHub → your profile → Packages → muusicmvp-web → Package settings → Change visibility → Public**. Repeat for the other two. Optional.

---

## What you no longer have to do

Once CI/CD is live, the manual deploy steps (everything previously documented as `cd /opt/muusic && git pull && docker compose up -d --build`) become **automatic on every push to main**.

You can still SSH into the VPS for everything else (logs, DB queries, debugging) — only the deploy step is automated.
