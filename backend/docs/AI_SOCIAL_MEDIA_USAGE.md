# 🤖 AI Social Media Tool Usage Guide

## Tổng quan

AI đã được train để tự động nhận diện và gọi social media tools khi user hỏi về video, vlog, review, hoặc content từ các platforms.

---

## 🎯 Triggers - Khi nào AI gọi tools

### 1️⃣ **search_social_media**

AI tự động gọi tool này khi user:
- Muốn xem **video** về địa điểm
- Tìm **vlog** du lịch
- Xem **review** trên social media
- Tìm content trên **TikTok**, **Facebook**, **Instagram**
- Muốn xem content từ **nhiều platforms**

### 2️⃣ **search_youtube_videos**

AI tự động gọi tool này khi user:
- Cụ thể muốn video **YouTube**
- Muốn xem **views, likes** của video
- Tìm video **sắp xếp theo lượt xem/đánh giá**
- Cần video với **độ dài** cụ thể

---

## 📝 Examples - AI sẽ phản ứng như thế nào

### Example 1: Video Review Resort

**User Input:**
```
"Có video review resort ở Phú Quốc không?"
```

**AI Thinking:**
- Keyword: "video review"
- Platform: Không chỉ định → all
- Content type: review

**AI Action:**
```javascript
search_social_media({
  query: "review resort Phú Quốc",
  platforms: ["youtube"],
  contentType: "review",
  numResults: 5,
  recency: "3months"
})
```

**AI Response:**
```
Dạ có ạ! Tôi tìm thấy một số video review resort ở Phú Quốc:

1. **"Review Resort 5 Sao Phú Quốc - Trải Nghiệm Thực Tế"**
   - Platform: YouTube
   - Link: [URL]
   - Highlights: Resort đẹp, dịch vụ tốt, giá 3-5 triệu/đêm

2. **"Top 5 Resort Đáng Ở Nhất Phú Quốc 2026"**
   - Platform: YouTube
   - Link: [URL]
   - Highlights: So sánh 5 resort, từ budget đến luxury

[...]

Bạn muốn tôi tìm thêm về loại resort nào cụ thể không? (Luxury, mid-range, hay budget?)
```

---

### Example 2: Vlog Du Lịch

**User Input:**
```
"Tìm vlog du lịch Đà Lạt đi"
```

**AI Action:**
```javascript
search_social_media({
  query: "du lịch Đà Lạt",
  platforms: ["youtube", "tiktok"],
  contentType: "vlog",
  numResults: 8,
  recency: "3months"
})
```

**AI Response:**
```
Đây là các vlog du lịch Đà Lạt mới nhất:

📺 YouTube:
1. **"Đà Lạt 3 Ngày 2 Đêm Tự Túc Giá Rẻ"** - [Link]
   Highlight: Chi phí chỉ 2 triệu cho 2 người

2. **"Food Tour Đà Lạt - 15 Món Phải Thử"** - [Link]
   Highlight: Ăn sáng → trưa → tối, đầy đủ

📱 TikTok:
1. **"Hidden Gems Đà Lạt Ít Người Biết"** - [Link]
   Highlight: 5 điểm check-in đẹp, vắng khách

[...]
```

---

### Example 3: TikTok Food

**User Input:**
```
"TikTok về food Hà Nội có gì hay không?"
```

**AI Action:**
```javascript
search_social_media({
  query: "food Hà Nội",
  platforms: ["tiktok"],
  contentType: "video",
  numResults: 10
})
```

**AI Response:**
```
Có nhiều TikTok hay về food Hà Nội ạ:

🔥 Trending:
1. **"Phố Cổ Food Tour 200K"** - [Link]
   - Ăn sáng đến tối chỉ 200K

2. **"5 Quán Bún Chả Locals Ăn"** - [Link]
   - Không phải tourist trap

3. **"Street Food Hà Nội Must Try"** - [Link]
   - Top 10 món phải thử

[...]

Bạn muốn tôi tìm món cụ thể nào không? (Phở, bún chả, bánh mì...)
```

---

### Example 4: YouTube với Stats

**User Input:**
```
"Tìm video YouTube food tour Hà Nội, sắp xếp theo lượt xem"
```

**AI Action:**
```javascript
search_youtube_videos({
  query: "food tour Hanoi",
  maxResults: 5,
  order: "viewCount",
  videoDuration: "medium"
})
```

**AI Response:**
```
Top 5 video food tour Hà Nội được xem nhiều nhất:

1. **"HANOI STREET FOOD TOUR - Best Places to Eat"**
   - Views: 2.5M | Likes: 85K | Duration: 15 phút
   - Channel: Food Insider
   - Link: [URL]

2. **"24 Hours Food Challenge in Hanoi"**
   - Views: 1.8M | Likes: 62K | Duration: 18 phút
   - Channel: Mark Wiens
   - Link: [URL]

[...]
```

