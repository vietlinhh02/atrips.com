# 8. Advanced AI (Phase 2)

## Mục tiêu
- Mở rộng năng lực AI và trải nghiệm đa ngôn ngữ
- Tăng độ chính xác và tối ưu hóa itinerary
- Thêm tính năng voice input

## Use cases chính
- Người dùng dùng AI bằng tiếng Việt hoặc tiếng Anh
- AI tối ưu route và thời gian di chuyển
- AI đề xuất theo thời tiết và mùa
- Người dùng nói trực tiếp để tạo plan

## Requirements
### Must-have (Phase 2)
- Multi-language AI (VN/EN)
- AI optimize itinerary (routes, timing, budget)
- AI suggestions theo weather, events, season
- Voice input cho AI chat

### Nice-to-have (Phase 3)
- Multi-turn memory dài hạn theo hồ sơ user
- Gợi ý cá nhân hóa sâu (sở thích, lịch sử)
- Auto-reschedule khi thay đổi lịch

## Dữ liệu chính
- AIOptimizationRequest
  - trip_id
  - constraints (budget, time, preferences)
  - created_at
- AIOptimizationResult
  - trip_id
  - changes[] (activity_id, before, after)
  - rationale
- VoiceInput
  - user_id
  - audio_url
  - transcript

## Luồng nghiệp vụ chính (tóm tắt)
- Optimize itinerary
  - user yêu cầu optimize → AI đề xuất thay đổi → user apply
- Weather/events suggestions
  - AI lấy context → đề xuất thay đổi/địa điểm
- Voice input
  - user nói → speech-to-text → AI response

## UX/Behavior notes
- Hiển thị diff khi AI đề xuất thay đổi
- Cho phép “Apply all” hoặc chọn từng item
- Voice input cần feedback trạng thái thu âm

## Integration
- Speech-to-text provider (Whisper hoặc tương đương)
- Weather/events data provider

## Rủi ro/giả định
- Optimize route cần dữ liệu thời gian di chuyển
- Voice input phụ thuộc độ chính xác STT

## Ghi chú
- Cần mô hình routing & thời gian mở cửa địa điểm
- Voice input: cân nhắc Whisper/OpenAI speech-to-text
