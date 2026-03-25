# Subscription & Conversation Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce AI quota and per-conversation limits, default new users to PRO, and add subscription UI.

**Architecture:** Extend existing Express middleware pattern with `requireConversationQuota`. Refactor `addMessage` to use Prisma `$transaction` for atomic counter updates. Add conversation quota SSE events for streaming endpoint.

**Tech Stack:** Node.js/Express, Prisma/PostgreSQL, Next.js/React/Zustand, LangChain

**Spec:** `docs/superpowers/specs/2026-03-25-subscription-conversation-limits-design.md`

---

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to `ai_conversations` model**

In `prisma/schema.prisma`, find the `ai_conversations` model and add these fields:

```prisma
  messageCount     Int       @default(0)
  summary          String?   @db.Text
  continuedFromId  String?
  continuedFrom    ai_conversations?  @relation("ConversationContinuation", fields: [continuedFromId], references: [id], onDelete: SetNull)
  continuations    ai_conversations[] @relation("ConversationContinuation")
```

- [ ] **Step 2: Add fields to `subscriptions` model**

In `prisma/schema.prisma`, find the `subscriptions` model and add:

```prisma
  conversationMessageLimit Int @default(50)
  conversationTokenLimit   Int @default(200000)
```

- [ ] **Step 3: Run migration**

Run: `npx prisma migrate dev --name add-conversation-limits`

Expected: Migration applies cleanly, generates updated Prisma client.

- [ ] **Step 4: Backfill existing data**

Create a one-off script or add to migration SQL. After the migration, run:

```sql
-- Backfill subscriptions based on tier
UPDATE subscriptions SET
  "conversationMessageLimit" = CASE tier
    WHEN 'FREE' THEN 20
    WHEN 'PRO' THEN 50
    WHEN 'BUSINESS' THEN 100
    ELSE 50
  END,
  "conversationTokenLimit" = CASE tier
    WHEN 'FREE' THEN 80000
    WHEN 'PRO' THEN 200000
    WHEN 'BUSINESS' THEN 500000
    ELSE 200000
  END
WHERE TRUE;  -- Update all rows based on their tier

-- Backfill messageCount from actual messages
UPDATE ai_conversations ac SET "messageCount" = (
  SELECT COUNT(*) FROM ai_messages am
  WHERE am."conversationId" = ac.id AND am.role = 'user'
);
```

- [ ] **Step 5: Verify migration**

Run: `npx prisma studio` or `npx prisma db pull` to confirm schema matches.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add conversation limits and subscription fields to schema"
```

---

### Task 2: AppError — Add `conversationLimitExceeded`

**Files:**
- Modify: `src/shared/errors/AppError.js:101-119`

- [ ] **Step 1: Add the new error factory method**

In `src/shared/errors/AppError.js`, after the existing `quotaExceeded` method (line 112-118), add:

```javascript
  static conversationLimitExceeded(limitType, used, limit, summary = null) {
    return new AppError(
      `Conversation ${limitType} limit reached (${used}/${limit})`,
      429,
      'CONVERSATION_LIMIT',
      { limitType, used, limit, summary }
    );
  }
```

- [ ] **Step 2: Verify no syntax errors**

Run: `node -e "import('./src/shared/errors/AppError.js').then(m => console.log(Object.keys(m.AppError)))"`

Expected: No errors, outputs class methods.

- [ ] **Step 3: Commit**

```bash
git add src/shared/errors/AppError.js
git commit -m "feat: add conversationLimitExceeded error (HTTP 429)"
```

---

### Task 3: Update `authenticate` Middleware — Include New Subscription Fields

**Files:**
- Modify: `src/shared/middleware/authenticate.js:41-49,73-80,118-126,143-150`

- [ ] **Step 1: Update `authenticate()` subscription select**

In `src/shared/middleware/authenticate.js`, find the subscription `select` block inside `authenticate()` (lines 41-49) and add:

```javascript
        subscriptions: {
          select: {
            tier: true,
            status: true,
            aiQuotaUsed: true,
            aiQuotaLimit: true,
            tripsCreated: true,
            tripsLimit: true,
            conversationMessageLimit: true,
            conversationTokenLimit: true,
          },
        },
```

- [ ] **Step 2: Update `authenticate()` fallback default**

In the fallback object (lines 73-80), add the new fields:

```javascript
      subscription: user.subscriptions || {
        tier: 'FREE',
        status: 'TRIAL',
        aiQuotaUsed: 0,
        aiQuotaLimit: 10,
        tripsCreated: 0,
        tripsLimit: 3,
        conversationMessageLimit: 20,
        conversationTokenLimit: 80000,
      },
