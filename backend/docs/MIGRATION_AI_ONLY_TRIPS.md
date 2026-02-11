# Migration Guide: AI-Only Trip Creation

**Date:** 2024-02-04
**Impact:** Breaking Change
**Affected:** Trip Creation Flow

---

## 🎯 Summary

Direct trip creation via `POST /api/trips` has been **DISABLED**. All trips must now be created through AI-powered planning to ensure rich, detailed itineraries.

---

## 📊 What Changed

### Backend Changes

| Component | Change | Status |
|-----------|--------|--------|
| `POST /api/trips` | Now throws error with instructions | ❌ Disabled |
| `CreateTripUseCase.js` | Original logic commented out | ⚠️ Deprecated |
| `POST /api/trips/drafts/:id/apply` | Remains the only way to create trips | ✅ Active |

### API Response

When calling `POST /api/trips`, the API will return:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Direct trip creation is not available. Please use AI-powered trip planning:\n1. Start a conversation with AI: POST /api/ai/chat\n2. Request trip planning: \"Plan a trip to [destination] from [date] to [date]\"\n3. Review the generated draft\n4. Apply the draft: POST /api/trips/drafts/{draftId}/apply"
  }
}
```

---

## 🔄 Migration Steps

### Step 1: Update Frontend Code

**Remove direct trip creation calls:**

```typescript
// ❌ DELETE THIS
async function createTrip(data) {
  const response = await fetch('/api/trips', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response.json();
}
```

**Implement AI-powered flow:**

```typescript
// ✅ USE THIS
async function createTripWithAI(userMessage: string) {
  // 1. Start AI conversation
  const eventSource = new EventSource(
    `/api/ai/chat/stream?message=${encodeURIComponent(userMessage)}`
  );

  let draftId: string | null = null;

  // 2. Listen for draft creation
  eventSource.addEventListener('draft_created', (event) => {
    const data = JSON.parse(event.data);
    draftId = data.draftId;
    eventSource.close();
  });

  // 3. Wait for draft, then apply
  await waitForDraft(draftId);

  // 4. Apply draft to create trip
  const trip = await applyDraft(draftId, { createNew: true });
  return trip;
}
```

### Step 2: Update UI Components

**Change trip creation buttons:**

```tsx
// ❌ OLD: Direct create button
<button onClick={handleCreateTrip}>
  Create Trip Manually
</button>

// ✅ NEW: AI-powered button
<button onClick={handleStartAIPlanning}>
  🤖 Plan My Trip with AI
</button>
```

### Step 3: Update Error Handling

```typescript
try {
  // If old code still exists, catch the error
  const trip = await createTrip(data);
} catch (error) {
  if (error.message.includes('AI-powered trip planning')) {
    // Redirect to AI planning flow
    router.push('/plan-with-ai');
  }
}
```

---

## 📋 Complete Flow Comparison

### Old Flow (Deprecated)

```
User Input Form
    ↓
POST /api/trips
    ↓
Empty Trip Created
    ↓
User Manually Adds Activities
```

**Problems:**
- Empty trips required manual work
- No intelligent suggestions
- Poor user experience

### New Flow (Required)

```
User Describes Trip
    ↓
POST /api/ai/chat (SSE stream)
    ↓
AI Generates Draft
    ↓
User Reviews Draft
    ↓
POST /api/trips/drafts/:id/apply
    ↓
Full Trip Created with Activities
```

**Benefits:**
- ✅ Rich itineraries from day 1
- ✅ Intelligent activity suggestions
- ✅ Better user experience
- ✅ Coordinates, costs, and timing included

---

## 🔍 Testing

### Test that direct creation is blocked:

```bash
curl -X POST http://localhost:3000/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Trip",
    "startDate": "2024-01-01",
    "endDate": "2024-01-05"
  }'

# Expected: 400 Bad Request with error message
```

### Test AI-powered creation:

```bash
# 1. Start AI chat
curl -X POST http://localhost:3000/api/ai/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Plan a 3-day trip to Hanoi",
    "context": { "useAlgorithm": true }
  }'

# 2. Get draftId from stream event: draft_created

# 3. Apply draft
curl -X POST http://localhost:3000/api/trips/drafts/{DRAFT_ID}/apply \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "createNew": true }'

# Expected: 201 Created with full trip + itinerary
```

---

## 📚 Resources

- [Frontend Integration Guide](../FRONTEND_INTEGRATION.md)
- [AI Chat Stream Documentation](../FRONTEND_INTEGRATION.md#chat-stream-integration)
- [Trip Planning Flow Diagram](./trip-planning-flow.png)

---

## ❓ FAQ

### Q: Can users still edit trips after creation?

**A:** Yes! All trip editing endpoints remain unchanged:
- `PATCH /api/trips/:id` - Update trip details
- `POST /api/trips/:tripId/days/:dayId/activities` - Add activities
- `PATCH /api/trips/:tripId/activities/:activityId` - Update activities
- `DELETE /api/trips/:tripId/activities/:activityId` - Delete activities

### Q: What about test/dev environments?

**A:** The restriction applies to all environments. Use AI flow or:
- Directly insert test data via Prisma
- Use seed scripts for development

### Q: Can we re-enable direct creation for admin users?

**A:** Yes, modify `tripController.js` line 16-47 to check user role:

```javascript
export const createTrip = asyncHandler(async (req, res) => {
  // Allow admins to bypass AI requirement
  if (req.user.role !== 'ADMIN') {
    throw AppError.badRequest('Use AI-powered trip planning');
  }
  // ... original code
});
```

### Q: What if AI generation fails?

**A:** Handle errors gracefully:

```typescript
try {
  const trip = await createTripWithAI(message);
} catch (error) {
  // Show error + offer retry
  showError('AI planning failed. Please try again or contact support.');
}
```

---

## 🐛 Issues?

Report issues to: https://github.com/your-org/atrips-backend/issues

---

**Updated:** 2024-02-04
**Version:** 2.0.0
