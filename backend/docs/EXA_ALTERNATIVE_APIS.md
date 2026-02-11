# ⚠️ DEPRECATED - Exa API đã được thay thế

**Tài liệu này đã lỗi thời. Dự án đã chuyển sang SearXNG + Crawlee.**

👉 **Xem tài liệu mới**: [SEARXNG_CRAWLEE_SETUP.md](./SEARXNG_CRAWLEE_SETUP.md)

---

# 🚀 Exa as Alternative API Solution (DEPRECATED)

## Vấn đề

Bạn **KHÔNG CÓ** các API keys sau:
- ❌ AMADEUS_CLIENT_ID + SECRET (flights)
- ❌ RAPIDAPI_KEY (hotels)
- ❌ TICKETMASTER_API_KEY (events)

## ✅ Giải pháp: Dùng EXA_API_KEY thay thế!

Thay vì cần 3 API keys riêng, giờ **CHỈ CẦN 1 EXA_API_KEY** để search tất cả!

---

## 🔄 Cách hoạt động

### Priority Flow (đã update)

#### 1️⃣ **search_flights**
```javascript
// Priority 1: Amadeus API (nếu có key)
if (AMADEUS_CLIENT_ID && AMADEUS_CLIENT_SECRET) {
  return searchAmadeusFlights() // ✅ Real flight offers + prices
}

// Priority 2: Exa Web Search (NẾU CÓ EXA_API_KEY) 🆕
if (EXA_API_KEY) {
  return searchFlightsViaExa() // ✅ Real search results từ:
  // - Google Flights
  // - Traveloka
  // - Skyscanner
  // - VietJet, Vietnam Airlines, Bamboo Airways
}

// Priority 3: Fallback
return searchFlightsFallback() // ❌ Mock data
```

**Kết quả với Exa:**
```json
{
  "source": "exa_web_search",
  "origin": "Hà Nội",
  "destination": "Đà Nẵng",
  "searchResults": [
    {
      "title": "Vé máy bay Hà Nội - Đà Nẵng từ 500K | Traveloka",
      "url": "https://traveloka.com/...",
      "snippet": "Đặt vé máy bay Hà Nội Đà Nẵng giá rẻ từ 500.000đ...",
      "highlights": ["500.000đ", "Vietnam Airlines", "VietJet"]
    }
  ],
  "bookingLinks": [
    { "site": "Traveloka", "url": "https://..." },
    { "site": "Google", "url": "https://google.com/travel/flights..." }
  ],
  "note": "Kết quả từ web search. Click vào link để xem giá chi tiết."
}
```

---

#### 2️⃣ **search_hotels**
```javascript
// Priority 1: RapidAPI Booking.com (nếu có key)
if (RAPIDAPI_KEY) {
  return searchRapidAPIHotels() // ✅ Real hotels from Booking.com
}

// Priority 2: Exa Web Search (NẾU CÓ EXA_API_KEY) 🆕
if (EXA_API_KEY) {
  return searchHotelsViaExa() // ✅ Real search results từ:
  // - Booking.com
  // - Agoda
  // - Hotels.com
  // - Airbnb
  // - TripAdvisor
}

// Priority 3: Fallback
return searchHotelsFallback() // ❌ Mock data
```

**Kết quả với Exa:**
```json
{
  "source": "exa_web_search",
  "location": "Đà Lạt",
  "checkIn": "2026-03-15",
  "checkOut": "2026-03-17",
  "searchResults": [
    {
      "title": "Top 10 khách sạn Đà Lạt giá tốt | Booking.com",
      "url": "https://booking.com/...",
      "snippet": "Khách sạn 4 sao từ 800K/đêm. Free WiFi, breakfast...",
      "highlights": ["800K/đêm", "4 sao", "Trung tâm"],
      "site": "Booking"
    }
  ],
  "bookingLinks": [
    { "site": "Booking", "url": "https://..." },
    { "site": "Agoda", "url": "https://..." }
  ],
  "note": "Kết quả từ web search. Click vào link để xem giá và đặt phòng."
}
```

---

#### 3️⃣ **get_local_events**
```javascript
// Priority 1: Database
const dbEvents = await getEventsFromDB()
if (dbEvents.length > 0) return dbEvents

// Priority 2: Ticketmaster API (nếu có key)
if (TICKETMASTER_API_KEY) {
  return searchTicketmasterEvents() // ✅ Real events
}

// Priority 3: Exa Web Search (NẾU CÓ EXA_API_KEY) 🆕
if (EXA_API_KEY) {
  return searchLocalEventsViaExa() // ✅ Real events từ:
  // - Facebook Events
  // - Eventbrite
  // - Ticketbox.vn
  // - Thiso.io
}

// Priority 4: Fallback
return getEventsFallback() // ❌ Mock data
```