```

- [ ] **Step 3: Update `optionalAuth()` subscription select**

Same change as Step 1, but in the `optionalAuth()` function (lines 118-126). Add `conversationMessageLimit: true` and `conversationTokenLimit: true`.

- [ ] **Step 4: Update `optionalAuth()` fallback default**

Same as Step 2, but in the `optionalAuth()` fallback (lines 143-150).

- [ ] **Step 5: Verify server starts**

Run: `node -e "import('./src/shared/middleware/authenticate.js')"`

Expected: No import errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/middleware/authenticate.js
git commit -m "feat: include conversation limits in auth middleware selects"
```

---

### Task 4: Update `requireSubscription` Middleware — Add Conversation Quota Check

**Files:**
- Modify: `src/shared/middleware/requireSubscription.js`

- [ ] **Step 1: Import prisma at top of file**

Add at the top of `src/shared/middleware/requireSubscription.js` (after the existing `AppError` import):

```javascript
import prisma from '../../config/database.js';
```

- [ ] **Step 2: Modify `requireAIQuota` to skip for guests**

Replace the existing `requireAIQuota` function (lines 58-70):

```javascript
export function requireAIQuota(req, res, next) {
  if (!req.user) return next();

  const subscription = req.user.subscription;

  if (subscription.aiQuotaUsed >= subscription.aiQuotaLimit) {
    return next(AppError.quotaExceeded('AI requests'));
  }

  next();
}
```

The only change: line 1 now returns `next()` instead of throwing unauthorized.

- [ ] **Step 3: Add `requireConversationQuota` middleware**

Add this new function after `requireAIQuota`:

```javascript
export async function requireConversationQuota(req, res, next) {
  if (!req.user) return next();

  const conversationId = req.body?.conversationId || req.query?.conversationId;
  if (!conversationId) return next();

  try {
    const conversation = await prisma.ai_conversations.findUnique({
      where: { id: conversationId },
      select: { messageCount: true, totalTokensUsed: true, userId: true, summary: true },
    });

    if (!conversation) return next();

    const sub = req.user.subscription;
    const msgLimit = sub.conversationMessageLimit;
    const tokenLimit = sub.conversationTokenLimit;

    if (conversation.messageCount >= msgLimit) {
      return next(AppError.conversationLimitExceeded(
        'message', conversation.messageCount, msgLimit, conversation.summary,
      ));
    }

    if (conversation.totalTokensUsed >= tokenLimit) {
      return next(AppError.conversationLimitExceeded(
        'token', conversation.totalTokensUsed, tokenLimit, conversation.summary,
      ));
    }

    req.conversationQuota = {
      messagesUsed: conversation.messageCount,
      messagesLimit: msgLimit,
      tokensUsed: conversation.totalTokensUsed,
      tokensLimit: tokenLimit,
    };

    next();
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 4: Update `attachSubscriptionInfo` tier limits**

In the `tierLimits` object (lines 124-143), add conversation limits to each tier:

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
    BUSINESS: {
      maxTrips: -1,
      maxAIQueries: 1000,
      maxCollaborators: -1,
      maxConversationMessages: 100,
      maxConversationTokens: 500000,
      features: ['basic_planning', 'place_search', 'ai_assistant', 'offline_mode', 'budget_tracking', 'team_management', 'analytics', 'white_label'],
    },
```

- [ ] **Step 5: Update the default export**

Add `requireConversationQuota` to the default export object at the bottom of the file.

- [ ] **Step 6: Commit**

```bash
git add src/shared/middleware/requireSubscription.js
git commit -m "feat: add requireConversationQuota middleware and guest-skip for requireAIQuota"
```

---

### Task 5: Apply Quota Middleware to AI Routes

**Files:**
- Modify: `src/modules/ai/interfaces/http/aiRoutes.js:30-34`

- [ ] **Step 1: Import the middleware**

At the top of `src/modules/ai/interfaces/http/aiRoutes.js`, add:

```javascript
import { requireAIQuota, requireConversationQuota } from '../../../../shared/middleware/requireSubscription.js';
```

- [ ] **Step 2: Apply middleware to chat routes**

Replace lines 31-34:

```javascript
// Chat with AI
router.post('/chat', optionalAuth, requireAIQuota, requireConversationQuota, sanitizeChatMiddleware, aiController.chat);

// Chat streaming (SSE)
router.get('/chat/stream', optionalAuth, requireAIQuota, requireConversationQuota, sanitizeChatMiddleware, aiController.chatStream);
```

