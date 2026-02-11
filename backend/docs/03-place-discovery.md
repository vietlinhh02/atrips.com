# 3. Place Discovery

## Mục tiêu
- Cho phép người dùng tìm và xem thông tin địa điểm
- Hỗ trợ map view và filter để so sánh nhanh
- Là nguồn dữ liệu để add vào itinerary

## Phạm vi
- Search places
- Category filters
- Place details
- Map view

## Use cases chính
- Người dùng tìm khách sạn, nhà hàng, điểm tham quan
- Người dùng lọc theo giá, rating, tiện ích
- Người dùng xem chi tiết địa điểm và thêm vào itinerary
- Người dùng xem map để so sánh vị trí

## Requirements
### Must-have (Phase 1)
- Search places theo keyword + location
- Filters cơ bản: price, rating, type
- Place detail: images, reviews, map pin, opening hours
- Add place vào itinerary (tạo activity)
- Map view cơ bản (list + map)

### Nice-to-have (Phase 2/3)
- Lọc nâng cao: distance, amenities, open now
- So sánh nhiều places (compare view)
- Save place vào collections
- Gợi ý place theo lịch sử/AI

## Dữ liệu chính
- Place
  - id (provider id)
  - name
  - type (hotel, restaurant, attraction, activity)
  - rating
  - price_level
  - address
  - geo (lat, lng)
  - photos[]
  - opening_hours
  - reviews[]
- PlaceSearchQuery
  - keyword
  - location
  - filters

## Luồng nghiệp vụ chính (tóm tắt)
- Search
  - nhập keyword + location → call provider API → render list + map
- Filter
  - chọn filter → refine results → update list/map
- Place detail
  - click place → fetch detail → add to itinerary

## UX/Behavior notes
- List + map view đồng bộ
- Hiển thị quick actions: add to itinerary, save place
- Map marker có hover/preview

## Integration
- Map provider: Mapbox/Goong
- Places data provider: TBD (Google Places, Foursquare, v.v.)

## Rủi ro/giả định
- Chi phí API place có thể cao, cần caching + quota
- Data từ provider có thể thiếu reviews/giờ mở cửa

## Ghi chú
- Cần chính sách cache (TTL theo type/location)
- Nếu dùng nhiều provider cần normalize fields
