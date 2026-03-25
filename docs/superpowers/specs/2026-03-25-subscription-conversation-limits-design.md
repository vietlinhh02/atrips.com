# Subscription & Conversation Limits Design

## Problem

1. **AI quota not enforced**: AI chat routes (`POST /ai/chat`, `GET /ai/chat/stream`) use `optionalAuth` with no quota middleware. Users can send unlimited messages regardless of tier.
2. **No conversation limits**: No per-conversation message or token limits exist. Long conversations degrade AI context quality.
3. **Wrong default tier**: Registration creates FREE tier subscriptions. For demo purposes, users should get PRO by default.
4. **Subscription UI incomplete**: Existing `/subscription` page needs conversation limit info and FAQ updates.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Limit type | Message count + token count per conversation | Dual limit catches both rapid short messages and long-form conversations |
| Token limit scope | Input + output tokens (both user and assistant) | Reflects actual API cost; aligns with existing `totalTokensUsed` tracking |
| Warning UX | Always-visible counter, color-coded | Users always know where they stand |
| Block UX | Soft warning at thresholds, hard block at limit | Gives users time to wrap up |
| Default tier | PRO ACTIVE on registration | Demo mode, full tier logic preserved for future payment activation |
| Monthly quota | Keep existing alongside conversation limits | Two independent limit axes |
| Carry-over | Auto-inject summary into new conversation | Seamless context continuity |
| Race condition tolerance | Accept 1-2 message overshoot | Simplicity over pessimistic locking; not billing-critical in demo mode |
| Mid-stream limit crossing | Allow current response to complete; block on next request | Cannot return 429 mid-SSE-stream |
| Quota warning delivery | SSE event in stream, JSON field in non-stream | Response headers unreliable for SSE clients |

## Architecture: Conversation-Level Enforcement

Extend existing middleware pattern. Modify `requireAIQuota()` to skip when `req.user` is null (instead of creating a new middleware). Add `requireConversationQuota()`.

```
Request → optionalAuth → requireAIQuota → requireConversationQuota → AIService
                              ↓                     ↓
                         Check monthly         Check conversation
                         aiQuotaUsed           messageCount + tokens
                         (skip if guest)       (skip if guest)
```

## Database Changes

### Table: `ai_conversations` — add fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `messageCount` | Int | 0 | Denormalized count of user messages (role=user only) |
| `summary` | Text? | null | AI-generated summary when conversation hits limit |
| `continuedFromId` | UUID? | null | FK → ai_conversations (onDelete: SetNull), links to predecessor |

**Note on `messageCount`**: This is a denormalized counter for fast middleware checks without `COUNT(*)` queries. It MUST be updated within the same `prisma.$transaction` as the message insert to prevent drift. The existing `addMessage` in `AIConversationRepository.js` currently uses `Promise.all` (non-transactional) — this must be refactored to `prisma.$transaction()` to atomically insert the message AND update both `totalTokensUsed` and `messageCount`.

### Table: `subscriptions` — add fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `conversationMessageLimit` | Int | 50 | Max user messages per conversation |
| `conversationTokenLimit` | Int | 200000 | Max total tokens (input+output) per conversation |

**Token limit rationale**: 50 exchanges × ~2000 avg tokens/exchange (user+assistant) = ~100K typical. Setting limit at 200K gives ~2x headroom for longer assistant responses. FREE tier at 80K supports ~20 exchanges.

### Tier defaults at registration

| Field | FREE | PRO | BUSINESS |
|-------|------|-----|----------|
| tier | FREE | PRO | BUSINESS |
| status | TRIAL | ACTIVE | ACTIVE |
| aiQuotaLimit | 10 | 100 | 1000 |
| tripsLimit | 3 | 20 | -1 (unlimited) |
| conversationMessageLimit | 20 | 50 | 100 |
| conversationTokenLimit | 80000 | 200000 | 500000 |

**Demo default**: All new registrations (email + Google) create PRO ACTIVE subscriptions.

### Migration for existing users

