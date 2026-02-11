# 🎥 Social Media Integration Guide

## Overview

Hệ thống hỗ trợ tìm kiếm nội dung trên các nền tảng mạng xã hội: **YouTube, Facebook, TikTok, Instagram**.

## 🛠️ Available Tools

### 1. `search_social_media`
Tìm kiếm nội dung trên multiple platforms cùng lúc.

**Parameters:**
- `query` (required): Từ khóa tìm kiếm
- `platforms` (optional): Array của platforms - `['youtube', 'facebook', 'tiktok', 'instagram', 'all']`
- `numResults` (optional): Số kết quả (1-10, default: 5)
- `recency` (optional): `'week'`, `'month'`, `'3months'`, `'6months'`, `'year'`, `'all'`
- `contentType` (optional): `'video'`, `'post'`, `'review'`, `'vlog'`, `'all'`

**Example:**
```javascript
{
  query: "du lịch Đà Lạt",
  platforms: ["youtube", "tiktok"],
  numResults: 5,
  recency: "3months",
  contentType: "video"
}
```

### 2. `search_youtube_videos`
Tìm kiếm video YouTube với thông tin chi tiết (views, likes, duration).

**Parameters:**
- `query` (required): Từ khóa tìm kiếm
- `maxResults` (optional): Số video (1-10, default: 5)
- `videoDuration` (optional): `'short'` (<4 min), `'medium'` (4-20 min), `'long'` (>20 min), `'any'`
- `order` (optional): `'relevance'`, `'date'`, `'viewCount'`, `'rating'`
- `publishedAfter` (optional): Ngày (YYYY-MM-DD)

**Example:**
```javascript
{
  query: "food tour Hanoi",
  maxResults: 5,
  videoDuration: "medium",
  order: "viewCount"
}
```

## 🔑 API Keys Setup

### Option 1: Chỉ dùng Exa API (RECOMMENDED)
**✅ Ưu điểm:** Search được TẤT CẢ platforms mà KHÔNG CẦN API key riêng!

1. Đăng ký tại: https://exa.ai
2. Free tier: 1,000 searches/month
3. Thêm vào `.env`:
   ```bash
   EXA_API_KEY=your_exa_api_key_here
   ```

**Với chỉ 1 API key này, bạn search được:**
- ✅ YouTube
- ✅ Facebook
- ✅ TikTok
- ✅ Instagram
- ✅ Mọi website khác

### Option 2: YouTube API (Optional - cho thông tin chi tiết hơn)
Nếu bạn cần thông tin chi tiết về YouTube videos (views, likes, duration):

1. Vào: https://console.cloud.google.com/
2. Tạo project mới
3. Enable **YouTube Data API v3**
4. Tạo Credentials → API Key
5. Thêm vào `.env`:
   ```bash
   YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

**Free quota:** 10,000 units/day
- 1 search = ~100 units
- 1 video stats = ~1 unit

### Fallback Behavior
```
1. YouTube API có → Dùng YouTube API (chi tiết nhất)
2. Không có YouTube API, có Exa → Dùng Exa search YouTube
3. Không có cả hai → Trả về fallback message
```

## 📊 API Comparison

| Feature | Exa API | YouTube API |
|---------|---------|-------------|
| Search YouTube | ✅ | ✅ |
| Search Facebook/TikTok | ✅ | ❌ |
| Video views/likes | ❌ | ✅ |
| Video duration | ❌ | ✅ |
| Channel info | Partial | ✅ Full |
| Free tier | 1000 searches/month | 10,000 units/day |
| Setup complexity | Low | Medium |

## 🎯 Use Cases

### 1. Tìm video review địa điểm
```javascript
await toolExecutor.execute('search_social_media', {
  query: 'review Phú Quốc resort',
  platforms: ['youtube'],
  contentType: 'review',
  recency: '3months'
});
```

### 2. Tìm content trending trên TikTok
```javascript
await toolExecutor.execute('search_social_media', {
  query: 'du lịch Sapa',
  platforms: ['tiktok'],
  numResults: 10,
  recency: 'month'
});
```

### 3. Tìm video chi tiết với stats
```javascript
await toolExecutor.execute('search_youtube_videos', {
  query: 'food tour Da Nang',
  maxResults: 5,
  videoDuration: 'medium',
  order: 'viewCount'
});
```

### 4. Search tất cả platforms
```javascript
await toolExecutor.execute('search_social_media', {
  query: 'travel Vietnam',
  platforms: ['all'], // YouTube, Facebook, TikTok, Instagram
  numResults: 8
});
```

## 🔧 Implementation Details

### Architecture
```
AI Request
  ↓
Tool Definition (domain/tools/socialMediaTools.js)
  ↓
Tool Executor (infrastructure/services/ToolExecutor.js)
  ↓
Handler (infrastructure/services/handlers/socialMediaHandlers.js)
  ↓
External API (Exa / YouTube Data API)
  ↓
Response with caching
```

### Rate Limiting
- **Exa API:** 5 requests/second (auto-handled by `exaRateLimiter`)
- **YouTube API:** 10,000 units/day quota

### Caching
- **Social media results:** 30 minutes
- **YouTube videos:** 1 hour

## 📝 Testing

### Test Exa API
```bash
curl -X POST https://api.exa.ai/search \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_EXA_KEY" \
  -d '{
    "query": "du lịch Đà Lạt site:youtube.com",
    "numResults": 3,
    "includeDomains": ["youtube.com"]
  }'
```

### Test YouTube API
```bash
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&q=travel+vietnam&type=video&maxResults=3&key=YOUR_YOUTUBE_KEY"
```

## 🚀 Quick Start

1. **Cài đặt EXA_API_KEY (recommended):**
   ```bash
   # .env
   EXA_API_KEY=your_key_here
   ```

2. **Test trong AI chat:**
   ```
   Tìm video YouTube về du lịch Đà Lạt trong 3 tháng gần đây
   ```

3. **AI sẽ tự động gọi tool:**
   ```javascript
   search_social_media({
     query: "du lịch Đà Lạt",
     platforms: ["youtube"],
     recency: "3months"
   })
   ```

## ⚠️ Important Notes

1. **Không cần API key riêng cho Facebook/TikTok:** Exa API có thể search được tất cả platforms
2. **YouTube API chỉ cần khi muốn thông tin chi tiết:** views, likes, duration
3. **Cache được enable mặc định:** Giảm API calls
4. **Rate limiting tự động:** Không lo về quota

## 🔗 Resources

- Exa API Docs: https://docs.exa.ai
- YouTube Data API: https://developers.google.com/youtube/v3
- Exa Sign Up: https://exa.ai
- Google Cloud Console: https://console.cloud.google.com/
