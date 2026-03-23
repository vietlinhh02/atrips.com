# AI Trip Planning Flow - Logging System

Tài liệu này hướng dẫn cách sử dụng và xem logs cho AI Trip Planning flow.

## 📁 Cấu trúc logs

Logs được lưu trong thư mục `logs/` với 2 loại file:

1. **App logs**: `logs/app-YYYY-MM-DD.log` - Tất cả logs của ứng dụng
2. **AI Flow logs**: `logs/ai-flow-YYYY-MM-DD.log` - Chỉ logs liên quan đến AI Trip Planning

## 🚀 Cách xem logs

### 1. Xem logs real-time trong terminal

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com/backend
npm run dev
```

### 2. Xem logs từ file (khi terminal đã đóng)

```bash
# Xem file log AI flow mới nhất
tail -f logs/ai-flow-$(date +%Y-%m-%d).log

# Xem 100 dòng cuối của AI flow log
tail -n 100 logs/ai-flow-$(date +%Y-%m-%d).log

# Xem tất cả log files
ls -la logs/

# Xem log theo ngày cụ thể
cat logs/ai-flow-2026-02-04.log
```

### 3. Xem logs qua API

```bash
# Lấy danh sách log files
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/ai/logs?type=list

# Lấy AI flow logs (100 dòng cuối)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/ai/logs?type=ai-flow&lines=100

# Lấy app logs
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/ai/logs?type=app&lines=50
```

## 📊 Cấu trúc log

### Log format

```
[2026-02-04T15:30:45.123Z] [INFO] 🗺️  Generating itinerary for: Hà Nội
[2026-02-04T15:30:45.234Z] [STEP 1] INTENT PARSING
[2026-02-04T15:30:45.345Z] [ALGO] POIRecommender - Filtering places...
```

### Các loại log

| Prefix | Ý nghĩa | Ví dụ |
|--------|---------|-------|
| `[INFO]` | Thông tin chung | User message, destination |
| `[STEP X]` | Bước trong flow | STEP 1: INTENT PARSING |
| `[ALGO]` | Algorithm execution | POIRecommender, KnapsackSelector |
| `[TOOL]` | Tool execution | search_places, get_weather |
| `[ERROR]` | Lỗi | Failed to create draft |
| `[WARN]` | Cảnh báo | Algorithm mode disabled |

## 🔍 Filter logs theo step

```bash
# Chỉ xem Step 1 (Intent Parsing)
grep "STEP 1" logs/ai-flow-*.log

# Chỉ xem Algorithm logs
grep "\[ALGO\]" logs/ai-flow-*.log

# Chỉ xem Tool execution logs
grep "\[TOOL\]" logs/ai-flow-*.log

# Xem logs một ngày cụ thể
grep "2026-02-04" logs/ai-flow-*.log

# Xem flow hoàn chỉnh cho một request (theo timestamp)
grep "15:30:45" logs/ai-flow-*.log
```

## 📈 Theo dõi flow hoàn chỉnh

Khi một request AI Trip Planning được xử lý, bạn sẽ thấy logs theo thứ tự:

```
╔════════════════════════════════════════════════════════════╗
║           AI TRIP PLANNING FLOW - STARTED                  ║
╚════════════════════════════════════════════════════════════╝
📨 User message: "Lập plan du lịch Hà Nội 2 ngày..."
👤 User: user_123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: INTENT PARSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Detected request type: 🗺️ ITINERARY_GENERATION
📍 Destination: Hà Nội
📅 Duration: 2026-02-07 to 2026-02-08

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: CONTEXT ENRICHMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 [STEP 2.1] Fetching places from database...
✅ Retrieved 20 places from API
🌤️  [STEP 2.2] Fetching weather for Hà Nội...
✅ Weather: Clear, 24°C

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: ALGORITHM PROCESSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 [STEP 3] Running Trip Planning Algorithms...
  🔍 [Algorithm 1/4] POIRecommender - Filtering places...
  🎒 [Algorithm 2/4] KnapsackSelector - Optimizing selection...
  🗺️  [Algorithm 3/4] TSPSolver - Optimizing routes...
  ⏰ [Algorithm 4/4] TimeWindowScheduler - Scheduling...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: ITINERARY GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ [STEP 4] Enhancing itinerary with AI-generated content...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: DRAFT STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 Saving draft to database...
✅ Draft created with ID: draft_abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6: USER REVIEW & APPROVAL (Frontend)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Draft ready for user review

╔════════════════════════════════════════════════════════════╗
║     AI TRIP PLANNING FLOW - RESPONSE SENT TO CLIENT        ║
╚════════════════════════════════════════════════════════════╝
```

## 🔧 Debug mode

Thêm biến môi trường để xem thêm thông tin debug:

```bash
# Trong file .env
DEBUG_AI=true
LOG_LEVEL=DEBUG
```

Hoặc khi chạy:

```bash
DEBUG_AI=true LOG_LEVEL=DEBUG npm run dev
```

## 📝 Log retention

- Logs được lưu theo ngày (mỗi ngày 1 file)
- Không có giới hạn dung lượng file (cần setup log rotation nếu cần)
- Có thể xóa logs cũ bằng cách xóa file trong thư mục `logs/`

```bash
# Xóa logs cũ hơn 7 ngày
find logs/ -name "*.log" -mtime +7 -delete
```

## 🐛 Troubleshooting

### Không thấy logs trong file

1. Kiểm tra quyền ghi file:
   ```bash
   ls -la logs/
   chmod 755 logs/
   ```

2. Kiểm tra disk space:
   ```bash
   df -h
   ```

3. Restart server để tạo lại log files

### Logs bị gián đoạn

Nếu terminal bị đóng giữa chừng, logs vẫn được lưu đầy đủ vào file. Xem lại bằng:

```bash
tail -n 200 logs/ai-flow-$(date +%Y-%m-%d).log
```

## 📚 Files liên quan

| File | Mô tả |
|------|-------|
| `src/shared/services/LoggerService.js` | Logger service chính |
| `logs/app-YYYY-MM-DD.log` | App logs |
| `logs/ai-flow-YYYY-MM-DD.log` | AI Trip Planning logs |