Update existing subscriptions that have no `conversationMessageLimit`/`conversationTokenLimit` to match their tier defaults. Set existing FREE users to PRO if desired (or leave as-is — admin decision).

## Backend Logic

### 1. Fix: Apply quota middleware to AI routes

**File**: `src/modules/ai/interfaces/http/aiRoutes.js`

```
// Before (broken)
router.post('/chat', optionalAuth, sanitizeChatMiddleware, aiController.chat);
router.get('/chat/stream', optionalAuth, sanitizeChatMiddleware, aiController.chatStream);

// After (enforced)
router.post('/chat', optionalAuth, requireAIQuota, requireConversationQuota, sanitizeChatMiddleware, aiController.chat);
router.get('/chat/stream', optionalAuth, requireAIQuota, requireConversationQuota, sanitizeChatMiddleware, aiController.chatStream);
```

### 2. Modify existing `requireAIQuota`

**File**: `src/shared/middleware/requireSubscription.js`

Change the existing `requireAIQuota` to skip when `req.user` is null instead of throwing unauthorized. This avoids creating a new middleware variant. No other route uses `requireAIQuota` without `authenticate` preceding it, so this is safe.

```javascript
export function requireAIQuota(req, res, next) {
  if (!req.user) return next(); // Guest mode — no limits
  // ... existing logic
}
```

### 3. New middleware: `requireConversationQuota`

**File**: `src/shared/middleware/requireSubscription.js`

Logic:
1. If `req.user` is null → skip (guest mode)
2. Extract `conversationId` from request body or query params
3. If no conversationId → skip (new conversation)
4. Lightweight DB query: `select { messageCount, totalTokensUsed, userId }` only — do NOT use `getConversationById` (controller loads full conversation separately for context building)
5. Load user subscription limits (`conversationMessageLimit`, `conversationTokenLimit`)
6. Compare: if either limit exceeded → return 429 with `AppError.conversationLimitExceeded()`:
   ```json
   {
     "error": "CONVERSATION_LIMIT",
     "limitType": "message" | "token",
     "used": 45,
     "limit": 50,
     "summary": "..."
   }
   ```
7. Attach remaining quota to `req.conversationQuota` for downstream use (controller reads this to include in response)

**New error method**: Create `AppError.conversationLimitExceeded(limitType, used, limit, summary)` returning HTTP 429. Keep existing `AppError.quotaExceeded()` at 403 for monthly/tier quota. Update frontend `api.ts` interceptor to handle 429.

### 4. Refactor `addMessage` to use `$transaction`

**File**: `src/modules/ai/infrastructure/repositories/AIConversationRepository.js`

The existing `addMessage` uses `Promise.all` for message insert + conversation token update. Refactor to:

```javascript
async addMessage(conversationId, messageData) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.ai_messages.create({ data: { ... } });
    await tx.ai_conversations.update({
      where: { id: conversationId },
      data: {
        totalTokensUsed: { increment: messageData.tokensUsed || 0 },
        messageCount: messageData.role === 'user' ? { increment: 1 } : undefined,
        updatedAt: new Date(),
      },
    });
    return message;
  });
}
```

### 5. Quota info in responses

**Non-streaming** (`POST /ai/chat`): Include `quota` field in JSON response body.

**Streaming** (`GET /ai/chat/stream`): Send quota as a dedicated SSE event after the response completes:
```
event: quota
data: {"monthly":{"used":15,"limit":100},"conversation":{"messagesUsed":12,"messagesLimit":50,"tokensUsed":45000,"tokensLimit":200000}}
```

The controller reads `req.conversationQuota` (set by middleware) and the updated counts after message save.

### 6. Summary generation on block

When conversation first hits limit:
1. Call `getFastModel()` from `provider.js` (currently `ag/gemini-3-flash`, overridable via `OAI_FAST_MODEL` env var) with conversation messages → generate ~200 word summary
2. Save summary to `ai_conversations.summary`
3. Return summary in the 429 response
4. Count this AI call against `aiQuotaUsed` to prevent abuse
5. Rate limit: max 10 summaries per user per hour (use existing cache service for tracking)

