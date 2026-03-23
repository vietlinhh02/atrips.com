#!/bin/bash

# SearXNG + Crawlee Setup Script
# This script automates the setup process

set -e

echo "🚀 Setting up SearXNG + Crawlee"
echo "================================"
echo ""

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker is installed"

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker Compose is available"
echo ""

# Install Node dependencies
echo "📦 Installing Node dependencies..."
if [ -f "package.json" ]; then
    npm install
    echo "✅ Dependencies installed"
else
    echo "❌ package.json not found. Are you in the project root?"
    exit 1
fi
echo ""

# Check SearXNG config
echo "🔧 Checking SearXNG configuration..."
if [ ! -f "config/searxng/settings.yml" ]; then
    echo "❌ SearXNG config not found at config/searxng/settings.yml"
    exit 1
fi

echo "✅ SearXNG config found"
echo ""

# Start SearXNG container
echo "🐳 Starting SearXNG container..."
docker compose up -d searxng

# Wait for SearXNG to be ready
echo "⏳ Waiting for SearXNG to be ready..."
RETRY=0
MAX_RETRY=30
until curl -s http://localhost:8080/ > /dev/null 2>&1 || [ $RETRY -eq $MAX_RETRY ]; do
    echo "   Waiting... ($RETRY/$MAX_RETRY)"
    sleep 2
    RETRY=$((RETRY+1))
done

if [ $RETRY -eq $MAX_RETRY ]; then
    echo "❌ SearXNG failed to start within 60 seconds"
    echo "   Check logs: docker compose logs searxng"
    exit 1
fi

echo "✅ SearXNG is ready!"
echo ""

# Update .env if needed
echo "📝 Checking .env configuration..."
if ! grep -q "SEARXNG_URL" .env; then
    echo "⚠️ SEARXNG_URL not found in .env"
    echo "   Adding SEARXNG_URL to .env..."
    echo "" >> .env
    echo "# SearXNG Configuration" >> .env
    echo "SEARXNG_URL=http://localhost:8080" >> .env
    echo "SEARXNG_SECRET_KEY=ultrasecretkey-change-in-production" >> .env
    echo "✅ Added SEARXNG_URL to .env"
else
    echo "✅ SEARXNG_URL already configured"
fi
echo ""

# Run test
echo "🧪 Running integration tests..."
node scripts/test-searxng.js

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Setup completed successfully!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📚 Useful commands:"
    echo "  • Start backend:     npm run dev"
    echo "  • View SearXNG:      open http://localhost:8080"
    echo "  • SearXNG logs:      docker compose logs -f searxng"
    echo "  • Stop SearXNG:      docker compose stop searxng"
    echo "  • Restart SearXNG:   docker compose restart searxng"
    echo ""
    echo "📖 Documentation: docs/SEARXNG_CRAWLEE_SETUP.md"
    echo ""
else
    echo ""
    echo "❌ Tests failed. Please check the errors above."
    exit 1
fi