**Kết quả với Exa:**
```json
{
  "source": "exa_web_search",
  "location": "TP.HCM",
  "category": "music",
  "events": [
    {
      "title": "Đêm nhạc Rock Việt 2026 | Ticketbox",
      "url": "https://ticketbox.vn/...",
      "description": "Concert rock lớn nhất năm tại TPHCM...",
      "highlights": ["15/03/2026", "500K-1M5"],
      "platform": "Ticketbox"
    }
  ],
  "note": "Kết quả từ web search. Click vào link để xem chi tiết và đăng ký."
}
```

---

## 📊 So sánh các phương pháp

### Flights
| Method | Data Type | API Key Required | Cost |
|--------|-----------|------------------|------|
| **Amadeus API** | ✅ Real prices, exact flights | AMADEUS credentials | Free (test tier) |
| **Exa Web Search** 🆕 | ✅ Real search results, booking links | EXA_API_KEY | Free (1000/month) |
| **Fallback** | ❌ Mock data | None | - |

### Hotels
| Method | Data Type | API Key Required | Cost |
|--------|-----------|------------------|------|
| **RapidAPI Booking** | ✅ Real hotels, prices | RAPIDAPI_KEY | Paid |
| **Exa Web Search** 🆕 | ✅ Real search results, booking links | EXA_API_KEY | Free (1000/month) |
| **Fallback** | ❌ Mock data | None | - |

### Events
| Method | Data Type | API Key Required | Cost |
|--------|-----------|------------------|------|
| **Database** | ✅ Cached events | None | - |
| **Ticketmaster** | ✅ Real events | TICKETMASTER_API_KEY | Free |
| **Exa Web Search** 🆕 | ✅ Real search results, event links | EXA_API_KEY | Free (1000/month) |
| **Fallback** | ❌ Mock data | None | - |

---

## 🎯 Setup đơn giản

### Chỉ cần 1 API key!
```bash
# .env
EXA_API_KEY=your_exa_api_key_here
```

**Kết quả:**
- ✅ **search_flights** → Real results từ Google Flights, Traveloka, Skyscanner
- ✅ **search_hotels** → Real results từ Booking, Agoda, Hotels.com
- ✅ **get_local_events** → Real results từ Facebook Events, Eventbrite

---

## 🔍 AI sẽ tự động xử lý

Khi user hỏi:
```
"Tìm vé máy bay từ Hà Nội đến Đà Nẵng ngày 15/3"
```

AI flow:
1. Call tool: `search_flights()`
2. Check: Có AMADEUS key? → Không
3. Check: Có EXA key? → **Có!** ✅
4. Execute: `searchFlightsViaExa()`
5. Return: Real search results với booking links

---

## 💡 Ưu điểm

### 1. **Chỉ cần 1 API key thay vì 3**
- ❌ Before: AMADEUS + RAPIDAPI + TICKETMASTER
- ✅ After: **CHỈ EXA_API_KEY**

### 2. **Free tier lớn**
- 1,000 searches/month
- Đủ cho development + testing

### 3. **Real data, không phải mock**
- Search results từ websites thực
- User click vào link để xem giá chi tiết

### 4. **Coverage rộng hơn**
- Flights: Google Flights, Traveloka, Skyscanner, airlines
- Hotels: Booking, Agoda, Hotels.com, Airbnb
- Events: Facebook, Eventbrite, Ticketbox, Thiso

### 5. **Flexible domain filtering**
- Có thể thêm/bớt domains dễ dàng
- Support local sites (Traveloka, Ticketbox.vn)

---

## ⚠️ Lưu ý

### Khác biệt với Dedicated APIs

#### Amadeus vs Exa Flights
| Feature | Amadeus API | Exa Web Search |
|---------|-------------|----------------|
| Exact prices | ✅ Yes | ❌ Click to view |
| Flight numbers | ✅ Yes | ⚠️ In snippet |
| Direct booking | ✅ Yes | ❌ Redirect to site |
| Real-time availability | ✅ Yes | ⚠️ Search results |
| Setup complexity | Medium | Easy |

#### RapidAPI vs Exa Hotels
| Feature | RapidAPI | Exa Web Search |
|---------|----------|----------------|
| Exact prices | ✅ Yes | ❌ Click to view |
| Availability | ✅ Real-time | ⚠️ Search results |
| Reviews/ratings | ✅ Yes | ⚠️ In snippet |
| Direct booking | ✅ Yes | ❌ Redirect to site |
| Cost | Paid | Free |