- [ ] **Step 3: Verify server starts**

Run: `node -e "import('./src/modules/ai/interfaces/http/aiRoutes.js')"`

Expected: No import errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai/interfaces/http/aiRoutes.js
git commit -m "feat: apply quota enforcement middleware to AI chat routes"
```

---

### Task 6: Refactor `addMessage` to Use `$transaction`

**Files:**
- Modify: `src/modules/ai/infrastructure/repositories/AIConversationRepository.js:205-244`

- [ ] **Step 1: Refactor `addMessage` method**

Replace the `addMessage` method (lines 205-244) with:

```javascript
  async addMessage(conversationId, role, content, options = {}) {
    const {
      tokensUsed = 0,
      structuredData = null,
      clientMessageId = null,
      sources = null,
    } = typeof options === 'number' ? { tokensUsed: options } : options;

    const isUserMessage = role === 'user';

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.ai_messages.create({
        data: {
          conversationId,
          role,
          content,
          tokensUsed,
          structuredData,
          clientMessageId,
          sources,
        },
      });

      const updateData = {
        totalTokensUsed: { increment: tokensUsed },
        updatedAt: new Date(),
      };

      if (isUserMessage) {
        updateData.messageCount = { increment: 1 };
      }

      const conversation = await tx.ai_conversations.update({
        where: { id: conversationId },
        data: updateData,
        select: {
          userId: true,
          messageCount: true,
          totalTokensUsed: true,
        },
      });

      return { message, conversation };
    });

    // Invalidate caches
    await Promise.all([
      cacheService.del(CACHE_KEYS.CONVERSATION_DETAIL(conversationId)),
      result.conversation.userId && this.invalidateConversationsListCache(result.conversation.userId),
    ]);

    return result.message;
  }
```

- [ ] **Step 2: Add a lightweight counter query helper**

Add this method to `AIConversationRepository` for use by the controller when building quota responses:

```javascript
  async getConversationCounters(conversationId) {
    return prisma.ai_conversations.findUnique({
      where: { id: conversationId },
      select: { messageCount: true, totalTokensUsed: true },
    });
  }
```

- [ ] **Step 3: Verify the repository imports**

Ensure `prisma` is imported at the top of the file. It should already be there.

- [ ] **Step 3: Verify server starts**

Run: `node -e "import('./src/modules/ai/infrastructure/repositories/AIConversationRepository.js')"`

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai/infrastructure/repositories/AIConversationRepository.js
git commit -m "refactor: use prisma.\$transaction in addMessage for atomic counter updates"
```

---

### Task 7: Add Quota Info to Chat Responses

**Files:**
- Modify: `src/modules/ai/interfaces/http/aiController.js:290-301,582-592`

- [ ] **Step 1: Add quota to non-streaming response**

In `aiController.js`, find the `sendSuccess` call in the `chat` handler (around line 290). Add `quota` to the response:

```javascript
  // Build quota info from post-save conversation counters (not pre-request middleware data)
  let quota;
  const sub = req.user?.subscription;
  if (sub && activeConversationId) {
    const freshConversation = await aiConversationRepository.getConversationCounters(activeConversationId);
    if (freshConversation) {
      quota = {
        conversation: {
          messagesUsed: freshConversation.messageCount,
          messagesLimit: sub.conversationMessageLimit,
          tokensUsed: freshConversation.totalTokensUsed,
          tokensLimit: sub.conversationTokenLimit,
        },
        monthly: {
          used: sub.aiQuotaUsed || 0,
          limit: sub.aiQuotaLimit || 10,
        },
      };
    }
  }

  return sendSuccess(res, {
    message: aiResponse.content,
    conversationId: activeConversationId,
    messageId: assistantMessageId,
    usage: aiResponse.usage,
    model: aiResponse.model,
    toolCalls: aiResponse.toolCalls,
    draftId,
    hasItinerary: !!structuredData,
    suggestions,
    clarification: aiResponse.clarification || undefined,
    quota,
  });
```

- [ ] **Step 2: Add quota SSE event to streaming response**

In the streaming handler, find the `sendEvent({ type: 'done', ... })` call (around line 582). Add a quota event BEFORE the done event. Use the **post-save** conversation counters from `addMessage` (which returns `{ message, conversation }` after Task 6 refactor) rather than `req.conversationQuota` (which has pre-request counts):

