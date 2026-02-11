# Phase 2 Implementation Plan - Social & Media Features

**Priority:** High
**Estimated Time:** 3-4 hours
**Dependencies:** Phase 1 Complete ✅

---

## 🎯 Objectives

Phase 2 tập trung vào **Social & Media features** để làm phong phú thêm trip planning experience:
- Reviews & ratings từ nhiều nguồn
- Media links (YouTube/TikTok videos)
- AI-generated review summaries
- Team chat & collaboration

---

## 📋 Features Overview

| Feature | Priority | Complexity | Time |
|---------|----------|------------|------|
| **Media Links Management** | High | Medium | 45min |
| **Review Summaries** | High | Medium | 60min |
| **Activity Comments** | High | Medium | 45min |
| **Team Chat (WebSocket)** | Medium | High | 90min |
| **Testing & Documentation** | High | Low | 30min |

**Total:** ~4 hours

---

## 🗄️ TASK 1: Database Schema (45min)

### 1.1 New Tables

#### `place_media_links`
```sql
CREATE TABLE "place_media_links" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "placeId" TEXT NOT NULL,
  "platform" TEXT NOT NULL, -- 'YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'BLOG'
  "url" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "thumbnailUrl" TEXT,
  "author" TEXT,
  "viewCount" INTEGER,
  "likes" INTEGER,
  "duration" INTEGER, -- seconds
  "publishedAt" TIMESTAMP,
  "language" TEXT DEFAULT 'vi',
  "metadata" JSONB, -- { videoId, channelId, etc. }
  "source" TEXT DEFAULT 'USER', -- 'USER', 'AUTO', 'AI_SUGGESTED'
  "isVerified" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "fk_place_media_place" FOREIGN KEY ("placeId")
    REFERENCES "cached_places"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_place_media_placeId" ON "place_media_links"("placeId");
CREATE INDEX "idx_place_media_platform" ON "place_media_links"("platform");
CREATE INDEX "idx_place_media_viewCount" ON "place_media_links"("viewCount" DESC);
```

#### `place_review_summaries`
```sql
CREATE TABLE "place_review_summaries" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "placeId" TEXT UNIQUE NOT NULL,
  "summary" TEXT NOT NULL, -- AI-generated summary
  "sentiment" TEXT, -- 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'
  "sentimentScore" FLOAT, -- -1.0 to 1.0
  "pros" TEXT[], -- Array of pros
  "cons" TEXT[], -- Array of cons
  "keywords" TEXT[], -- Top keywords from reviews
  "totalReviews" INTEGER DEFAULT 0,
  "sources" JSONB, -- { google: 150, youtube: 20, tiktok: 5 }
  "generatedBy" TEXT DEFAULT 'AI', -- 'AI', 'MANUAL'
  "lastUpdated" TIMESTAMP DEFAULT NOW(),
  "expiresAt" TIMESTAMP, -- TTL for refresh
  "createdAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "fk_review_summary_place" FOREIGN KEY ("placeId")
    REFERENCES "cached_places"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_review_summary_placeId" ON "place_review_summaries"("placeId");
CREATE INDEX "idx_review_summary_sentiment" ON "place_review_summaries"("sentiment");
CREATE INDEX "idx_review_summary_expires" ON "place_review_summaries"("expiresAt");
```

#### `activity_comments`
```sql
CREATE TABLE "activity_comments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "activityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT, -- For nested replies
  "content" TEXT NOT NULL,
  "mentions" TEXT[], -- User IDs mentioned with @
  "attachments" TEXT[], -- URLs to images/files
  "reactions" JSONB DEFAULT '{}', -- { "👍": ["userId1"], "❤️": ["userId2"] }
  "isEdited" BOOLEAN DEFAULT false,
  "editedAt" TIMESTAMP,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "fk_activity_comment_activity" FOREIGN KEY ("activityId")
    REFERENCES "activities"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_activity_comment_user" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_activity_comment_parent" FOREIGN KEY ("parentId")
    REFERENCES "activity_comments"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_activity_comment_activityId" ON "activity_comments"("activityId");
CREATE INDEX "idx_activity_comment_userId" ON "activity_comments"("userId");
CREATE INDEX "idx_activity_comment_parentId" ON "activity_comments"("parentId");
CREATE INDEX "idx_activity_comment_createdAt" ON "activity_comments"("createdAt" DESC);
```

