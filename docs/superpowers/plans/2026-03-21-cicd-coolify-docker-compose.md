# CI/CD Coolify Docker Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy backend as a Docker Compose stack on Coolify with auto-deploy on push to `main`.

**Architecture:** 3-stage Dockerfile builds the backend image (Prisma generate → prod deps → final with Chromium). docker-compose.prod.yml orchestrates backend + PostgreSQL + Redis + SearXNG. Entrypoint runs migrations before starting the server. Coolify webhook triggers the pipeline on push to `main`.

**Tech Stack:** Docker, Docker Compose, Node.js 22, Prisma 6, PostgreSQL 16 + PostGIS, Redis 7, SearXNG, Coolify

**Spec:** `docs/superpowers/specs/2026-03-21-cicd-coolify-docker-compose-design.md`

---

### File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `Dockerfile` | 3-stage build for backend image |
| Create | `.dockerignore` | Exclude unnecessary files from Docker context |
| Create | `scripts/entrypoint.sh` | Run migrations then start server |
| Create | `docker-compose.prod.yml` | Production stack: backend + postgres + redis + searxng |
| Modify | `src/modules/ai/infrastructure/services/CrawleeService.js:200` | Add `executablePath` to PlaywrightCrawler launchOptions |
| Modify | `src/modules/ai/infrastructure/services/GoogleMapsProvider.js:777,878,974` | Add `executablePath` to 3 PlaywrightCrawler launchOptions |

---

### Task 1: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

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

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for production Docker build"
```

---

### Task 2: Create entrypoint script

**Files:**
- Create: `scripts/entrypoint.sh`

- [ ] **Step 1: Create `scripts/entrypoint.sh`**

```bash
#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node src/index.js
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/entrypoint.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/entrypoint.sh
git commit -m "chore: add Docker entrypoint with auto-migration"
```

---

### Task 3: Create Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create `Dockerfile`**

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
RUN npm install --no-save "prisma@^6.1.0"
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "sh", "scripts/entrypoint.sh"]
```

- [ ] **Step 2: Verify Docker build succeeds**

```bash
docker build -t atrips-backend:test .
```

Expected: Build completes without errors. Image created.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: add multi-stage Dockerfile for production"
```

---

### Task 4: Create `docker-compose.prod.yml`

**Files:**
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `docker-compose.prod.yml`**

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

- [ ] **Step 2: Validate compose file syntax**

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

Expected: No errors. If env vars are missing, that's OK (they'll be set in Coolify).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "chore: add production Docker Compose for Coolify deployment"
```

---

### Task 5: Add Playwright `executablePath` to CrawleeService

**Files:**
- Modify: `src/modules/ai/infrastructure/services/CrawleeService.js:200-208`

- [ ] **Step 1: Add `executablePath` to launchOptions**

In `CrawleeService.js` at line 200, the current `launchOptions` block:

```js
      launchContext: {
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
          ],
        },
      },
```

Change to:

```js
      launchContext: {
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
          ],
        },
      },
```

- [ ] **Step 2: Verify lint passes**

```bash
npx eslint src/modules/ai/infrastructure/services/CrawleeService.js
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/CrawleeService.js
git commit -m "fix: use system Chromium in Docker via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"
```

---

### Task 6: Add Playwright `executablePath` to GoogleMapsProvider

**Files:**
- Modify: `src/modules/ai/infrastructure/services/GoogleMapsProvider.js:777,878,974`

- [ ] **Step 1: Add `executablePath` to all 3 launchOptions blocks**

At line 777, current:
```js
        launchContext: {
          launchOptions: {
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-gpu',
              '--disable-blink-features=AutomationControlled',
              '--disable-dev-shm-usage',
            ],
          },
```

Change to:
```js
        launchContext: {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-gpu',
              '--disable-blink-features=AutomationControlled',
              '--disable-dev-shm-usage',
            ],
          },
```

Repeat the same change at line 878 and line 974 (identical pattern — add `executablePath` line before `args`).

- [ ] **Step 2: Verify lint passes**

```bash
npx eslint src/modules/ai/infrastructure/services/GoogleMapsProvider.js
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/GoogleMapsProvider.js
git commit -m "fix: use system Chromium for GoogleMaps PlaywrightCrawler instances"
```

---

### Task 7: Smoke test the full stack locally

- [ ] **Step 1: Create a `.env.prod.test` for local testing**

```bash
cat > .env.prod.test << 'EOF'
POSTGRES_USER=atrips
POSTGRES_PASSWORD=testpassword123
POSTGRES_DB=atrips
REDIS_PASSWORD=redistest123
SEARXNG_SECRET_KEY=testsecretkey
PORT=3000
JWT_SECRET=test-jwt-secret-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_REFRESH_SECRET=test-refresh-secret-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
FRONTEND_URL=http://localhost:3001
EOF
```

- [ ] **Step 2: Build and start the stack**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod.test up --build -d
```

Expected: All 4 services start. Backend waits for db/redis health checks, then runs migrations and starts.

- [ ] **Step 3: Check health endpoint**

```bash
# Wait for startup
sleep 30
curl -s http://localhost:3000/health | head -1
curl -s http://localhost:3000/ready | head -1
```

Expected: Both return 200 with JSON response.

- [ ] **Step 4: Tear down**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod.test down -v
rm .env.prod.test
```

- [ ] **Step 5: Add `.env.prod.test` to `.gitignore` (safety)**

Append to `.gitignore`:
```
.env.prod.test
```

- [ ] **Step 6: Final commit**

```bash
git add .gitignore
git commit -m "chore: add .env.prod.test to gitignore"
```