```javascript
    // Build fresh quota from post-save conversation counters
    const sub = req.user?.subscription;
    if (sub && activeConversationId) {
      // The last addMessage call returns updated conversation counters
      // Use them for accurate post-request counts
      const freshConversation = await prisma.ai_conversations.findUnique({
        where: { id: activeConversationId },
        select: { messageCount: true, totalTokensUsed: true },
      });
      if (freshConversation) {
        sendEvent({
          type: 'quota',
          conversation: {
            messagesUsed: freshConversation.messageCount,
            messagesLimit: sub.conversationMessageLimit,
            tokensUsed: freshConversation.totalTokensUsed,
            tokensLimit: sub.conversationTokenLimit,
          },
          monthly: {
            used: sub.aiQuotaUsed || 0,
            limit: sub.aiQuotaLimit || 10,
          },
        });
      }
    }

    sendEvent({
      type: 'done',
      // ... existing fields
    });
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/interfaces/http/aiController.js
git commit -m "feat: include conversation and monthly quota in chat responses"
```

---

### Task 8: Add Carry-Over Support to `createConversation`

**Files:**
- Modify: `src/modules/ai/interfaces/http/aiController.js:151-159`
- Modify: `src/modules/ai/infrastructure/repositories/AIConversationRepository.js:128-184`
- Modify: `src/modules/ai/domain/prompts/index.js:750-788`

- [ ] **Step 1: Update `createConversation` in the controller**

Replace the `createConversation` handler (lines 151-159) in `aiController.js`:

```javascript
export const createConversation = asyncHandler(async (req, res) => {
  const { tripId, title, continueFromId } = req.body;

  // Carry-over requires authentication
  if (continueFromId && !req.user) {
    throw AppError.unauthorized('Authentication required to continue a conversation');
  }

  let summary = null;
  if (continueFromId && req.user) {
    const predecessor = await aiConversationRepository.getConversationById(
      continueFromId, req.user.id,
    );
    if (!predecessor) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }
    summary = predecessor.summary || null;
  }

  const conversation = await aiConversationRepository.createConversation(
    req.user?.id || null,
    tripId || null,
    title || null,
    { continueFromId: continueFromId || null, summary },
  );
  return sendSuccess(res, { conversation }, 'Conversation created successfully', 201);
});
```

- [ ] **Step 2: Update `createConversation` in the repository**

In `AIConversationRepository.js`, update the `createConversation` method (around line 177):

```javascript
  async createConversation(userId, tripId = null, title = null, options = {}) {
    const { continueFromId = null } = options;

    const conversation = await prisma.ai_conversations.create({
      data: {
        userId,
        tripId,
        title,
        continuedFromId: continueFromId,
      },
    });

    if (userId) {
      await this.invalidateConversationsListCache(userId);
    }

    return conversation;
  }
```

- [ ] **Step 3: Add `continuedFrom` to `getConversationById` include block**

In `AIConversationRepository.js`, find the `getConversationById` method (around line 128). In the `include` block (which contains `trips`, `ai_messages`, `ai_itinerary_drafts`), add:

```javascript
      include: {
        // ... existing includes (trips, ai_messages, ai_itinerary_drafts) ...
        continuedFrom: {
          select: { summary: true },
        },
      },
```

- [ ] **Step 4: Inject carry-over context in `aiController.js` chat handler**

In `aiController.js`, in the `chat` handler, find where `enrichedContext` is built (around line 260). After the `enrichedContext` line, add:

```javascript
    if (conversation?.continuedFrom?.summary) {
      enrichedContext.carryOverSummary = conversation.continuedFrom.summary;
    }
```

- [ ] **Step 5: Inject carry-over context in `aiController.js` chatStream handler**

In the `chatStream` handler, find where `enrichedContext` is built (around line 413). After it, add the same line:

```javascript
    if (conversation?.continuedFrom?.summary) {
      enrichedContext.carryOverSummary = conversation.continuedFrom.summary;
    }
```

- [ ] **Step 6: Handle `carryOverSummary` in `buildContextPrompt`**

In `src/modules/ai/domain/prompts/index.js`, in the `buildContextPrompt` function (line 704), replace the return statement (line 741) with:

