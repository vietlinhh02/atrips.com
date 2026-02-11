# 2. Trip Planning

## Mục tiêu
- Cho phép người dùng tạo trip và lập kế hoạch hành trình
- AI là entry point: vào app có thể chat với AI để tạo plan ngay
- Hỗ trợ AI gợi ý itinerary và chỉnh sửa linh hoạt
- Hỗ trợ multi-city và cộng tác nhóm

## Phạm vi
- Tạo trip cơ bản
- AI Trip Planner
- Manual Itinerary Builder
- Multi-city trips
- Collaborative planning

## Use cases chính
- Người dùng mở app và chat với AI để tạo trip/plan ngay
- Người dùng tạo trip mới với điểm đến và ngày đi
- Người dùng dùng AI để gợi ý itinerary theo sở thích
- Người dùng chỉnh sửa itinerary thủ công
- Người dùng tạo trip nhiều thành phố
- Người dùng mời bạn bè vào trip để cùng lập kế hoạch

## Requirements
### Must-have (Phase 1)
- AI chat là luồng khởi đầu tạo trip
- Create Trip: destination, dates, travelers, budget
- AI Trip Planner: chat để generate itinerary cơ bản
- Manual Itinerary Builder: add/edit/delete activity theo ngày
- Multi-city trips: nhiều điểm đến trong 1 trip
- Invite collaborators (share link/email invite)

### Nice-to-have (Phase 2/3)
- Drag & drop reorder activities
- Smart time-blocking cho itinerary
- Template trip (duplicate)
- Offline draft và sync sau

## Dữ liệu chính
- Trip
  - id
  - owner_id
  - title
  - start_date, end_date
  - travelers_count
  - budget_total
  - status (draft, active, completed, archived)
  - cities[] (multi-city)
  - created_at, updated_at
- TripCity
  - trip_id
  - city_name
  - start_date, end_date
  - order_index
- ItineraryDay
  - trip_id
  - date
  - city_name
- Activity
  - itinerary_day_id
  - name
  - type (hotel, food, attraction, transport, custom)
  - start_time, end_time
  - location (place_id / custom address)
  - notes

## Luồng nghiệp vụ chính (tóm tắt)
- Entry: AI-first
  - người dùng chat → AI thu thập thông tin → tạo trip + itinerary draft
- Create Trip (manual)
  - nhập thông tin → tạo trip + default itinerary days
- AI generate itinerary
  - chat input → AI output (structured) → user review → apply
- Manual edit
  - add/edit/delete activity theo ngày
- Multi-city
  - thêm city segment → hệ thống tạo days cho từng city
- Invite collaborators
  - gửi link/invite → người nhận join → quyền member

## UX/Behavior notes
- Landing screen là AI chat (quick prompts: budget, dates, travelers)
- AI chat có thể tạo trip mới hoặc cập nhật trip hiện có
- Hiển thị timeline theo ngày + city
- Cho phép switch giữa “AI view” và “Manual edit”
- Gợi ý place từ discovery để add nhanh vào activity

## Integration
- AI: Gemini service
- Places: lấy từ module Place Discovery

## Rủi ro/giả định
- Cần chuẩn hóa output AI thành activity structure
- Multi-city có thể phức tạp khi chỉnh sửa ngày
- Cần chiến lược conflict resolution khi nhiều người edit

## Ghi chú
- Quyền edit (owner vs member) chi tiết ở Phase 2
- Nên có audit log khi nhiều người sửa
