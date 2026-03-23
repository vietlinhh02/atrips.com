# CrewAI Migration Guide

Tài liệu hướng dẫn chuyển đổi AI module hiện tại sang CrewAI khi cần scale lên multi-agent architecture.

**Trạng thái:** Blueprint / Chưa triển khai
**Cập nhật:** 2026-02-05

---

## Mục lục

1. [Tại sao CrewAI](#1-tại-sao-crewai)
2. [Kiến trúc hiện tại vs. CrewAI](#2-kiến-trúc-hiện-tại-vs-crewai)
3. [Kiến trúc đề xuất](#3-kiến-trúc-đề-xuất)
4. [Agent Design](#4-agent-design)
5. [Tool Mapping](#5-tool-mapping)
6. [Migration Plan theo phase](#6-migration-plan-theo-phase)
7. [Integration Pattern: Node.js ↔ CrewAI](#7-integration-pattern-nodejs--crewai)
8. [Giữ lại gì, thay thế gì](#8-giữ-lại-gì-thay-thế-gì)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Khi nào nên trigger migration](#11-khi-nào-nên-trigger-migration)
12. [Ước tính effort](#12-ước-tính-effort)

---

## 1. Tại sao CrewAI

### Khi nào cần chuyển

Hệ thống hiện tại là **single-agent** (1 AI assistant xử lý tất cả). Chuyển sang CrewAI khi:

- Cần **nhiều AI agent chạy song song** (research agent, price monitor, personalization agent)
- Cần **agent delegation** (agent A nhờ agent B xử lý sub-task)
- Cần **long-term memory** across sessions phức tạp hơn conversation history
- Cần **agent specialization** (mỗi agent expert 1 domain, kết quả tốt hơn 1 agent làm tất cả)
- Single-agent bắt đầu **tốn quá nhiều tokens** vì system prompt + tools quá lớn

### Khi nào KHÔNG cần

- Chỉ cần chat + tool calling đơn giản → giữ nguyên
- Latency là ưu tiên #1 → CrewAI multi-agent chậm hơn single-agent
- Không muốn maintain Python service → giữ nguyên Node.js

---

## 2. Kiến trúc hiện tại vs. CrewAI

### Hiện tại: Single-Agent Tool-Calling

```
User Request
    ↓
Express API (aiController.js)
    ↓
AIService.chat() ← 1 system prompt, 28 tools
    ↓
OpenAI-compatible API (tool-calling loop, max 5 iterations)
    ↓
ToolExecutor.execute() → handlers (search, booking, planning, trip mgmt, social)
    ↓
Algorithms (POIRecommender, Knapsack, TSP, TimeWindow)
    ↓
Response (text + structured data)
```

**File chính:**
- `AIService.js` — orchestration, tool-calling loop, streaming
- `ToolExecutor.js` — tool dispatch (28 tools)
- `handlers/` — 6 handler files (~3,500 lines)
- `algorithms/` — 4 optimization algorithms
- `prompts/index.js` — system prompt builder
- `tools/index.js` — tool definitions + context-based filtering

### Sau migration: Multi-Agent CrewAI

```
User Request
    ↓
Express API (aiController.js) — giữ nguyên
    ↓
HTTP call → Python CrewAI Service (FastAPI)
    ↓
CrewAI Crew orchestrates multiple agents:
    ├── ResearchAgent (web_search, scrape_url, social_media)
    ├── PlanningAgent (search_places, algorithms, create_trip_plan)
    ├── BookingAgent (flights, hotels, events, exchange_rate)
    └── TripManagerAgent (CRUD operations on trips)
    ↓
Response → Node.js → User
```

---

## 3. Kiến trúc đề xuất

### System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND                              │
│              (React / Next.js)                            │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼───────────────────────────────────┐
│              NODE.JS BACKEND (Express)                     │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Auth Module  │  │ Trip Module  │  │ Place Module   │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              AI Gateway (aiController.js)            │ │
│  │  - Route requests to CrewAI service                 │ │
│  │  - Handle SSE streaming bridge                      │ │
│  │  - Auth context injection                           │ │
│  │  - Response formatting                              │ │
│  └──────────────────────┬──────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────┘
                          │ HTTP (internal network)
┌─────────────────────────▼────────────────────────────────┐
│           PYTHON CREWAI SERVICE (FastAPI)                  │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                   Crew Router                       │ │
│  │  POST /crews/chat         — general chat            │ │
│  │  POST /crews/itinerary    — trip planning           │ │
│  │  POST /crews/research     — destination research    │ │
│  │  POST /crews/modify-trip  — trip modifications      │ │
│  │  GET  /jobs/{id}          — async job status        │ │
│  │  GET  /health             — health check            │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                 │
│  ┌──────────┐ ┌────────┴───────┐ ┌──────────────────┐   │
│  │  Agents  │ │     Crews      │ │     Tools        │   │
│  │          │ │                │ │  (Python wrappers │   │
│  │ Research │ │ TripPlanning   │ │   calling Node.js │   │
│  │ Planning │ │ Research       │ │   APIs or direct  │   │
│  │ Booking  │ │ Modification   │ │   implementations)│   │
│  │ TripMgmt │ │ Chat           │ │                   │   │
│  └──────────┘ └────────────────┘ └──────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                   Shared                            │ │
│  │  Memory (ChromaDB) │ Config │ Callbacks             │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │   SearXNG    │
│  (Prisma)    │ │  (cache/job) │ │  (search)    │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 4. Agent Design

### 4.1 ResearchAgent

```python
research_agent = Agent(
    role="Travel Research Specialist",
    goal="Gather comprehensive, accurate destination information from multiple sources",
    backstory="""You are an expert travel researcher who finds the best information
    about destinations, attractions, local tips, and real traveler experiences.
    You cross-reference multiple sources and prioritize recent, reliable data.""",
    tools=[web_search, scrape_url, search_social_media, search_youtube],
    llm=ChatOpenAI(model="gpt-4-turbo", temperature=0.3),
    memory=True,
    verbose=True,
    max_iter=5,
)
```

**Khi nào hoạt động:**
- User hỏi về destination ("Hà Nội có gì chơi?")
- Cần thu thập context trước khi planning (Step 2 của workflow hiện tại)
- User yêu cầu research cụ thể ("review khách sạn X")

### 4.2 PlanningAgent

```python
planning_agent = Agent(
    role="Trip Planning Strategist",
    goal="Create optimal, personalized travel itineraries using data and algorithms",
    backstory="""You are a master trip planner who combines data-driven optimization
    (route optimization, budget allocation) with creative local recommendations.
    You always consider weather, opening hours, travel time, and user preferences.""",
    tools=[search_places, get_weather, calculate_distance, create_trip_plan,
           run_tsp_optimizer, run_knapsack_selector, run_time_scheduler],
    llm=ChatOpenAI(model="gpt-4-turbo", temperature=0.5),
    memory=True,
    allow_delegation=True,  # Có thể nhờ ResearchAgent tìm thêm info
)
```

**Khi nào hoạt động:**
- User yêu cầu tạo lịch trình ("Lập plan Đà Nẵng 3 ngày")
- Optimization tasks (sắp xếp lại route, cân đối budget)
- Step 3-5 của workflow hiện tại

### 4.3 BookingAgent

```python
booking_agent = Agent(
    role="Travel Booking Assistant",
    goal="Find the best deals on flights, hotels, and activities",
    backstory="""You are a savvy travel booking expert who finds optimal
    price-quality combinations. You compare options across multiple providers
    and consider factors like cancellation policies and location convenience.""",
    tools=[search_flights, search_hotels, get_local_events,
           get_exchange_rate, get_travel_tips],
    llm=ChatOpenAI(model="gpt-4-turbo", temperature=0.3),
    memory=True,
)
```

**Khi nào hoạt động:**
- User hỏi về vé máy bay, khách sạn
- Ước tính budget
- Tìm events/activities tại destination

### 4.4 TripManagerAgent

```python
trip_manager_agent = Agent(
    role="Trip Management Coordinator",
    goal="Execute precise modifications to user trips based on instructions",
    backstory="""You are a meticulous trip coordinator who handles all CRUD
    operations on trips. You ensure data integrity, validate changes,
    and confirm modifications with clear summaries.""",
    tools=[get_user_trips, get_trip_detail, update_trip, delete_trip,
           add_activity, update_activity, delete_activity, reorder_activities,
           apply_draft_to_trip, add_day_to_trip, update_day, delete_day],
    llm=ChatOpenAI(model="gpt-3.5-turbo", temperature=0.2),  # Cheaper, deterministic
    memory=False,  # Stateless CRUD, không cần memory
)
```

**Khi nào hoạt động:**
- User muốn sửa trip ("thêm quán cà phê vào ngày 2")
- Apply draft to existing trip
- Xóa/reorder activities

---

## 5. Tool Mapping

### Chuyển đổi từ Node.js handlers sang CrewAI tools

| Current Handler (Node.js) | CrewAI Tool (Python) | Strategy |
|---|---|---|
| `searchHandlers.webSearch` | `SearxngSearchTool` | Rewrite — gọi SearXNG trực tiếp từ Python |
| `searchHandlers.scrapeUrl` | `CrawleeScrapeTool` | **Giữ Node.js** — gọi qua internal API (Crawlee = Node.js only) |
| `searchHandlers.searchPlaces` | `PlaceSearchTool` | Rewrite — gọi Mapbox/Google Places API từ Python |
| `infoHandlers.getCurrentDatetime` | `DatetimeTool` | Rewrite — trivial Python implementation |
| `infoHandlers.getWeather` | `WeatherTool` | Rewrite — gọi OpenWeatherMap từ Python |
| `infoHandlers.calculateDistance` | `DistanceTool` | Rewrite — Haversine formula in Python |
| `infoHandlers.getExchangeRate` | `ExchangeRateTool` | Rewrite — gọi API từ Python |
| `infoHandlers.getTravelTips` | `TravelTipsTool` | Rewrite — gọi API từ Python |
| `bookingHandlers.searchFlights` | `FlightSearchTool` | Rewrite — Amadeus Python SDK (chính thức) |
| `bookingHandlers.searchHotels` | `HotelSearchTool` | Rewrite — RapidAPI từ Python |
| `bookingHandlers.getLocalEvents` | `EventSearchTool` | Rewrite — Ticketmaster từ Python |
| `planningHandlers.createTripPlan` | `CreateDraftTool` | **Gọi Node.js API** — cần Prisma/DB access |
| `tripManagementHandlers.*` (12 tools) | `TripCrudTool` | **Gọi Node.js API** — tất cả cần Prisma/DB |
| `socialMediaHandlers.*` | `SocialMediaTool` | Rewrite — gọi SearXNG + YouTube API từ Python |
| `algorithms/*` (TSP, Knapsack, etc.) | `OptimizerTool` | **Port sang Python** — tận dụng numpy/scipy |

### Tool Implementation Strategy

```
┌─────────────────────────────────────────────────┐
│              CrewAI Tools                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  REWRITE IN PYTHON (standalone, no Node.js dep): │
│  ├── SearxngSearchTool     (HTTP → SearXNG)     │
│  ├── WeatherTool           (HTTP → OpenWeather)  │
│  ├── DistanceTool          (Haversine formula)   │
│  ├── ExchangeRateTool      (HTTP → API)          │
│  ├── FlightSearchTool      (Amadeus Python SDK)  │
│  ├── HotelSearchTool       (HTTP → RapidAPI)     │
│  ├── EventSearchTool       (HTTP → Ticketmaster) │
│  ├── DatetimeTool          (Python datetime)     │
│  ├── SocialMediaTool       (HTTP → SearXNG)      │
│  └── YouTubeTool           (HTTP → YouTube API)  │
│                                                  │
│  PORT FROM NODE.JS → PYTHON:                     │
│  ├── TSPSolverTool         (numpy + scipy)       │
│  ├── KnapsackTool          (numpy)               │
│  ├── POIRecommenderTool    (pandas + sklearn)     │
│  └── TimeSchedulerTool     (Python implementation)│
│                                                  │
│  PROXY TO NODE.JS (cần DB/Prisma access):        │
│  ├── CrawleeScrapeTool     (HTTP → Node.js API)  │
│  ├── CreateDraftTool       (HTTP → Node.js API)  │
│  ├── PlaceSearchTool       (HTTP → Node.js API)  │
│  └── TripCrudTools (12x)   (HTTP → Node.js API)  │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 6. Migration Plan theo Phase

### Phase 0: Preparation (1-2 tuần)

**Mục tiêu:** Setup infrastructure, không thay đổi production.

- [ ] Tạo Python project structure:
  ```
  crewai-service/
  ├── pyproject.toml
  ├── Dockerfile
  ├── src/
  │   ├── main.py              # FastAPI entrypoint
  │   ├── config.py            # Environment config
  │   ├── agents/              # Agent definitions
  │   ├── crews/               # Crew compositions
  │   ├── tools/               # Tool implementations
  │   └── callbacks/           # Streaming callbacks
  └── tests/
  ```
- [ ] Setup CrewAI + FastAPI + Docker
- [ ] Expose internal API endpoints trên Node.js cho DB operations (trip CRUD, draft, places)
- [ ] Setup ChromaDB cho CrewAI memory
- [ ] CI/CD pipeline cho Python service

### Phase 1: Research Crew (2-3 tuần)

**Mục tiêu:** Chuyển research tasks sang CrewAI. Chat thông thường vẫn qua Node.js.

- [ ] Implement `ResearchAgent` + tools (SearXNG, scrape, social media)
- [ ] Tạo `ResearchCrew` với single agent
- [ ] Node.js gateway: route `taskType=research` → CrewAI service
- [ ] A/B test: so sánh quality giữa Node.js single-agent vs CrewAI research
- [ ] Fallback: nếu CrewAI service down → fallback về Node.js

**Validation criteria:**
- Response quality >= hiện tại
- Latency < 2x hiện tại
- Error rate < 1%

### Phase 2: Planning Crew (3-4 tuần)

**Mục tiêu:** Multi-agent trip planning.

- [ ] Port algorithms sang Python (TSP, Knapsack, POIRecommender, TimeWindow)
- [ ] Implement `PlanningAgent` + `BookingAgent`
- [ ] Tạo `TripPlanningCrew`:
  ```python
  trip_planning_crew = Crew(
      agents=[research_agent, planning_agent, booking_agent],
      tasks=[
          Task(description="Research destination", agent=research_agent),
          Task(description="Create optimized itinerary", agent=planning_agent),
          Task(description="Find booking options", agent=booking_agent),
      ],
      process=Process.sequential,  # Research → Plan → Book
      memory=True,
      verbose=True,
  )
  ```
- [ ] Node.js gateway: route `taskType=itinerary` → CrewAI service
- [ ] Streaming bridge: CrewAI callbacks → SSE → frontend
- [ ] Benchmark: so sánh itinerary quality, latency, cost

**Validation criteria:**
- Itinerary quality >= hiện tại (human evaluation)
- Algorithm results identical (unit tests so sánh Node.js vs Python output)
- End-to-end latency < 30s cho typical request

### Phase 3: Trip Management Crew (2-3 tuần)

**Mục tiêu:** Chuyển trip modification sang CrewAI.

- [ ] Implement `TripManagerAgent` với proxy tools (gọi Node.js API)
- [ ] Tạo `ModificationCrew`:
  ```python
  modification_crew = Crew(
      agents=[trip_manager_agent, planning_agent],
      tasks=[
          Task(description="Analyze trip and requested changes", agent=trip_manager_agent),
          Task(description="Optimize if needed", agent=planning_agent),
      ],
      process=Process.sequential,
  )
  ```
- [ ] Route `taskType=modify_trip` → CrewAI service
- [ ] Auth context forwarding (userId, JWT) qua internal API headers

### Phase 4: Full Migration + Advanced Features (4-6 tuần)

**Mục tiêu:** Tất cả AI requests qua CrewAI. Thêm advanced features.

- [ ] Migrate remaining chat flow sang CrewAI
- [ ] Implement CrewAI Flows cho complex workflows:
  ```python
  @flow
  class TripPlanningFlow(Flow):
      @start()
      def parse_intent(self):
          # Determine which crew to use
          ...

      @listen(parse_intent)
      def execute_crew(self):
          # Run appropriate crew
          ...

      @listen(execute_crew)
      def save_results(self):
          # Store draft, update conversation
          ...
  ```
- [ ] Enable cross-session memory (user preferences learned over time)
- [ ] Agent training: fine-tune agent behavior với feedback data
- [ ] Remove Node.js AI orchestration code (AIService.chat, ToolExecutor)
- [ ] Keep Node.js: Express API, Prisma, Crawlee, internal APIs

---

## 7. Integration Pattern: Node.js ↔ CrewAI

### 7.1 Request Flow

```javascript
// aiController.js — Updated gateway
async function chat(req, res) {
  const { message, conversationId, taskType } = req.body;
  const userId = req.user.id;

  // Route to CrewAI service
  const crewResponse = await fetch(`${CREWAI_URL}/crews/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
      'X-Conversation-Id': conversationId,
      'Authorization': `Bearer ${INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      message,
      task_type: taskType,
      user_context: await getUserContext(userId),
      conversation_history: await getConversationHistory(conversationId),
    }),
  });

  // Bridge streaming response
  if (req.headers.accept === 'text/event-stream') {
    res.setHeader('Content-Type', 'text/event-stream');
    // Pipe CrewAI SSE → client SSE
    crewResponse.body.pipe(res);
  } else {
    const result = await crewResponse.json();
    res.json(result);
  }
}
```

### 7.2 CrewAI → Node.js Internal API (cho DB operations)

```python
# tools/trip_crud.py
from crewai.tools import BaseTool
import httpx

NODEJS_API = os.getenv("NODEJS_INTERNAL_URL", "http://localhost:3000")

class AddActivityTool(BaseTool):
    name: str = "add_activity"
    description: str = "Add an activity to a specific day in a trip"

    def _run(self, trip_id: str, day_id: str, activity_data: dict) -> str:
        response = httpx.post(
            f"{NODEJS_API}/internal/trips/{trip_id}/days/{day_id}/activities",
            json=activity_data,
            headers={
                "X-User-Id": self.metadata.get("user_id"),
                "Authorization": f"Bearer {INTERNAL_API_KEY}",
            },
        )
        return response.json()
```

### 7.3 Internal API Endpoints cần thêm vào Node.js

```
# Trip CRUD (proxy cho Prisma operations)
POST   /internal/trips/:tripId/days/:dayId/activities
PUT    /internal/trips/:tripId/activities/:activityId
DELETE /internal/trips/:tripId/activities/:activityId
PUT    /internal/trips/:tripId/activities/reorder
POST   /internal/drafts
PUT    /internal/trips/:tripId
GET    /internal/trips/:tripId
GET    /internal/users/:userId/trips

# Places (proxy cho database + external APIs)
GET    /internal/places/search?query=...&lat=...&lng=...

# Crawlee (Playwright/Cheerio scraping)
POST   /internal/scrape    { url, options }
```

Các endpoint này chỉ accessible từ internal network (Docker network hoặc localhost).

---

## 8. Giữ lại gì, thay thế gì

### GIỮ LẠI trong Node.js

| Component | Lý do |
|---|---|
| Express API + Routes | Frontend gateway, auth, validation |
| Prisma + PostgreSQL | ORM + database, không cần duplicate |
| Crawlee (Cheerio + Playwright) | Node.js only library, chạy tốt rồi |
| Redis caching | Shared cache giữa Node.js và CrewAI |
| Auth middleware | JWT validation, user context |
| SSE streaming bridge | Pipe CrewAI output → frontend |
| `aiController.js` | Giữ lại như gateway/router |

### THAY THẾ bằng CrewAI (Python)

| Component | Thay thế bằng |
|---|---|
| `AIService.js` (orchestration) | CrewAI Crews + Flows |
| `ToolExecutor.js` (dispatch) | CrewAI Agent tool binding |
| `handlers/*.js` (tool logic) | CrewAI Tools (Python) |
| `prompts/index.js` (system prompts) | Agent role/goal/backstory |
| `tools/index.js` (tool definitions) | `@tool` decorators in Python |
| `algorithms/*.js` | Python implementations (numpy/scipy) |

### XÓA sau khi migration hoàn tất

```
src/modules/ai/
├── infrastructure/services/
│   ├── AIService.js          ← XÓA (replaced by CrewAI)
│   ├── ToolExecutor.js       ← XÓA (replaced by CrewAI)
│   └── handlers/             ← XÓA toàn bộ folder
│       ├── searchHandlers.js
│       ├── infoHandlers.js
│       ├── bookingHandlers.js
│       ├── planningHandlers.js
│       ├── tripManagementHandlers.js
│       └── socialMediaHandlers.js
├── domain/
│   ├── prompts/              ← XÓA (replaced by agent definitions)
│   ├── tools/                ← XÓA (replaced by Python tools)
│   └── algorithms/           ← XÓA (ported to Python)
```

**Giữ lại:**
```
src/modules/ai/
├── infrastructure/
│   ├── repositories/         ← GIỮ (DB access for internal API)
│   ├── services/
│   │   ├── SearxngService.js ← GIỮ hoặc XÓA (tùy Python có gọi trực tiếp SearXNG không)
│   │   ├── CrawleeService.js ← GIỮ (Node.js only, exposed via internal API)
│   │   └── utils/            ← GIỮ (rate limiter dùng chung)
└── interfaces/
    └── http/
        ├── aiController.js   ← GIỮ (gateway role)
        ├── aiRoutes.js       ← GIỮ
        └── internalRoutes.js ← MỚI (internal API cho CrewAI)
```

---

## 9. Infrastructure & Deployment

### Docker Compose Addition

```yaml
# docker-compose.yml — thêm CrewAI service
services:
  # ... existing services (postgres, redis, searxng) ...

  crewai:
    build:
      context: ./crewai-service
      dockerfile: Dockerfile
    ports:
      - "8400:8400"  # Internal only, không expose ra ngoài
    environment:
      - OAI_BASE_URL=${OAI_BASE_URL}
      - OAI_API_KEY=${OAI_API_KEY}
      - OAI_MODEL=${OAI_MODEL}
      - NODEJS_INTERNAL_URL=http://backend:3000
      - SEARXNG_URL=http://searxng:8080
      - REDIS_URL=redis://redis:6379
      - CHROMADB_URL=http://chromadb:8000
    depends_on:
      - redis
      - searxng
      - chromadb
    networks:
      - atrips-network
    deploy:
      resources:
        limits:
          memory: 2G  # CrewAI + LLM calls cần RAM

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chromadb_data:/chroma/chroma
    networks:
      - atrips-network
```

### CrewAI Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml

COPY src/ src/

EXPOSE 8400

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8400"]
```

### Python Dependencies

```toml
# pyproject.toml
[project]
name = "atrips-crewai"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "crewai[tools]>=1.1.0",
    "fastapi>=0.115.0",
    "uvicorn>=0.32.0",
    "httpx>=0.27.0",
    "numpy>=2.0.0",
    "scipy>=1.14.0",
    "chromadb>=0.5.0",
    "redis>=5.0.0",
    "pydantic>=2.9.0",
]
```

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Latency tăng** (multi-agent = nhiều LLM calls) | High | Dùng `Process.sequential` thay vì `hierarchical` khi có thể. Cache agent results. Dùng GPT-3.5 cho simple agents. |
| **LLM cost tăng** (nhiều agents = nhiều tokens) | High | Agent-specific model selection (cheap model cho CRUD, expensive cho planning). Set `max_iter` thấp. |
| **CrewAI service down** | Critical | Fallback route: nếu CrewAI timeout → route về Node.js AIService (giữ code cũ trong Phase 1-3). Health check + auto-restart. |
| **Data inconsistency** (2 services ghi DB) | Medium | Chỉ Node.js ghi DB (qua internal API). CrewAI = read-only trực tiếp, write qua proxy. |
| **Algorithm parity** (Python port khác kết quả) | Medium | Unit tests: so sánh output Node.js vs Python với cùng input. Chạy song song trong Phase 2. |
| **Streaming complexity** (bridge SSE qua 2 services) | Medium | CrewAI callbacks → FastAPI StreamingResponse → Node.js pipe. Test kỹ với slow connections. |
| **Python dependency issues** | Low | Pin versions. Docker isolation. CI test matrix. |
| **Memory leak** (ChromaDB + long-running agents) | Medium | Monitor memory usage. Set `memory=False` cho stateless agents. Periodic ChromaDB cleanup. |

---

## 11. Khi nào nên trigger migration

### Checklist — bắt đầu migration khi >= 3 items đúng:

- [ ] System prompt + tool definitions > 8,000 tokens (LLM context window bị chiếm quá nhiều)
- [ ] Cần agent chạy background (price monitoring, re-optimization scheduled)
- [ ] User feedback: AI response quality kém vì phải handle quá nhiều tasks cùng lúc
- [ ] Cần personalization phức tạp (long-term user preference learning)
- [ ] Team có Python developer hoặc sẵn sàng maintain Python service
- [ ] Infrastructure đã stable (Docker, CI/CD, monitoring hoạt động tốt)
- [ ] Có budget cho LLM cost tăng ~2-3x trong giai đoạn đầu

### Metrics để đo sau migration

| Metric | Target | Đo bằng |
|---|---|---|
| Itinerary quality score | >= current | Human evaluation (blind A/B test) |
| Response latency (P95) | < 15s chat, < 30s itinerary | APM monitoring |
| LLM cost per request | < 3x current | Token usage tracking |
| Error rate | < 1% | Error logging |
| User satisfaction | >= current | NPS / feedback |

---

## 12. Ước tính effort

| Phase | Effort | Dependencies |
|---|---|---|
| Phase 0: Preparation | 1-2 tuần | Docker, CI/CD setup |
| Phase 1: Research Crew | 2-3 tuần | Phase 0 |
| Phase 2: Planning Crew | 3-4 tuần | Phase 1 + algorithm porting |
| Phase 3: Trip Management Crew | 2-3 tuần | Phase 2 + internal API |
| Phase 4: Full Migration | 4-6 tuần | Phase 3 + streaming bridge |
| **Tổng** | **12-18 tuần** | — |

**Team cần:**
- 1 Python developer (CrewAI + FastAPI)
- 1 Node.js developer (internal API + gateway + maintain existing)
- Shared: DevOps cho Docker/CI/CD

---

## Appendix: Quick Reference

### CrewAI Python Project Structure

```
crewai-service/
├── pyproject.toml
├── Dockerfile
├── docker-compose.override.yml
├── tests/
│   ├── test_agents.py
│   ├── test_crews.py
│   ├── test_tools.py
│   └── test_algorithms.py
└── src/
    ├── main.py                    # FastAPI app
    ├── config.py                  # Settings (Pydantic BaseSettings)
    ├── agents/
    │   ├── __init__.py
    │   ├── research_agent.py
    │   ├── planning_agent.py
    │   ├── booking_agent.py
    │   └── trip_manager_agent.py
    ├── crews/
    │   ├── __init__.py
    │   ├── chat_crew.py
    │   ├── trip_planning_crew.py
    │   ├── research_crew.py
    │   └── modification_crew.py
    ├── tools/
    │   ├── __init__.py
    │   ├── search_tools.py        # SearXNG, scrape proxy
    │   ├── weather_tools.py
    │   ├── booking_tools.py       # Amadeus, RapidAPI
    │   ├── planning_tools.py      # Algorithm wrappers
    │   ├── trip_crud_tools.py     # Node.js API proxy
    │   └── social_tools.py
    ├── algorithms/
    │   ├── __init__.py
    │   ├── tsp_solver.py          # Ported from TSPSolver.js
    │   ├── knapsack_selector.py   # Ported from KnapsackSelector.js
    │   ├── poi_recommender.py     # Ported from POIRecommender.js
    │   └── time_scheduler.py      # Ported from TimeWindowScheduler.js
    ├── flows/
    │   ├── __init__.py
    │   └── trip_planning_flow.py  # CrewAI Flow orchestration
    └── callbacks/
        ├── __init__.py
        └── streaming.py           # SSE streaming callbacks
```

### Mapping: Current Node.js files → CrewAI equivalents

```
Node.js                                    →  Python CrewAI
─────────────────────────────────────────────────────────────
AIService.js                               →  crews/*.py + flows/*.py
ToolExecutor.js                            →  (built into CrewAI agent)
handlers/searchHandlers.js                 →  tools/search_tools.py
handlers/infoHandlers.js                   →  tools/weather_tools.py
handlers/bookingHandlers.js                →  tools/booking_tools.py
handlers/planningHandlers.js               →  tools/planning_tools.py
handlers/tripManagementHandlers.js         →  tools/trip_crud_tools.py
handlers/socialMediaHandlers.js            →  tools/social_tools.py
prompts/index.js                           →  agents/*.py (role/goal/backstory)
tools/index.js + tools/*Tools.js           →  (built into agent tool binding)
algorithms/TSPSolver.js                    →  algorithms/tsp_solver.py
algorithms/KnapsackSelector.js             →  algorithms/knapsack_selector.py
algorithms/POIRecommender.js               →  algorithms/poi_recommender.py
algorithms/TimeWindowScheduler.js          →  algorithms/time_scheduler.py
```