```javascript
  let carryOver = '';
  if (context.carryOverSummary) {
    carryOver = `\n\n## Context from Previous Conversation\n${context.carryOverSummary}`;
  }

  return userProfileContext + tripContext + carryOver;
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/ai/interfaces/http/aiController.js src/modules/ai/infrastructure/repositories/AIConversationRepository.js src/modules/ai/domain/prompts/index.js
git commit -m "feat: add conversation carry-over with continueFromId support"
```

---

### Task 9: Registration Default PRO

**Files:**
- Modify: `src/modules/auth/infrastructure/repositories/UserRepository.js:159-195,202-242`

- [ ] **Step 1: Update `createWithEmail` subscription defaults**

In `UserRepository.js`, find the `createWithEmail` method (line 159). Replace the `subscriptions.create` block (lines 174-181):

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

- [ ] **Step 2: Update `createWithGoogle` subscription defaults**

Same change in `createWithGoogle` method (line 202). Replace lines 228-235 with the same PRO defaults as Step 1.

- [ ] **Step 3: Verify by testing registration flow**

Manually test: register a new user and check the `subscriptions` table to confirm tier=PRO, status=ACTIVE, and new fields are set.

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/infrastructure/repositories/UserRepository.js
git commit -m "feat: default new users to PRO tier for demo mode"
```

---

### Task 10: Summary Generation Service

**Files:**
- Create: `src/modules/ai/infrastructure/services/ConversationSummaryService.js`

- [ ] **Step 1: Create the summary service**

Create `src/modules/ai/infrastructure/services/ConversationSummaryService.js`:

```javascript
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getFastModel } from './provider.js';
import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const SUMMARY_RATE_LIMIT_KEY = (userId) => `summary_rate:${userId}`;
const SUMMARY_RATE_LIMIT_MAX = 10;
const SUMMARY_RATE_LIMIT_WINDOW = 3600; // 1 hour

export async function generateConversationSummary(conversationId, userId) {
  // Rate limit check
  const rateKey = SUMMARY_RATE_LIMIT_KEY(userId);
  const currentCount = await cacheService.get(rateKey) || 0;
  if (currentCount >= SUMMARY_RATE_LIMIT_MAX) {
    logger.warn('[Summary] Rate limit hit', { userId, count: currentCount });
    return null;
  }

  try {
    const messages = await prisma.ai_messages.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
      take: 100,
    });

    if (messages.length === 0) return null;

    const transcript = messages
      .map((m) => `${m.role}: ${m.content?.substring(0, 500) || ''}`)
      .join('\n');

    const model = getFastModel();
    const response = await model.invoke([
      new SystemMessage(
        'Summarize this conversation in under 200 words. Focus on: key decisions, destinations discussed, preferences expressed, and any plans made. Write in the same language as the conversation.',
      ),
      new HumanMessage(transcript),
    ]);

    const summary = response.content?.trim();
    if (!summary) return null;

    // Save summary to conversation
    await prisma.ai_conversations.update({
      where: { id: conversationId },
      data: { summary },
    });

    // Increment rate limit counter
    await cacheService.set(rateKey, currentCount + 1, SUMMARY_RATE_LIMIT_WINDOW);

    // Increment user's aiQuotaUsed
    await prisma.subscriptions.updateMany({
      where: { userId },
      data: { aiQuotaUsed: { increment: 1 } },
    });

    logger.info('[Summary] Generated', { conversationId, length: summary.length });
    return summary;
  } catch (error) {
    logger.error('[Summary] Generation failed', { conversationId, error: error.message });
    return null;
  }
}
```

- [ ] **Step 2: Integrate summary generation with the conversation limit middleware**

In `src/shared/middleware/requireSubscription.js`, add the import at the top:

```javascript
import { generateConversationSummary } from '../../modules/ai/infrastructure/services/ConversationSummaryService.js';
```

Then replace the two limit-check blocks inside `requireConversationQuota` (from Task 4 Step 3) with:

```javascript
    if (conversation.messageCount >= msgLimit) {
      let summary = conversation.summary;
      if (!summary && req.user?.id) {
        summary = await generateConversationSummary(conversationId, req.user.id);
      }
      return next(AppError.conversationLimitExceeded(
        'message', conversation.messageCount, msgLimit, summary,
      ));
    }

    if (conversation.totalTokensUsed >= tokenLimit) {
      let summary = conversation.summary;
      if (!summary && req.user?.id) {
        summary = await generateConversationSummary(conversationId, req.user.id);
      }
      return next(AppError.conversationLimitExceeded(
        'token', conversation.totalTokensUsed, tokenLimit, summary,
      ));
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/ConversationSummaryService.js src/shared/middleware/requireSubscription.js
git commit -m "feat: add conversation summary generation service with rate limiting"
```

---

### Task 11: Frontend — Chat Store Quota State

**Files:**
- Modify: `frontend/src/stores/chatStore.ts:19-94`

- [ ] **Step 1: Add quota types and state**

In `frontend/src/stores/chatStore.ts`, add the quota interface and fields to `ChatState` (after line 17):

```typescript
interface ConversationQuota {
  messagesUsed: number;
  messagesLimit: number;
  tokensUsed: number;
  tokensLimit: number;
}
```

