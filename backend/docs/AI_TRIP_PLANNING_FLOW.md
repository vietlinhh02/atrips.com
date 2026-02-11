# AI Trip Planning Flow

## Overview

Tài liệu này mô tả chi tiết flow xử lý khi AI tạo plan du lịch từ yêu cầu tự nhiên của người dùng.

**Ví dụ input:** "Lập plan du lịch Hà Nội 2 ngày vào cuối tuần này"

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER REQUEST                                       │
│              "Lập plan du lịch Hà Nội 2 ngày vào cuối tuần này"             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STEP 1: INTENT PARSING                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  AIService.chat() nhận request với taskType = 'itinerary'           │    │
│  │  • Extract: destination = "Hà Nội"                                  │    │
│  │  • Extract: duration = 2 ngày                                       │    │
│  │  • Extract: timing = "cuối tuần này" → calculate actual dates       │    │
│  │  • Infer: default budget, travel style, preferences                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STEP 2: CONTEXT ENRICHMENT                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  AI gọi các tools để thu thập thông tin:                            │    │
│  │                                                                      │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │    │
│  │  │   get_weather    │  │  search_places   │  │ get_local_events │   │    │
│  │  │  • Thời tiết HN  │  │  • Attractions   │  │  • Events cuối   │   │    │
│  │  │  • Nhiệt độ      │  │  • Restaurants   │  │    tuần này      │   │    │
│  │  │  • Mưa/nắng      │  │  • Hotels        │  │                  │   │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘   │    │
│  │                                                                      │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                         │    │
│  │  │ get_travel_tips  │  │ calculate_budget │                         │    │
│  │  │  • Local tips    │  │  • Estimate cost │                         │    │
│  │  │  • Best time     │  │  • Daily budget  │                         │    │
│  │  └──────────────────┘  └──────────────────┘                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 3: ALGORITHM PROCESSING                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  TripPlannerService.js điều phối các algorithms:                    │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  1. POIRecommender.js                                       │    │    │
│  │  │     • Filter places phù hợp traveler type                   │    │    │
│  │  │     • Score và rank các địa điểm                            │    │    │
│  │  │     • Output: Danh sách POIs được recommend                 │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                           │                                          │    │
│  │                           ▼                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  2. KnapsackSelector.js                                     │    │    │
│  │  │     • Input: POIs, budget constraint, time constraint       │    │    │
│  │  │     • Algorithm: Dynamic programming knapsack               │    │    │
│  │  │     • Output: Optimal set of places to visit                │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                           │                                          │    │
│  │                           ▼                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  3. TSPSolver.js (Traveling Salesman Problem)               │    │    │
│  │  │     • Input: Selected places với coordinates                │    │    │
│  │  │     • Algorithm: Nearest neighbor + 2-opt optimization      │    │    │
│  │  │     • Output: Optimal route order                           │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                           │                                          │    │
│  │                           ▼                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  4. TimeWindowScheduler.js                                  │    │    │
│  │  │     • Input: Ordered places, opening hours, travel time     │    │    │
│  │  │     • Block activities vào time slots                       │    │    │
│  │  │     • Respect constraints: open/close, duration             │    │    │
│  │  │     • Output: Daily schedule với startTime/endTime          │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 4: ITINERARY GENERATION                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  AI tổng hợp và tạo structured JSON itinerary:                      │    │
│  │                                                                      │    │
│  │  {                                                                   │    │
│  │    "title": "Du lịch Hà Nội 2 ngày cuối tuần",                      │    │
│  │    "destination": "Hà Nội, Việt Nam",                               │    │
│  │    "startDate": "2026-02-07",                                       │    │
│  │    "endDate": "2026-02-08",                                         │    │
│  │    "estimatedBudget": { "total": 3000000, "currency": "VND" },      │    │
│  │    "days": [                                                         │    │
│  │      {                                                               │    │
│  │        "dayNumber": 1,                                               │    │
│  │        "date": "2026-02-07",                                        │    │
│  │        "activities": [                                               │    │
│  │          {                                                           │    │
│  │            "name": "Lăng Bác",                                       │    │
│  │            "type": "ATTRACTION",                                     │    │
│  │            "startTime": "07:30",                                     │    │
│  │            "endTime": "09:00",                                       │    │
│  │            "description": "Viếng Lăng Chủ tịch Hồ Chí Minh",        │    │
│  │            "estimatedCost": 0,                                       │    │
│  │            "latitude": 21.0367,                                      │    │
│  │            "longitude": 105.8343                                     │    │
│  │          },                                                          │    │
│  │          ...more activities                                          │    │
│  │        ]                                                             │    │
│  │      },                                                              │    │
│  │      { "dayNumber": 2, ... }                                        │    │
│  │    ]                                                                 │    │
│  │  }                                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STEP 5: DRAFT STORAGE                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Tool create_trip_plan được gọi để lưu draft:                       │    │
│  │                                                                      │    │
│  │  AIItineraryDraftRepository.create({                                │    │
│  │    conversationId: "conv_xxx",                                      │    │
│  │    sourcePrompt: "Lập plan du lịch Hà Nội 2 ngày...",              │    │
│  │    generatedData: { ...itinerary JSON },                            │    │
│  │    createdAt: timestamp                                             │    │
│  │  })                                                                  │    │
│  │                                                                      │    │
│  │  → Returns: draftId = "draft_yyy"                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 6: USER REVIEW & APPROVAL                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Frontend hiển thị draft để user review:                            │    │
│  │                                                                      │    │
│  │  GET /api/ai/drafts/:draftId                                        │    │
│  │                                                                      │    │
│  │  User có thể:                                                        │    │
│  │  • Approve → Apply draft                                            │    │
│  │  • Request changes → AI modify via chat                             │    │
│  │  • Reject → Start over                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            [User Approves]                [User Requests Changes]
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────────┐
│       STEP 7A: APPLY          │   │      STEP 7B: MODIFY                  │
│  ┌─────────────────────────┐  │   │  ┌─────────────────────────────────┐  │
│  │ POST /api/trips/drafts/ │  │   │  │ POST /api/trips/:id/ai-modify   │  │
│  │      :draftId/apply     │  │   │  │                                 │  │
│  │                         │  │   │  │ "Thêm 1 quán cafe buổi sáng"    │  │
│  │ ApplyAIDraftUseCase:    │  │   │  │                                 │  │
│  │ • Create Trip record    │  │   │  │ ModifyTripWithAIUseCase:        │  │
│  │ • Create ItineraryDays  │  │   │  │ • Load current trip context     │  │
│  │ • Create Activities     │  │   │  │ • AI processes modification     │  │
│  │ • Link draft to trip    │  │   │  │ • Update activities             │  │
│  └─────────────────────────┘  │   │  └─────────────────────────────────┘  │
└───────────────────────────────┘   └───────────────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STEP 8: TRIP READY                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Trip đã sẵn sàng trong database:                                   │    │
│  │                                                                      │    │
│  │  trips                                                               │    │
│  │    └── itinerary_days (Day 1, Day 2)                                │    │
│  │          └── activities (ordered by orderIndex)                     │    │
│  │                                                                      │    │
│  │  User có thể:                                                        │    │
│  │  • View trip: GET /api/trips/:tripId                                │    │
│  │  • Edit manually: PATCH /api/trips/:tripId/activities/:id           │    │
│  │  • Share trip: POST /api/trips/:tripId/share                        │    │
│  │  • Export to calendar/PDF                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram

```
┌──────┐     ┌──────────┐     ┌───────────┐     ┌─────────┐     ┌──────────┐     ┌────────┐
│Client│     │AIController│    │AIService  │     │LLM(Gemini)│    │ToolHandlers│   │Database│
└──┬───┘     └────┬─────┘     └─────┬─────┘     └────┬────┘     └─────┬────┘     └───┬────┘
   │              │                 │                │                │              │
   │ POST /ai/chat                  │                │                │              │
   │ "Lập plan HN 2 ngày"           │                │                │              │
   │─────────────────────────────>│ │                │                │              │
   │              │                 │                │                │              │
   │              │  chat(message,  │                │                │              │
   │              │  taskType)      │                │                │              │
   │              │────────────────>│                │                │              │
   │              │                 │                │                │              │
   │              │                 │ buildPrompt()  │                │              │
   │              │                 │────────────────│                │              │
   │              │                 │                │                │              │
   │              │                 │ sendToLLM()    │                │              │
   │              │                 │───────────────>│                │              │
   │              │                 │                │                │              │
   │              │                 │      Tool Call: get_weather     │              │
   │              │                 │<───────────────│                │              │
   │              │                 │                │                │              │
   │              │                 │────────────────────────────────>│              │
   │              │                 │                │   weatherData  │              │
   │              │                 │<────────────────────────────────│              │
   │              │                 │                │                │              │
   │              │                 │      Tool Call: search_places   │              │
   │              │                 │<───────────────│                │              │
   │              │                 │                │                │              │
   │              │                 │────────────────────────────────>│              │
   │              │                 │                │   places[]     │              │
   │              │                 │<────────────────────────────────│              │
   │              │                 │                │                │              │
   │              │                 │    [Repeat tools as needed]     │              │
   │              │                 │                │                │              │
   │              │                 │      Tool Call: create_trip_plan│              │
   │              │                 │<───────────────│                │              │
   │              │                 │                │                │              │
   │              │                 │────────────────────────────────>│              │
   │              │                 │                │                │  saveDraft() │
   │              │                 │                │                │─────────────>│
   │              │                 │                │                │   draftId    │
   │              │                 │                │                │<─────────────│
   │              │                 │                │   draftId      │              │
   │              │                 │<────────────────────────────────│              │
   │              │                 │                │                │              │
   │              │                 │ Final response │                │              │
   │              │                 │<───────────────│                │              │
   │              │                 │                │                │              │
   │              │ Response + draftId               │                │              │
   │              │<────────────────│                │                │              │
   │              │                 │                │                │              │
   │ Response JSON│                 │                │                │              │
   │<─────────────│                 │                │                │              │
   │              │                 │                │                │              │
   │ POST /trips/drafts/:id/apply  │                │                │              │
   │─────────────────────────────>│ │                │                │              │
   │              │                 │                │                │              │
   │              │ ApplyAIDraftUseCase              │                │              │
   │              │───────────────────────────────────────────────────────────────>│
   │              │                 │                │                │   Trip       │
   │              │<───────────────────────────────────────────────────────────────│
   │              │                 │                │                │              │
   │ Trip created │                 │                │                │              │
   │<─────────────│                 │                │                │              │
   │              │                 │                │                │              │
```

