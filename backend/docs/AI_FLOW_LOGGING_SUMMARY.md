# AI Trip Planning Flow - Logging Summary

Tài liệu này mô tả logging đã được thêm vào code để trace flow AI Trip Planning.

## Files Modified with Logging

### 1. `src/modules/ai/interfaces/http/aiController.js`
**Flows:** Step 1, Step 2-4, Step 5, Step 6

```
╔════════════════════════════════════════════════════════════╗
║           AI TRIP PLANNING FLOW - STARTED                  ║
╚════════════════════════════════════════════════════════════╝
📨 User message: "Lập plan du lịch Hà Nội 2 ngày..."
👤 User: user_id_123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: INTENT PARSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Extracting intent from natural language...
🔍 Detected request type: 🗺️ ITINERARY_GENERATION
📍 Destination: Hà Nội
📅 Duration: 2026-02-07 to 2026-02-08

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2-4: CONTEXT ENRICHMENT + ALGORITHM PROCESSING + ITINERARY GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌤️  Gathering weather data...
📍 Searching places from database and external APIs...
💡 Collecting travel tips and local events...
🎯 POIRecommender: Filtering and scoring places...
🎒 KnapsackSelector: Optimizing places selection...
🗺️  TSPSolver: Finding optimal routes...
⏰ TimeWindowScheduler: Scheduling activities...
🤖 AI synthesizing final itinerary...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: DRAFT STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 Saving draft to database...
✅ Draft created with ID: draft_abc123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6: USER REVIEW & APPROVAL (Frontend)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Draft ready for user review
🔗 Draft ID: draft_abc123
⏳ Waiting for user to approve, modify, or reject...

╔════════════════════════════════════════════════════════════╗
║     AI TRIP PLANNING FLOW - RESPONSE SENT TO CLIENT        ║
╚════════════════════════════════════════════════════════════╝
```

### 2. `src/modules/ai/infrastructure/services/AIService.js`
**Flows:** Step 2-4 (Detailed algorithm execution)

```
┌────────────────────────────────────────────────────────────┐
│     STEP 2-4: CONTEXT + ALGORITHMS + GENERATION            │
└────────────────────────────────────────────────────────────┘
🗺️  Generating itinerary for: Hà Nội
📅 Dates: 2026-02-07 to 2026-02-08
💰 Budget: 3000000
🎒 Travel style: comfort
👥 Travelers: 2
🎯 Use algorithms: true

  📍 [STEP 2.1] Fetching places from database...
  📍 Only 3 places in DB - fetching from external APIs...
  ✅ Retrieved 20 places from API

  🌤️  [STEP 2.2] Fetching weather for Hà Nội on 2026-02-07...
  ✅ Weather: Clear, 24°C

  📊 Total places available for planning: 23

  🔧 [STEP 3] Running Trip Planning Algorithms...
     3.1 POIRecommender: Scoring places based on preferences
     3.2 KnapsackSelector: Selecting optimal place combinations
     3.3 TSPSolver: Calculating optimal routes
     3.4 TimeWindowScheduler: Assigning time slots

  ✨ [STEP 4] Enhancing itinerary with AI-generated content...
  ✅ Itinerary enhancement complete

  📊 Final itinerary stats:
     - Days: 2
     - Total places: 8
     - Total distance: 15.5 km
     - Algorithm: atrips-v2
```

### 3. `src/modules/ai/domain/algorithms/TripPlannerService.js`
**Flows:** Detailed algorithm pipeline logging

