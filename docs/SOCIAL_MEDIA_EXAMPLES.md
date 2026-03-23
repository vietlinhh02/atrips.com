# 🎬 Social Media Search Examples

## Ví dụ thực tế về cách AI sử dụng social media tools

## 1️⃣ Tìm video YouTube review resort

**User hỏi:**
> "Tìm video review resort ở Phú Quốc trong 3 tháng gần đây"

**AI sẽ call tool:**
```json
{
  "tool": "search_social_media",
  "arguments": {
    "query": "review resort Phú Quốc",
    "platforms": ["youtube"],
    "contentType": "review",
    "recency": "3months",
    "numResults": 5
  }
}
```

**Response:**
```json
{
  "source": "exa",
  "query": "review resort Phú Quốc review",
  "platforms": ["youtube"],
  "results": [
    {
      "title": "Review Resort 5 Sao Ở Phú Quốc - Trải Nghiệm Thực Tế",
      "url": "https://youtube.com/watch?v=...",
      "platform": "youtube",
      "publishedDate": "2026-01-15",
      "text": "Chi tiết về resort, dịch vụ, giá cả...",
      "highlights": ["Resort đẹp", "Dịch vụ tốt"]
    }
  ]
}
```

## 2️⃣ Tìm video food tour với thông tin chi tiết

**User hỏi:**
> "Cho tôi xem video food tour Hà Nội, sắp xếp theo lượt xem"

**AI sẽ call tool:**
```json
{
  "tool": "search_youtube_videos",
  "arguments": {
    "query": "food tour Hanoi",
    "maxResults": 5,
    "order": "viewCount",
    "videoDuration": "medium"
  }
}
```

**Response (với YouTube API):**
```json
{
  "source": "youtube_api",
  "videos": [
    {
      "title": "HANOI STREET FOOD TOUR - Best Places to Eat",
      "videoId": "abc123",
      "url": "https://youtube.com/watch?v=abc123",
      "thumbnail": "https://img.youtube.com/vi/abc123/hqdefault.jpg",
      "channelTitle": "Food Insider",
      "views": "2.5M",
      "likes": "85K",
      "duration": "PT15M30S",
      "description": "Join us for the ultimate Hanoi food tour..."
    }
  ]
}
```

**Response (không có YouTube API, dùng Exa):**
```json
{
  "source": "exa_youtube",
  "note": "Kết quả từ Exa. Để có thông tin chi tiết (views, likes), hãy cấu hình YOUTUBE_API_KEY.",
  "videos": [
    {
      "title": "HANOI STREET FOOD TOUR - Best Places to Eat",
      "url": "https://youtube.com/watch?v=abc123",
      "videoId": "abc123",
      "thumbnail": "https://img.youtube.com/vi/abc123/hqdefault.jpg",
      "description": "Join us for the ultimate Hanoi food tour...",
      "score": 0.95
    }
  ]
}
```

## 3️⃣ Tìm content TikTok trending

**User hỏi:**
> "Có video TikTok nào về du lịch Sapa không?"

**AI sẽ call tool:**
```json
{
  "tool": "search_social_media",
  "arguments": {
    "query": "du lịch Sapa",
    "platforms": ["tiktok"],
    "recency": "month",
    "numResults": 8
  }
}
```

**Response:**
```json
{
  "source": "exa",
  "results": [
    {
      "title": "Du Lịch Sapa 2 Ngày 1 Đêm Giá Rẻ",
      "url": "https://tiktok.com/@user/video/...",
      "platform": "tiktok",
      "publishedDate": "2026-01-28",
      "author": "@travel_vietnam",
      "text": "Hướng dẫn chi tiết du lịch Sapa...",
      "highlights": ["Giá rẻ", "Đẹp"]
    }
  ]
}
```

## 4️⃣ Search tất cả platforms

**User hỏi:**
> "Tìm tất cả content về du lịch Đà Lạt trên mạng xã hội"

**AI sẽ call tool:**
```json
{
  "tool": "search_social_media",
  "arguments": {
    "query": "du lịch Đà Lạt",
    "platforms": ["all"],
    "numResults": 10,
    "recency": "3months"
  }
}
```

**Response:** Kết quả từ YouTube, Facebook, TikTok, Instagram

## 5️⃣ Tìm video ngắn (shorts)

**User hỏi:**
> "Tìm video ngắn về ẩm thực Đà Nẵng"