---

## Data Models Involved

### 1. AI Conversation & Messages

```sql
-- Lưu conversation history
ai_conversations
├── id (UUID)
├── userId (FK)
├── title
├── context (JSON) -- trip preferences, current state
├── totalTokens
└── createdAt, updatedAt

ai_messages
├── id (UUID)
├── conversationId (FK)
├── role (user|assistant|system|tool)
├── content
├── toolCalls (JSON)
├── tokenCount
└── createdAt
```

### 2. AI Itinerary Draft

```sql
-- Lưu draft trước khi apply
ai_itinerary_drafts
├── id (UUID)
├── conversationId (FK, nullable)
├── sourcePrompt -- "Lập plan du lịch Hà Nội 2 ngày..."
├── generatedData (JSON) -- Full itinerary structure
├── appliedAt (nullable)
├── appliedToTripId (FK, nullable)
└── createdAt
```

### 3. Trip & Activities

```sql
-- Trip chính
trips
├── id (UUID)
├── ownerId (FK)
├── title, description
├── startDate, endDate
├── travelersCount
├── budgetTotal, budgetCurrency
├── status (DRAFT|ACTIVE|COMPLETED|ARCHIVED)
└── ...

-- Ngày trong trip
itinerary_days
├── id (UUID)
├── tripId (FK)
├── date
├── dayNumber
├── cityName
├── notes
└── weatherData (JSON)

-- Activities trong ngày
activities
├── id (UUID)
├── itineraryDayId (FK)
├── name, type
├── description
├── startTime, endTime, duration
├── latitude, longitude
├── estimatedCost, currency
├── orderIndex
└── ...
```

