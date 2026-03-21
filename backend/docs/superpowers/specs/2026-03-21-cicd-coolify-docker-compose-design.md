# CI/CD Design: Coolify + Docker Compose

**Date:** 2026-03-21
**Scope:** Backend only (frontend deployed on Vercel separately)

## Overview

Deploy the backend as a Docker Compose stack on Coolify. Push to `main` triggers auto-deploy via Coolify webhook. No GitHub Actions — Coolify handles the full pipeline.

## Architecture

```
Developer pushes to main
  → Coolify webhook fires
  → Coolify pulls latest code
  → docker compose -f docker-compose.prod.yml build
  → Containers start (postgres, redis, searxng, backend)
  → Backend entrypoint runs prisma migrate deploy
  → node src/index.js starts
  → Coolify health check hits /ready
  → Traffic routes to backend
```

## Files to Create

### 1. `Dockerfile`

Three-stage build: install all deps for Prisma generate, then production deps only, then final image.

```dockerfile
# Stage 1: Generate Prisma client (needs prisma CLI from devDependencies)
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

# Stage 2: Production dependencies only
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: Final production image
FROM node:22-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    tini \
    wget \
    && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
# Install prisma CLI for runtime migrations
RUN npm install --no-save prisma@6
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "sh", "scripts/entrypoint.sh"]
```

Key decisions:
- **`node:22-slim`** instead of alpine — Playwright/Crawlee need Chromium + glibc libs, Debian-slim is the pragmatic choice
- **3-stage build**: stage 1 installs all deps (including `prisma` CLI from devDependencies) to run `prisma generate`; stage 2 installs production-only deps; stage 3 combines prod deps + generated Prisma client
- **Chromium** installed via `apt-get` for PlaywrightCrawler (used by CrawleeService and GoogleMapsProvider)
- **`tini`** as PID 1 init — properly reaps zombie processes from BullMQ workers and Crawlee
- **Non-root user** (`appuser`) — container does not run as root
- **`prisma@6`** installed at runtime for `prisma migrate deploy` in entrypoint
- **`wget`** installed for health check probe
- No `.env` copied — Coolify injects env vars at runtime

### 2. `.dockerignore`

```
node_modules
.env
.git
logs
storage
docs
.vscode
.claude
*.log
test-*.js
test_*.js
scripts/test-*
scripts/benchmark-*
config/searxng/settings.yml.new
```

### 3. `scripts/entrypoint.sh`

```bash
#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node src/index.js
```

Key decisions:
- `prisma migrate deploy` runs production-safe migrations only (no interactive prompts)
- `exec` replaces shell process so Node receives SIGTERM directly (graceful shutdown works)
- `set -e` exits on migration failure → container restarts

### 4. `docker-compose.prod.yml`

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-atrips}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-atrips}?schema=public
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      SEARXNG_URL: http://searxng:8080
    ports:
      - "${PORT:-3000}:3000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/ready"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 2G
    restart: unless-stopped

  db:
    image: postgis/postgis:16-3.4-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-atrips}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-atrips}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-atrips}"]
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
    restart: unless-stopped

  searxng:
    image: searxng/searxng:2024.12.23-5cc4e4f14
    volumes:
      - ./config/searxng:/etc/searxng:ro
    environment:
      SEARXNG_BASE_URL: ${SEARXNG_BASE_URL:-http://searxng:8080/}
      SEARXNG_SECRET_KEY: ${SEARXNG_SECRET_KEY}
    deploy:
      resources:
        limits:
          memory: 512M
    restart: unless-stopped

volumes:
  db_data:
  redis_data:
```

Key decisions:
- **Backend health check** in compose — `wget` hits `/ready`, start_period 30s for migration time
- **Non-superuser DB** — uses `${POSTGRES_USER:-atrips}` instead of hardcoded `postgres`
- **Redis password** — `--requirepass` for defense-in-depth
- **Pinned SearXNG** — `2024.12.23-5cc4e4f14` instead of `latest` for reproducibility
- **SearXNG mount `:ro`** — read-only, no write-back to host
- **Resource limits** — backend 2G (Chromium is memory-hungry), postgres 1G, redis/searxng 512M
- **No ports exposed** for db, redis, searxng — only backend is public (Coolify handles SSL/reverse proxy)
- `depends_on` with `condition: service_healthy` ensures correct startup order
- All env vars (JWT_SECRET, API keys, etc.) passed through by Coolify to the backend container

## Environment Variables for Coolify

Set these in Coolify UI (not in `.env` file):

**Infrastructure:**
- `POSTGRES_USER` — database user (default: `atrips`)
- `POSTGRES_PASSWORD` — strong random password
- `POSTGRES_DB` — database name (default: `atrips`)
- `REDIS_PASSWORD` — strong random password

**Security:**
- `JWT_SECRET` — 64+ char random string
- `JWT_REFRESH_SECRET` — 64+ char random string (different from JWT_SECRET)
- `ENCRYPTION_KEY` — 32 bytes / 64 hex chars

**All API keys from `.env.example`:**
- Google OAuth, Mapbox, Stripe, Amadeus, etc.
- `FRONTEND_URL` — production frontend URL (Vercel domain)

### 5. Backend code change: Playwright executable path

`CrawleeService.js` and `GoogleMapsProvider.js` create `PlaywrightCrawler` instances with `launchOptions` but no `executablePath`. Playwright's npm package looks for browsers it downloaded itself, not system-installed chromium. Add `executablePath` from the env var:

In every `launchOptions` block, add:
```js
launchOptions: {
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: [ /* existing args */ ],
},
```

This is a no-op in development (env var not set → `undefined` → Playwright uses its own browser) and uses system chromium in Docker.

**Files to modify:**
- `src/modules/ai/infrastructure/services/CrawleeService.js` — 1 PlaywrightCrawler instance (line 189)
- `src/modules/ai/infrastructure/services/GoogleMapsProvider.js` — 3 PlaywrightCrawler instances (lines 766, 867, 963)

## What Does NOT Change
- `docker-compose.yml` (dev) — kept as-is for local development
- Health check endpoints `/health` and `/ready` — already implemented
- Graceful shutdown handling — already implemented
- `.env.example` — remains the reference for required env vars

## Deployment Flow

1. Developer merges PR to `main`
2. Coolify webhook triggers
3. Coolify pulls code, runs `docker compose -f docker-compose.prod.yml up --build -d`
4. PostgreSQL and Redis start first (health checks pass)
5. Backend container starts after dependencies are healthy
6. Entrypoint runs `prisma migrate deploy` (applies pending migrations)
7. `node src/index.js` starts
8. Docker health check verifies `/ready` returns 200
9. Coolify routes traffic to new container, stops old one

## Rollback

If deploy fails:
- Coolify keeps the previous container running until the new one is healthy
- If migration fails → container exits → Coolify shows deploy failed
- Manual rollback: Coolify UI → Deployments → redeploy previous version
- Database rollback: migrations are forward-only; test risky migrations on staging first

## Future Improvements

When test framework is added:
- Add GitHub Actions to run lint + tests before merge to `main`
- Block merge if pipeline fails (branch protection)
- Upgrade to Approach B (GitHub Actions gate + Coolify deploy)