Add to `ChatState` interface (after `conversationFiles` around line 40):

```typescript
  // Conversation quota
  conversationQuota: ConversationQuota | null;
  isConversationBlocked: boolean;
  conversationSummary: string | null;
```

Add actions to `ChatState` interface:

```typescript
  setConversationQuota: (quota: ConversationQuota | null) => void;
  setConversationBlocked: (blocked: boolean, summary?: string | null) => void;
```

- [ ] **Step 2: Add state defaults and action implementations**

In the `create` call, add default values:

```typescript
  conversationQuota: null,
  isConversationBlocked: false,
  conversationSummary: null,
```

Add action implementations:

```typescript
  setConversationQuota: (quota) => set({ conversationQuota: quota }),
  setConversationBlocked: (blocked, summary = null) => set({
    isConversationBlocked: blocked,
    conversationSummary: summary,
  }),
```

- [ ] **Step 3: Update `resetConversation` to clear quota**

In the existing `resetConversation` action, add:

```typescript
  conversationQuota: null,
  isConversationBlocked: false,
  conversationSummary: null,
```

- [ ] **Step 4: Update `sendMessage` to parse quota from response**

In the `sendMessage` action, where SSE events are processed, add handling for the `quota` event type. Find the event processing switch/if chain and add:

```typescript
if (data.type === 'quota') {
  set({
    conversationQuota: data.conversation || null,
  });
}
```

Also handle 429 errors in the catch block:

```typescript
if (error?.response?.status === 429) {
  const details = error.response.data?.error?.details;
  if (details?.limitType) {
    const currentQuota = get().conversationQuota;
    set({
      isConversationBlocked: true,
      conversationSummary: details.summary || null,
      conversationQuota: {
        messagesUsed: details.limitType === 'message' ? details.used : (currentQuota?.messagesUsed ?? 0),
        messagesLimit: details.limitType === 'message' ? details.limit : (currentQuota?.messagesLimit ?? 50),
        tokensUsed: details.limitType === 'token' ? details.used : (currentQuota?.tokensUsed ?? 0),
        tokensLimit: details.limitType === 'token' ? details.limit : (currentQuota?.tokensLimit ?? 200000),
      },
    });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/chatStore.ts
git commit -m "feat: add conversation quota state tracking to chat store"
```

---

### Task 12: Frontend — Conversation Quota Counter Component

**Files:**
- Create: `frontend/src/components/features/chat/conversation/ConversationQuotaCounter.tsx`

- [ ] **Step 1: Create the quota counter component**

Create `frontend/src/components/features/chat/conversation/ConversationQuotaCounter.tsx`:

```tsx
'use client';

import useChatStore from '@/src/stores/chatStore';

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

function getColorClass(used: number, limit: number): string {
  const remaining = (limit - used) / limit;
  if (remaining <= 0.1) return 'text-red-500';
  if (remaining <= 0.3) return 'text-yellow-500';
  return 'text-zinc-400';
}

export default function ConversationQuotaCounter() {
  const quota = useChatStore((s) => s.conversationQuota);

  if (!quota) return null;

  const msgColor = getColorClass(quota.messagesUsed, quota.messagesLimit);
  const tokenColor = getColorClass(quota.tokensUsed, quota.tokensLimit);

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-xs">
      <span className={msgColor}>
        {quota.messagesUsed}/{quota.messagesLimit} messages
      </span>
      <span className="text-zinc-600">•</span>
      <span className={tokenColor}>
        {formatTokens(quota.tokensUsed)}/{formatTokens(quota.tokensLimit)} tokens
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/features/chat/conversation/ConversationQuotaCounter.tsx
git commit -m "feat: add ConversationQuotaCounter component"
```

---

### Task 13: Frontend — Integrate Counter + Block UI into ChatInputArea

**Files:**
- Modify: `frontend/src/components/features/chat/conversation/ChatInputArea.tsx`

- [ ] **Step 1: Import the counter and store**

At the top of `ChatInputArea.tsx`, add:

```typescript
import ConversationQuotaCounter from './ConversationQuotaCounter';
import aiConversationService from '@/src/services/aiConversationService';
import useChatStore from '@/src/stores/chatStore';
```

- [ ] **Step 2: Add blocked state reading**

Inside the component, read the blocked state:

```typescript
const isConversationBlocked = useChatStore((s) => s.isConversationBlocked);
const conversationSummary = useChatStore((s) => s.conversationSummary);
const conversationId = useChatStore((s) => s.conversationId);
```