### Khi nào nên dùng Dedicated APIs?

Dùng dedicated APIs nếu:
- ✅ Cần **exact prices** trong response
- ✅ Cần **direct booking** flow
- ✅ Cần **real-time availability**
- ✅ Budget cho paid APIs

Dùng Exa Web Search nếu:
- ✅ Muốn **free solution**
- ✅ OK với redirect user to booking sites
- ✅ Cần **coverage nhiều sites**
- ✅ Development/testing phase

---

## 🚀 Quick Start

### 1. Get Exa API Key
```bash
# Visit https://exa.ai
# Sign up (free)
# Copy API key
```

### 2. Add to .env
```bash
EXA_API_KEY=your_exa_api_key_here
```

### 3. Restart server
```bash
npm run dev
```

### 4. Test
Ask AI:
```
"Tìm vé máy bay Hà Nội - Đà Nẵng ngày 15/3"
"Tìm khách sạn Đà Lạt check-in 20/3 check-out 22/3"
"Có sự kiện gì ở TP.HCM tuần này?"
```

AI sẽ tự động dùng Exa web search! ✅

---

## 📝 Example Responses

### Flight Search via Exa
```json
{
  "source": "exa_web_search",
  "origin": "Hà Nội",
  "destination": "Đà Nẵng",
  "departureDate": "2026-03-15",
  "passengers": 1,
  "searchResults": [
    {
      "title": "Vé Máy Bay Hà Nội Đà Nẵng Từ 500K | Traveloka",
      "url": "https://traveloka.com/vi-vn/flight/...",
      "snippet": "Đặt vé máy bay Hà Nội - Đà Nẵng giá rẻ chỉ từ 500.000đ. Vietnam Airlines, VietJet, Bamboo Airways. Bay trực tiếp 1h20.",
      "highlights": [
        "500.000đ",
        "Vietnam Airlines bay lúc 06:00",
        "VietJet 450K lúc 08:30"
      ]
    },
    {
      "title": "Chuyến bay Hà Nội (HAN) đến Đà Nẵng (DAD) | Google",
      "url": "https://google.com/travel/flights/search?...",
      "snippet": "So sánh giá vé máy bay từ các hãng. Giá từ 475.000đ - 1.200.000đ...",
      "highlights": ["475.000đ", "So sánh 3 hãng"]
    }
  ],
  "bookingLinks": [
    { "site": "Traveloka", "url": "https://..." },
    { "site": "Google", "url": "https://..." },
    { "site": "Vietjetair", "url": "https://..." }
  ],
  "note": "Kết quả từ web search. Click vào link để xem giá chi tiết và đặt vé."
}
```

### Hotel Search via Exa
```json
{
  "source": "exa_web_search",
  "location": "Đà Lạt",
  "checkIn": "2026-03-20",
  "checkOut": "2026-03-22",
  "guests": 2,
  "budget": "mid-range",
  "searchResults": [
    {
      "title": "15 khách sạn 4 sao Đà Lạt giá tốt | Booking.com",
      "url": "https://booking.com/searchresults.vi.html?...",
      "snippet": "Khách sạn 4 sao trung tâm Đà Lạt từ 800.000đ/đêm. Miễn phí WiFi, ăn sáng, hồ bơi...",
      "highlights": [
        "800.000đ/đêm",
        "Gần chợ Đà Lạt",
        "Đánh giá 8.5/10"
      ],
      "site": "Booking"
    },
    {
      "title": "Khách sạn Đà Lạt giá rẻ từ 500K | Agoda",
      "url": "https://agoda.com/vi-vn/search?...",
      "snippet": "Top khách sạn Đà Lạt view đẹp, giá tốt. Free cancellation...",
      "highlights": ["Từ 500K", "Hủy miễn phí"],
      "site": "Agoda"
    }
  ],
  "note": "Kết quả từ web search. Click vào link để xem giá và đặt phòng."
}
```

---

## 🎉 Tóm tắt

**TRƯỚC:**
- ❌ Cần 3 API keys: Amadeus, RapidAPI, Ticketmaster
- ❌ Phức tạp setup
- ❌ Nhiều keys paid

**SAU (với Exa):**
- ✅ Chỉ cần 1 API key: EXA_API_KEY
- ✅ Free 1000 searches/month
- ✅ Real data từ multiple sites
- ✅ Easy setup

**Chỉ cần:**
```bash
EXA_API_KEY=xxx
```

**Và bạn có:**
- ✅ Flights search từ Google/Traveloka/Skyscanner
- ✅ Hotels search từ Booking/Agoda/Hotels.com
- ✅ Events search từ Facebook/Eventbrite/Ticketbox

🎯 **Done!**
