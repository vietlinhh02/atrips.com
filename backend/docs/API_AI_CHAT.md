# API Documentation - AI Chat & Conversations

## Base URL
```
Production: https://api.atrips.com
Development: http://localhost:5000
```

## Authentication
Hầu hết các endpoint hỗ trợ **Guest Mode** (không cần auth) hoặc **Optional Auth**.
- **Required**: Bắt buộc phải có token
- **Optional**: Có thể có hoặc không có token
- **No Auth**: Không cần token

### Headers
```javascript
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN", // Optional/Required
  "Content-Type": "application/json"
}
```

---

## 📨 Chat Endpoints

### 1. Chat với AI
**POST** `/api/ai/chat`

Chat với AI để lập kế hoạch chuyến đi hoặc hỏi đáp về travel.

**Auth**: Optional (hỗ trợ Guest Mode)

**Request Body**:
```json
{
  "message": "Tôi muốn đi du lịch Đà Lạt 3 ngày 2 đêm",
  "conversationId": "conv_123abc", // Optional: để tiếp tục conversation cũ
  "tripId": "trip_456def", // Optional: liên kết với trip cụ thể
  "context": {
    "destination": "Đà Lạt",
    "duration": "3 days",
    "budget": "5000000"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "AI response text...",
    "conversationId": "conv_123abc",
    "messageId": "msg_789ghi",
    "suggestions": [
      "Gợi ý địa điểm tham quan",
      "Ước tính chi phí"
    ],
    "draftId": "draft_xyz" // Nếu AI tạo itinerary draft
  }
}
```

---

### 2. Chat Streaming (SSE)
**GET** `/api/ai/chat/stream`

Stream chat response real-time với Server-Sent Events.

**Auth**: Optional

**Query Parameters**:
```
?message=Hello&conversationId=conv_123&tripId=trip_456
```

**Example (JavaScript)**:
```javascript
const eventSource = new EventSource(
  `/api/ai/chat/stream?message=${encodeURIComponent(message)}&conversationId=${conversationId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}` // Optional
    }
  }
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'content') {
    // Append text chunk
    console.log(data.content);
  } else if (data.type === 'done') {
    // Stream completed
    console.log('Conversation ID:', data.conversationId);
    eventSource.close();
  } else if (data.type === 'error') {
    console.error('Error:', data.error);
    eventSource.close();
  }
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

**SSE Event Types**:
- `content` - Text chunk
- `function_call` - AI đang gọi function
- `function_result` - Kết quả function call
- `done` - Stream hoàn tất
- `error` - Lỗi xảy ra

---

### 3. Generate Itinerary
**POST** `/api/ai/generate-itinerary`

Tạo lịch trình từ dữ liệu có cấu trúc.

**Auth**: Optional

**Request Body**:
```json
{
  "destination": "Đà Lạt",
  "startDate": "2026-03-15",
  "endDate": "2026-03-18",
  "budget": 5000000,
  "interests": ["nature", "food", "culture"],
  "travelStyle": "backpacker", // backpacker | comfort | luxury
  "groupSize": 2,
  "conversationId": "conv_123" // Optional
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "draftId": "draft_abc123",
    "itinerary": {
      "days": [
        {
          "date": "2026-03-15",
          "activities": [
            {
              "time": "08:00",
              "title": "Khám phá hồ Xuân Hương",
              "description": "Đi dạo quanh hồ...",
              "location": { "lat": 11.9404, "lng": 108.4583 },
              "estimatedCost": 0,
              "duration": 120
            }
          ]
        }
      ],
      "totalEstimatedCost": 3500000
    },
    "conversationId": "conv_123"
  }
}
```

---

## 💬 Conversation Management

### 4. Tạo Conversation Mới
**POST** `/api/ai/conversations`

Tạo conversation trống mới.

**Auth**: Optional

**Request Body**:
```json
{
  "tripId": "trip_456", // Optional: liên kết với trip
  "title": "Planning Đà Lạt Trip" // Optional
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "conversationId": "conv_new123",
    "userId": "user_789", // hoặc guestId nếu guest
    "tripId": "trip_456",
    "title": "Planning Đà Lạt Trip",
    "createdAt": "2026-01-30T10:00:00Z"
  }
}
```

---

### 5. Lấy Danh Sách Conversations
**GET** `/api/ai/conversations`

Lấy tất cả conversations của user.

**Auth**: **Required**

**Query Parameters**:
```
?page=1&limit=20&tripId=trip_456
```

**Response**:
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversationId": "conv_123",
        "title": "Planning Đà Lạt Trip",
        "tripId": "trip_456",
        "lastMessage": "Tôi muốn đi du lịch...",
        "lastMessageAt": "2026-01-30T10:00:00Z",
        "messageCount": 5,
        "createdAt": "2026-01-29T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 6. Lấy Chi Tiết Conversation
**GET** `/api/ai/conversations/:conversationId`

Lấy conversation với tất cả messages.

**Auth**: **Required**

**Response**:
```json
{
  "success": true,
  "data": {
    "conversation": {
      "conversationId": "conv_123",
      "title": "Planning Đà Lạt Trip",
      "tripId": "trip_456",
      "userId": "user_789",
      "createdAt": "2026-01-29T08:00:00Z"
    },
    "messages": [
      {
        "messageId": "msg_001",
        "role": "user", // user | assistant | system
        "content": "Tôi muốn đi Đà Lạt",
        "timestamp": "2026-01-29T08:01:00Z"
      },
      {
        "messageId": "msg_002",
        "role": "assistant",
        "content": "Tuyệt vời! Bạn dự định đi bao nhiêu ngày?",
        "timestamp": "2026-01-29T08:01:15Z",
        "functionCalls": [] // Nếu có function calls
      }
    ]
  }
}
```

---

### 7. Lấy Conversations Của Trip
**GET** `/api/ai/trips/:tripId/conversations`

Lấy tất cả conversations liên quan đến một trip.

**Auth**: **Required**

**Response**:
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversationId": "conv_123",
        "title": "Planning Đà Lạt Trip",
        "lastMessage": "Tôi muốn...",
        "lastMessageAt": "2026-01-30T10:00:00Z",
        "messageCount": 5
      }
    ]
  }
}
```

