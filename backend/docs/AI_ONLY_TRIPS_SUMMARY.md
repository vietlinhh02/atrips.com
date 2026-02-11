# 🤖 AI-Only Trip Creation - Quick Reference

> **TL;DR:** Direct trip creation is disabled. Use AI-powered planning instead.

---

## 🚫 What's Blocked

```bash
POST /api/trips
```

**Error Response:**
```json
{
  "success": false,
  "error": "Direct trip creation is not available. Use AI-powered trip planning."
}
```

---

## ✅ What to Use Instead

### Simple 3-Step Flow

```typescript
// 1️⃣ Start AI Chat
const stream = startChatStream({
  message: "Plan a 5-day trip to Hanoi",
  context: { useAlgorithm: true }
});

// 2️⃣ Get Draft ID from SSE event
stream.on('draft_created', (data) => {
  const draftId = data.draftId;
});

// 3️⃣ Apply Draft to Create Trip
const trip = await applyDraft(draftId, { createNew: true });
```

---

## 📦 What You Get

### Old Way (Direct Creation)
```json
{
  "trip": {
    "id": "...",
    "title": "My Trip",
    "itinerary_days": [
      {
        "date": "2024-01-01",
        "activities": []  // ❌ Empty
      }
    ]
  }
}
```

### New Way (AI-Powered)
```json
{
  "trip": {
    "id": "...",
    "title": "5-Day Hanoi Adventure",
    "itinerary_days": [
      {
        "date": "2024-01-01",
        "title": "Day 1: Old Quarter Exploration",
        "activities": [
          {
            "name": "Hoan Kiem Lake",
            "type": "ATTRACTION",
            "startTime": "09:00",
            "duration": 120,
            "placeId": "ChIJ...",
            "latitude": 21.028511,
            "longitude": 105.852146,
            "estimatedCost": 0
          },
          // ✅ 5-10 activities per day
        ]
      }
    ]
  }
}
```

---

## 🔥 Benefits

| Feature | Old Way | AI Way |
|---------|---------|--------|
| Activities | 0 (empty) | 5-10 per day |
| Place Details | ❌ None | ✅ Coords, PlaceID, Cost |
| Timing | ❌ Manual | ✅ Optimized |
| Route | ❌ None | ✅ TSP-optimized |
| Weather | ❌ None | ✅ Included |

---

## 🛠️ Code Changes Required

### Frontend

**Before:**
```tsx
<button onClick={() => createTrip(data)}>
  Create Trip
</button>
```

**After:**
```tsx
<button onClick={() => startAIPlannerChat()}>
  🤖 Plan with AI
</button>
```

### API Calls

**Before:**
```typescript
POST /api/trips
```

**After:**
```typescript
POST /api/ai/chat/stream          // Step 1
→ Listen for 'draft_created'      // Step 2
POST /api/trips/drafts/:id/apply  // Step 3
```

---

## 📚 Full Documentation

- **Migration Guide:** [MIGRATION_AI_ONLY_TRIPS.md](./MIGRATION_AI_ONLY_TRIPS.md)
- **Frontend Integration:** [FRONTEND_INTEGRATION.md](../FRONTEND_INTEGRATION.md)
- **API Reference:** [OpenAPI Spec](../docs/openapi.yaml)

---

## 🆘 Quick Help

**Problem:** Old code still calling `POST /api/trips`
**Solution:** Search codebase for `POST.*trips` and replace with AI flow

**Problem:** Need test data
**Solution:** Use Prisma seed scripts or AI with test accounts

**Problem:** Want to bypass for admin
**Solution:** Add role check in `tripController.js:16`

---

**Questions?** Ask in #backend-support Slack channel
