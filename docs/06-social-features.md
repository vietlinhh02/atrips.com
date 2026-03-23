# 6. Social Features

## Mục tiêu
- Tăng tương tác giữa người dùng
- Cho phép chia sẻ trip và lưu địa điểm yêu thích
- Hỗ trợ chat nhóm trong trip

## Phạm vi
- Follow guides
- Save places vào Collections
- Share trip
- Group chat trong trip

## Use cases chính
- Người dùng theo dõi guide yêu thích
- Người dùng lưu place vào collection để dùng sau
- Người dùng chia sẻ trip với bạn bè
- Nhóm chat để thảo luận itinerary

## Requirements
### Must-have (Phase 1)
- Follow/Unfollow guide
- Save places vào collections
- Share trip (link hoặc invite)
- Group chat cơ bản trong trip (text)

### Nice-to-have (Phase 2/3)
- Comment trên activity/place
- Reaction trong group chat
- Share trip public (read-only)
- Mention/tag người dùng

## Dữ liệu chính
- Collection
  - id
  - user_id
  - name
  - places[]
- TripShare
  - trip_id
  - shared_with (user/email/link)
  - permission (view/edit)
  - created_at
- GroupChat
  - trip_id
  - messages[] (user_id, content, created_at)

## Luồng nghiệp vụ chính (tóm tắt)
- Follow guide
  - user click follow → update followers list
- Save place
  - add place → collection
- Share trip
  - generate link/invite → recipient access
- Group chat
  - user gửi message → broadcast

## UX/Behavior notes
- Collection dễ truy cập từ profile
- Share trip có quyền view/edit
- Chat nằm trong trip context

## Integration
- Notifications cho share/invite
- Collaboration module để sync chat

## Rủi ro/giả định
- Cần kiểm soát quyền riêng tư khi share
- Chat real-time có thể cần WebSocket (Phase 2)

## Ghi chú
- Cần chính sách quyền riêng tư khi share trip
- Group chat nâng cao và real-time sẽ mở rộng ở Phase 2
