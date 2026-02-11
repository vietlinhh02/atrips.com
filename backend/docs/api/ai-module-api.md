# AI Module API Documentation

## Overview

Module AI quản lý các chức năng AI chat, conversation history, và draft itinerary:
- AI Chat (với tool calling support)
- Conversation management
- AI Itinerary Drafts
- Itinerary generation với algorithms

**Base URL:** `/api/ai`

**Authentication:**
- Một số endpoints yêu cầu JWT token
- Một số hỗ trợ guest mode (optional auth)

```
Authorization: Bearer <access_token>
```

---

## Data Models

### Conversation Object

```typescript
interface Conversation {
  id: string;                    // UUID
  userId: string | null;         // null nếu guest
  tripId: string | null;         // Trip đã liên kết (sau khi apply draft)
  title: string | null;          // Tự động tạo từ message đầu tiên
  totalTokensUsed: number;       // Tổng tokens đã dùng
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### Conversation List Item (trong danh sách)

```typescript
interface ConversationListItem {
  id: string;
  title: string | null;
  tripId: string | null;
  trip: {                        // Trip đã liên kết
    id: string;
    title: string;
    status: TripStatus;
  } | null;
  totalTokensUsed: number;
  lastMessage: {                 // Tin nhắn cuối
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  } | null;
  latestDraft: {                 // Draft mới nhất
    id: string;
    isApplied: boolean;
    appliedToTripId: string | null;
    createdAt: string;
  } | null;
  hasDraft: boolean;             // Có draft hay không
  hasAppliedDraft: boolean;      // Draft đã được apply chưa
  createdAt: string;
  updatedAt: string;
}
```

### Conversation Detail (chi tiết)

```typescript
interface ConversationDetail {
  id: string;
  userId: string | null;
  tripId: string | null;
  title: string | null;
  totalTokensUsed: number;
  trips: {                       // Trip đã liên kết
    id: string;
    title: string;
    status: TripStatus;
    startDate: string;
    endDate: string;
  } | null;
  ai_messages: AIMessage[];      // Lịch sử chat
  ai_itinerary_drafts: DraftSummary[]; // Các drafts
  createdAt: string;
  updatedAt: string;
}
```

### AI Message Object

```typescript
interface AIMessage {
  id: string;                    // UUID
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;               // Nội dung tin nhắn
  structuredData: any | null;    // Tool calls info (nếu có)
  tokensUsed: number;
  createdAt: string;
}
```

### AI Draft Object

```typescript
interface AIDraft {
  id: string;                    // UUID
  conversationId: string | null;
  sourcePrompt: string;          // Prompt gốc từ user
  generatedData: ItineraryData;  // Dữ liệu lịch trình JSON
  appliedAt: string | null;      // Thời điểm đã apply thành trip
  appliedToTripId: string | null;// Trip ID đã tạo từ draft này
  createdAt: string;
}

interface DraftSummary {
  id: string;
  sourcePrompt: string;
  appliedAt: string | null;
  appliedToTripId: string | null;
  createdAt: string;
}
```

### Itinerary Data (trong draft)

```typescript
interface ItineraryData {
  tripTitle: string;
  destination: string;
  description: string;
  startDate: string;             // YYYY-MM-DD
  endDate: string;               // YYYY-MM-DD
  travelers: number;
  budget: number;
  currency: string;              // VND, USD, etc.
  days: ItineraryDay[];
}

interface ItineraryDay {
  date: string;                  // YYYY-MM-DD
  dayNumber: number;             // 1, 2, 3...
  title: string;                 // "Day 1: Khám phá trung tâm"
  theme: string;                 // Theme của ngày
  notes: string | null;
  schedule: ItineraryActivity[];
}

interface ItineraryActivity {
  name: string;
  type: string;                  // sightseeing, dining, etc.
  description: string;
  time: string;                  // "09:00"
  startTime: string;
  endTime: string;
  duration: number;              // phút
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  estimatedCost: number;
  placeId: string | null;        // Google Place ID
  orderIndex: number;
}
```

### Chat Response

```typescript
interface ChatResponse {
  message: string;               // Nội dung AI trả lời
  conversationId: string;        // ID conversation (tạo mới nếu chưa có)
  messageId: string;             // ID của message assistant
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;                 // Model đã dùng
  toolCalls: ToolCall[] | null;  // Các tool đã gọi
  draftId: string | null;        // Draft ID nếu tạo itinerary
  hasItinerary: boolean;         // Có tạo itinerary không
  algorithm: string | null;      // Algorithm đã dùng (nếu có)
  placesUsed: number | null;     // Số places đã dùng
  weatherInfo: any | null;       // Thông tin thời tiết
}

