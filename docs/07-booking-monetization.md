# 7. Booking & Monetization

## Mục tiêu
- Tạo doanh thu qua affiliate và subscription
- Hỗ trợ thanh toán qua Stripe
- Theo dõi conversion để tối ưu doanh thu

## Phạm vi
- Affiliate links
- Subscription paywall
- Payment integration

## Use cases chính
- Người dùng click affiliate link để booking
- Người dùng nâng cấp gói Pro/Business
- Hệ thống tự cập nhật trạng thái subscription

## Requirements
### Must-have (Phase 1)
- Affiliate links: redirect tracking
- Subscription paywall theo tier
- Stripe checkout + webhook sync
- Billing page cho user quản lý subscription

### Nice-to-have (Phase 2/3)
- Multi-currency pricing
- Coupon/discount codes
- Revenue dashboard cho admin
- Upsell prompts theo usage

## Dữ liệu chính
- AffiliateClick
  - id
  - user_id
  - place_id
  - provider (booking, agoda, klook)
  - clicked_at
- Subscription
  - user_id
  - tier
  - status
  - current_period_start, current_period_end
- PaymentEvent
  - provider (stripe)
  - event_type
  - payload_ref
  - created_at

## Luồng nghiệp vụ chính (tóm tắt)
- Affiliate booking
  - user click link → redirect → track click
- Upgrade subscription
  - user chọn plan → stripe checkout → webhook cập nhật status
- Downgrade/cancel
  - user cancel → status chuyển canceled at period end

## UX/Behavior notes
- Paywall hiển thị khi user chạm feature premium
- Trang pricing rõ ràng so sánh Free/Pro/Business
- Billing page cho phép cancel/upgrade

## Integration
- Stripe (billing, webhook)
- Affiliate networks (Booking.com, Agoda, Klook)

## Rủi ro/giả định
- Tracking affiliate phụ thuộc provider
- Cần xử lý retry webhook để đảm bảo sync

## Ghi chú
- Cần tracking conversion cho affiliate
- Cần webhook xử lý subscription status