---

## 📝 Itinerary Draft

### 8. Apply Itinerary Draft
**POST** `/api/ai/drafts/:draftId/apply`

Áp dụng bản nháp lịch trình do AI tạo vào trip.

**Auth**: **Required**

**Request Body**:
```json
{
  "tripId": "trip_456" // Trip để apply draft
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "trip": {
      "tripId": "trip_456",
      "itinerary": {
        "days": [...], // Itinerary đã được apply
        "appliedAt": "2026-01-30T10:00:00Z"
      }
    },
    "message": "Itinerary applied successfully"
  }
}
```

---

## 🎯 AI Optimization

### 9. Suggest Activity Improvements
**POST** `/api/ai/activities/:activityId/suggest`

AI đề xuất cải thiện cho một activity cụ thể.

**Auth**: **Required**

**Request Body**:
```json
{
  "context": "Muốn tìm hoạt động thú vị hơn",
  "preferences": ["adventure", "culture"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "title": "Canyoning tại thác Datanla",
        "description": "Trải nghiệm mạo hiểm...",
        "estimatedCost": 500000,
        "duration": 180,
        "reason": "Phù hợp với sở thích adventure"
      }
    ]
  }
}
```

---

### 10. Optimize Trip Itinerary
**POST** `/api/ai/trips/:tripId/optimize`

Tối ưu hóa toàn bộ lịch trình chuyến đi.

**Auth**: **Required**

**Request Body**:
```json
{
  "optimizationGoals": ["reduce_cost", "save_time", "add_activities"],
  "constraints": {
    "maxBudget": 4000000,
    "interests": ["food", "nature"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "optimizedItinerary": {
      "days": [...],
      "improvements": [
        "Tiết kiệm 500,000đ bằng cách thay đổi thứ tự",
        "Thêm 2 hoạt động phù hợp với sở thích"
      ],
      "costSavings": 500000
    },
    "draftId": "draft_optimized_xyz"
  }
}
```

---

## 📊 Provider & Quota

### 11. Get Provider Status
**GET** `/api/ai/provider/status`

Lấy trạng thái AI provider và models khả dụng.