interface ToolCall {
  name: string;
  arguments: any;
  result: any;
}
```

---

## API Endpoints

### 1. Conversation Management

#### 1.1. List Conversations

Lấy danh sách conversations của user.

```http
GET /api/ai/conversations?limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| limit | number | ❌ | 50 | Số items trả về |
| offset | number | ❌ | 0 | Vị trí bắt đầu |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv-uuid-1",
        "title": "Du lịch Đà Nẵng 5 ngày...",
        "tripId": "trip-uuid",
        "trip": {
          "id": "trip-uuid",
          "title": "Du lịch Đà Nẵng",
          "status": "DRAFT"
        },
        "totalTokensUsed": 1500,
        "lastMessage": {
          "id": "msg-uuid",
          "role": "assistant",
          "content": "Đây là lịch trình 5 ngày...",
          "createdAt": "2024-02-15T10:30:00.000Z"
        },
        "latestDraft": {
          "id": "draft-uuid",
          "isApplied": true,
          "appliedToTripId": "trip-uuid",
          "createdAt": "2024-02-15T10:25:00.000Z"
        },
        "hasDraft": true,
        "hasAppliedDraft": true,
        "createdAt": "2024-02-15T10:00:00.000Z",
        "updatedAt": "2024-02-15T10:30:00.000Z"
      }
    ],
    "total": 15
  }
}
```

---

#### 1.2. Get Conversation Detail

Lấy chi tiết conversation với messages và drafts.

```http
GET /api/ai/conversations/:id
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| id | string | Conversation UUID |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "conv-uuid",
      "userId": "user-uuid",
      "tripId": "trip-uuid",
      "title": "Du lịch Đà Nẵng 5 ngày...",
      "totalTokensUsed": 1500,
      "trips": {
        "id": "trip-uuid",
        "title": "Du lịch Đà Nẵng",
        "status": "DRAFT",
        "startDate": "2024-03-01T00:00:00.000Z",
        "endDate": "2024-03-05T00:00:00.000Z"
      },
      "ai_messages": [
        {
          "id": "msg-1",
          "conversationId": "conv-uuid",
          "role": "user",
          "content": "Tạo lịch trình du lịch Đà Nẵng 5 ngày",
          "structuredData": null,
          "tokensUsed": 50,
          "createdAt": "2024-02-15T10:00:00.000Z"
        },
        {
          "id": "msg-2",
          "conversationId": "conv-uuid",
          "role": "assistant",
          "content": "Đây là lịch trình 5 ngày tại Đà Nẵng...",
          "structuredData": {
            "toolCalls": [
              {
                "name": "create_trip_plan",
                "result": { "draftId": "draft-uuid" }
              }
            ]
          },
          "tokensUsed": 1450,
          "createdAt": "2024-02-15T10:00:30.000Z"
        }
      ],
      "ai_itinerary_drafts": [
        {
          "id": "draft-uuid",
          "sourcePrompt": "Tạo lịch trình du lịch Đà Nẵng 5 ngày",
          "appliedAt": "2024-02-15T10:05:00.000Z",
          "appliedToTripId": "trip-uuid",
          "createdAt": "2024-02-15T10:00:30.000Z"
        }
      ],
      "createdAt": "2024-02-15T10:00:00.000Z",
      "updatedAt": "2024-02-15T10:05:00.000Z"
    }
  }
}
```

**Error Responses:**

| Status | Code | Message |
|--------|------|---------|
| 404 | NOT_FOUND | Conversation not found |

---

#### 1.3. Create Conversation

Tạo conversation mới (thường không cần gọi trực tiếp, chat API tự tạo).

```http
POST /api/ai/conversations
Content-Type: application/json
Authorization: Bearer <token> (optional)
```

**Request Body:**

```json
{
  "tripId": "trip-uuid",
  "title": "Lập kế hoạch du lịch"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tripId | string | ❌ | Liên kết với trip có sẵn |
| title | string | ❌ | Tiêu đề conversation |

**Success Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "conv-uuid",
      "userId": "user-uuid",
      "tripId": "trip-uuid",
      "title": "Lập kế hoạch du lịch",
      "totalTokensUsed": 0,
      "createdAt": "2024-02-15T10:00:00.000Z",
      "updatedAt": "2024-02-15T10:00:00.000Z"
    }
  },
  "message": "Conversation created successfully"
}
```

---

#### 1.4. Delete Conversation

Xóa conversation và tất cả messages, drafts liên quan.

```http
DELETE /api/ai/conversations/:id
Authorization: Bearer <token>
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": null,
  "message": "Conversation deleted successfully"
}
```

---

### 2. AI Chat

#### 2.1. Chat (Non-streaming)

Gửi message và nhận response đầy đủ.

```http
POST /api/ai/chat
Content-Type: application/json
Authorization: Bearer <token> (optional - supports guest)
```

**Request Body:**

```json
{
  "message": "Tạo lịch trình du lịch Đà Nẵng 5 ngày",
  "conversationId": "conv-uuid",
  "tripId": "trip-uuid",
  "context": {
    "destination": "Đà Nẵng",
    "startDate": "2024-03-01",
    "endDate": "2024-03-05",
    "budget": 15000000,
    "interests": ["biển", "ẩm thực", "văn hóa"],
    "travelStyle": "comfort",
    "travelers": 2
  },
  "enableTools": true,
  "taskType": "itinerary"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | ✅ | Tin nhắn user (1-2000 ký tự) |
| conversationId | string | ❌ | ID conversation (tạo mới nếu không có) |
| tripId | string | ❌ | Liên kết với trip có sẵn |
| context | object | ❌ | Context bổ sung cho AI |
| enableTools | boolean | ❌ | Bật/tắt tool calling (default: true) |
| taskType | string | ❌ | "itinerary" để force tạo lịch trình |

**Context Object:**

```typescript
interface ChatContext {
  destination?: string;          // Điểm đến
  startDate?: string;            // Ngày bắt đầu
  endDate?: string;              // Ngày kết thúc
  budget?: number;               // Ngân sách
  interests?: string[];          // Sở thích
  travelStyle?: 'budget' | 'moderate' | 'comfort' | 'luxury';
  travelers?: number;            // Số người đi
  hotelLocation?: string;        // Vị trí khách sạn
  mustSeeAttractions?: string[]; // Điểm must-see
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Đây là lịch trình 5 ngày tại Đà Nẵng:\n\n**Ngày 1: Khám phá trung tâm**\n...",
    "conversationId": "conv-uuid",
    "messageId": "msg-uuid",
    "usage": {
      "prompt_tokens": 150,
      "completion_tokens": 1200,
      "total_tokens": 1350
    },
    "model": "gpt-4-turbo",
    "toolCalls": [
      {
        "name": "search_places",
        "arguments": { "query": "attractions in Da Nang" },
        "result": { "places": [...] }
      },
      {
        "name": "create_trip_plan",
        "arguments": { "destination": "Đà Nẵng", ... },
        "result": { "draftId": "draft-uuid", "success": true }
      }
    ],
    "draftId": "draft-uuid",
    "hasItinerary": true,
    "algorithm": "TSP+Knapsack",
    "placesUsed": 15,
    "weatherInfo": {
      "avgTemp": 28,
      "condition": "sunny"
    }
  }
}
```

---

#### 2.2. Chat Stream (SSE)

Streaming response qua Server-Sent Events.

```http
GET /api/ai/chat/stream?message=...&conversationId=...&context=...
Authorization: Bearer <token> (optional)
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | ✅ | Tin nhắn user |
| conversationId | string | ❌ | ID conversation |
| tripId | string | ❌ | ID trip liên kết |
| context | string | ❌ | JSON stringified context |
| enableTools | string | ❌ | "true" / "false" |
| taskType | string | ❌ | "itinerary" để force |

**SSE Events:**

```typescript
// Content chunk
{ "type": "content", "content": "Đây là " }

// Tool calling
{ "type": "tool_call", "name": "search_places", "arguments": {...} }

// Tool result
{ "type": "tool_result", "name": "search_places", "result": {...} }

// Draft created
{
  "type": "draft_created",
  "draftId": "draft-uuid",
  "message": "Draft đã được tạo! Bạn có thể apply vào trip."
}

// Metadata (algorithms used)
{
  "type": "metadata",
  "algorithm": "TSP+Knapsack",
  "placesUsed": 15,
  "weatherInfo": {...}
}

// Finish streaming
{ "type": "finish", "reason": "stop" }

// Final summary
{
  "type": "done",
  "conversationId": "conv-uuid",
  "fullContent": "...",
  "toolCalls": [...],
  "draftId": "draft-uuid",
  "hasItinerary": true
}

// Error
{ "type": "error", "error": "Error message" }
```

**JavaScript Example:**

```javascript
const eventSource = new EventSource(
  `/api/ai/chat/stream?message=${encodeURIComponent(message)}&conversationId=${convId}`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'content':
      // Append to UI
      appendMessage(data.content);
      break;
    case 'draft_created':
      // Show apply button
      showApplyButton(data.draftId);
      break;
    case 'done':
      // Save conversation ID for next messages
      setConversationId(data.conversationId);
      eventSource.close();
      break;
    case 'error':
      showError(data.error);
      eventSource.close();
      break;
  }
};
```

---

### 3. AI Drafts

#### 3.1. List Drafts

Lấy danh sách drafts của user hoặc theo conversation.

```http
GET /api/ai/drafts?conversationId=conv-uuid
Authorization: Bearer <token>
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| conversationId | string | ❌ | Lọc theo conversation (nếu không có, lấy tất cả unapplied drafts) |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "drafts": [
      {
        "id": "draft-uuid-1",
        "conversationId": "conv-uuid",
        "sourcePrompt": "Tạo lịch trình Đà Nẵng 5 ngày",
        "generatedData": {
          "tripTitle": "Du lịch Đà Nẵng",
          "destination": "Đà Nẵng",
          "startDate": "2024-03-01",
          "endDate": "2024-03-05",
          "days": [...]
        },
        "appliedAt": null,
        "appliedToTripId": null,
        "createdAt": "2024-02-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

#### 3.2. Get Draft Detail

Lấy chi tiết một draft.

```http
GET /api/ai/drafts/:id
Authorization: Bearer <token>
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "draft": {
      "id": "draft-uuid",
      "conversationId": "conv-uuid",
      "sourcePrompt": "Tạo lịch trình du lịch Đà Nẵng 5 ngày cho 2 người, ngân sách 15 triệu",
      "generatedData": {
        "tripTitle": "Du lịch Đà Nẵng 5 ngày",
        "destination": "Đà Nẵng, Việt Nam",
        "description": "Hành trình khám phá thành phố biển xinh đẹp",
        "startDate": "2024-03-01",
        "endDate": "2024-03-05",
        "travelers": 2,
        "budget": 15000000,
        "currency": "VND",
        "days": [
          {
            "date": "2024-03-01",
            "dayNumber": 1,
            "title": "Ngày 1: Khám phá trung tâm",
            "theme": "City exploration",
            "schedule": [
              {
                "name": "Cầu Rồng",
                "type": "sightseeing",
                "description": "Biểu tượng của Đà Nẵng",
                "time": "09:00",
                "startTime": "09:00",
                "endTime": "10:30",
                "duration": 90,
                "address": "Cầu Rồng, Đà Nẵng",
                "coordinates": { "lat": 16.0612, "lng": 108.2279 },
                "estimatedCost": 0,
                "placeId": "ChIJ...",
                "orderIndex": 0
              }
            ]
          }
        ]
      },
      "appliedAt": null,
      "appliedToTripId": null,
      "createdAt": "2024-02-15T10:00:00.000Z",
      "ai_conversations": {
        "id": "conv-uuid",
        "userId": "user-uuid",
        "title": "Du lịch Đà Nẵng..."
      }
    }
  }
}
```

---

#### 3.3. Apply Draft to Trip

Chuyển draft thành trip thực sự.

```http
POST /api/trips/drafts/:draftId/apply
Content-Type: application/json
Authorization: Bearer <token>
```

**Xem chi tiết tại:** `trip-module-api.md` - Section 2.1

---

### 4. Generate Itinerary (Direct)

Tạo itinerary trực tiếp với algorithms.

```http
POST /api/ai/generate-itinerary
Content-Type: application/json
Authorization: Bearer <token> (optional)
```

**Request Body:**

```json
{
  "destination": "Đà Nẵng",
  "startDate": "2024-03-01",
  "endDate": "2024-03-05",
  "budget": 15000000,
  "interests": ["biển", "ẩm thực", "văn hóa"],
  "travelStyle": "comfort",
  "travelers": 2,
  "hotelLocation": "Mỹ Khê Beach",
  "mustSeeAttractions": ["Bà Nà Hills", "Cầu Rồng"],
  "useAlgorithm": true,
  "conversationId": "conv-uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| destination | string | ✅ | Điểm đến |
| startDate | string | ❌ | Ngày bắt đầu (YYYY-MM-DD) |
| endDate | string | ❌ | Ngày kết thúc |
| budget | number | ❌ | Ngân sách |
| interests | string[] | ❌ | Sở thích |
| travelStyle | string | ❌ | budget/moderate/comfort/luxury |
| travelers | number | ❌ | Số người (default: 1) |
| hotelLocation | string | ❌ | Vị trí khách sạn |
| mustSeeAttractions | string[] | ❌ | Điểm must-see |
| useAlgorithm | boolean | ❌ | Dùng algorithm (default: true) |
| conversationId | string | ❌ | Liên kết với conversation |

**Algorithms Used:**
- **TSP (Traveling Salesman Problem)**: Tối ưu lộ trình
- **Knapsack**: Chọn địa điểm trong giới hạn thời gian/ngân sách
- **Time Window Scheduling**: Xử lý giờ mở cửa
- **POI Recommender**: Gợi ý địa điểm cá nhân hóa

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "content": "# Lịch trình Du lịch Đà Nẵng 5 ngày\n\n## Ngày 1...",
    "itinerary": {
      "tripTitle": "Du lịch Đà Nẵng 5 ngày",
      "destination": "Đà Nẵng",
      "days": [...]
    },
    "draftId": "draft-uuid",
    "algorithm": "TSP+Knapsack+TimeWindow",
    "placesUsed": 18,
    "weatherInfo": {
      "forecast": [
        { "date": "2024-03-01", "temp": 28, "condition": "sunny" }
      ]
    },
    "toolCalls": [...],
    "usage": {
      "prompt_tokens": 500,
      "completion_tokens": 2000,
      "total_tokens": 2500
    }
  }
}
```

---

### 5. Other AI Endpoints

#### 5.1. Get Recommendations

```http
POST /api/ai/recommend
Content-Type: application/json
```

**Request Body:**

```json
{
  "location": "Đà Nẵng",
  "type": "restaurant",
  "budget": "moderate",
  "interests": ["seafood", "local"]
}
```

---

#### 5.2. Estimate Budget

```http
POST /api/ai/estimate-budget
Content-Type: application/json
```

**Request Body:**

```json
{
  "destination": "Đà Nẵng",
  "duration": 5,
  "travelers": 2,
  "style": "comfort"
}
```

---

#### 5.3. Get AI Quota

```http
GET /api/ai/quota
Authorization: Bearer <token> (optional)
```

**Response:**

```json
{
  "success": true,
  "data": {
    "quota": {
      "tier": "FREE",
      "monthlyLimit": 10,
      "used": 3,
      "remaining": 7,
      "resetDate": "2024-03-01T00:00:00.000Z"
    },
    "usage": {
      "thisMonth": 3
    }
  }
}
```

---

#### 5.4. Get Available Tools

```http
GET /api/ai/tools?taskType=itinerary
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "search_places",
        "description": "Search for places, restaurants, hotels...",
        "parameters": {...}
      },
      {
        "name": "create_trip_plan",
        "description": "Create a complete trip itinerary...",
        "parameters": {...}
      }
    ]
  }
}
```

---

#### 5.5. Get Provider Status

```http
GET /api/ai/provider/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "provider": "openai",
    "model": "gpt-4-turbo",
    "status": "operational",
    "toolsEnabled": true
  }
}
```

---

## Flow: Chat → Draft → Trip

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. User mở chat (mới hoặc existing)
   │
   ├── Conversation mới: conversationId = null
   │   └── POST /api/ai/chat { message, context }
   │       └── Response: { conversationId, draftId, message }
   │
   └── Conversation cũ:
       └── GET /api/ai/conversations/:id
           └── Response: { trips, ai_messages, ai_itinerary_drafts }

2. User chat để tạo itinerary
   │
   └── POST /api/ai/chat
       {
         "message": "Tạo lịch trình...",
         "conversationId": "conv-uuid",  // từ step 1
         "context": { destination, dates, budget, ... }
       }
       │
       └── Response:
           {
             "message": "Đây là lịch trình...",
             "conversationId": "conv-uuid",
             "draftId": "draft-uuid",    // ⭐ LƯU LẠI
             "hasItinerary": true
           }

3. User xem preview draft (optional)
   │
   └── GET /api/ai/drafts/:draftId
       └── Response: { draft: { generatedData: { days: [...] } } }

4. User apply draft thành trip
   │
   └── POST /api/trips/drafts/:draftId/apply
       { "createNew": true }
       │
       └── Response:
           {
             "trip": {
               "id": "trip-uuid",   // ⭐ TRIP ĐÃ TẠO
               "title": "...",
               "itinerary_days": [...]
             }
           }
       │
       └── Conversation.tripId được update = trip.id

5. User F5 / quay lại sau
   │
   └── GET /api/ai/conversations/:conversationId
       │
       └── Response:
           {
             "trips": { "id": "trip-uuid", ... },  // ⭐ Trip đã liên kết
             "ai_itinerary_drafts": [
               { "appliedToTripId": "trip-uuid" }  // ⭐ Draft đã apply
             ]
           }
```

---

## TypeScript Types

```typescript
// types/ai.ts

export interface Conversation {
  id: string;
  userId: string | null;
  tripId: string | null;
  title: string | null;
  totalTokensUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListItem extends Conversation {
  trip: {
    id: string;
    title: string;
    status: string;
  } | null;
  lastMessage: AIMessage | null;
  latestDraft: {
    id: string;
    isApplied: boolean;
    appliedToTripId: string | null;
    createdAt: string;
  } | null;
  hasDraft: boolean;
  hasAppliedDraft: boolean;
}

export interface ConversationDetail extends Conversation {
  trips: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
  } | null;
  ai_messages: AIMessage[];
  ai_itinerary_drafts: DraftSummary[];
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  structuredData: any | null;
  tokensUsed: number;
  createdAt: string;
}

export interface AIDraft {
  id: string;
  conversationId: string | null;
  sourcePrompt: string;
  generatedData: ItineraryData;
  appliedAt: string | null;
  appliedToTripId: string | null;
  createdAt: string;
}

export interface DraftSummary {
  id: string;
  sourcePrompt: string;
  appliedAt: string | null;
  appliedToTripId: string | null;
  createdAt: string;
}

export interface ItineraryData {
  tripTitle: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
  currency: string;
  days: ItineraryDay[];
}

export interface ItineraryDay {
  date: string;
  dayNumber: number;
  title: string;
  theme: string;
  notes: string | null;
  schedule: ItineraryActivity[];
}

export interface ItineraryActivity {
  name: string;
  type: string;
  description: string;
  time: string;
  startTime: string;
  endTime: string;
  duration: number;
  address: string;
  coordinates: { lat: number; lng: number };
  estimatedCost: number;
  placeId: string | null;
  orderIndex: number;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  tripId?: string;
  context?: ChatContext;
  enableTools?: boolean;
  taskType?: 'itinerary' | 'general';
}

export interface ChatContext {
  destination?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  interests?: string[];
  travelStyle?: 'budget' | 'moderate' | 'comfort' | 'luxury';
  travelers?: number;
  hotelLocation?: string;
  mustSeeAttractions?: string[];
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  messageId: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  toolCalls: ToolCall[] | null;
  draftId: string | null;
  hasItinerary: boolean;
  algorithm: string | null;
  placesUsed: number | null;
  weatherInfo: any | null;
}

export interface ToolCall {
  name: string;
  arguments: any;
  result: any;
}

export interface GenerateItineraryRequest {
  destination: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  interests?: string[];
  travelStyle?: string;
  travelers?: number;
  hotelLocation?: string;
  mustSeeAttractions?: string[];
  useAlgorithm?: boolean;
  conversationId?: string;
}
```

---

## API Service

```typescript
// services/aiApi.ts

import axios from 'axios';
import type {
  ConversationListItem,
  ConversationDetail,
  AIDraft,
  ChatRequest,
  ChatResponse,
  GenerateItineraryRequest,
} from '../types/ai';

const API_BASE = '/api/ai';

export const aiApi = {
  // Conversations
  async listConversations(params?: { limit?: number; offset?: number }) {
    const response = await axios.get(`${API_BASE}/conversations`, { params });
    return response.data.data as { conversations: ConversationListItem[]; total: number };
  },

  async getConversation(id: string) {
    const response = await axios.get(`${API_BASE}/conversations/${id}`);
    return response.data.data as { conversation: ConversationDetail };
  },

  async createConversation(data: { tripId?: string; title?: string }) {
    const response = await axios.post(`${API_BASE}/conversations`, data);
    return response.data.data as { conversation: any };
  },

  async deleteConversation(id: string) {
    const response = await axios.delete(`${API_BASE}/conversations/${id}`);
    return response.data;
  },

  // Chat
  async chat(data: ChatRequest): Promise<ChatResponse> {
    const response = await axios.post(`${API_BASE}/chat`, data);
    return response.data.data;
  },

  chatStream(params: {
    message: string;
    conversationId?: string;
    context?: any;
  }): EventSource {
    const queryParams = new URLSearchParams({
      message: params.message,
      ...(params.conversationId && { conversationId: params.conversationId }),
      ...(params.context && { context: JSON.stringify(params.context) }),
    });
    return new EventSource(`${API_BASE}/chat/stream?${queryParams}`);
  },

  // Drafts
  async listDrafts(conversationId?: string) {
    const params = conversationId ? { conversationId } : {};
    const response = await axios.get(`${API_BASE}/drafts`, { params });
    return response.data.data as { drafts: AIDraft[] };
  },

  async getDraft(id: string) {
    const response = await axios.get(`${API_BASE}/drafts/${id}`);
    return response.data.data as { draft: AIDraft };
  },

  // Generate
  async generateItinerary(data: GenerateItineraryRequest) {
    const response = await axios.post(`${API_BASE}/generate-itinerary`, data);
    return response.data.data;
  },

  // Quota
  async getQuota() {
    const response = await axios.get(`${API_BASE}/quota`);
    return response.data.data;
  },
};
```

---

## React Hooks

```typescript
// hooks/useAI.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../services/aiApi';

export const useConversations = (params?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => aiApi.listConversations(params),
  });
};

