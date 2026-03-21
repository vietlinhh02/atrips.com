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