Error handling: if summary generation fails, still block but return `summary: null`. Frontend shows generic message.

**Limit crossing during stream**: The middleware checks limits before the request. If the assistant's response causes `totalTokensUsed` to exceed the limit, the current response completes normally. The block takes effect on the next request. Summary generation triggers on the next blocked request.

### 7. Carry-over on new conversation

**Endpoint**: `POST /ai/conversations`

Accept optional `continueFromId` in request body. The route remains `optionalAuth` (anonymous conversation creation still works). The auth guard is **controller-level**: if `continueFromId` is present and `req.user` is null, return 401.

1. **Requires authentication for carry-over** — reject with 401 if `continueFromId` is present but `req.user` is null
2. Load predecessor conversation, **verify ownership**: `predecessor.userId === req.user.id`. Return 404 (not 403) on mismatch to avoid leaking conversation existence.
3. Read its `summary` field (generate one if missing)
4. Create new conversation with `continuedFromId` set
5. When building system prompt for the new conversation, prepend: `"Context from previous conversation: {summary}"`

### 8. Fix: Registration default tier

**Files**:
- `src/modules/auth/infrastructure/repositories/UserRepository.js` — `createWithEmail()` and `createWithGoogle()`

Change subscription creation in both methods:
```javascript
subscriptions: {
  create: {
    tier: 'PRO',
    status: 'ACTIVE',
    aiQuotaUsed: 0,
    aiQuotaLimit: 100,
    tripsCreated: 0,
    tripsLimit: 20,
    conversationMessageLimit: 50,
    conversationTokenLimit: 200000,
  },
},
```

### 9. Update authenticate middleware selects

**File**: `src/shared/middleware/authenticate.js`

Both `authenticate()` (lines 41-49) and `optionalAuth()` (lines 118-126) have subscription `select` blocks. Add new fields to BOTH:

```javascript
subscriptions: {
  select: {
    tier: true,
    status: true,
    aiQuotaUsed: true,
    aiQuotaLimit: true,
    tripsCreated: true,
    tripsLimit: true,
    conversationMessageLimit: true,  // NEW
    conversationTokenLimit: true,    // NEW
  },
},
```

Also update the fallback default object (lines 73-80, 143-150) to include:
```javascript
conversationMessageLimit: 20,  // FREE default
conversationTokenLimit: 80000,
```

### 10. Update `attachSubscriptionInfo` tier limits

**File**: `src/shared/middleware/requireSubscription.js`

Add conversation limits to the `tierLimits` object in `attachSubscriptionInfo`:
```javascript
FREE: {
  maxTrips: 3,
  maxAIQueries: 10,
  maxCollaborators: 0,
  maxConversationMessages: 20,
  maxConversationTokens: 80000,
  features: ['basic_planning', 'place_search'],
},
PRO: {
  maxTrips: 20,
  maxAIQueries: 100,
  maxCollaborators: 5,
  maxConversationMessages: 50,
  maxConversationTokens: 200000,
  features: ['basic_planning', 'place_search', 'ai_assistant', 'offline_mode', 'budget_tracking'],
},
// ... BUSINESS similarly
```

## Frontend Changes

### 1. Chat counter component

**Location**: Above `ChatInputArea`

Display: `"12/50 messages • 45K/200K tokens"`

Color coding:
- Green: >30% remaining
- Yellow: 10–30% remaining
- Red: <10% remaining

When blocked (0 remaining):
- Disable input textarea
- Show banner: "Conversation reached its limit"
- Show button: "Continue in new conversation" → calls `POST /ai/conversations` with `continueFromId`
- Redirect to new conversation

Data source:
- Non-streaming: read `quota` from JSON response
- Streaming: listen for `event: quota` SSE event
- Store in Zustand chatStore

### 2. Update existing Subscription page

**Route**: `/subscription` (existing page at `frontend/src/app/(app)/subscription/page.tsx`)

