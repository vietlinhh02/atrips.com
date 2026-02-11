# ATrips Product Docs

Tài liệu sản phẩm cho ATrips (trip planning + discovery + marketplace), được chia theo module và phase để dễ review và triển khai.

## Mục tiêu
- Xác định phạm vi tính năng theo từng phase
- Tạo ngôn ngữ chung giữa Product, Design, Engineering
- Làm cơ sở cho kiến trúc, UX/UI, API, và roadmap
- Dễ tách phần nhỏ để review theo module

## Nguyên tắc phát triển
- Phase 1 ưu tiên “giá trị cốt lõi” và go-to-market nhanh
- Phase 2 mở rộng chiều sâu (AI nâng cao, cộng tác, vận hành)
- Phase 3 tăng độ hoàn thiện, tiện ích, và mở rộng B2B

## Đối tượng người dùng (personas)
- Traveler cá nhân: cần itinerary nhanh, dễ chỉnh sửa
- Nhóm bạn/ gia đình: cần cộng tác, chia sẻ, chat nhóm
- Local guide: cần kênh quảng bá và kiếm thu nhập
- Agency/Business: cần white-label, quản trị nhiều khách hàng

## Giá trị cốt lõi (core value)
- Lên kế hoạch trip nhanh hơn nhờ AI
- Tìm kiếm và chọn địa điểm dễ hơn (filters + map + reviews)
- Cộng tác nhóm linh hoạt
- Kết nối guides và tạo doanh thu qua booking/affiliate

## Scope theo phase
### Phase 1 (MVP/Go-to-market)
Tập trung vào nền tảng cốt lõi: tạo trip, itinerary, AI basic, khám phá địa điểm, marketplace cơ bản, thanh toán/subscription.

### Phase 2 (Advanced Features)
Mở rộng AI, real-time collaboration, quản lý trip nâng cao, notification, UGC.

### Phase 3 (Nice-to-have)
Tính năng bổ trợ (flights, weather, budgeting, offline, gamification) và mở rộng B2B.

## Index
### Phase 1
- 01-auth-user-management.md
- 02-trip-planning.md
- 03-place-discovery.md
- 04-ai-assistant-orbit.md
- 05-guide-marketplace.md
- 06-social-features.md
- 07-booking-monetization.md

### Phase 2
- 08-advanced-ai.md
- 09-guide-advanced.md
- 10-trip-management.md
- 11-collaboration-advanced.md
- 12-notifications.md
- 13-content-management.md

### Phase 3
- 14-flight-integration.md
- 15-weather-events.md
- 16-budget-tracking.md
- 17-offline-mode.md
- 18-gamification.md
- 19-advanced-analytics.md
- 20-white-label.md

## Cách đọc và review
- Đọc theo phase nếu review roadmap
- Đọc theo module nếu review nghiệp vụ chi tiết
- Ghi chú feedback trực tiếp trong từng file để dễ tracking

## Quy ước nội dung mỗi file
- Mục tiêu và phạm vi
- Use cases chính
- Requirements (must-have vs nice-to-have)
- Dữ liệu chính và trạng thái (nếu có)
- API/Integration liên quan (ghi chú sơ bộ)
- Rủi ro/giả định

## Định nghĩa trạng thái chung (gợi ý)
- Trip: Draft → Active → Completed → Archived
- Guide Hire: Pending → Accepted → Rejected → Completed → Canceled
- Subscription: Trial → Active → Past Due → Canceled
