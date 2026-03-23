# 19. Advanced Analytics (Phase 3)

## Mục tiêu
- Phân tích hành vi và tối ưu conversion
- Hỗ trợ Product/Marketing ra quyết định

## Use cases chính
- Team theo dõi funnel từ create trip → booking
- A/B test UI/flow quan trọng
- Xem heatmap để cải thiện UX

## Requirements
### Must-have (Phase 3)
- User behavior tracking (event tracking)
- A/B testing cơ bản
- Conversion funnels
- Heatmaps

### Nice-to-have
- Cohort analysis
- Attribution tracking

## Dữ liệu chính
- AnalyticsEvent
  - id
  - user_id
  - event_name
  - properties
  - created_at
- Experiment
  - id
  - name
  - variants[]
  - status
- Funnel
  - name
  - steps[]

## Luồng nghiệp vụ chính (tóm tắt)
- Track event
  - client emit → server collect → store
- A/B test
  - assign variant → track metrics
- Funnel report
  - aggregate events → display conversion

## UX/Behavior notes
- Dashboard cho admin/product
- Funnel & experiment reports exportable

## Integration
- Analytics provider (Segment, Mixpanel, Amplitude)
- Heatmap provider (Hotjar, Clarity)

## Rủi ro/giả định
- Cần tuân thủ privacy/consent
- Tracking quá nhiều event có thể tăng chi phí

## Ghi chú
- Cần tuân thủ privacy/consent
- Nên thiết kế event schema chuẩn từ đầu
