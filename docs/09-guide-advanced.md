# 9. Guide Features (Phase 2)

## Mục tiêu
- Hỗ trợ guides tạo nội dung và theo dõi hiệu quả
- Tạo hệ sinh thái guide chuyên nghiệp

## Use cases chính
- Guide tạo tour/collection để quảng bá
- Guide xin verified badge để tăng uy tín
- Guide theo dõi lượt xem, conversion
- Guide theo dõi thu nhập từ hires

## Requirements
### Must-have (Phase 2)
- Guide tạo content (tours, destination guides)
- Verification system (verified badge)
- Analytics dashboard cơ bản
- Earnings tracking (commission from hires)

### Nice-to-have (Phase 3)
- In-app chat với khách hàng
- Advanced analytics (cohort, conversion funnel)
- Automated payouts

## Dữ liệu chính
- GuideContent
  - id
  - guide_id
  - type (tour, destination_guide)
  - title
  - description
  - places[]
- GuideVerification
  - guide_id
  - status (pending, verified, rejected)
  - verified_at
- GuideAnalytics
  - guide_id
  - views
  - hires
  - conversion_rate
- GuideEarnings
  - guide_id
  - period
  - amount
  - status (pending, paid)

## Luồng nghiệp vụ chính (tóm tắt)
- Create guide content
  - guide tạo tour → publish → hiển thị trên marketplace
- Verification
  - guide submit request → admin review → update status
- Analytics/Earnings
  - hệ thống tổng hợp dữ liệu → hiển thị dashboard

## UX/Behavior notes
- Guide dashboard riêng
- Badge verified hiển thị rõ trên profile
- Content builder đơn giản, dễ tạo tour

## Integration
- Admin panel để review verification
- Payments system nếu có payouts

## Rủi ro/giả định
- Cần chính sách xét duyệt minh bạch
- Earnings tracking phụ thuộc dữ liệu hire flow

## Ghi chú
- Cần tiêu chí xét duyệt verified
- Earnings tracking cần đồng bộ với booking/hire flow
