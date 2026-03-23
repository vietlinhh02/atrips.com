# 🔍 Tool API Integration Status

## Tổng quan
Tất cả tools đều có **graceful fallback** - khi không có API key, sẽ trả về data tham khảo/mock data thay vì lỗi.

---

## ✅ Tools Call Real APIs (Khi có API key)

### 1. **get_current_datetime** ✅ ALWAYS REAL
- ✅ **100% Real data** - Không cần API key
- Sử dụng: JavaScript Date API + timezone calculation
- Database: Đọc timezone từ user preferences
- **Status:** Luôn trả real data

---

### 2. **web_search** (searchHandlers.js)
#### ✅ Có EXA_API_KEY:
```javascript
// Real API call
fetch('https://api.exa.ai/search', {
  method: 'POST',
  headers: { 'x-api-key': this.exaApiKey },
  body: JSON.stringify({ query, numResults, ... })
})
```
**Trả về:** Real search results từ web/Google

#### ⚠️ KHÔNG có EXA_API_KEY:
```javascript
return {
  source: 'fallback',
  results: [],
  message: 'Web search không khả dụng. Vui lòng cấu hình EXA_API_KEY.',
  note: 'Đăng ký tại https://exa.ai để lấy API key miễn phí'
}
```
**Trả về:** Empty results + thông báo cần API key

---

### 3. **search_places** (searchHandlers.js)
#### Thứ tự ưu tiên:
1. ✅ **Database** - Tìm từ cached_places
2. ✅ **Mapbox API** (nếu có MAPBOX_ACCESS_TOKEN)
   ```javascript
   fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/...`)
   ```
3. ❌ **Fallback** - Generate mock places
   ```javascript
   places: generateMockPlaces(location, type, query, limit)
   // Trả về: "Nhà hàng location 1", "Quán ăn location 2",...
   ```

**Status:**
- Có Mapbox token → Real data
- Không có token → Mock data (generic names)

---

### 4. **get_weather** (infoHandlers.js)
#### Thứ tự ưu tiên:
1. ✅ **Database** - Cached weather forecasts
2. ✅ **OpenWeatherMap API** (nếu có OPENWEATHER_API_KEY)
   ```javascript
   fetch(`https://api.openweathermap.org/data/2.5/weather?...`)
   fetch(`https://api.openweathermap.org/data/2.5/forecast?...`)
   ```
3. ❌ **Fallback**
   ```javascript
   return {
     source: 'fallback',
     temperature: { min: 22, max: 32, current: 28 },
     humidity: 75,
     condition: 'Dữ liệu tham khảo',
     note: 'Vui lòng cấu hình OPENWEATHER_API_KEY...'
   }
   ```

**Status:**
- Có OpenWeather key → Real weather
- Không có → Static mock data (22-32°C)

---

### 5. **calculate_distance** (infoHandlers.js)
#### ✅ Có MAPBOX_ACCESS_TOKEN:
```javascript
// 1. Geocode origin & destination
geocodeLocation(origin)
geocodeLocation(destination)

// 2. Get directions
fetch(`https://api.mapbox.com/directions/v5/mapbox/${profile}/...`)
```
**Trả về:** Real distance, duration, turn-by-turn steps

#### ❌ Fallback:
```javascript
return {
  source: 'fallback',
  distance: '~',
  duration: '~',
  note: 'Vui lòng cấu hình MAPBOX_ACCESS_TOKEN...'
}
```

**Status:**
- Có Mapbox → Real directions
- Không có → "~" (unknown)

---

### 6. **get_exchange_rate** (infoHandlers.js)
#### Thứ tự ưu tiên:
1. ✅ **Database** - Cached currency rates
2. ✅ **ExchangeRate-API** (FREE - không cần key!)
   ```javascript
   fetch(`https://api.exchangerate-api.com/v4/latest/${from}`)
   ```
3. ❌ **Fallback** - Static rates
   ```javascript
   const mockRates = {
     'USD_VND': 24500,
     'EUR_VND': 26500,
     // ... hardcoded rates
   }
   ```

**Status:**
- ✅ **ALWAYS CALLS REAL API** (free public API)
- Fallback chỉ khi API fail

---

### 7. **search_flights** (bookingHandlers.js)
#### ✅ Có AMADEUS_CLIENT_ID + SECRET:
```javascript
// 1. Get OAuth token
fetch('https://test.api.amadeus.com/v1/security/oauth2/token')

