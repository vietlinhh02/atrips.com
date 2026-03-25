# File Upload During Plan Creation — Design Spec

## Overview

Enable users to upload images and documents during AI chat-based trip planning. Images serve as visual inspiration for the AI; documents (booking confirmations, existing itineraries) provide structured data the AI extracts and uses to build plans.

## Architecture

**Approach: R2-first, unified pipeline** — all files upload to Cloudflare R2 (existing infrastructure), processed via BullMQ queue with job types for images and documents.

### System Flow

1. User attaches file via chat input (📎 button) or drags into side panel
2. Frontend validates type and size, uploads to `POST /api/uploads`
3. Backend receives via Multer, uploads to R2, creates `file_uploads` record (PENDING)
4. Enqueues BullMQ job — `image-process` or `document-extract`
5. Worker processes file:
   - **Images**: generate variants (thumb, card, hero) via existing pipeline
   - **Documents**: extract text via pdf-parse / mammoth / xlsx
6. Status updates to READY; extracted text stored in DB
7. When user sends chat message with attached files:
   - Images → vision content block in AI request
   - Documents → extracted text injected into message context
8. After plan is saved as trip:
   - Inspiration images → linked to trip (persist = true)
   - Documents → marked for cleanup (persist = false)

## Database Schema

### New table: `file_uploads`

```sql
CREATE TABLE file_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  conversation_id UUID REFERENCES ai_conversations(id),
  message_id      UUID REFERENCES ai_messages(id),
  trip_id         UUID REFERENCES trips(id),

  file_name       VARCHAR(255) NOT NULL,
  file_type       VARCHAR(20) NOT NULL,  -- 'IMAGE' | 'DOCUMENT'
  mime_type       VARCHAR(100) NOT NULL,
  file_size       INTEGER NOT NULL,

  r2_key          VARCHAR(500),
  r2_bucket       VARCHAR(100),
  public_url      VARCHAR(1000),
  variants        JSONB,  -- { thumb, card, hero, original } for images

  extracted_text  TEXT,
  extraction_meta JSONB,  -- { pageCount, language, sheetNames, etc. }

  status          VARCHAR(20) NOT NULL DEFAULT 'UPLOADING',
  category        VARCHAR(20) NOT NULL DEFAULT 'INSPIRATION',
  persist         BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_uploads_conversation ON file_uploads(conversation_id);
CREATE INDEX idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_trip ON file_uploads(trip_id);
```

**Status enum**: UPLOADING → PROCESSING → READY → FAILED

**Category enum**: INSPIRATION, REFERENCE_DOC, BOOKING

**Persist logic**:
- `true` for images (category = INSPIRATION) — linked to trip after plan creation
- `false` for documents — cleaned up after conversation ends or after a retention period (7 days)

## Backend API

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/uploads` | Required | Upload one or more files |
| GET | `/api/uploads/:id` | Required | Get file status and metadata |
| DELETE | `/api/uploads/:id` | Required | Delete uploaded file |
| GET | `/api/uploads/conversation/:conversationId` | Required | List all files in a conversation |

### POST /api/uploads

**Request**: `multipart/form-data`
- `files` — one or more files (max 5 per request)
- `conversationId` — UUID of the active conversation
- `category` — optional, defaults to INSPIRATION for images, REFERENCE_DOC for documents

**Response** (201):
```json
{
  "uploads": [
    {
      "id": "uuid",
      "fileName": "booking.pdf",
      "fileType": "DOCUMENT",
      "mimeType": "application/pdf",
      "fileSize": 234567,
      "status": "UPLOADING",
      "category": "BOOKING"
    }
  ]
}
```

### Multer Configuration

```js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});
```

## File Processing Pipeline

### Queue Design

Extend existing BullMQ infrastructure with a new queue `file-process` alongside `image-ingest`.

**Concurrency**: 3 workers (lower than image pipeline since document extraction is CPU-bound)

**Retry**: 3 attempts, exponential backoff (1s, 4s, 16s)

### Image Processing

Reuse existing `ImageIngestWorker` pattern:
1. Read file buffer from R2
2. Generate variants via Cloudflare Image Resizing (existing CDN setup)
3. Update `file_uploads` record with variant URLs
4. Set status = READY

### Document Extraction

New `FileProcessWorker`:

| Mime Type | Library | Output |
|-----------|---------|--------|
| `application/pdf` | `pdf-parse` | Full text content, page count |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `mammoth` | HTML → plain text |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `xlsx` | Sheet data as structured text |
| `text/csv` | `xlsx` | Parsed rows as structured text |

**Text truncation**: Max 50,000 characters. If exceeded, truncate with notice: `[Content truncated at 50,000 characters]`

**Extraction metadata** stored in `extraction_meta`:
```json
{
  "pageCount": 3,
  "language": "en",
  "sheetNames": ["Budget", "Flights"],
  "charCount": 12450,
  "truncated": false
}
```

## AI Integration

### Message Construction

When a user sends a message with attached files (status = READY):

**Images** — added as vision content blocks:
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "User's message here" },
    {
      "type": "image_url",
      "image_url": { "url": "https://cdn.atrips.com/uploads/abc/original.jpg" }
    }
  ]
}
```

