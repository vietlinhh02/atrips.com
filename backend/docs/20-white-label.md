# 20. White-label (Phase 3)

## Mục tiêu
- Hỗ trợ tùy biến thương hiệu cho agency
- Mở rộng B2B và tích hợp qua API

## Use cases chính
- Agency dùng branding riêng để phục vụ khách hàng
- Agency tích hợp API để quản lý trip cho khách

## Requirements
### Must-have (Phase 3)
- Custom branding (logo, color, domain)
- API access cho third-party
- Multi-tenant isolation cơ bản

### Nice-to-have
- White-label billing riêng
- Template theme cho agency

## Dữ liệu chính
- Tenant
  - id
  - name
  - branding (logo_url, colors, domain)
  - created_at
- TenantUser
  - tenant_id
  - user_id
  - role (admin, member)
- ApiKey
  - tenant_id
  - key
  - scopes
  - created_at

## Luồng nghiệp vụ chính (tóm tắt)
- Create tenant
  - admin tạo tenant → cấu hình branding
- API access
  - generate api key → dùng trong integrations

## UX/Behavior notes
- Admin portal riêng cho agency
- Branding 적용 lên UI theo tenant

## Integration
- Auth + rate limit cho API
- Billing cho tenant (optional)

## Rủi ro/giả định
- Multi-tenant isolation cần đảm bảo chặt chẽ
- Branding phức tạp nếu UI không thiết kế từ đầu

## Ghi chú
- Cần tách tenant và cấu hình theme
- API cần cơ chế auth và rate limit