- [ ] **Step 3: Add the counter above the input**

In the JSX, add the counter above the textarea:

```tsx
<ConversationQuotaCounter />
```

- [ ] **Step 4: Add block overlay**

When blocked, show an overlay instead of the input:

```tsx
{isConversationBlocked ? (
  <div className="flex flex-col items-center gap-3 p-4 text-center">
    <p className="text-sm text-zinc-400">
      Conversation reached its limit.
    </p>
    <button
      onClick={handleContinueConversation}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
    >
      Continue in new conversation
    </button>
  </div>
) : (
  /* existing textarea + send button */
)}
```

- [ ] **Step 5: Implement `handleContinueConversation`**

```typescript
const handleContinueConversation = async () => {
  if (!conversationId) return;
  const newConversation = await aiConversationService.createConversation({
    continueFromId: conversationId,
  });
  if (newConversation?.id) {
    useChatStore.getState().resetConversation();
    useChatStore.getState().setConversationId(newConversation.id);
  }
};
```

- [ ] **Step 6: Disable textarea when blocked**

Add `disabled={isConversationBlocked}` to the textarea element.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/features/chat/conversation/ChatInputArea.tsx
git commit -m "feat: integrate quota counter and block UI into chat input"
```

---

### Task 14: Frontend — Update `aiConversationService` for Carry-Over

**Files:**
- Modify: `frontend/src/services/aiConversationService.ts`

- [ ] **Step 1: Update `createConversation` to accept `continueFromId`**

Find the `createConversation` method in `aiConversationService.ts` (line 102). The existing signature uses an object payload — keep that pattern and add `continueFromId`:

```typescript
async createConversation(
  payload: { tripId?: string; title?: string; continueFromId?: string } = {},
): Promise<ConversationDetail> {
  const response = await api.post('/ai/conversations', payload);
  return response.data.data.conversation;
}
```

This is backward-compatible — existing callers pass `{ tripId, title }` which still works.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/aiConversationService.ts
git commit -m "feat: add continueFromId support to createConversation"
```

---

### Task 15: Frontend — Handle 429 in API Client

**Files:**
- Modify: `frontend/src/lib/api.ts:99-105`

- [ ] **Step 1: Update 429 handler**

In `frontend/src/lib/api.ts`, find the 429 handler (line 103-105). Replace:

```typescript
    if (error.response?.status === 429) {
      const errorData = error.response?.data?.error;
      if (errorData?.code === 'CONVERSATION_LIMIT') {
        console.warn('Conversation limit reached:', errorData.details);
      } else {
        console.error('Too many requests. Please try again later.');
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: handle CONVERSATION_LIMIT 429 errors in API client"
```

---

### Task 16: Frontend — Update Subscription Page

**Files:**
- Modify: `frontend/src/app/(app)/subscription/page.tsx:77-149`

- [ ] **Step 1: Add conversation limit features to `PLAN_FEATURES`**

In `subscription/page.tsx`, add new entries to the `PLAN_FEATURES` array (after the 'AI Conversations' entry around line 83):

```typescript
  {
    label: 'Messages per Conversation',
    free: '20',
    pro: '50',
    business: '100',
  },
  {
    label: 'Tokens per Conversation',
    free: '80K',
    pro: '200K',
    business: '500K',
  },
```

- [ ] **Step 2: Update FAQ items**

Replace the FAQ item about conversation limits (lines 134-138):

```typescript
  {
    question: 'What happens when I reach my limits?',
    answer:
      'There are two types of limits: a monthly AI query quota and per-conversation limits (message count and tokens). When a conversation reaches its limit, you can continue in a new conversation — context from the previous conversation is automatically carried over. Your monthly quota resets at the beginning of each billing cycle.',
  },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/(app)/subscription/page.tsx
git commit -m "feat: update subscription page with conversation limits and FAQ"
```

---

### Task 17: Frontend — Handle Quota SSE Event in Stream Handler

**Files:**
- Modify: `frontend/src/services/aiConversationService.ts:108-121,232`

The streaming path uses `fetchEventSource` directly (not Axios), so `api.ts` interceptors do not apply. We must handle both the `quota` SSE event and 429 errors inside the stream handler.

- [ ] **Step 1: Add `onQuota` handler to the `handlers` interface**

In `aiConversationService.ts`, find the `handlers` parameter of `streamChat` (lines 110-120). Add:

```typescript
    handlers: {
      // ... existing handlers ...
      onQuota?: (data: { conversation: { messagesUsed: number; messagesLimit: number; tokensUsed: number; tokensLimit: number }; monthly: { used: number; limit: number } }) => void;
    },
```

