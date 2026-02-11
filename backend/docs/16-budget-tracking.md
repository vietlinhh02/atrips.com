# 16. Budget Tracking (Phase 3)

## Mục tiêu
- Theo dõi chi tiêu thực tế so với ngân sách
- Hỗ trợ chia chi phí nhóm

## Use cases chính
- Người dùng nhập chi phí từng activity
- Nhóm chia đều chi phí
- Người dùng chuyển đổi tiền tệ khi đi nước ngoài

## Requirements
### Must-have (Phase 3)
- Track actual spending vs budget
- Expense splitting trong group
- Currency conversion

### Nice-to-have
- Import giao dịch từ ngân hàng
- Nhắc khi vượt ngân sách

## Dữ liệu chính
- Expense
  - id
  - trip_id
  - user_id
  - category (food, hotel, transport, activity)
  - amount
  - currency
  - paid_by
  - created_at
- ExpenseSplit
  - expense_id
  - user_id
  - share_amount
- CurrencyRate
  - base
  - target
  - rate
  - fetched_at

## Luồng nghiệp vụ chính (tóm tắt)
- Add expense
  - user nhập chi phí → lưu → update budget
- Split expense
  - chọn members → chia đều/tuỳ chỉnh
- Currency conversion
  - fetch rate → hiển thị quy đổi

## UX/Behavior notes
- Hiển thị biểu đồ chi tiêu vs budget
- Cho phép filter theo category

## Integration
- Exchange rate provider

## Rủi ro/giả định
- Tỷ giá thay đổi theo thời gian
- Cần xử lý làm tròn khi chia tiền

## Ghi chú
- Cần exchange rate provider
- Expense splitting: equal hoặc theo tỷ lệ
