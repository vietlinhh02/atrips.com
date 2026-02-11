# 4. AI Assistant (Gemini-AI)

## Mục tiêu
- AI là core entry point của app, hỗ trợ lập kế hoạch nhanh
- Trả lời câu hỏi về destination, gợi ý itinerary theo sở thích
- Parse kết quả AI vào itinerary để user chỉnh sửa
- Hỗ trợ tìm kiếm web real-time khi cần

## Phạm vi
- Chat 1-on-1 (AI-first landing)
- AI suggest itinerary
- Q&A về destination
- Parse AI recommendations → itinerary
- Search web real-time qua Exa API

## Use cases chính
- Người dùng mở app và chat với AI để tạo trip mới
- Người dùng hỏi AI về điểm đến, lịch trình, chi phí
- Người dùng yêu cầu AI tối ưu lịch trình theo budget/preferences
- Người dùng chọn gợi ý của AI và add vào itinerary

## Requirements
### Must-have (Phase 1)
- Chat 1-on-1 với AI (entry point)
- AI tạo itinerary draft dựa trên prompt
- Parse output → itinerary structure
- AI Q&A cơ bản về destination
- Guardrails: hạn chế hallucination, nhắc user verify info

### Nice-to-have (Phase 2/3)
- AI tối ưu route/time/budget
- Multi-language (VN/EN)
- Voice input cho AI chat
- AI suggestions theo weather/events

## Dữ liệu chính
- AIConversation
  - id
  - user_id
  - trip_id (optional)
  - messages[] (role, content, created_at)
- AIItineraryDraft
  - trip_id
  - days[]
  - source_prompt
  - created_at

## Luồng nghiệp vụ chính (tóm tắt)
- Entry AI chat
  - user prompt → AI hỏi thêm thông tin → tạo trip + draft itinerary
- AI Q&A
  - hỏi đáp theo destination → trả lời + nguồn (nếu có)
- Apply AI suggestion
  - user chọn activity → add vào itinerary
- Web search (Exa)
  - AI trigger search → kết quả dùng để trả lời

## Output schema (tóm tắt)
- AI trả về JSON chuẩn để parse:
  - trip_summary
  - days[] {date, city, activities[] {name, type, time, location}}

## UX/Behavior notes
- AI chat có quick prompts (budget, dates, travelers)
- AI hiển thị “Apply to trip” cho từng gợi ý
- User có thể chỉnh sửa sau khi apply

## Integration
- LLM provider (OpenAI hoặc tương đương)
- Exa API cho web search real-time

## Rủi ro/giả định
- AI có thể hallucinate, cần disclaimer và data sources
- Cost AI cao nếu prompt dài, cần quota theo tier

## Ghi chú
- Cần chuẩn JSON schema rõ ràng để map vào itinerary
- Cân nhắc giới hạn token theo subscription
