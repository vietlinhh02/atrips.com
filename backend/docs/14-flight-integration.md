# 14. Flight Integration (Phase 3)

## Mục tiêu
- Hỗ trợ tìm chuyến bay và gắn vào trip
- Theo dõi giá và nhắc người dùng

## Use cases chính
- Người dùng tìm chuyến bay cho trip
- Người dùng theo dõi giá vé
- Người dùng thêm chuyến bay vào itinerary

## Requirements
### Must-have (Phase 3)
- Search flights theo route + dates
- Price tracking cơ bản
- Add flights vào itinerary

### Nice-to-have
- Alerts khi giá giảm
- Gợi ý thời gian bay tối ưu

## Dữ liệu chính
- FlightSearch
  - origin
  - destination
  - depart_date, return_date
  - passengers
- FlightResult
  - provider_id
  - airline
  - price
  - duration
- FlightTracking
  - user_id
  - route
  - price_threshold
  - created_at

## Luồng nghiệp vụ chính (tóm tắt)
- Search flights
  - user input → provider API → list results
- Add flight
  - user chọn flight → add activity to itinerary
- Price tracking
  - user set alert → monitor price → notify

## UX/Behavior notes
- Kết quả search có filter (price, duration)
- Flight activity hiển thị trong timeline

## Integration
- Flight data provider (Skyscanner, Amadeus, v.v.)
- Notifications module cho price alerts

## Rủi ro/giả định
- Giá vé thay đổi liên tục
- Provider API có thể hạn chế quota

## Ghi chú
- Cần provider dữ liệu (Skyscanner, Amadeus, v.v.)
