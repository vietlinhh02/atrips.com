# 11. Collaboration (Phase 2)

## Mục tiêu
- Tăng khả năng cộng tác real-time và phân quyền
- Minh bạch lịch sử thay đổi

## Use cases chính
- Nhóm cùng chỉnh sửa itinerary real-time
- Owner quản lý quyền thành viên
- Mọi người xem được lịch sử thay đổi
- Nhóm vote chọn activity

## Requirements
### Must-have (Phase 2)
- Real-time sync (WebSocket)
- Member permissions (owner vs member)
- Activity log ("Alice added Hotel X")
- Voting system (members vote on activities)

### Nice-to-have (Phase 3)
- Role nâng cao (editor, viewer)
- Conflict resolution UI (merge)
- Notification cho activity log

## Dữ liệu chính
- TripMember
  - trip_id
  - user_id
  - role (owner, member)
  - joined_at
- ActivityLog
  - trip_id
  - user_id
  - action (add, edit, delete, vote)
  - target_id
  - created_at
- ActivityVote
  - activity_id
  - user_id
  - vote (up/down)

## Luồng nghiệp vụ chính (tóm tắt)
- Real-time edit
  - user update activity → broadcast changes
- Permission check
  - verify role trước khi edit
- Voting
  - user vote → tally → show result

## UX/Behavior notes
- Hiển thị “đang chỉnh sửa” (presence)
- Activity log hiển thị theo time

## Integration
- WebSocket service
- Notifications module (optional)

## Rủi ro/giả định
- Conflict resolution cần rõ ràng khi edit cùng lúc
- WebSocket scaling cần tính toán sớm

## Ghi chú
- Cần audit trail và conflict resolution
- Voting nên gắn với activity level
