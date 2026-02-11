# 🎉 Exa → SearXNG + Crawlee Migration Complete!

## Tóm tắt

Dự án đã **thay thế Exa API** bằng **SearXNG + Crawlee** thành công!

### ✅ Thay đổi

| Trước (Exa) | Sau (SearXNG + Crawlee) |
|-------------|-------------------------|
| ❌ Cần API key | ✅ Không cần API key |
| ❌ 1000 searches/month | ✅ Unlimited |
| ❌ $49/month (paid tier) | ✅ 100% Free |
| ❌ Rate limit: 5/s | ✅ No rate limit |
| ❌ Single source | ✅ Multiple engines |
| ❌ Cloud dependency | ✅ Self-hosted |

---

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run setup script
bash scripts/setup-searxng.sh
```

Script sẽ tự động:
1. ✅ Install dependencies (crawlee, cheerio, playwright)
2. ✅ Start SearXNG container
3. ✅ Configure .env
4. ✅ Run tests
5. ✅ Show status

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Start SearXNG
docker compose up -d searxng

# 3. Update .env
cat >> .env << EOF
SEARXNG_URL=http://localhost:8080
SEARXNG_SECRET_KEY=ultrasecretkey-change-in-production
EOF

# 4. Test
node scripts/test-searxng.js

# 5. Start backend
npm run dev
```

---

## 📝 Files Changed

### New Files
```
✨ src/modules/ai/infrastructure/services/SearxngService.js
✨ src/modules/ai/infrastructure/services/CrawleeService.js
✨ config/searxng/settings.yml
✨ docs/SEARXNG_CRAWLEE_SETUP.md
✨ scripts/setup-searxng.sh
✨ scripts/test-searxng.js
```

### Modified Files
```
📝 docker-compose.yml (added searxng service)
📝 package.json (added crawlee, cheerio, playwright)
📝 .env (SEARXNG_URL, deprecated EXA_API_KEY)
📝 .env.example (updated documentation)
📝 src/modules/ai/infrastructure/services/handlers/searchHandlers.js (replaced Exa with SearXNG)
📝 src/modules/ai/infrastructure/services/ToolExecutor.js (removed exaApiKey)
📝 docs/EXA_ALTERNATIVE_APIS.md (marked as deprecated)
```

---

## 🧪 Testing

### 1. Test SearXNG

```bash
# Health check
curl http://localhost:8080/

# Search test
curl "http://localhost:8080/search?q=vietnam+travel&format=json"
```

### 2. Test Integration

```bash
# Run test script
node scripts/test-searxng.js
```

Expected output:
```
🧪 Testing SearXNG + Crawlee Integration

📝 Test 1: SearXNG Service
   ✓ SearxngService imported
   ✓ SearXNG is healthy
   🔍 Testing search...
   ✓ Search successful! Found 10 results
   ✓ Engines used: google, bing, duckduckgo

📝 Test 2: Crawlee Service
   ✓ CrawleeService imported
   🕷️ Testing enrichment...
   ✓ Enrichment successful!

📝 Test 3: Integration Test
   ✓ Search handlers created
   🔍 Testing webSearch handler...
   ✓ webSearch successful!

✅ All tests passed!
```

### 3. Test AI Chat

Start backend và test với AI:

```bash
npm run dev
```

Ask AI:
```
"Tìm thông tin về du lịch Đà Lạt 2026"
```

AI sẽ:
1. ✅ Call `webSearch()` tool
2. ✅ SearXNG search từ multiple engines
3. ✅ Crawlee enrich top results
4. ✅ Return enriched data

---

## 📊 Architecture