// 2. Search flights
fetch('https://test.api.amadeus.com/v2/shopping/flight-offers?...')
```
**Trả về:** Real flight offers với giá thực

#### ❌ Fallback:
```javascript
flights: [
  { airline: 'Vietnam Airlines', flightNumber: 'VN***',
    price: 1500000, note: 'Giá tham khảo' },
  { airline: 'VietJet Air', flightNumber: 'VJ***',
    price: 1200000, note: 'Giá tham khảo' },
  { airline: 'Bamboo Airways', flightNumber: 'QH***',
    price: 1350000, note: 'Giá tham khảo' }
]
```

**Status:**
- Có Amadeus → Real flights
- Không có → Mock data (generic airlines, estimated prices)

---

### 8. **search_hotels** (bookingHandlers.js)
#### ✅ Có RAPIDAPI_KEY:
```javascript
// 1. Get destination ID
fetch('https://booking-com.p.rapidapi.com/v1/hotels/locations?...')

// 2. Search hotels
fetch('https://booking-com.p.rapidapi.com/v1/hotels/search?...')
```
**Trả về:** Real hotels từ Booking.com

#### ❌ Fallback:
```javascript
hotels: [
  { name: 'Grand Hotel Location', rating: 4.5,
    pricePerNight: 1500000, note: 'Giá tham khảo' },
  { name: 'Boutique Hotel Location', rating: 4.2,
    pricePerNight: 1000000, note: 'Giá tham khảo' },
  { name: 'Cozy Homestay Location', rating: 4.7,
    pricePerNight: 500000, note: 'Giá tham khảo' }
]
```

**Status:**
- Có RapidAPI key → Real hotels from Booking.com
- Không có → Mock data (generic names)

---

### 9. **get_local_events** (bookingHandlers.js)
#### Thứ tự ưu tiên:
1. ✅ **Database** - Cached local_events
2. ✅ **Ticketmaster API** (nếu có TICKETMASTER_API_KEY)
   ```javascript
   fetch('https://app.ticketmaster.com/discovery/v2/events.json?...')
   ```
3. ❌ **Fallback**
   ```javascript
   events: [{
     title: 'Sự kiện tại location',
     description: 'Thông tin sự kiện đang được cập nhật',
     note: 'Dữ liệu tham khảo'
   }]
   ```

**Status:**
- Có Ticketmaster → Real events
- Không có → Generic placeholder

---

### 10. **get_travel_tips** (infoHandlers.js)
#### ✅ ALWAYS REAL
- ✅ **Hardcoded knowledge base** + Database lookup
- Không cần API key
- 7 categories: safety, culture, food, transport, money, weather, packing
- **Status:** Luôn trả real tips

---

### 11. **search_social_media** (socialMediaHandlers.js) 🆕
#### ✅ Có EXA_API_KEY:
```javascript
fetch('https://api.exa.ai/search', {
  body: JSON.stringify({
    query,
    includeDomains: ['youtube.com', 'facebook.com', 'tiktok.com', ...]
  })
})
```
**Trả về:** Real content từ social media

#### ❌ Fallback:
```javascript
return {
  source: 'fallback',
  results: [],
  message: 'Social media search không khả dụng.',
  note: 'Cần EXA_API_KEY...'
}
```

---

### 12. **search_youtube_videos** (socialMediaHandlers.js) 🆕
#### Thứ tự ưu tiên:
1. ✅ **YouTube Data API v3** (nếu có YOUTUBE_API_KEY)
   ```javascript
   fetch('https://www.googleapis.com/youtube/v3/search?...')
   fetch('https://www.googleapis.com/youtube/v3/videos?...') // Get stats
   ```
   **Trả về:** Views, likes, duration, full details

2. ✅ **Exa API** (nếu có EXA_API_KEY)
   ```javascript
   fetch('https://api.exa.ai/search', {
     body: JSON.stringify({
       query: `${query} site:youtube.com`,
       includeDomains: ['youtube.com']
     })
   })
   ```
   **Trả về:** Video URLs, titles, descriptions (không có views/likes)

3. ❌ **Fallback**
   ```javascript
   return {
     source: 'fallback',
     videos: [],
     message: 'YouTube search không khả dụng.',
     note: 'Cần YOUTUBE_API_KEY hoặc EXA_API_KEY...'
   }
   ```

---

### 13. **create_trip_plan** (planningHandlers.js)
#### ✅ ALWAYS REAL
- Saves to database (ai_itinerary_drafts)
- Enrichment features:
  - **Geocoding:** Mapbox API (if token available)
  - **Images:** Pexels API (if key available) → Fallback to Lorem Picsum
- **Status:** Core functionality always works

---

## 📊 Summary Table

| Tool | Real Data? | Requires API Key? | Fallback Behavior |
|------|-----------|-------------------|-------------------|
| `get_current_datetime` | ✅ Always | ❌ No | N/A |
| `web_search` | ✅ Yes | ✅ EXA_API_KEY | Empty results |
| `search_places` | ✅ Yes | ✅ MAPBOX_ACCESS_TOKEN | Mock places |
| `get_weather` | ✅ Yes | ✅ OPENWEATHER_API_KEY | Static 22-32°C |
| `calculate_distance` | ✅ Yes | ✅ MAPBOX_ACCESS_TOKEN | "~" unknown |
| `get_exchange_rate` | ✅ Always* | ❌ No (free API) | Static rates |
| `search_flights` | ✅ Yes | ✅ AMADEUS credentials | Mock flights |
| `search_hotels` | ✅ Yes | ✅ RAPIDAPI_KEY | Mock hotels |
| `get_local_events` | ✅ Yes | ✅ TICKETMASTER_API_KEY | Placeholder |
| `get_travel_tips` | ✅ Always | ❌ No | N/A |
| `search_social_media` | ✅ Yes | ✅ EXA_API_KEY | Empty results |
| `search_youtube_videos` | ✅ Yes | ⚠️ YOUTUBE_API_KEY or EXA | Empty results |
| `create_trip_plan` | ✅ Always | ❌ No | Degraded features |

\* Uses free public API, no key needed

---

## 🎯 Priority API Keys to Configure

### High Priority (Most Impact)
1. **EXA_API_KEY** - Enables:
   - ✅ web_search (Google/web search)
   - ✅ search_social_media (all platforms)
   - ✅ search_youtube_videos (fallback)
   - **Free:** 1000 searches/month
   - **Impact:** 🔥🔥🔥 HIGHEST

2. **MAPBOX_ACCESS_TOKEN** - Enables:
   - ✅ search_places (POI search)
   - ✅ calculate_distance (directions)
   - ✅ Geocoding for weather
   - **Free:** 100K requests/month
   - **Impact:** 🔥🔥🔥 HIGHEST

### Medium Priority
3. **OPENWEATHER_API_KEY** - Enables:
   - ✅ get_weather (real forecasts)
   - **Free:** 1000 calls/day
   - **Impact:** 🔥🔥 HIGH

4. **YOUTUBE_API_KEY** - Enables:
   - ✅ search_youtube_videos (views, likes, duration)
   - **Free:** 10K units/day
   - **Impact:** 🔥 MEDIUM (Exa can substitute)

### Low Priority (Nice to Have)
5. **AMADEUS_CLIENT_ID + SECRET** - Enables:
   - ✅ search_flights (real prices)
   - **Free:** Test tier available
   - **Impact:** 🔥 LOW (users likely book elsewhere)

6. **RAPIDAPI_KEY** - Enables:
   - ✅ search_hotels (Booking.com)
   - **Cost:** Paid tiers only
   - **Impact:** 🔥 LOW

7. **TICKETMASTER_API_KEY** - Enables:
   - ✅ get_local_events (real events)
   - **Free:** Available
   - **Impact:** 🔥 LOW (limited use case)

---

## 🚀 Recommended Setup

### Minimal Setup (Free, High Impact)
```bash
# .env
EXA_API_KEY=your_key              # Web + social search
MAPBOX_ACCESS_TOKEN=your_token    # Places + directions
OPENWEATHER_API_KEY=your_key      # Weather
```

**Result:** ~80% of tools work with real data!

### Optional Enhancements
```bash
YOUTUBE_API_KEY=your_key          # Detailed YouTube stats
PEXELS_API_KEY=your_key           # Better trip images
```

---

## 🔍 How to Identify Fallback Data

All responses include a `source` field:
- `"source": "exa"` / `"amadeus"` / `"mapbox"` → ✅ Real data
- `"source": "database"` / `"cache"` → ✅ Real data (cached)
- `"source": "fallback"` → ⚠️ Mock/placeholder data
- Response includes `"note": "Vui lòng cấu hình..."` → ⚠️ Needs API key

---

## 📝 Testing Tools

Check which tools need API keys:
```javascript
// Test in AI chat
"Tìm quán ăn ngon ở Đà Lạt"        // → Uses search_places
"Thời tiết Hà Nội ngày mai"        // → Uses get_weather
"Khoảng cách từ Hà Nội đến Sapa"  // → Uses calculate_distance
"Tìm video YouTube về du lịch"     // → Uses search_youtube_videos
```

Check response for:
- ✅ Real data: `source: "mapbox"`, `source: "openweathermap"`
- ⚠️ Mock data: `source: "fallback"`, `note: "Dữ liệu tham khảo"`
