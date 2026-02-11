# 10. Trip Management (Phase 2)

## Mục tiêu
- Quản lý lifecycle của trip và hỗ trợ export
- Hỗ trợ tái sử dụng và lưu trữ trip

## Use cases chính
- Người dùng export itinerary để chia sẻ/offline
- Người dùng in itinerary
- Người dùng duplicate trip làm template
- Người dùng archive/delete trip cũ
- Hệ thống tự update trạng thái trip theo thời gian

## Requirements
### Must-have (Phase 2)
- Export itinerary to PDF
- Print-friendly view
- Duplicate trip (template)
- Archive/delete trips
- Trip status: Draft → Active → Completed → Archived

### Nice-to-have (Phase 3)
- Export to calendar (Google/Apple)
- Custom PDF theme
- Bulk archive/manage trips

## Dữ liệu chính
- TripStatusHistory
  - trip_id
  - status
  - changed_at
- TripExport
  - trip_id
  - export_type (pdf, print)
  - created_at

## Luồng nghiệp vụ chính (tóm tắt)
- Export PDF
  - user click export → generate PDF → download
- Duplicate trip
  - copy trip + itinerary → new draft trip
- Archive/delete
  - archive = ẩn khỏi list; delete = xóa vĩnh viễn
- Auto status update
  - dựa theo end_date, set Completed

## UX/Behavior notes
- Trip list phân loại theo status
- Export actions đặt trong trip settings

## Integration
- PDF generation service
- Storage cho file export

## Rủi ro/giả định
- PDF export phải ổn định đa ngôn ngữ
- Duplicate trip cần tránh copy dữ liệu nhạy cảm

## Ghi chú
- Cần versioning để tránh mất dữ liệu
- PDF export nên dùng template thống nhất