**Documents** — extracted text prepended to message:
```
[Attached: flight-booking.pdf (3 pages)]
---
Booking Confirmation
Flight: VN123 Tokyo Narita → Ho Chi Minh
Date: March 15, 2026
Passengers: 2
---

User's actual message here
```

### Context Management

- File attachments are part of the message they were sent with
- AI conversation history retains file context across turns
- For long documents, only the first message includes full text; subsequent references use a summary marker

## Frontend Design

### Chat Input — Attach Button

- 📎 button in the chat input area (left side, next to text input)
- Opens native file picker with accepted types filter
- Also supports paste from clipboard (images)
- Shows attached files as compact preview chips above the input before sending:
  - Images: thumbnail with ✕ remove button
  - Documents: icon + filename + size with ✕ remove button

### Side Panel — Drag & Drop Zone

- Drag & drop zone in the TripPlanningSideCard component
- Shows "Drop files here" with dashed border, highlights on drag over
- Below the drop zone: list of all uploaded files in the conversation
- Each file shows: icon/thumbnail, filename, status badge, category tag

### Upload States

| State | Visual | Actions |
|-------|--------|---------|
| Uploading | Progress bar, file icon | Cancel button |
| Processing | Spinner, "Extracting..." | Wait |
| Ready | Green checkmark, thumbnail | Remove, send with message |
| Failed | Red X, error text | Retry button, remove |

### State Management

Extend `chatStore` (Zustand):
```typescript
interface FileUpload {
  id: string;
  fileName: string;
  fileType: 'IMAGE' | 'DOCUMENT';
  mimeType: string;
  fileSize: number;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  category: 'INSPIRATION' | 'REFERENCE_DOC' | 'BOOKING';
  publicUrl?: string;
  variants?: { thumb: string; card: string; hero: string; original: string };
  progress?: number; // 0-100 for upload progress
  error?: string;
}

// Added to chatStore
pendingAttachments: FileUpload[];   // files attached but not yet sent
conversationFiles: FileUpload[];    // all files in conversation
uploadFile: (file: File) => Promise<void>;
removeAttachment: (id: string) => void;
pollFileStatus: (id: string) => Promise<void>;
```

### Frontend Upload Service

Extend existing `uploadService.ts`:
- `uploadChatFile(file: File, conversationId: string)` — upload to `/api/uploads`
- `getFileStatus(id: string)` — poll status until READY/FAILED
- `getConversationFiles(conversationId: string)` — list files
- Client-side image resizing before upload (max 2048px, existing pattern from avatar upload)

## Limits and Validation

| Rule | Value | Enforced At |
|------|-------|-------------|
| Max file size | 10 MB | Frontend + Multer |
| Max files per message | 5 | Frontend + API |
| Max files per conversation | 20 | API |
| Allowed image types | JPEG, PNG, WebP | Frontend + Multer |
| Allowed document types | PDF, DOCX, XLSX, CSV | Frontend + Multer |
| Max extracted text length | 50,000 chars | FileProcessWorker |
| Upload rate limit | 10 files/minute/user | API middleware |

## Error Handling

| Scenario | Handling |
|----------|----------|
| File too large | Frontend blocks before upload; API returns 413 |
| Invalid file type | Frontend blocks; API returns 400 |
| R2 upload fails | Status → FAILED, retry via queue |
| Text extraction fails | Status → FAILED, store error in `lastError`, retry 3x |
| AI vision fails | Fallback: skip image, inform user in response |
| Conversation file limit reached | API returns 429, frontend shows "max files reached" |

## Cleanup Strategy

- **Persist = true** (images): remain in R2 and DB, linked to trip
- **Persist = false** (documents): scheduled cleanup job runs daily, deletes files where:
  - `persist = false`
  - `created_at` older than 7 days
  - OR conversation has no activity for 48 hours
- Cleanup job deletes R2 object and sets DB record status to DELETED (soft delete)

## Dependencies

New npm packages:
- `multer` — multipart file handling (if not already installed)
- `pdf-parse` — PDF text extraction
- `mammoth` — DOCX to text
- `xlsx` — Excel/CSV parsing

All are well-maintained, widely used libraries with no known security issues.

## Out of Scope

- Real-time collaborative file sharing between trip members
- OCR for scanned image documents (future enhancement)
- Video/audio file support
- File editing or annotation within the app