```
User Question
     ↓
AI Agent (Gemini/Claude)
     ↓
webSearch() tool
     ↓
┌─────────────────────┐
│  SearxngService     │
│  ├─ Google          │
│  ├─ Bing            │
│  ├─ DuckDuckGo      │
│  └─ Brave           │
└─────────┬───────────┘
          ↓
    Search Results
          ↓
┌─────────────────────┐
│  CrawleeService     │
│  ├─ Scrape URLs     │
│  ├─ Extract content │
│  ├─ Get highlights  │
│  └─ Add metadata    │
└─────────┬───────────┘
          ↓
   Enriched Results
          ↓
     AI Response
          ↓
        User
```

---

## 🔧 Configuration

### SearXNG Engines

Edit `config/searxng/settings.yml`:

```yaml
engines:
  - name: google
    engine: google
    shortcut: gg

  - name: bing
    engine: bing
    shortcut: bi
```

### Crawlee Settings

Edit `src/modules/ai/infrastructure/services/CrawleeService.js`:

```javascript
const MAX_CONCURRENT_REQUESTS = 3;  // Concurrent crawls
const REQUEST_TIMEOUT = 15000;       // Timeout per request
const CRAWL_CACHE_TTL = 3600;        // Cache duration
```

### Environment Variables

```bash
# SearXNG
SEARXNG_URL=http://localhost:8080
SEARXNG_SECRET_KEY=your-secret-key

# Old (deprecated)
# EXA_API_KEY=not-needed-anymore
```

---

## 📚 Documentation

- **Full Setup Guide**: [docs/SEARXNG_CRAWLEE_SETUP.md](docs/SEARXNG_CRAWLEE_SETUP.md)
- **SearXNG Docs**: https://docs.searxng.org/
- **Crawlee Docs**: https://crawlee.dev/

---

## 🐛 Troubleshooting

### Issue: SearXNG not starting

```bash
# Check logs
docker compose logs searxng

# Restart
docker compose restart searxng
```

### Issue: No search results

```bash
# Test SearXNG directly
curl "http://localhost:8080/search?q=test&format=json"

# Check if running
docker compose ps searxng
```

### Issue: Crawlee timeout

```javascript
// Increase timeout in CrawleeService.js
const REQUEST_TIMEOUT = 30000; // 30 seconds
```

---

## 🎯 Next Steps

1. ✅ **Setup complete** - SearXNG + Crawlee is running
2. 📝 **Test thoroughly** - Try various search queries
3. ⚙️ **Optimize** - Tune settings for your use case
4. 📊 **Monitor** - Watch logs and performance
5. 🚀 **Production** - Deploy with proper security

### Production Checklist

- [ ] Change `SEARXNG_SECRET_KEY` to random value
- [ ] Add authentication to SearXNG
- [ ] Setup proxy/CDN for SearXNG
- [ ] Configure rate limiting
- [ ] Setup monitoring & alerts
- [ ] Backup SearXNG config

---

## 💡 Tips

1. **Performance**: Disable unused engines in `settings.yml`
2. **Privacy**: SearXNG doesn't log searches by default
3. **Caching**: Results are cached for 30 mins (configurable)
4. **Enrichment**: Top 3 results enriched by Crawlee (optional)
5. **Fallback**: If SearXNG fails, returns fallback message

---

## ✅ Benefits Summary

### Cost
- **Before**: $0/month (free tier) → $49/month (paid)
- **After**: $0/month forever (self-hosted)

### Limits
- **Before**: 1,000 searches/month → unlimited paid
- **After**: Unlimited searches

### Privacy
- **Before**: Data sent to Exa servers
- **After**: All data stays on your server

### Performance
- **Before**: Single source (Exa)
- **After**: Multiple sources (Google, Bing, etc.)

### Control
- **Before**: Dependent on Exa API
- **After**: Full control over search pipeline

---

## 🎉 Done!

Migration từ Exa sang SearXNG + Crawlee đã hoàn tất thành công!

**Enjoy unlimited, free, self-hosted web search! 🚀**

Questions? Check [docs/SEARXNG_CRAWLEE_SETUP.md](docs/SEARXNG_CRAWLEE_SETUP.md)