#### `day_comments` (Optional - same structure as activity_comments)
```sql
CREATE TABLE "day_comments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "dayId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "content" TEXT NOT NULL,
  "mentions" TEXT[],
  "attachments" TEXT[],
  "reactions" JSONB DEFAULT '{}',
  "isEdited" BOOLEAN DEFAULT false,
  "editedAt" TIMESTAMP,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "fk_day_comment_day" FOREIGN KEY ("dayId")
    REFERENCES "itinerary_days"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_day_comment_user" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_day_comment_parent" FOREIGN KEY ("parentId")
    REFERENCES "day_comments"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_day_comment_dayId" ON "day_comments"("dayId");
CREATE INDEX "idx_day_comment_userId" ON "day_comments"("userId");
```

### 1.2 New Enums
```sql
CREATE TYPE "MediaPlatform" AS ENUM ('YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'BLOG', 'OTHER');
CREATE TYPE "ReviewSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED');
CREATE TYPE "MediaSource" AS ENUM ('USER', 'AUTO', 'AI_SUGGESTED');
```

### 1.3 Prisma Schema Updates
Update `schema.prisma` to include new models.

---

## 🔧 TASK 2: Media Links Feature (45min)

### 2.1 Services

#### `MediaLinkService.js`
```javascript
/**
 * Fetch YouTube videos for a place
 */
async fetchYouTubeVideos(placeName, location) {
  // YouTube Data API v3
  const query = `${placeName} ${location} review vlog`;
  // Return: { videos: [...], nextPageToken }
}

/**
 * Fetch TikTok videos
 */
async fetchTikTokVideos(placeName, hashtags) {
  // TikTok API or scraping
  // Return: { videos: [...] }
}

/**
 * Parse video metadata
 */
parseVideoMetadata(url) {
  // Extract videoId, platform, thumbnail
  // Support: youtube.com, youtu.be, tiktok.com, instagram.com
}

/**
 * AI suggest relevant videos
 */
async suggestVideos(placeId) {
  // AI analyzes place + existing reviews
  // Returns curated list of relevant videos
}
```

### 2.2 API Endpoints

#### `mediaLinksController.js`
```javascript
// GET /api/places/:placeId/media
// List all media links for a place

// POST /api/places/:placeId/media
// Add a media link (user-submitted)

// DELETE /api/media-links/:linkId
// Remove a media link

// GET /api/places/:placeId/media/suggestions
// Get AI-suggested videos (not saved yet)

// POST /api/places/:placeId/media/auto-fetch
// Auto-fetch from YouTube/TikTok and save
```

---

## 🤖 TASK 3: Review Summaries (60min)

### 3.1 AI Review Analyzer Service

#### `ReviewAnalyzerService.js`
```javascript
/**
 * Analyze reviews from multiple sources
 */
async analyzeReviews(placeId) {
  // 1. Collect reviews from:
  //    - Google Maps (from enrichedDetail)
  //    - YouTube comments (from media links)
  //    - TikTok comments
  //    - User reviews (if any)

  // 2. AI analysis:
  //    - Generate summary (2-3 paragraphs)
  //    - Extract sentiment (POSITIVE/NEGATIVE/MIXED)
  //    - Calculate sentiment score (-1 to 1)
  //    - Extract pros (bullet points)
  //    - Extract cons (bullet points)
  //    - Extract top keywords

  // 3. Save to place_review_summaries

  // 4. Set expiry (7 days for popular, 30 days for others)
}

/**
 * Refresh expired summaries
 */
async refreshExpiredSummaries() {
  // Background job to refresh summaries
}
```

### 3.2 AI Prompt Template
```javascript
const REVIEW_ANALYSIS_PROMPT = `
Analyze the following reviews for {placeName}:

{reviews_text}

Provide:
1. Summary (2-3 paragraphs covering overall experience)
2. Pros (3-5 positive aspects as bullet points)
3. Cons (3-5 negative aspects as bullet points)
4. Overall sentiment: POSITIVE/NEGATIVE/MIXED
5. Top 5 keywords that best describe this place

Format as JSON.
`;
```

