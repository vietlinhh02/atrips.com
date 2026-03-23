# 5. Guide Marketplace

## Mục tiêu
- Kết nối người dùng với local guides
- Cho phép khám phá, theo dõi và thuê guide
- Tạo kênh thu nhập cho guides

## Phạm vi
- Explore guides
- Guide profile
- Follow/Unfollow guide
- Hire guide (request form + workflow)

## Use cases chính
- Người dùng tìm local guide theo thành phố
- Người dùng xem profile và đánh giá của guide
- Người dùng theo dõi guide yêu thích
- Người dùng gửi request thuê guide cho trip

## Requirements
### Must-have (Phase 1)
- Browse danh sách guides (filter cơ bản)
- Guide profile: portfolio, tours, collections, reviews
- Follow/Unfollow guide
- Hire guide: request form gắn với trip
- Workflow trạng thái hire (pending/accepted/rejected)

### Nice-to-have (Phase 2/3)
- Verified badge
- In-app chat giữa user và guide
- Lịch rảnh của guide
- Gợi ý guide dựa trên trip

## Dữ liệu chính
- Guide
  - id (user_id)
  - display_name
  - bio
  - city
  - languages[]
  - rating_avg
  - reviews_count
  - portfolio_items[]
- GuideReview
  - guide_id
  - user_id
  - rating
  - comment
  - created_at
- GuideHireRequest
  - id
  - trip_id
  - guide_id
  - requester_id
  - status (pending, accepted, rejected, completed, canceled)
  - message
  - created_at

## Luồng nghiệp vụ chính (tóm tắt)
- Explore
  - search city + filter → list guides
- View profile
  - open guide → view portfolio + reviews
- Hire guide
  - submit request → guide accept/reject → notify user

## UX/Behavior notes
- CTA rõ ràng: “Hire Guide” trên profile
- Hiển thị rating + reviews
- Show guides phù hợp với trip city

## Integration
- Notifications module để thông báo status
- Payments nếu có commission (Phase 2)

## Rủi ro/giả định
- Cần chính sách dispute khi guide không nhận hoặc hủy
- Cần verification nếu mở rộng marketplace

## Ghi chú
- Gợi ý flow liên kết hire request với trip cụ thể
