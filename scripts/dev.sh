#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}   ATrips Backend Development Server${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}[1/5] Warning: .env file not found. Copying from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}      .env file created. Please update it with your configuration.${NC}"
    else
        echo -e "${RED}Error: .env.example not found. Please create .env file manually.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}[1/5] .env file found${NC}"
fi

# Load environment variables
set -a
source .env
set +a

# Start Docker containers (PostgreSQL + Redis)
echo -e "${YELLOW}[2/5] Starting Docker containers (PostgreSQL + Redis)...${NC}"
docker compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to start Docker containers. Make sure Docker is running.${NC}"
    exit 1
fi

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}[3/5] Waiting for PostgreSQL to be ready...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec atrips-postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}      PostgreSQL is ready!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}      Waiting for PostgreSQL... (${RETRY_COUNT}/${MAX_RETRIES})${NC}"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}Error: PostgreSQL failed to start in time.${NC}"
    exit 1
fi

# Verify PostgreSQL actually accepts connections (pg_isready can return true before accepting queries)
echo -e "${YELLOW}      Verifying database connection...${NC}"
RETRY_COUNT=0
while [ $RETRY_COUNT -lt 10 ]; do
    if docker exec atrips-postgres psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}      Database accepting connections!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

# Wait for Redis to be ready
echo -e "${YELLOW}      Checking Redis...${NC}"
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec atrips-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}      Redis is ready!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

# Generate Prisma client if needed
echo -e "${YELLOW}[4/5] Setting up Prisma...${NC}"
if [ ! -d "node_modules/.prisma/client" ]; then
    echo -e "${YELLOW}      Generating Prisma client...${NC}"
    ./node_modules/.bin/prisma generate
else
    echo -e "${GREEN}      Prisma client already generated${NC}"
fi

# Run database migrations
echo -e "${YELLOW}      Running database migrations...${NC}"
if ./node_modules/.bin/prisma migrate deploy 2>&1; then
    echo -e "${GREEN}      Migrations applied successfully!${NC}"
else
    echo -e "${YELLOW}      migrate deploy failed, trying db push...${NC}"
    if ./node_modules/.bin/prisma db push 2>&1; then
        echo -e "${GREEN}      Database schema pushed successfully!${NC}"
    else
        echo -e "${RED}Warning: Database migration failed. Check your DATABASE_URL.${NC}"
    fi
fi

# Enable logging (default to info if not set)
export LOG_LEVEL=${LOG_LEVEL:-info}
export NODE_ENV=${NODE_ENV:-development}

# Run the server with watch mode (Node.js 18+)
echo -e "${GREEN}[5/5] Starting server on port ${PORT:-3000}...${NC}"
echo -e "${YELLOW}      Log level: ${LOG_LEVEL}${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}   Server running at http://localhost:${PORT:-3000}${NC}"
echo -e "${GREEN}   Press Ctrl+C to stop${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Use node --watch for hot reload (Node 18+)
# Falls back to regular node if --watch is not supported
node --watch src/index.js || node src/index.js
