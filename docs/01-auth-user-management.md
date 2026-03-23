# 1. Authentication & User Management

## Mục tiêu
- Cho phép người dùng tạo tài khoản, đăng nhập an toàn
- Quản lý hồ sơ cá nhân và preferences để cá nhân hóa
- Quản trị subscription theo tier (Free/Pro/Business)

## Phạm vi
- Đăng ký / đăng nhập bằng Email + mật khẩu
- Đăng nhập bằng Google OAuth
- Quản lý hồ sơ người dùng
- Quản lý subscription và paywall
- Các luồng bảo mật cơ bản (quên mật khẩu, đổi mật khẩu)

## Use cases chính
- Người dùng tạo tài khoản mới bằng email
- Người dùng đăng nhập nhanh bằng Google
- Người dùng cập nhật avatar, bio, preferences
- Người dùng nâng cấp hoặc hủy subscription
- Hệ thống kiểm tra quyền truy cập tính năng theo tier

## Requirements
### Must-have (Phase 1)
- Email signup + login
- Google OAuth login
- Password reset (email)
- User profile: avatar, bio, preferences cơ bản
- Subscription state: Free/Pro/Business
- Paywall kiểm tra trước khi dùng tính năng premium

### Nice-to-have (Phase 2/3)
- Social login khác (Apple/Facebook)
- 2FA (email/SMS/authenticator)
- Account deletion/self-service data export

## Dữ liệu chính
- User
  - id
  - email
  - name
  - avatar_url
  - bio
  - preferences (language, travel_style, budget_range)
  - created_at, updated_at
- AuthProvider
  - user_id
  - provider (email, google)
  - provider_user_id
  - last_login_at
- Subscription
  - user_id
  - tier (free, pro, business)
  - status (trial, active, past_due, canceled)
  - current_period_start, current_period_end

## Luồng nghiệp vụ chính (tóm tắt)
- Email signup
  - Nhập email + password → verify email (tùy chọn) → tạo user
- Google OAuth
  - Redirect → consent → callback → tạo hoặc liên kết user
- Password reset
  - Request reset → gửi email link → đặt mật khẩu mới
- Upgrade subscription
  - Tạo checkout session → webhook Stripe → cập nhật status

## Paywall và quyền truy cập
- Tier được kiểm tra theo feature flags
- Ví dụ giới hạn:
  - Free: số trip giới hạn, AI quota thấp
  - Pro: tăng quota, mở AI advanced
  - Business: multi-seat, collaboration nâng cao

## Integration
- OAuth provider: Google
- Payment: Stripe (subscriptions)
- Email: SMTP provider hoặc dịch vụ email transactional

## Rủi ro/giả định
- Cần chính sách bảo mật dữ liệu cá nhân
- Xác định quota AI rõ ràng theo tier để tránh bùng chi phí
- Cần xử lý tài khoản trùng email khi login OAuth
