# 15. Weather & Events (Phase 3)

## Mục tiêu
- Cung cấp bối cảnh thời tiết và sự kiện cho trip
- Giúp AI gợi ý hoạt động phù hợp

## Use cases chính
- Người dùng xem dự báo thời tiết theo ngày
- Người dùng xem sự kiện địa phương theo thời gian
- Người dùng nhận cảnh báo ngày lễ

## Requirements
### Must-have (Phase 3)
- Weather forecast cho destination
- Local events calendar
- Holiday alerts

### Nice-to-have
- Weather-based suggestions trong itinerary
- Event highlights theo sở thích

## Dữ liệu chính
- WeatherForecast
  - location
  - date
  - temp_min, temp_max
  - condition
- LocalEvent
  - id
  - title
  - start_time, end_time
  - location
  - category
- Holiday
  - date
  - name
  - region

## Luồng nghiệp vụ chính (tóm tắt)
- Weather lookup
  - user chọn destination → fetch forecast → render
- Events lookup
  - user chọn date range → list events
- Holiday alert
  - detect holidays in trip range → notify

## UX/Behavior notes
- Weather hiển thị theo day view trong trip
- Events có filter theo category

## Integration
- Weather API provider
- Events provider (Eventbrite, Ticketmaster, v.v.)

## Rủi ro/giả định
- Forecast dài ngày có thể không chính xác
- Events data có thể thiếu hoặc không cập nhật

## Ghi chú
- Weather theo ngày và timezone của destination
- Events cần lọc theo category/địa điểm