export const useConversation = (id: string) => {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => aiApi.getConversation(id),
    enabled: !!id,
  });
};

export const useChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: aiApi.chat,
    onSuccess: (data) => {
      // Invalidate conversation queries
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['conversation', data.conversationId]
        });
      }
    },
  });
};

export const useDrafts = (conversationId?: string) => {
  return useQuery({
    queryKey: ['drafts', conversationId],
    queryFn: () => aiApi.listDrafts(conversationId),
  });
};

export const useDraft = (id: string) => {
  return useQuery({
    queryKey: ['draft', id],
    queryFn: () => aiApi.getDraft(id),
    enabled: !!id,
  });
};

export const useGenerateItinerary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: aiApi.generateItinerary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
};
```

---

## File Structure Reference

```
src/modules/ai/
├── domain/
│   ├── algorithms/
│   │   ├── TSPSolver.js          # Route optimization
│   │   ├── KnapsackSelector.js   # Place selection
│   │   ├── TimeWindowScheduler.js # Opening hours
│   │   ├── POIRecommender.js     # Personalization
│   │   └── TripPlannerService.js # Orchestrator
│   ├── prompts/
│   │   └── index.js              # AI prompt templates
│   └── tools/
│       └── index.js              # Tool definitions
├── infrastructure/
│   ├── repositories/
│   │   └── AIConversationRepository.js
│   └── services/
│       ├── AIService.js          # Main AI service
│       └── ToolExecutor.js       # Tool execution
└── interfaces/
    └── http/
        ├── aiRoutes.js           # Route definitions
        └── aiController.js       # HTTP handlers
```