**AI sẽ call tool:**
```json
{
  "tool": "search_youtube_videos",
  "arguments": {
    "query": "ẩm thực Đà Nẵng",
    "maxResults": 5,
    "videoDuration": "short",
    "order": "date"
  }
}
```

## 6️⃣ Fallback khi không có API key

**Không có cả EXA_API_KEY và YOUTUBE_API_KEY:**

```json
{
  "source": "fallback",
  "query": "du lịch Đà Lạt",
  "platforms": ["youtube"],
  "results": [],
  "message": "Social media search không khả dụng.",
  "note": "Cần EXA_API_KEY để tìm kiếm trên social media. Đăng ký miễn phí tại https://exa.ai"
}
```

## 🎯 Best Practices

### 1. Chọn platform phù hợp
```javascript
// Video dài, chi tiết → YouTube
search_youtube_videos({ query: "travel guide Vietnam" })

// Video ngắn, trending → TikTok
search_social_media({ query: "du lịch Sapa", platforms: ["tiktok"] })

// Review, bài viết → Facebook
search_social_media({ query: "review resort", platforms: ["facebook"] })

// Ảnh đẹp → Instagram
search_social_media({ query: "beautiful places Vietnam", platforms: ["instagram"] })
```

### 2. Sử dụng recency filter
```javascript
// Tìm content mới nhất
{ recency: "week" }

// Content trong tháng
{ recency: "month" }

// Default (recommended)
{ recency: "3months" }

// Tìm tất cả
{ recency: "all" }
```

### 3. Optimize query
```javascript
// ❌ Quá chung chung
"du lịch"

// ✅ Cụ thể hơn
"du lịch Đà Lạt tự túc 2 ngày 1 đêm"

// ✅ Với content type
"review resort Phú Quốc"

// ✅ Tiếng Anh cho international content
"travel Vietnam backpacking"
```

## 🔄 Integration với Trip Planning

AI có thể tự động gọi social media tools trong quá trình lập kế hoạch:

```
User: "Lên lịch đi Đà Lạt 3 ngày, tôi muốn xem video review trước"

AI Flow:
1. get_current_datetime() → Lấy ngày hiện tại
2. search_social_media({
     query: "review Đà Lạt",
     platforms: ["youtube"],
     recency: "3months"
   }) → Tìm video review
3. search_places({
     location: "Đà Lạt",
     type: "hotel"
   }) → Tìm khách sạn
4. create_trip_plan({...}) → Tạo plan với video refs
```

## 📊 Response Format Comparison

### Exa API Response
```json
{
  "source": "exa",
  "query": "enhanced query",
  "platforms": ["youtube"],
  "results": [{
    "title": "...",
    "url": "...",
    "platform": "youtube|facebook|tiktok|instagram",
    "publishedDate": "2026-01-15",
    "author": "...",
    "score": 0.95,
    "text": "snippet...",
    "highlights": ["key", "phrases"]
  }]
}
```

### YouTube API Response
```json
{
  "source": "youtube_api",
  "videos": [{
    "title": "...",
    "videoId": "abc123",
    "url": "https://youtube.com/watch?v=abc123",
    "thumbnail": "high-res image",
    "channelTitle": "Channel Name",
    "channelId": "UCxxx",
    "publishedAt": "2026-01-15T10:00:00Z",
    "views": "1.2M",
    "likes": "45K",
    "duration": "PT15M30S"
  }]
}
```

## 🚨 Common Issues

### Issue 1: Không tìm thấy kết quả
**Solution:**
- Check API key đã đúng chưa
- Thử query khác (tiếng Anh hoặc tiếng Việt)
- Tăng `numResults`
- Mở rộng `recency` filter

### Issue 2: YouTube API quota exceeded
**Solution:**
- Switch sang Exa API (tự động fallback)
- Reduce số lượng searches
- Enable caching để giảm API calls

### Issue 3: Rate limit error
**Solution:**
- Exa: Max 5 req/s (auto-handled)
- Thêm delay giữa các requests
- Use caching

## 💡 Tips

1. **Combine tools:** Dùng cả `search_social_media` và `search_youtube_videos` để có comprehensive results
2. **Cache results:** Mặc định cache 30 phút (social), 1 giờ (YouTube)
3. **Use Exa for initial search:** Sau đó dùng YouTube API để get detailed stats
4. **Filter by platform:** Chọn platform phù hợp với nội dung cần tìm
5. **Optimize quota:** YouTube API quota hữu hạn, dùng Exa khi có thể