---

### Example 5: Facebook Events

**User Input:**
```
"Có event gì trên Facebook ở TP.HCM tuần này không?"
```

**AI Action:**
```javascript
search_social_media({
  query: "events in Ho Chi Minh City",
  platforms: ["facebook"],
  contentType: "post",
  recency: "week"
})
```

**AI Response:**
```
Các sự kiện đang diễn ra ở TP.HCM tuần này:

📅 Facebook Events:
1. **"Đêm Nhạc Rock Việt 2026"**
   - Ngày: 15/03/2026
   - Địa điểm: Nhà Văn Hóa Thanh Niên
   - Link: [URL]

2. **"Street Food Festival Saigon"**
   - Ngày: 16-17/03/2026
   - Địa điểm: Công viên Tao Đàn
   - Link: [URL]

[...]
```

---

## 🎨 Use Cases - Các trường hợp sử dụng

### 1. Research Before Trip
```
User: "Xem review khách sạn ABC ở Đà Nẵng"
→ AI: search_social_media(query="review khách sạn ABC Đà Nẵng", contentType="review")
```

### 2. Find Food Spots
```
User: "Video về quán ăn ngon ở Phú Quốc"
→ AI: search_social_media(query="quán ăn ngon Phú Quốc", contentType="video")
```

### 3. Activity Ideas
```
User: "Có vlog nào về hoạt động ở Sapa không?"
→ AI: search_social_media(query="hoạt động Sapa", contentType="vlog")
```

### 4. Event Discovery
```
User: "Event tháng này ở Hà Nội"
→ AI: search_social_media(query="events Hanoi March", platforms=["facebook", "eventbrite"])
```

### 5. Travel Inspiration
```
User: "Xem TikTok về du lịch miền Tây"
→ AI: search_social_media(query="du lịch miền Tây", platforms=["tiktok"])
```

---

## 🔄 AI Workflow

### Typical Conversation Flow

```
User: "Lên lịch đi Đà Lạt 3 ngày, muốn xem vlog trước"

AI Step 1: Acknowledge + Call tools in parallel
→ search_social_media(query="du lịch Đà Lạt", contentType="vlog")
→ get_current_datetime()

AI Step 2: Present vlogs
"Đây là các vlog du lịch Đà Lạt hay:
1. [Vlog 1]
2. [Vlog 2]
[...]"

AI Step 3: Ask for trip details
"Bạn dự định đi từ ngày nào đến ngày nào?"

User: "Từ thứ 7 tuần sau"

AI Step 4: Calculate dates + Create itinerary
→ get_current_datetime(calculate_relative_date="next_saturday")
→ search_places(location="Đà Lạt")
→ create_trip_plan(...)

AI Step 5: Present complete plan with vlog references
"Đây là lịch trình 3 ngày ở Đà Lạt:

📅 Ngày 1: [...]
💡 Tham khảo: [Vlog 1] có hướng dẫn chi tiết về [...]

📅 Ngày 2: [...]
💡 Xem: [Vlog 2] để biết cách đi từ A đến B

[...]"
```

---

## 📊 Platform Selection Logic

AI tự động chọn platform dựa trên context:

### YouTube (Default cho video)
```javascript
// User không chỉ định platform
"Tìm video về..."
"Xem review..."
"Vlog về..."

→ platforms: ["youtube"]
```

### TikTok
```javascript
// User mention "TikTok" hoặc muốn video ngắn
"TikTok về..."
"Video ngắn về..."
"Clip về..."

→ platforms: ["tiktok"]
```

### Facebook
```javascript
// User mention "Facebook" hoặc tìm events/posts
"Facebook event..."
"Bài viết về..."
"Cộng đồng..."

→ platforms: ["facebook"]
```

### All Platforms
```javascript
// User muốn comprehensive search
"Tìm content về..."
"Có gì về... trên mạng xã hội"

→ platforms: ["all"]
```

---

## 🎯 Content Type Mapping

AI maps user intent to contentType:

| User Says | contentType |
|-----------|-------------|
| "review" | `"review"` |
| "vlog", "du lịch" | `"vlog"` |
| "video" | `"video"` |
| "bài viết", "post" | `"post"` |
| không chỉ định | `"all"` |

---

## 💬 Natural Language Understanding

AI hiểu các cụm từ tự nhiên:

### Variations for Video Search
```
✅ "Có video nào về..."
✅ "Tìm video..."
✅ "Xem video..."
✅ "Video về..."
✅ "Clip về..."
✅ "Tìm clip..."
```

### Variations for Review
```
✅ "Review về..."
✅ "Đánh giá về..."
✅ "Nhận xét về..."
✅ "Có ai review... chưa"
✅ "Xem review..."
```

### Variations for Vlog
```
✅ "Vlog về..."
✅ "Vlog du lịch..."
✅ "Có vlog nào..."
✅ "Tìm vlog..."
```

