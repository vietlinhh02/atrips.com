# Subscription & Conversation Limits Design

## Problem

1. **AI quota not enforced**: AI chat routes (`POST /ai/chat`, `GET /ai/chat/stream`) use `optionalAuth` with no quota middleware. Users can send unlimited messages regardless of tier.
2. **No conversation limits**: No per-conversation message or token limits exist. Long conversations degrade AI context quality.
3. **Wrong default tier**: Registration creates FREE tier subscriptions. For demo purposes, users should get PRO by default.
4. **No subscription UI**: No pricing page or tier badge exists in the frontend.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Limit type | Message count + token count per conversation | Dual limit catches both rapid short messages and long-form conversations |
| Warning UX | Always-visible counter, color-coded | Users always know where they stand |
| Block UX | Soft warning at thresholds, hard block at limit | Gives users time to wrap up |
| Default tier | PRO ACTIVE on registration | Demo mode, full tier logic preserved for future payment activation |
| Monthly quota | Keep existing alongside conversation limits | Two independent limit axes |
| Carry-over | Auto-inject summary into new conversation | Seamless context continuity |

## Architecture: Conversation-Level Enforcement

Extend existing middleware pattern. Add `requireConversationQuota()` alongside existing `requireAIQuota()`.

```
Request → optionalAuth → requireAIQuota → requireConversationQuota → AIService
                              ↓                     ↓
                         Check monthly         Check conversation
                         aiQuotaUsed           messageCount + tokens
```

## Database Changes

### Table: `ai_conversations` — add fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `messageCount` | Int | 0 | Count of user messages (role=user only) |
| `summary` | Text? | null | AI-generated summary when conversation hits limit |
| `continuedFromId` | UUID? | null | FK → ai_conversations, links to predecessor conversation |

### Table: `subscriptions` — add fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `conversationMessageLimit` | Int | 50 | Max user messages per conversation |
| `conversationTokenLimit` | Int | 150000 | Max total tokens per conversation |

### Tier defaults at registration

| Field | FREE | PRO | BUSINESS |
|-------|------|-----|----------|
| tier | FREE | PRO | BUSINESS |
| status | TRIAL | ACTIVE | ACTIVE |
| aiQuotaLimit | 10 | 100 | 1000 |
| tripsLimit | 3 | 20 | -1 (unlimited) |
| conversationMessageLimit | 20 | 50 | 100 |
| conversationTokenLimit | 50000 | 150000 | 300000 |

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
router.post('/chat', optionalAuth, requireAIQuotaIfAuth, requireConversationQuota, sanitizeChatMiddleware, aiController.chat);
router.get('/chat/stream', optionalAuth, requireAIQuotaIfAuth, requireConversationQuota, sanitizeChatMiddleware, aiController.chatStream);
```

`requireAIQuotaIfAuth` — variant of `requireAIQuota` that skips check if `req.user` is null (guest mode). Guests remain unrestricted for now.

### 2. New middleware: `requireConversationQuota`

**File**: `src/shared/middleware/requireSubscription.js`

Logic:
1. Extract `conversationId` from request body or query params
2. If no conversationId or no user → skip (new conversation or guest)
3. Load conversation from DB (messageCount, totalTokensUsed)
4. Load user subscription limits (conversationMessageLimit, conversationTokenLimit)
5. Compare: if either limit exceeded → return 429 with:
   ```json
   {
     "error": "CONVERSATION_LIMIT",
     "limitType": "message" | "token",
     "used": 45,
     "limit": 50,
     "summary": "..." // if available
   }
   ```
6. If within 20% of either limit → add response header `X-Conversation-Warning: true`

### 3. Message count increment

**File**: `src/modules/ai/application/services/AIService.js` (or wherever messages are saved)

After processing a user message:
- Prisma transaction: increment `messageCount` by 1, update `totalTokensUsed` on the conversation record
- Return updated counts in the response `quota` field

### 4. Summary generation on block

When conversation first hits limit:
1. Call AI model (fast/cheap — haiku equivalent) with conversation messages → generate ~200 word summary
2. Save summary to `ai_conversations.summary`
3. Return summary in the 429 response

Error handling: if summary generation fails, still block but return `summary: null`. Frontend shows generic message.

### 5. Carry-over on new conversation

**Endpoint**: `POST /ai/conversations`

Accept optional `continueFromId` in request body:
1. Load predecessor conversation, verify it belongs to the user
2. Read its `summary` field (generate one if missing)
3. Create new conversation with `continuedFromId` set
4. When building system prompt for the new conversation, prepend: `"Context from previous conversation: {summary}"`

### 6. Fix: Registration default tier

**Files**:
- `src/modules/auth/infrastructure/repositories/UserRepository.js` — `createWithEmail()` and `createWithGoogle()`

Change subscription creation:
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
    conversationTokenLimit: 150000,
  },
},
```