```
  ┌─────────────────────────────────────────────────────────┐
  │           TRIP PLANNER PIPELINE STARTED                 │
  └─────────────────────────────────────────────────────────┘

  📊 Trip Parameters:
     - Destination: Hà Nội
     - Duration: 2 days
     - Daily time budget: 480 min
     - Daily money budget: 1,500,000 VND
     - Travel style: comfort
     - Travelers: 2

  🔍 [Algorithm 1/4] POIRecommender - Filtering places...
     ✓ Found 23 places in Hà Nội
     ✓ After filtering: 22 places
     → Scoring with profile: {"interests":[],"travelStyle":"comfort"...}
     ✓ Recommended 12 diverse places

  🎒 [Algorithm 2/4] KnapsackSelector - Optimizing selection...
     Constraints: maxTime=960min, budget=3000000
     ✓ Selected 8 places
     → Total value: 85.50
     → Time utilization: 87.5%

  🗺️  [Algorithm 3/4] TSPSolver - Optimizing routes...
     ✓ Route optimization complete for 2 days

  ⏰ [Algorithm 4/4] TimeWindowScheduler - Scheduling...
     ✓ Scheduled 8 activities across 2 days

  📋 Formatting final itinerary...
  ┌─────────────────────────────────────────────────────────┐
  │           TRIP PLANNER PIPELINE COMPLETE ✓              │
  └─────────────────────────────────────────────────────────┘
```

### 4. `src/modules/trip/application/useCases/ApplyAIDraftUseCase.js`
**Flows:** Step 7A, Step 8

```
╔════════════════════════════════════════════════════════════╗
║     STEP 7A: APPLY DRAFT → CREATE TRIP                     ║
╚════════════════════════════════════════════════════════════╝
📝 Draft ID: draft_abc123
👤 User ID: user_123
🏗️  Create new: true

  📋 Parsing draft data...
  ✓ Trip title: Du lịch Hà Nội 2 ngày
  ✓ Destination: Hà Nội

  💾 Creating new Trip record...
  ✅ Trip created: trip_xyz789

  📅 Creating Itinerary Days...
     Total days to create: 2

     Day 1:
       ✓ Created day: day_001
       → Creating 4 activities...
       ✓ Created 4 activities

     Day 2:
       ✓ Created day: day_002
       → Creating 4 activities...
       ✓ Created 4 activities

  🔗 Marking draft as applied...
  ✅ Draft draft_abc123 marked as applied to trip trip_xyz789
  🔗 Linking conversation conv_123 to trip...
  ✅ Conversation linked

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8: TRIP READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  🎉 TRIP CREATED SUCCESSFULLY!
  📍 Trip ID: trip_xyz789
  📝 Title: Du lịch Hà Nội 2 ngày
  📅 Days: 2
  🎯 Activities: 8

  User can now:
     • View trip: GET /api/trips/trip_xyz789
     • Edit activities manually
     • Share trip with others
     • Export to calendar/PDF

╔════════════════════════════════════════════════════════════╗
║     STEP 7A & 8: COMPLETED ✓                               ║
╚════════════════════════════════════════════════════════════╝
```

### 5. `src/modules/trip/application/useCases/ModifyTripWithAIUseCase.js`
**Flows:** Step 7B

```
╔════════════════════════════════════════════════════════════╗
║     STEP 7B: MODIFY TRIP WITH AI                           ║
╚════════════════════════════════════════════════════════════╝
📝 Modification request: "Thêm 1 quán cafe buổi sáng ngày 1"
🎯 Trip ID: trip_xyz789
👤 User ID: user_123
  ✅ Trip ownership verified
  📋 Current trip: "Du lịch Hà Nội 2 ngày" (2 days, 8 activities)

  🤖 Processing modification with AI...
  ✅ AI processing complete

  📊 Detected changes:
     • Add 1 activities

  💾 Applying changes...
  ✅ Changes applied successfully

  📊 Trip updated:
     • Days: 2
     • Activities: 9 (was 8)

╔════════════════════════════════════════════════════════════╗
║     STEP 7B: COMPLETED ✓                                   ║
╚════════════════════════════════════════════════════════════╝
```

### 6. `src/modules/ai/infrastructure/services/handlers/planningHandlers.js`
**Flows:** Step 5 (via create_trip_plan tool)