- [ ] **Step 2: Add `case 'quota':` to the onmessage switch**

In the `onmessage` handler's switch statement (around line 232), add a new case:

```typescript
            case 'quota':
              handlers.onQuota?.({
                conversation: data.conversation as { messagesUsed: number; messagesLimit: number; tokensUsed: number; tokensLimit: number },
                monthly: data.monthly as { used: number; limit: number },
              });
              break;
```

- [ ] **Step 3: Handle 429 in `onopen` for streaming**

In the `onopen` handler (line 213), update the error handling to detect 429:

```typescript
        onopen: async (response) => {
          if (response.status === 429) {
            const body = await response.json().catch(() => null);
            const details = body?.error?.details;
            handlers.onError?.(`CONVERSATION_LIMIT:${JSON.stringify(details)}`);
            throw new Error('CONVERSATION_LIMIT');
          }
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        },
```

- [ ] **Step 4: Wire `onQuota` in `chatStore.ts`'s `sendMessage`**

In `frontend/src/stores/chatStore.ts`, find where `streamChat` is called with handlers. Add the `onQuota` handler:

```typescript
        onQuota: (data) => {
          set({ conversationQuota: data.conversation });
        },
```

Also handle the `CONVERSATION_LIMIT` error in the `onError` handler:

```typescript
        onError: (error) => {
          if (typeof error === 'string' && error.startsWith('CONVERSATION_LIMIT:')) {
            const details = JSON.parse(error.replace('CONVERSATION_LIMIT:', ''));
            set({
              isConversationBlocked: true,
              conversationSummary: details?.summary || null,
            });
            return;
          }
          // ... existing error handling ...
        },
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/aiConversationService.ts frontend/src/stores/chatStore.ts
git commit -m "feat: handle quota SSE events and 429 in streaming chat"
```

---

### Task 18: Frontend — Tier Badge in Sidebar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

The user avatar is displayed in `Sidebar.tsx` (around line 418).

- [ ] **Step 1: Add tier badge next to user name**

In `Sidebar.tsx`, find where the user's display name is shown (near the avatar section). Add:

```tsx
{user?.subscription?.tier && user.subscription.tier !== 'FREE' && (
  <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
    {user.subscription.tier}
  </span>
)}
```

Note: The auth store may need to expose `subscription.tier`. Check `useAuthStore` to see if subscription data is available — if not, it may need to be added to the auth store's user object.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add subscription tier badge to sidebar"
```

---

### Task 19: Frontend — Monthly Quota Display on Subscription Page

**Files:**
- Modify: `frontend/src/app/(app)/subscription/page.tsx`

- [ ] **Step 1: Add monthly usage display**

In the subscription page, after the tier cards section, add a usage summary section:

```tsx
{subscription && (
  <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
    <h3 className="mb-4 text-lg font-semibold text-white">Current Usage</h3>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-zinc-400">AI Queries This Month</p>
        <p className="text-xl font-bold text-white">
          {subscription.aiQuotaUsed}/{subscription.aiQuotaLimit}
        </p>
      </div>
      <div>
        <p className="text-sm text-zinc-400">Trips Created</p>
        <p className="text-xl font-bold text-white">
          {subscription.tripsCreated}/{subscription.tripsLimit === -1 ? '∞' : subscription.tripsLimit}
        </p>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/(app)/subscription/page.tsx
git commit -m "feat: add monthly usage display to subscription page"
```

---

### Task 20: End-to-End Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (or the project's dev command)

- [ ] **Step 2: Test registration creates PRO**

Register a new user. Verify in DB: `SELECT tier, status, "conversationMessageLimit", "conversationTokenLimit" FROM subscriptions WHERE "userId" = '<new-user-id>';`

Expected: tier=PRO, status=ACTIVE, conversationMessageLimit=50, conversationTokenLimit=200000

- [ ] **Step 3: Test conversation limit enforcement**

Send messages in a conversation. Verify the quota counter updates in the UI after each message. Check that the middleware returns 429 when limits are exceeded.

- [ ] **Step 4: Test carry-over**

When a conversation is blocked, click "Continue in new conversation". Verify:
- New conversation is created with `continuedFromId` set
- The new conversation's system prompt includes the summary

- [ ] **Step 5: Test guest mode**

Send messages without logging in. Verify no limits are enforced and no counter is shown.

- [ ] **Step 6: Test subscription page**

Navigate to `/subscription`. Verify conversation limits appear in the feature comparison and FAQ is updated.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete subscription and conversation limits implementation"
```