### 7. Quota response in AI chat

Every AI response includes:
```json
{
  "quota": {
    "monthly": {
      "used": 15,
      "limit": 100
    },
    "conversation": {
      "messagesUsed": 12,
      "messagesLimit": 50,
      "tokensUsed": 45000,
      "tokensLimit": 150000
    }
  }
}
```

## Frontend Changes

### 1. Chat counter component

**Location**: Above `ChatInputArea`

Display: `"12/50 messages • 45K/150K tokens"`

Color coding:
- Green: >30% remaining
- Yellow: 10–30% remaining
- Red: <10% remaining

When blocked (0 remaining):
- Disable input textarea
- Show banner: "Conversation reached its limit"
- Show button: "Continue in new conversation" → calls `POST /ai/conversations` with `continueFromId`
- Redirect to new conversation

### 2. Subscription/Pricing page

**Route**: `/pricing`

Layout: 3 horizontal cards (FREE / PRO / BUSINESS)

Each card:
- Tier name + price (FREE=$0, PRO=$9.99/mo, BUSINESS=$29.99/mo — display only)
- Feature checklist with checkmarks
- Limits: AI queries/month, messages/conversation, tokens/conversation, trips
- CTA button: current tier shows "Your Plan" badge, others show "Upgrade" (disabled for demo)

### 3. Tier badge

Small "PRO" chip next to avatar in header dropdown or profile section.

### 4. Monthly quota display

Show monthly AI quota usage somewhere accessible (pricing page or settings). Format: "15/100 AI queries this month".

## Edge Cases

| Case | Handling |
|------|----------|
| Guest user (no auth) | No limits enforced, no counter shown |
| Race condition on increment | Prisma `$transaction` with atomic increment |
| Summary generation fails | Block conversation, return `summary: null`, frontend shows generic message |
| User creates conversation from carry-over but predecessor has no summary | Generate summary on-demand before creating new conversation |
| Monthly quota resets | Existing logic via `currentPeriodStart`/`currentPeriodEnd` — unchanged |
| Token count inaccuracy | Use AI provider's reported token count from response, not estimate |

## Files to Modify

### Backend
- `prisma/schema.prisma` — add fields to ai_conversations and subscriptions
- `src/shared/middleware/requireSubscription.js` — add `requireConversationQuota`, `requireAIQuotaIfAuth`
- `src/shared/middleware/authenticate.js` — include new subscription fields in select
- `src/modules/ai/interfaces/http/aiRoutes.js` — apply quota middleware
- `src/modules/ai/interfaces/http/aiController.js` — return quota in responses, handle `continueFromId`
- `src/modules/ai/application/services/AIService.js` — increment messageCount, generate summary
- `src/modules/auth/infrastructure/repositories/UserRepository.js` — change default to PRO

### Frontend
- New component: `ConversationQuotaCounter` (in chat feature area)
- `frontend/src/stores/chatStore.ts` — track conversation quota state
- `frontend/src/services/aiConversationService.ts` — pass `continueFromId`, parse quota response
- `frontend/src/components/features/chat/ChatInputArea.tsx` — integrate counter + block UI
- New page: `/pricing` with tier comparison cards
- Header component — add tier badge

### Database
- Prisma migration: add fields + backfill existing data
