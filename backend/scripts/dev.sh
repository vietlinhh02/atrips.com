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
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}Error: PostgreSQL failed to start in time.${NC}"
    exit 1
fi

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
./node_modules/.bin/prisma migrate deploy || ./node_modules/.bin/prisma db push --accept-data-loss

if [ $? -ne 0 ]; then
    echo -e "${RED}Warning: Database migration may have issues. Check your DATABASE_URL.${NC}"
fi

# Start Browser Workers (Python browser-use microservice)
echo -e "${YELLOW}[5/7] Starting Browser Workers...${NC}"
WORKER_DIR="$(cd "$(dirname "$0")/../../python-workers" && pwd)"

if [ -d "$WORKER_DIR" ]; then
    if command -v docker &> /dev/null && [ -f "$WORKER_DIR/docker-compose.yml" ]; then
        echo -e "${YELLOW}      Building & starting browser-workers container...${NC}"
        docker compose -f "$WORKER_DIR/docker-compose.yml" up -d --build

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}      Browser Workers running at http://localhost:8500${NC}"
        else
            echo -e "${RED}      Warning: Browser Workers failed to start. Continuing without them.${NC}"
        fi
    else
        # Fallback: run directly with uvicorn if no Docker
        if command -v uv &> /dev/null || command -v python3 &> /dev/null; then
            echo -e "${YELLOW}      Starting browser-workers locally (no Docker)...${NC}"
            (
                cd "$WORKER_DIR"
                if [ ! -d ".venv" ]; then
                    echo -e "${YELLOW}      Creating venv & installing deps...${NC}"
                    uv venv 2>/dev/null || python3 -m venv .venv
                    . .venv/bin/activate
                    uv pip install -r requirements.txt 2>/dev/null || pip install -r requirements.txt
                    playwright install chromium
                else
                    . .venv/bin/activate
                fi
                uvicorn app.main:app --host 0.0.0.0 --port 8500 &
            )
            echo -e "${GREEN}      Browser Workers running at http://localhost:8500${NC}"
        else
            echo -e "${RED}      Warning: No Docker or Python found. Skipping browser-workers.${NC}"
        fi
    fi
else
    echo -e "${RED}      Warning: python-workers/ not found. Skipping browser-workers.${NC}"
fi

# Wait for Browser Workers to be ready
echo -e "${YELLOW}[6/7] Checking Browser Workers health...${NC}"
RETRY_COUNT=0
while [ $RETRY_COUNT -lt 15 ]; do
    if curl -s http://localhost:8500/health > /dev/null 2>&1; then
        echo -e "${GREEN}      Browser Workers healthy!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 2
done

if [ $RETRY_COUNT -eq 15 ]; then
    echo -e "${YELLOW}      Browser Workers not responding. AI planning will work without browser research.${NC}"
fi

# Enable logging (default to info if not set)
export LOG_LEVEL=${LOG_LEVEL:-info}
export NODE_ENV=${NODE_ENV:-development}

# Run the server with watch mode (Node.js 18+)
echo -e "${GREEN}[7/7] Starting server on port ${PORT:-3000}...${NC}"
echo -e "${YELLOW}      Log level: ${LOG_LEVEL}${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}   Server running at http://localhost:${PORT:-3000}${NC}"
echo -e "${GREEN}   Browser Workers at http://localhost:8500${NC}"
echo -e "${GREEN}   Press Ctrl+C to stop${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Cleanup browser-workers on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping Browser Workers...${NC}"
    if [ -f "$WORKER_DIR/docker-compose.yml" ]; then
        docker compose -f "$WORKER_DIR/docker-compose.yml" down 2>/dev/null
    fi
    # Kill background uvicorn if running locally
    pkill -f "uvicorn app.main:app.*8500" 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# Use node --watch for hot reload (Node 18+)
# Falls back to regular node if --watch is not supported
node --watch src/index.js || node src/index.js