### 3.3 API Endpoints

#### `reviewSummariesController.js`
```javascript
// GET /api/places/:placeId/review-summary
// Get summary (from cache or generate new)

// POST /api/places/:placeId/review-summary/refresh
// Force refresh summary

// GET /api/places/:placeId/review-sentiment
// Get just sentiment + score
```

---

## 💬 TASK 4: Activity Comments (45min)

### 4.1 Comments Service

#### `CommentsService.js`
```javascript
/**
 * Create comment with @mentions
 */
async createComment(activityId, userId, content, mentions) {
  // 1. Parse mentions from content
  // 2. Save comment
  // 3. Send notifications to mentioned users
}

/**
 * Add reaction to comment
 */
async addReaction(commentId, userId, emoji) {
  // Update reactions JSONB field
}

/**
 * Get comment thread (nested replies)
 */
async getCommentThread(commentId) {
  // Return comment with all nested replies
}
```

### 4.2 API Endpoints

#### `commentsController.js`
```javascript
// Activity Comments
// GET    /api/activities/:activityId/comments
// POST   /api/activities/:activityId/comments
// PUT    /api/comments/:commentId
// DELETE /api/comments/:commentId
// POST   /api/comments/:commentId/reactions

// Day Comments (similar)
// GET    /api/days/:dayId/comments
// POST   /api/days/:dayId/comments
```

### 4.3 Real-time Notifications
```javascript
// When someone is @mentioned:
// 1. Create notification in notifications table
// 2. Send push notification (if enabled)
// 3. Send email (if enabled)
// 4. Emit WebSocket event (if connected)
```

---

## 🔌 TASK 5: Team Chat - WebSocket (90min)

### 5.1 WebSocket Server Setup

#### `websocket/chatServer.js`
```javascript
import { Server } from 'socket.io';

export function setupChatServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL },
  });

  // Middleware: authenticate socket connections
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    // Join trip room
    socket.on('join:trip', ({ tripId }) => {
      socket.join(`trip:${tripId}`);
    });

    // Join activity room
    socket.on('join:activity', ({ activityId }) => {
      socket.join(`activity:${activityId}`);
    });

    // Send message
    socket.on('message:send', async (data) => {
      const { tripId, activityId, content } = data;

      // Save to database
      const message = await saveMessage(data);

      // Broadcast to room
      if (activityId) {
        io.to(`activity:${activityId}`).emit('message:new', message);
      } else {
        io.to(`trip:${tripId}`).emit('message:new', message);
      }
    });

    // Typing indicator
    socket.on('typing:start', ({ tripId, userId }) => {
      socket.to(`trip:${tripId}`).emit('user:typing', { userId });
    });

    socket.on('typing:stop', ({ tripId, userId }) => {
      socket.to(`trip:${tripId}`).emit('user:stopped-typing', { userId });
    });

    // Disconnect
    socket.on('disconnect', () => {
      // Handle cleanup
    });
  });

  return io;
}
```

### 5.2 Chat Integration

#### Update `trip_chat_rooms` table
Already exists! Just need to use it.

#### Update `chat_messages` table
Already exists! Just need WebSocket layer.

### 5.3 REST Fallback APIs

#### `chatController.js`
```javascript
// For clients without WebSocket support

// GET /api/trips/:tripId/messages
// GET /api/activities/:activityId/messages
// POST /api/trips/:tripId/messages
// PUT /api/messages/:messageId
// DELETE /api/messages/:messageId
```

---

## 🧪 TASK 6: Testing & Documentation (30min)

### 6.1 Test Scenarios

**Media Links:**
- [ ] Fetch YouTube videos for a place
- [ ] Add custom media link
- [ ] Get AI-suggested videos
- [ ] Delete media link
- [ ] Filter by platform

**Review Summaries:**
- [ ] Generate summary from multiple sources
- [ ] Cache works (no regeneration within TTL)
- [ ] Refresh expired summaries
- [ ] Sentiment analysis accurate

**Comments:**
- [ ] Create comment on activity
- [ ] Reply to comment (nested)
- [ ] @mention sends notification
- [ ] Add/remove reactions
- [ ] Edit/delete comments
- [ ] Soft delete works