Updates:
- Add conversation limits to each tier card (messages/conversation, tokens/conversation)
- Update FAQ to distinguish monthly AI quota vs per-conversation limits
- Current FAQ says "you will not be able to start new AI-assisted planning sessions" — update to explain both limit types

### 3. Tier badge

Small "PRO" chip next to avatar in header dropdown or profile section.

### 4. Monthly quota display

Show monthly AI quota usage somewhere accessible (subscription page or settings). Format: "15/100 AI queries this month".

### 5. Handle 429 in API client

**File**: `frontend/src/lib/api.ts`

Add handler for HTTP 429 responses:
- Parse `CONVERSATION_LIMIT` error code
- Store limit info in chatStore
- Trigger blocked UI state

## Edge Cases

| Case | Handling |
|------|----------|
| Guest user (no auth) | No limits enforced, no counter shown |
| Race condition on increment | Tolerate 1-2 message overshoot; `$transaction` ensures counter consistency with message insert |
| Summary generation fails | Block conversation, return `summary: null`, frontend shows generic message |
| Predecessor has no summary on carry-over | Generate summary on-demand before creating new conversation |
| Monthly quota resets | Existing logic via `currentPeriodStart`/`currentPeriodEnd` — unchanged |
| Token count inaccuracy | Use AI provider's reported token count from response, not estimate |
| Limit crossed mid-stream | Current response completes; block takes effect on next request |
| `continueFromId` without auth | Return 401 |
| `continueFromId` with wrong user | Return 404 (not 403) to prevent IDOR |
| Predecessor conversation deleted | `onDelete: SetNull` nullifies `continuedFromId`, no cascade |
| Summary abuse (many conversations hit limit) | Count summary AI call against `aiQuotaUsed`; rate limit 10/user/hour |

## Files to Modify

### Backend
- `prisma/schema.prisma` — add fields to `ai_conversations` and `subscriptions`; add `continuedFromId` FK with `onDelete: SetNull`
- `src/shared/middleware/requireSubscription.js` — modify `requireAIQuota` (null guard), add `requireConversationQuota`, add `AppError.conversationLimitExceeded()`, update `attachSubscriptionInfo` tier limits
- `src/shared/middleware/authenticate.js` — include `conversationMessageLimit` and `conversationTokenLimit` in BOTH `authenticate()` and `optionalAuth()` subscription select blocks + fallback defaults
- `src/shared/errors/AppError.js` — add `conversationLimitExceeded()` method returning HTTP 429
- `src/modules/ai/interfaces/http/aiRoutes.js` — apply `requireAIQuota` and `requireConversationQuota` to chat routes
- `src/modules/ai/interfaces/http/aiController.js` — return quota in responses (JSON + SSE event), handle `continueFromId`
- `src/modules/ai/infrastructure/repositories/AIConversationRepository.js` — refactor `addMessage` to use `prisma.$transaction`, increment `messageCount`
- `src/modules/ai/application/services/AIService.js` — generate summary, inject carry-over context
- `src/modules/auth/infrastructure/repositories/UserRepository.js` — change default to PRO in `createWithEmail()` and `createWithGoogle()`

### Frontend
- New component: `ConversationQuotaCounter` (in chat feature area)
- `frontend/src/stores/chatStore.ts` — add quota state:
  ```typescript
  conversationQuota: {
    messagesUsed: number;
    messagesLimit: number;
    tokensUsed: number;
    tokensLimit: number;
  } | null;
  isConversationBlocked: boolean;
  conversationSummary: string | null;
  ```
- `frontend/src/services/aiConversationService.ts` — pass `continueFromId`, parse quota from response/SSE
- `frontend/src/components/features/chat/ChatInputArea.tsx` — integrate counter + block UI
- `frontend/src/lib/api.ts` — handle HTTP 429 for conversation limits
- `frontend/src/app/(app)/subscription/page.tsx` — update existing page with conversation limits + FAQ
- Header component — add tier badge
