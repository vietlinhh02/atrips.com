# 13. Content Management (Phase 2)

## Mục tiêu
- Cho phép người dùng tạo và quản lý nội dung
- Tăng độ tin cậy nhờ reviews và ảnh thật

## Use cases chính
- Người dùng viết review sau chuyến đi
- Người dùng upload ảnh địa điểm
- Người dùng chia sẻ travel stories/blogs
- Người dùng tạo collection lưu place

## Requirements
### Must-have (Phase 2)
- User-generated reviews (rating + comment)
- Photo uploads (place/trip)
- Travel stories/blogs cơ bản
- Collections (save favorite places)

### Nice-to-have (Phase 3)
- Moderation queue
- Report abuse
- Like/comment cho stories
- Rich editor cho stories

## Dữ liệu chính
- Review
  - id
  - user_id
  - place_id
  - rating
  - comment
  - created_at
- Photo
  - id
  - user_id
  - place_id (optional)
  - trip_id (optional)
  - url
  - created_at
- Story
  - id
  - user_id
  - title
  - content
  - created_at
- Collection
  - id
  - user_id
  - name
  - places[]

## Luồng nghiệp vụ chính (tóm tắt)
- Post review
  - user submit → publish → hiển thị trên place
- Upload photo
  - upload → store → attach to place/trip
- Create story
  - viết nội dung → publish → hiển thị profile

## UX/Behavior notes
- Review form đơn giản, rating rõ ràng
- Photo upload có preview
- Stories hiển thị theo profile

## Integration
- Storage cho ảnh (S3/Cloudinary)
- Moderation tools (Phase 3)

## Rủi ro/giả định
- Nội dung UGC cần policy và moderation
- Storage cost cho ảnh có thể tăng

## Ghi chú
- Cần moderation và report abuse
- Photo uploads cần lưu trữ (S3/Cloudinary)