### Variations for Social Media
```
✅ "TikTok về..."
✅ "Facebook event..."
✅ "Instagram về..."
✅ "Trên mạng xã hội..."
```

---

## 🚀 Advanced Usage

### Combine with Other Tools

AI có thể combine social media search với tools khác:

```
User: "Lên lịch đi Phú Quốc, muốn xem review resort trước"

AI Workflow:
1. search_social_media(query="review resort Phú Quốc")
   → Present video reviews

2. User picks a resort from videos

3. search_places(query="resort ABC", location="Phú Quốc")
   → Get exact location, coordinates

4. search_hotels(location="Phú Quốc")
   → Get booking links, prices

5. create_trip_plan(...)
   → Create itinerary with chosen resort
```

---

## 📝 Response Format

AI formats social media results user-friendly:

### Standard Format
```markdown
Tôi tìm thấy [N] video/vlog/review về [topic]:

[Platform Icon] Platform Name:
1. **"[Title]"** - [Link]
   - [Key highlights from snippet]
   - [Published date if recent]

2. **"[Title]"** - [Link]
   - [Highlights]

[...]

💡 Gợi ý: [AI's recommendation based on results]
🔗 Click vào link để xem chi tiết
```

### YouTube with Stats (if available)
```markdown
Top 5 video YouTube về [topic]:

1. **"[Title]"**
   - 👁 Views: 2.5M | 👍 Likes: 85K | ⏱ Duration: 15 phút
   - Channel: [Channel Name]
   - Link: [URL]
   - Highlights: [Key points]

[...]
```

---

## ⚙️ Configuration

### Default Parameters

AI uses smart defaults:

```javascript
// search_social_media
{
  numResults: 5-8,           // Enough variety
  recency: "3months",        // Recent content
  contentType: "all",        // If not specified
  platforms: ["all"]         // If not specified
}

// search_youtube_videos
{
  maxResults: 5,             // Top results
  order: "relevance",        // Best matches
  videoDuration: "any"       // All lengths
}
```

---

## 🎓 Training Examples

Các ví dụ AI đã được train:

1. ✅ "Có video review resort Phú Quốc không"
2. ✅ "Tìm vlog du lịch Đà Lạt"
3. ✅ "TikTok về food Hà Nội"
4. ✅ "YouTube food tour Hà Nội"
5. ✅ "Facebook event TP.HCM tuần này"
6. ✅ "Xem review khách sạn ABC"
7. ✅ "Video hướng dẫn đi Sapa"
8. ✅ "Clip về du lịch miền Tây"
9. ✅ "Có vlog nào về Nha Trang không"
10. ✅ "Tìm content về ẩm thực Huế"

---

## 🔧 Troubleshooting

### AI không gọi tool?

**Check:**
1. User có mention "video", "vlog", "review", "TikTok", "YouTube", "Facebook"?
2. Context có liên quan đến travel/tourism?
3. EXA_API_KEY đã được config?

**Fix:**
- Thêm explicit keywords: "Tìm **video** về..."
- Restart server sau khi update prompts

### AI gọi sai tool?

**Example:**
```
User: "Tìm video về resort"
AI gọi: web_search thay vì search_social_media
```

**Fix:**
- User nên rõ ràng hơn: "Tìm **video YouTube** về resort"
- Hoặc: "Có **vlog** nào về resort không"

---

## 📊 Success Metrics

AI social media integration thành công khi:

- ✅ 80%+ câu hỏi về video → gọi search_social_media
- ✅ User không cần specify tool name
- ✅ Results relevant với query
- ✅ AI combine được với other tools
- ✅ Natural conversation flow

---

## 🎉 Summary

**AI được train để:**
1. ✅ Tự động nhận diện khi user muốn video/vlog/review
2. ✅ Chọn đúng tool (search_social_media vs search_youtube_videos)
3. ✅ Chọn đúng platform (YouTube, TikTok, Facebook)
4. ✅ Chọn đúng contentType (review, vlog, video, post)
5. ✅ Format results user-friendly
6. ✅ Combine với tools khác trong workflow

**User chỉ cần:**
- 💬 Hỏi tự nhiên như chat bình thường
- 🎯 AI tự động gọi đúng tools
- ✨ Nhận kết quả chất lượng

**Example Perfect Flow:**
```
User: "Lên lịch đi Phú Quốc 3 ngày, muốn xem vlog trước"

AI: [Tự động gọi search_social_media]
→ "Đây là các vlog hay về Phú Quốc: [...]"
→ "Bạn dự định đi từ ngày nào?"

User: "Thứ 7 tuần sau"

AI: [Tự động gọi get_current_datetime]
→ [Tạo lịch trình với references đến vlogs]

✅ Natural | ✅ Helpful | ✅ Complete
```
