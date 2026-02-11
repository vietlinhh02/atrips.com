# 17. Offline Mode (Phase 3)

## Mục tiêu
- Cho phép truy cập itinerary khi không có mạng
- Hỗ trợ offline maps cơ bản

## Use cases chính
- Người dùng tải itinerary để xem offline
- Người dùng xem map khi mất mạng
- App hoạt động như PWA trên mobile

## Requirements
### Must-have (Phase 3)
- Download itinerary for offline
- Offline maps (basic tiles)
- PWA support

### Nice-to-have
- Offline edit và sync sau
- Prefetch data theo trip dates

## Dữ liệu chính
- OfflinePackage
  - trip_id
  - data_version
  - downloaded_at
- OfflineMapTile
  - region
  - zoom_level
  - cached_at

## Luồng nghiệp vụ chính (tóm tắt)
- Download offline package
  - user click download → cache itinerary + places
- Offline mode
  - serve cached data → show warning nếu outdated
- Sync back
  - when online → sync changes (nếu có)

## UX/Behavior notes
- Hiển thị trạng thái offline rõ ràng
- Cho phép refresh dữ liệu khi online

## Integration
- PWA service worker
- Map provider hỗ trợ offline tiles

## Rủi ro/giả định
- Offline map có giới hạn theo provider
- Cần giới hạn dung lượng cache

## Ghi chú
- Cần cơ chế sync khi online trở lại
- Offline maps cần provider hỗ trợ caching