**WebSocket Chat:**
- [ ] Connect to trip room
- [ ] Send/receive messages in real-time
- [ ] Typing indicators work
- [ ] Multiple users can chat
- [ ] Messages persist in DB
- [ ] Fallback to REST works

### 6.2 Documentation
- Update Postman collection
- Add WebSocket connection guide
- Document AI prompts for reviews
- Add architecture diagram for chat

---

## 📁 Files to Create/Modify

### New Files (~10)
1. `src/modules/media/services/MediaLinkService.js`
2. `src/modules/media/services/ReviewAnalyzerService.js`
3. `src/modules/media/controllers/mediaLinksController.js`
4. `src/modules/media/controllers/reviewSummariesController.js`
5. `src/modules/chat/controllers/commentsController.js`
6. `src/modules/chat/controllers/chatController.js`
7. `src/modules/chat/websocket/chatServer.js`
8. `src/modules/chat/routes/chatRoutes.js`
9. `prisma/migrations/20260206_phase2_social_media.sql`
10. `PHASE2_TESTING_GUIDE.md`

### Modified Files (~5)
1. `prisma/schema.prisma`
2. `server.js` (add WebSocket)
3. `src/modules/trip/interfaces/http/tripRoutes.js`
4. `package.json` (add socket.io)
5. `src/shared/services/NotificationService.js`

---

## 🔑 External APIs Needed

### YouTube Data API v3
```bash
# Get API key from Google Cloud Console
# https://console.cloud.google.com/apis/credentials

# Enable: YouTube Data API v3
# Quota: 10,000 units/day (free)
```

### TikTok API (Optional)
```bash
# Official API requires business account
# Alternative: Use unofficial scraping (with caution)
# Or: Let users add TikTok links manually
```

### Environment Variables
```env
YOUTUBE_API_KEY=your_youtube_api_key
TIKTOK_API_KEY=your_tiktok_api_key (optional)
WEBSOCKET_PORT=3001
```

---

## 🚀 Implementation Order

### Day 1 (2 hours)
1. ✅ Database schema (30min)
2. ✅ Media links feature (45min)
3. ✅ Review summaries (45min)

### Day 2 (2 hours)
4. ✅ Activity comments (45min)
5. ✅ WebSocket chat (60min)
6. ✅ Testing & docs (30min)

---

## 📊 Success Metrics

- [ ] Users can see YouTube/TikTok videos for each place
- [ ] AI-generated review summaries help decision making
- [ ] Team members can comment on activities
- [ ] Real-time chat works for trip planning
- [ ] All Phase 2 APIs respond < 500ms
- [ ] WebSocket stable with 50+ concurrent users

---

## 🔄 Dependencies

### NPM Packages to Install
```bash
npm install socket.io           # WebSocket server
npm install socket.io-client    # Client (for testing)
npm install @google-cloud/youtube # YouTube API (optional)
npm install sentiment           # Sentiment analysis (backup)
```

### Phase 1 Must Be Complete
- ✅ `cached_places` table with enrichedData
- ✅ `activities` table
- ✅ `itinerary_days` table
- ✅ Authentication working

---

## ⚠️ Potential Issues & Solutions

### Issue 1: YouTube API Quota Limit
**Solution:**
- Cache video results for 7 days
- Implement rate limiting
- Allow manual video links as backup

### Issue 2: TikTok API Access
**Solution:**
- Start with manual links only
- Add auto-fetch later if API access granted
- Or use unofficial scraping carefully

### Issue 3: WebSocket Scalability
**Solution:**
- Use Redis adapter for multi-server
- Implement reconnection logic
- Fallback to polling if WebSocket fails

### Issue 4: AI Review Analysis Cost
**Solution:**
- Batch process (analyze multiple places at once)
- Cache for 7-30 days
- Only analyze popular places automatically

---

## 🎯 Phase 2 Completion Criteria

- [ ] All 4 new tables created and working
- [ ] Media links can be added/fetched/deleted
- [ ] AI review summaries generated and cached
- [ ] Comments work with nested replies and reactions
- [ ] WebSocket chat functional in real-time
- [ ] All Phase 2 APIs documented
- [ ] Integration tests pass
- [ ] No regressions in Phase 1 features

---

**Ready to start Phase 2?**
See: `PHASE3_PLAN.md` for next features.
