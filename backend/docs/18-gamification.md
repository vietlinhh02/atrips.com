# 18. Gamification (Phase 3)

## Mục tiêu
- Tăng tương tác và giữ chân người dùng
- Khuyến khích người dùng hoàn thành trip

## Use cases chính
- Người dùng nhận badge khi hoàn thành trip
- Người dùng tích điểm khi dùng app
- Người dùng xem leaderboard theo thành phố

## Requirements
### Must-have (Phase 3)
- Badges for completed trips
- Points system
- Leaderboards

### Nice-to-have
- Seasonal challenges
- Reward redeem (voucher)

## Dữ liệu chính
- Badge
  - id
  - name
  - criteria
  - icon
- UserBadge
  - user_id
  - badge_id
  - earned_at
- PointsLedger
  - user_id
  - action
  - points
  - created_at
- Leaderboard
  - scope (global/city)
  - period
  - top_users[]

## Luồng nghiệp vụ chính (tóm tắt)
- Earn badge
  - user complete trip → award badge
- Earn points
  - user actions → add points
- Leaderboard
  - cron update → display ranking

## UX/Behavior notes
- Hiển thị badges trong profile
- Leaderboard có filter theo region

## Integration
- Analytics để track user actions

## Rủi ro/giả định
- Gamification nếu không cân bằng có thể phản tác dụng

## Ghi chú
- Cần quy tắc tính điểm rõ ràng
- Leaderboards có thể theo thành phố/quốc gia