---

## API Endpoints

### Chat & Planning

```http
# Bắt đầu chat với AI
POST /api/ai/chat
Content-Type: application/json

{
  "message": "Lập plan du lịch Hà Nội 2 ngày vào cuối tuần này",
  "taskType": "itinerary",
  "conversationId": null  // null = new conversation
}

# Response
{
  "success": true,
  "data": {
    "response": "Tôi đã tạo plan du lịch Hà Nội 2 ngày cho bạn...",
    "conversationId": "conv_xxx",
    "draftId": "draft_yyy",
    "toolsUsed": ["get_weather", "search_places", "create_trip_plan"]
  }
}
```

### Draft Management

```http
# Lấy draft để review
GET /api/ai/drafts/:draftId

# Response
{
  "success": true,
  "data": {
    "id": "draft_yyy",
    "sourcePrompt": "Lập plan du lịch Hà Nội 2 ngày...",
    "generatedData": {
      "title": "Du lịch Hà Nội 2 ngày",
      "days": [...]
    },
    "appliedAt": null
  }
}
```

### Apply Draft → Create Trip

```http
# Apply draft thành trip thực
POST /api/trips/drafts/:draftId/apply
Content-Type: application/json

{
  "existingTripId": null  // null = create new trip
}

# Response
{
  "success": true,
  "data": {
    "tripId": "trip_zzz",
    "message": "Trip created successfully"
  }
}
```

### Modify Existing Trip with AI

```http
# Sửa trip bằng AI
POST /api/trips/:tripId/ai-modify
Content-Type: application/json

{
  "instruction": "Thêm 1 quán cafe vào buổi sáng ngày 1"
}

# Response
{
  "success": true,
  "data": {
    "modifiedActivities": [...],
    "message": "Đã thêm Cafe Giang vào 8:00 sáng ngày 1"
  }
}
```

---

## Tool Definitions

### Core Planning Tools

| Tool | Description | Input |
|------|-------------|-------|
| `search_places` | Tìm địa điểm từ Mapbox/Google Places | `{ query, location, types[], limit }` |
| `get_weather` | Lấy thông tin thời tiết | `{ location, date }` |
| `get_local_events` | Tìm sự kiện địa phương | `{ location, dateRange }` |
| `get_travel_tips` | Tips du lịch từ web search | `{ destination }` |
| `calculate_distance` | Tính khoảng cách/thời gian đi | `{ origin, destination, mode }` |
| `create_trip_plan` | Lưu draft itinerary | `{ title, destination, dates, days[] }` |

### Tool Call Flow Example