```
  ┌─────────────────────────────────────────────────────────┐
  │  STEP 5: DRAFT STORAGE (via create_trip_plan tool)      │
  └─────────────────────────────────────────────────────────┘
  📝 AI requested trip plan creation:
     - Title: Du lịch Hà Nội 2 ngày
     - Destination: Hà Nội
     - Dates: 2026-02-07 to 2026-02-08
     - Travelers: 2
  📊 Itinerary has 2 days
  💾 Saving draft to database...
  ✅ Draft created with ID: draft_abc123

  🚀 User authenticated - Auto-applying draft (Skip Step 6 Review)...
  ⚡ Proceeding directly to Step 7A: Apply Draft
  ✅ Trip created from draft: trip_xyz789
```

### 7. `src/modules/ai/infrastructure/services/ToolExecutor.js`
**Flows:** Tool execution logging

```
  🔧 [STEP 2: Context] Executing: search_places
  ✅ search_places completed in 245ms

  🔧 [STEP 2: Context] Executing: get_weather
  ✅ get_weather completed in 120ms

  🔧 [STEP 5: Draft] Executing: create_trip_plan
  ✅ create_trip_plan completed in 560ms
```

## Complete Flow Mapping

| Step | Name | Location | Log Output |
|------|------|----------|------------|
| 1 | Intent Parsing | `aiController.js` | ✅ START + detection |
| 2 | Context Enrichment | `AIService.js` + `ToolExecutor.js` | ✅ Places, Weather, Events |
| 3 | Algorithm Processing | `TripPlannerService.js` | ✅ POI→Knapsack→TSP→Scheduler |
| 4 | Itinerary Generation | `AIService.js` | ✅ AI enhancement |
| 5 | Draft Storage | `planningHandlers.js` | ✅ Draft creation |
| 6 | User Review | `aiController.js` | ✅ Frontend notification |
| 7A | Apply Draft | `ApplyAIDraftUseCase.js` | ✅ Trip + Days + Activities |
| 7B | Modify Trip | `ModifyTripWithAIUseCase.js` | ✅ Changes detection |
| 8 | Trip Ready | `ApplyAIDraftUseCase.js` | ✅ Completion message |

## How to Monitor Flow

### 1. Watch All AI Flow Logs
```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com/backend
npm run dev 2>&1 | grep -E "(STEP|FLOW|✓|✅|❌|⚠️|🗺️|📅|💾|🎉)"
```

### 2. Watch Specific Step
```bash
# Only Step 1 (Intent)
npm run dev 2>&1 | grep "STEP 1"

# Only Algorithm steps
npm run dev 2>&1 | grep -E "(Algorithm|POI|Knapsack|TSP|Scheduler)"

# Only Step 7A/8 (Apply)
npm run dev 2>&1 | grep -E "(STEP 7|STEP 8|TRIP CREATED)"
```

### 3. Debug Mode
Set environment variable for more detailed logs:
```bash
DEBUG_AI=true npm run dev
```

## Flow Verification Checklist

When testing the flow, verify these log messages appear in order:

- [ ] `AI TRIP PLANNING FLOW - STARTED`
- [ ] `STEP 1: INTENT PARSING`
- [ ] `STEP 2-4: CONTEXT ENRICHMENT...`
- [ ] `TRIP PLANNER PIPELINE STARTED`
- [ ] `[Algorithm 1/4] POIRecommender`
- [ ] `[Algorithm 2/4] KnapsackSelector`
- [ ] `[Algorithm 3/4] TSPSolver`
- [ ] `[Algorithm 4/4] TimeWindowScheduler`
- [ ] `TRIP PLANNER PIPELINE COMPLETE`
- [ ] `STEP 5: DRAFT STORAGE`
- [ ] `Draft created with ID`
- [ ] `STEP 6: USER REVIEW & APPROVAL`
- [ ] `AI TRIP PLANNING FLOW - RESPONSE SENT TO CLIENT`

And when applying draft:
- [ ] `STEP 7A: APPLY DRAFT → CREATE TRIP`
- [ ] `Creating new Trip record`
- [ ] `Creating Itinerary Days`
- [ ] `STEP 8: TRIP READY`
- [ ] `TRIP CREATED SUCCESSFULLY!`
