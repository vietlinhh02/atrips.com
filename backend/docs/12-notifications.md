# 12. Notifications (Phase 2)

## Mục tiêu
- Gửi thông báo kịp thời cho người dùng
- Giữ người dùng cập nhật về trip và booking

## Use cases chính
- Người dùng nhận thông báo khi trip được cập nhật
- Người dùng nhận email khi guide chấp nhận request
- Người dùng nhận push khi có thay đổi quan trọng

## Requirements
### Must-have (Phase 2)
- In-app notifications
- Email notifications (trip updates, bookings)
- Push notifications (PWA)

### Nice-to-have (Phase 3)
- Digest email theo tuần
- Notification settings theo loại sự kiện
- Quiet hours (không gửi ban đêm)

## Dữ liệu chính
- Notification
  - id
  - user_id
  - type (trip_update, hire_status, system)
  - title
  - body
  - is_read
  - created_at
- NotificationPreference
  - user_id
  - channel (in_app, email, push)
  - enabled

## Luồng nghiệp vụ chính (tóm tắt)
- Trip update
  - event → create notification → deliver (in-app/email)
- Hire status
  - guide action → notify requester
- Push
  - critical event → send push

## UX/Behavior notes
- Notification center trong app
- Badge count cho unread
- Cho phép mark read/all

## Integration
- Email provider (SendGrid/Mailgun)
- Push provider (PWA Web Push)
- Queue/worker cho delivery

## Rủi ro/giả định
- Nếu gửi nhiều dễ spam, cần throttling
- Push cần user opt-in rõ ràng

## Ghi chú
- Cần cơ chế opt-in/out cho từng loại thông báo
- Nên dùng queue để xử lý email/push