```javascript
// AI nhận request → gọi tools
const toolCalls = [
  {
    name: "get_weather",
    arguments: { location: "Hà Nội", date: "2026-02-07" }
  },
  {
    name: "search_places",
    arguments: {
      query: "tourist attractions",
      location: "Hà Nội",
      types: ["tourist_attraction", "museum", "temple"],
      limit: 20
    }
  },
  {
    name: "search_places",
    arguments: {
      query: "restaurants local food",
      location: "Hà Nội",
      types: ["restaurant"],
      limit: 15
    }
  }
];

// Tools trả về data → AI tổng hợp và gọi create_trip_plan
const createPlanCall = {
  name: "create_trip_plan",
  arguments: {
    title: "Du lịch Hà Nội 2 ngày cuối tuần",
    destination: { city: "Hà Nội", country: "Vietnam" },
    startDate: "2026-02-07",
    endDate: "2026-02-08",
    days: [
      {
        dayNumber: 1,
        activities: [
          { name: "Lăng Bác", type: "ATTRACTION", startTime: "07:30", ... },
          { name: "Phở Bát Đàn", type: "RESTAURANT", startTime: "09:30", ... },
          // ...
        ]
      },
      // Day 2...
    ]
  }
};
```

---

## Algorithms Detail

### 1. POI Recommender

```javascript
// File: /src/modules/ai/domain/algorithms/POIRecommender.js

class POIRecommender {
  recommend(places, userPreferences) {
    // Filter by traveler type (solo, couple, family, group)
    // Filter by budget level
    // Filter by interests (culture, food, nature, shopping)
    // Score based on ratings, reviews, popularity
    // Return ranked list
  }
}
```

### 2. Knapsack Selector

```javascript
// File: /src/modules/ai/domain/algorithms/KnapsackSelector.js

class KnapsackSelector {
  select(items, constraints) {
    // items = [{ id, value, cost, time }]
    // constraints = { maxBudget, maxTimePerDay }

    // Dynamic programming: maximize total value
    // while respecting budget and time constraints

    // Return optimal subset of items
  }
}
```

### 3. TSP Solver

```javascript
// File: /src/modules/ai/domain/algorithms/TSPSolver.js

class TSPSolver {
  solve(places) {
    // Input: places with latitude, longitude

    // 1. Build distance matrix using Haversine formula
    // 2. Apply nearest neighbor heuristic
    // 3. Optimize with 2-opt improvement

    // Return: ordered list minimizing total travel distance
  }
}
```

### 4. Time Window Scheduler

```javascript
// File: /src/modules/ai/domain/algorithms/TimeWindowScheduler.js

class TimeWindowScheduler {
  schedule(orderedPlaces, dayStart, dayEnd) {
    // Input:
    //   - orderedPlaces from TSP
    //   - dayStart: "08:00"
    //   - dayEnd: "21:00"

    // For each place:
    //   - Check opening hours
    //   - Assign startTime, endTime
    //   - Add travel time buffer
    //   - Handle lunch/dinner breaks

    // Return: scheduled activities with times
  }
}
```

---

## Error Handling

### Common Errors

| Error Code | Description | Handling |
|------------|-------------|----------|
| `INVALID_DESTINATION` | Không tìm thấy địa điểm | AI hỏi lại user |
| `DATE_CONFLICT` | Ngày không hợp lệ | AI suggest valid dates |
| `TOOL_EXECUTION_FAILED` | Tool call failed | Retry or fallback |
| `DRAFT_NOT_FOUND` | Draft không tồn tại | Return 404 |
| `DRAFT_ALREADY_APPLIED` | Draft đã được apply | Return 409 Conflict |

### Retry Strategy

```javascript
// AIService.js - Max 5 tool iterations
const MAX_ITERATIONS = 5;

async chat(message, options) {
  let iterations = 0;
  while (iterations < MAX_ITERATIONS) {
    const response = await this.llm.generate(messages);

    if (!response.toolCalls) {
      return response; // Final answer
    }

    // Execute tools and continue
    const toolResults = await this.executeTools(response.toolCalls);
    messages.push({ role: 'tool', content: toolResults });
    iterations++;
  }

  throw new Error('Max iterations reached');
}
```

---

## Caching Strategy

```javascript
// Caching để tăng performance
const CACHE_TTL = {
  weather: 3600,      // 1 hour
  places: 86400,      // 24 hours
  chatResponse: 3600, // 1 hour
  travelTips: 604800  // 1 week
};

// Cache key format
const cacheKey = `${tool_name}:${JSON.stringify(params)}`;
```