**Auth**: No Auth

**Response**:
```json
{
  "success": true,
  "data": {
    "provider": "openai", // openai | anthropic | gemini
    "status": "operational",
    "availableModels": [
      {
        "id": "gpt-4-turbo",
        "name": "GPT-4 Turbo",
        "contextWindow": 128000,
        "supportsFunctionCalling": true
      }
    ]
  }
}
```

---

### 12. Get User AI Quota
**GET** `/api/ai/quota`

Lấy quota AI của user.

**Auth**: Optional

**Response**:
```json
{
  "success": true,
  "data": {
    "quota": {
      "tier": "free", // free | pro | premium
      "monthlyLimit": 50,
      "used": 23,
      "remaining": 27,
      "resetDate": "2026-02-01T00:00:00Z"
    },
    "usage": {
      "thisMonth": 23,
      "today": 5
    }
  }
}
```

---

## 🔧 OpenAI-Compatible Proxy

### 13. Chat Completions (OpenAI Compatible)
**POST** `/v1/chat/completions`

OpenAI-compatible endpoint.

**Auth**: Bearer Token (OAI_PROXY_API_KEY)

**Request Body**:
```json
{
  "model": "gpt-4-turbo",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false,
  "temperature": 0.7
}
```

**Response**: Standard OpenAI format

---

### 14. List Models
**GET** `/v1/models`

Danh sách models theo format OpenAI.

**Auth**: Bearer Token

**Response**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4-turbo",
      "object": "model",
      "created": 1234567890,
      "owned_by": "openai"
    }
  ]
}
```

---

## ❌ Error Responses

Tất cả errors đều có format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional: thêm thông tin chi tiết
  }
}
```

### Common Error Codes:
- `UNAUTHORIZED` - Token không hợp lệ hoặc expired
- `FORBIDDEN` - Không có quyền truy cập
- `NOT_FOUND` - Resource không tồn tại
- `QUOTA_EXCEEDED` - Vượt quá quota AI
- `INVALID_REQUEST` - Request body không đúng format
- `RATE_LIMIT_EXCEEDED` - Quá nhiều requests
- `AI_SERVICE_ERROR` - Lỗi từ AI provider
- `CONVERSATION_NOT_FOUND` - Conversation không tồn tại

---

## 🚀 Usage Examples (React/Next.js)

### Example 1: Chat Hook
```typescript
import { useState } from 'react';

export function useAIChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = async (message: string, conversationId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ message, conversationId })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error.message);
      }

      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading, error };
}
```

### Example 2: Streaming Chat
```typescript
export function useStreamingChat() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const streamMessage = (message: string, conversationId?: string) => {
    setContent('');
    setIsStreaming(true);

    const params = new URLSearchParams({ message });
    if (conversationId) params.append('conversationId', conversationId);

    const eventSource = new EventSource(
      `/api/ai/chat/stream?${params.toString()}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'content') {
        setContent((prev) => prev + data.content);
      } else if (data.type === 'done') {
        setIsStreaming(false);
        eventSource.close();
      } else if (data.type === 'error') {
        console.error(data.error);
        setIsStreaming(false);
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
      setIsStreaming(false);
    };
  };

  return { content, isStreaming, streamMessage };
}
```

### Example 3: Load Conversations
```typescript
export async function getConversations(page = 1, limit = 20) {
  const response = await fetch(
    `/api/ai/conversations?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );

  const data = await response.json();
  return data.data;
}
```

---

## 📋 Notes

1. **Guest Mode**: Hầu hết endpoints hỗ trợ guest users, nhưng data sẽ bị giới hạn
2. **Quota**: Free tier có giới hạn số lượng AI requests/tháng
3. **Streaming**: Nên dùng streaming cho better UX với responses dài
4. **Function Calling**: AI có thể tự động gọi functions (search places, calculate budget, etc.)
5. **Rate Limiting**: Có rate limits để tránh abuse (chi tiết xem docs riêng)

---

## 🔗 Related Documentation
- [Authentication API](./API_AUTH.md)
- [Trip Management API](./API_TRIPS.md)
- [Rate Limiting](./RATE_LIMITING.md)

**Last Updated**: 2026-01-30
**API Version**: v1
