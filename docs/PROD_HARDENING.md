# Production Hardening Runbook

This runbook operationalizes the README production checklist for secrets, HTTPS, network exposure, monitoring, and backups.

## 1) Secrets

- Copy `.env.example` to a private production env file.
- Replace all `changeme_*` values.
- Use at least 32 random characters for `AUTH_SECRET`.
- Set:
  - `MEDIAARCHIVE_DOMAIN` (for Caddy TLS host)
  - `ACME_EMAIL` (for certificate registration)

Example secret generation:

```bash
openssl rand -base64 48
```

## 2) HTTPS + Secure Proxy

Use production compose override + production Caddyfile:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

What this applies:
- HTTPS termination with Caddy using `MEDIAARCHIVE_DOMAIN`
- HTTP -> HTTPS redirect
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.)
- App exposed only through Caddy (`80/443`)

For local development hardening without production TLS assumptions, use:
- `docker/caddy/Caddyfile.local-safe`

## 3) Network Exposure

`docker-compose.prod.yml` removes host bindings for:
- PostgreSQL
- Redis
- Typesense
- App

Only Caddy publishes ports (`80`, `443`).

## 4) Monitoring

Run quick operational checks:

```powershell
./ops/healthcheck.ps1
```

This validates:
- compose service states are healthy/running
- app health endpoint responds with `ok: true`

## 5) Backups

Run a backup set:

```powershell
./ops/backup.ps1
```

Artifacts are written under `./backups/<timestamp>/`:
- `postgres.sql`
- `redis-dump.rdb`
- `typesense-data.tar.gz` (if `TYPESENSE_API_KEY` is set)
- `manifest.json`

## 6) Restore Drill (recommended)

At least monthly, verify a restore path on a staging environment:
1. Restore PostgreSQL from `postgres.sql`
2. Restore Redis from `redis-dump.rdb`
3. Restore Typesense data from `typesense-data.tar.gz`
4. Confirm app login, search, and record fetch end-to-end

## Notes

- Keep backup artifacts encrypted at rest and off-host.
- Do not expose Typesense directly on public internet in production.
- Rotate credentials and API keys periodically.