---

## Frontend Integration

### React Hook Example

```typescript
// useTripPlanning.ts
import { useState } from 'react';
import { aiService, tripService } from '@/services';

export function useTripPlanning() {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ItineraryDraft | null>(null);

  const createPlan = async (prompt: string) => {
    setLoading(true);
    try {
      // Step 1: Chat with AI
      const response = await aiService.chat({
        message: prompt,
        taskType: 'itinerary'
      });

      // Step 2: Fetch draft
      if (response.draftId) {
        const draftData = await aiService.getDraft(response.draftId);
        setDraft(draftData);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyDraft = async (draftId: string) => {
    const trip = await tripService.applyDraft(draftId);
    return trip;
  };

  return { loading, draft, createPlan, applyDraft };
}
```

### UI Flow

```
┌────────────────────────────────────────────────────┐
│                   Chat Interface                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🤖 Xin chào! Bạn muốn đi du lịch ở đâu?     │  │
│  │                                              │  │
│  │ 👤 Lập plan du lịch Hà Nội 2 ngày vào       │  │
│  │    cuối tuần này                             │  │
│  │                                              │  │
│  │ 🤖 Đang tạo plan... ⏳                       │  │
│  │    ✓ Kiểm tra thời tiết                     │  │
│  │    ✓ Tìm địa điểm                           │  │
│  │    ✓ Tối ưu lộ trình                        │  │
│  │                                              │  │
│  │ 🤖 Đã tạo xong plan! [Xem chi tiết]         │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  [Input: Nhập tin nhắn...]         [Gửi]          │
└────────────────────────────────────────────────────┘
                        │
                        ▼ Click "Xem chi tiết"
┌────────────────────────────────────────────────────┐
│              Draft Preview Modal                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  🗓️ Du lịch Hà Nội 2 ngày                   │  │
│  │  📅 07/02 - 08/02/2026                       │  │
│  │  💰 ~3,000,000 VNĐ                           │  │
│  │                                              │  │
│  │  📍 Ngày 1 - Thứ Bảy                        │  │
│  │  ├─ 07:30 Lăng Bác                          │  │
│  │  ├─ 09:30 Phở Bát Đàn                       │  │
│  │  ├─ 11:00 Văn Miếu                          │  │
│  │  ├─ 13:00 Bún chả Hương Liên               │  │
│  │  ├─ 15:00 Hoàn Kiếm Lake                    │  │
│  │  └─ 19:00 Phố cổ & Night market             │  │
│  │                                              │  │
│  │  📍 Ngày 2 - Chủ Nhật                       │  │
│  │  ├─ 08:00 Cafe trứng Giảng                  │  │
│  │  ├─ ...                                      │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  [Yêu cầu chỉnh sửa]    [✓ Áp dụng plan này]      │
└────────────────────────────────────────────────────┘
```

---

## Summary

Flow xử lý AI tạo plan du lịch gồm 8 bước chính:

1. **Intent Parsing**: Phân tích yêu cầu từ ngôn ngữ tự nhiên
2. **Context Enrichment**: Thu thập data từ các tools (weather, places, events)
3. **Algorithm Processing**: Chạy các thuật toán tối ưu (POI → Knapsack → TSP → Scheduler)
4. **Itinerary Generation**: AI tổng hợp thành structured JSON
5. **Draft Storage**: Lưu draft vào database
6. **User Review**: User xem và approve/modify
7. **Apply/Modify**: Tạo trip thực hoặc chỉnh sửa
8. **Trip Ready**: Trip sẵn sàng sử dụng

Kiến trúc này cho phép:
- Tách biệt AI logic khỏi trip management
- User có quyền review trước khi tạo trip
- Dễ dàng modify thông qua natural language
- Tối ưu với các algorithms (TSP, Knapsack)
- Caching để tăng performance
