# File Upload During Plan Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to upload images and documents during AI chat-based trip planning, with images sent as vision content and documents text-extracted for AI context.

**Architecture:** R2-first unified pipeline. All files upload to Cloudflare R2 via a new backend upload endpoint (Multer). BullMQ processes files async — images get variants via existing Cloudflare Image Resizing, documents get text extracted via pdf-parse/mammoth/xlsx. Frontend adds attach button in chat input and drag-and-drop in side panel.

**Tech Stack:** Node.js/Express + Multer, Prisma (PostgreSQL), BullMQ + Redis, Cloudflare R2, pdf-parse, mammoth, xlsx, Next.js 16 + React 19 + Zustand + TypeScript

**Spec:** `docs/superpowers/specs/2026-03-25-file-upload-plan-creation-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `prisma/migrations/XXXXXX_add_file_uploads/migration.sql` | DB migration for `file_uploads` table |
| `src/modules/upload/infrastructure/repositories/FileUploadRepository.js` | CRUD for `file_uploads` table |
| `src/modules/upload/infrastructure/services/FileProcessQueueService.js` | BullMQ queue for file processing jobs |
| `src/modules/upload/infrastructure/services/FileProcessWorker.js` | Worker: image variants + document text extraction |
| `src/modules/upload/application/useCases/UploadFileUseCase.js` | Business logic: validate, store R2, enqueue |
| `src/modules/upload/interfaces/http/uploadController.js` | HTTP handlers for upload endpoints |
| `src/modules/upload/interfaces/http/uploadRoutes.js` | Express routes with Multer middleware |
| `frontend/src/types/upload.types.ts` | TypeScript types for file uploads |
| `frontend/src/components/features/chat/conversation/FileAttachmentPreview.tsx` | Attachment chips in chat input |
| `frontend/src/components/features/chat/page/FileDropZone.tsx` | Drag-and-drop zone for side panel |
| `frontend/src/components/features/chat/page/ConversationFileList.tsx` | File list in side panel |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `file_uploads` model |
| `src/config/index.js` | Add upload limits config |
| `src/app.js` or `src/routes/index.js` | Register upload routes |
| `src/modules/ai/interfaces/http/aiController.js` | Inject file content into AI messages |
| `src/modules/trip/application/useCases/ApplyAIDraftUseCase.js` | Link inspiration images to trip |
| `frontend/src/services/uploadService.ts` | Add backend upload methods |
| `frontend/src/stores/chatStore.ts` | Add file attachment state + actions |
| `frontend/src/services/aiConversationService.ts` | Send file IDs with chat messages |
| `frontend/src/components/features/chat/conversation/ChatInputArea.tsx` | Add attach button + file preview |
| `frontend/src/components/features/chat/page/TripPlanningSideCard.tsx` | Add drop zone + file list |

---

## Task 1: Database Schema — Add `file_uploads` Table

**Files:**
- Modify: `prisma/schema.prisma`
- Create: Prisma migration (auto-generated)

- [ ] **Step 1: Add `file_uploads` model to Prisma schema**

Add at the end of `prisma/schema.prisma`, before closing:

```prisma
enum FileUploadStatus {
  UPLOADING
  PROCESSING
  READY
  FAILED
  DELETED
}

enum FileUploadType {
  IMAGE
  DOCUMENT
}

enum FileUploadCategory {
  INSPIRATION
  REFERENCE_DOC
  BOOKING
}

model file_uploads {
  id              String              @id @default(uuid()) @db.Uuid
  userId          String              @db.Uuid
  conversationId  String?             @db.Uuid
  messageId       String?             @db.Uuid
  tripId          String?             @db.Uuid

  fileName        String              @db.VarChar(255)
  fileType        FileUploadType
  mimeType        String              @db.VarChar(100)
  fileSize        Int

  r2Key           String?             @db.VarChar(500)
  r2Bucket        String?             @db.VarChar(100)
  publicUrl       String?             @db.VarChar(1000)
  variants        Json?

  extractedText   String?             @db.Text
  extractionMeta  Json?

  status          FileUploadStatus    @default(UPLOADING)
  category        FileUploadCategory  @default(INSPIRATION)
  persist         Boolean             @default(false)

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  user            users               @relation(fields: [userId], references: [id])
  conversation    ai_conversations?   @relation(fields: [conversationId], references: [id])
  message         ai_messages?        @relation(fields: [messageId], references: [id])
  trip            trips?              @relation("TripFileUploads", fields: [tripId], references: [id])

  @@index([conversationId])
  @@index([userId])
  @@index([tripId])
  @@index([status, persist, createdAt])
}
```

Also add reverse relations to existing models:

In the `users` model, add:
```prisma
file_uploads    file_uploads[]
```

In the `ai_conversations` model, add:
```prisma
file_uploads    file_uploads[]
```

In the `ai_messages` model, add:
```prisma
file_uploads    file_uploads[]
```

In the `trips` model, add:
```prisma
file_uploads    file_uploads[]  @relation("TripFileUploads")
```

- [ ] **Step 2: Generate and run migration**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com
npx prisma migrate dev --name add_file_uploads
```

Expected: Migration created and applied successfully.

- [ ] **Step 3: Verify migration**

```bash
npx prisma db pull --print | grep file_uploads
```

Expected: `file_uploads` table exists with all columns.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add file_uploads table for chat file upload feature"
```

---

## Task 2: Backend — File Upload Repository

**Files:**
- Create: `src/modules/upload/infrastructure/repositories/FileUploadRepository.js`

- [ ] **Step 1: Create FileUploadRepository**

```javascript
import prisma from '../../../../shared/database/prismaClient.js';

class FileUploadRepository {
  async create(data) {
    return prisma.file_uploads.create({ data });
  }

  async findById(id) {
    return prisma.file_uploads.findUnique({ where: { id } });
  }

  async findByConversationId(conversationId) {
    return prisma.file_uploads.findMany({
      where: { conversationId, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findReadyByIds(ids) {
    return prisma.file_uploads.findMany({
      where: { id: { in: ids }, status: 'READY' },
    });
  }

  async updateStatus(id, status, extra = {}) {
    return prisma.file_uploads.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  async linkToMessage(id, messageId) {
    return prisma.file_uploads.update({
      where: { id },
      data: { messageId },
    });
  }

  async linkToTrip(ids, tripId) {
    return prisma.file_uploads.updateMany({
      where: { id: { in: ids } },
      data: { tripId },
    });
  }

  async findForCleanup(olderThanDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    return prisma.file_uploads.findMany({
      where: {
        persist: false,
        status: { not: 'DELETED' },
        createdAt: { lt: cutoff },
      },
    });
  }

  async softDelete(id) {
    return prisma.file_uploads.update({
      where: { id },
      data: { status: 'DELETED' },
    });
  }
}

export default new FileUploadRepository();
```

- [ ] **Step 2: Verify file created and imports resolve**

```bash
node -e "import('./src/modules/upload/infrastructure/repositories/FileUploadRepository.js').then(() => console.log('OK')).catch(e => console.error(e.message))"
```

Expected: OK (or Prisma client import error if DB not connected, which is fine).

- [ ] **Step 3: Commit**

```bash
git add src/modules/upload/
git commit -m "feat: add FileUploadRepository for file_uploads CRUD"
```

---

## Task 3: Backend — R2 Upload + File Process Queue

**Files:**
- Create: `src/modules/upload/infrastructure/services/FileProcessQueueService.js`
- Create: `src/modules/upload/infrastructure/services/FileProcessWorker.js`

- [ ] **Step 1: Install document extraction dependencies**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com
npm install multer pdf-parse mammoth xlsx
```

- [ ] **Step 2: Create FileProcessQueueService**

Follow the pattern from `src/modules/image/infrastructure/services/ImageQueueService.js`:

```javascript
import { Queue, Worker } from 'bullmq';
import config from '../../../../config/index.js';
import { processFileJob } from './FileProcessWorker.js';

const QUEUE_NAME = 'file-process';

const connection = {
  url: config.redis?.url || process.env.REDIS_URL,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
};

class FileProcessQueueService {
  constructor() {
    this.queue = null;
    this.worker = null;
  }

  init() {
    if (this.queue) return;

    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions,
    });

    this.worker = new Worker(QUEUE_NAME, processFileJob, {
      connection,
      concurrency: 3,
      limiter: { max: 10, duration: 1000 },
    });

    this.worker.on('completed', (job) => {
      console.log(`[FileProcess] Job ${job.id} completed: ${job.data.fileName}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[FileProcess] Job ${job?.id} failed: ${err.message}`);
    });
  }

  async addJob(data) {
    if (!this.queue) this.init();
    return this.queue.add('process', data, {
      jobId: `file-${data.fileUploadId}`,
    });
  }

  async getStats() {
    if (!this.queue) return null;
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  async close() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export default new FileProcessQueueService();
```

- [ ] **Step 3: Create FileProcessWorker**

```javascript
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import R2StorageService from '../../../image/infrastructure/services/R2StorageService.js';
import FileUploadRepository from '../repositories/FileUploadRepository.js';

const MAX_TEXT_LENGTH = 50000;

function truncateText(text) {
  if (text.length <= MAX_TEXT_LENGTH) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_TEXT_LENGTH) + '\n[Content truncated at 50,000 characters]',
    truncated: true,
  };
}

async function extractPdf(buffer) {
  const data = await pdfParse(buffer);
  const { text, truncated } = truncateText(data.text);
  return {
    extractedText: text,
    extractionMeta: {
      pageCount: data.numpages,
      charCount: data.text.length,
      truncated,
    },
  };
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const { text, truncated } = truncateText(result.value);
  return {
    extractedText: text,
    extractionMeta: {
      charCount: result.value.length,
      truncated,
      warnings: result.messages.length,
    },
  };
}

function extractSpreadsheet(buffer, mimeType) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets = [];
  let fullText = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    sheets.push(sheetName);
    fullText += `[Sheet: ${sheetName}]\n${csv}\n\n`;
  }

  const { text, truncated } = truncateText(fullText);
  return {
    extractedText: text,
    extractionMeta: {
      sheetNames: sheets,
      sheetCount: sheets.length,
      charCount: fullText.length,
      truncated,
    },
  };
}

async function processImageFile(job) {
  const { fileUploadId, r2Key } = job.data;

  await FileUploadRepository.updateStatus(fileUploadId, 'PROCESSING');

  const publicUrl = R2StorageService.getPublicUrl(r2Key);
  const variants = R2StorageService.getVariantUrls(r2Key);

  await FileUploadRepository.updateStatus(fileUploadId, 'READY', {
    publicUrl,
    variants,
  });
}

async function processDocumentFile(job) {
  const { fileUploadId, r2Key, mimeType } = job.data;

  await FileUploadRepository.updateStatus(fileUploadId, 'PROCESSING');

  const buffer = await R2StorageService.download(r2Key);

  let result;
  if (mimeType === 'application/pdf') {
    result = await extractPdf(buffer);
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    result = await extractDocx(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv'
  ) {
    result = extractSpreadsheet(buffer, mimeType);
  } else {
    throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
  }

  await FileUploadRepository.updateStatus(fileUploadId, 'READY', {
    extractedText: result.extractedText,
    extractionMeta: result.extractionMeta,
  });
}

export async function processFileJob(job) {
  const { fileType } = job.data;

  if (fileType === 'IMAGE') {
    return processImageFile(job);
  }
  if (fileType === 'DOCUMENT') {
    return processDocumentFile(job);
  }
  throw new Error(`Unknown file type: ${fileType}`);
}
```

- [ ] **Step 4: Add `download` method to R2StorageService**

In `src/modules/image/infrastructure/services/R2StorageService.js`, add a download method. Find the class and add after the existing `upload` method:

```javascript
async download(key) {
  const command = new GetObjectCommand({
    Bucket: this.bucketName,
    Key: key,
  });
  const response = await this.client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
```

Also add `GetObjectCommand` to the imports at the top:

```javascript
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
```

- [ ] **Step 5: Verify imports resolve**

```bash
node -e "import('./src/modules/upload/infrastructure/services/FileProcessQueueService.js').then(() => console.log('OK')).catch(e => console.error(e.message))"
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/upload/infrastructure/services/ src/modules/image/infrastructure/services/R2StorageService.js
git commit -m "feat: add file processing queue and worker for image variants + document extraction"
```

---

## Task 4: Backend — Upload Use Case + Controller + Routes

**Files:**
- Create: `src/modules/upload/application/useCases/UploadFileUseCase.js`
- Create: `src/modules/upload/interfaces/http/uploadController.js`
- Create: `src/modules/upload/interfaces/http/uploadRoutes.js`
- Modify: `src/config/index.js`

- [ ] **Step 1: Add upload config**

In `src/config/index.js`, add to the exported config object:

```javascript
upload: {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFilesPerRequest: 5,
  maxFilesPerConversation: 20,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedDocTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
},
```

- [ ] **Step 2: Create UploadFileUseCase**

```javascript
import { v4 as uuidv4 } from 'uuid';
import config from '../../../../config/index.js';
import R2StorageService from '../../../image/infrastructure/services/R2StorageService.js';
import FileUploadRepository from '../../infrastructure/repositories/FileUploadRepository.js';
import FileProcessQueueService from '../../infrastructure/services/FileProcessQueueService.js';

const IMAGE_TYPES = new Set(config.upload.allowedImageTypes);

function classifyFile(mimeType) {
  return IMAGE_TYPES.has(mimeType) ? 'IMAGE' : 'DOCUMENT';
}

function inferCategory(fileType) {
  return fileType === 'IMAGE' ? 'INSPIRATION' : 'REFERENCE_DOC';
}

class UploadFileUseCase {
  async execute({ userId, conversationId, file, category }) {
    const fileType = classifyFile(file.mimetype);
    const resolvedCategory = category || inferCategory(fileType);
    const persist = fileType === 'IMAGE';

    const id = uuidv4();
    const ext = file.originalname.split('.').pop().toLowerCase();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const r2Key = `uploads/${year}/${month}/${id}.${ext}`;
    const r2Bucket = config.r2.bucketName;

    const record = await FileUploadRepository.create({
      id,
      userId,
      conversationId,
      fileName: file.originalname,
      fileType,
      mimeType: file.mimetype,
      fileSize: file.size,
      r2Key,
      r2Bucket,
      status: 'UPLOADING',
      category: resolvedCategory,
      persist,
    });

    await R2StorageService.upload(r2Key, file.buffer, file.mimetype);

    await FileProcessQueueService.addJob({
      fileUploadId: id,
      r2Key,
      r2Bucket,
      fileType,
      mimeType: file.mimetype,
      fileName: file.originalname,
    });

    await FileUploadRepository.updateStatus(id, 'PROCESSING');

    return record;
  }
}

export default new UploadFileUseCase();
```

- [ ] **Step 3: Create uploadController**

```javascript
import UploadFileUseCase from '../../application/useCases/UploadFileUseCase.js';
import FileUploadRepository from '../../infrastructure/repositories/FileUploadRepository.js';
import config from '../../../../config/index.js';

export async function uploadFiles(req, res) {
  const userId = req.user.id;
  const { conversationId, category } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  if (conversationId) {
    const existing = await FileUploadRepository.findByConversationId(conversationId);
    if (existing.length + req.files.length > config.upload.maxFilesPerConversation) {
      return res.status(429).json({
        error: `Maximum ${config.upload.maxFilesPerConversation} files per conversation`,
      });
    }
  }

  const uploads = await Promise.all(
    req.files.map((file) =>
      UploadFileUseCase.execute({ userId, conversationId, file, category })
    )
  );

  return res.status(201).json({ uploads });
}

export async function getFileStatus(req, res) {
  const record = await FileUploadRepository.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (record.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(record);
}

export async function getConversationFiles(req, res) {
  const files = await FileUploadRepository.findByConversationId(
    req.params.conversationId
  );
  return res.json({ files });
}

export async function deleteFile(req, res) {
  const record = await FileUploadRepository.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (record.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await FileUploadRepository.softDelete(req.params.id);
  return res.json({ success: true });
}
```

- [ ] **Step 4: Create uploadRoutes with Multer middleware**

```javascript
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import config from '../../../../config/index.js';
import { authenticate } from '../../../../shared/middleware/authMiddleware.js';
import {
  uploadFiles,
  getFileStatus,
  getConversationFiles,
  deleteFile,
} from './uploadController.js';

const router = Router();

const allowedTypes = [
  ...config.upload.allowedImageTypes,
  ...config.upload.allowedDocTypes,
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFilesPerRequest,
  },
  fileFilter(req, file, cb) {
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 files/minute/user
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Upload rate limit exceeded. Try again in a minute.' },
});

router.post('/', authenticate, uploadRateLimit, upload.array('files', config.upload.maxFilesPerRequest), uploadFiles);
router.get('/:id', authenticate, getFileStatus);
router.get('/conversation/:conversationId', authenticate, getConversationFiles);
router.delete('/:id', authenticate, deleteFile);

export default router;
```

Note: Check if `express-rate-limit` is already installed (`npm ls express-rate-limit`). If not, install it: `npm install express-rate-limit`.
```

- [ ] **Step 5: Register upload routes in the app**

In `src/index.js`, find where other routes are registered (e.g. `app.use('/api/images', ...)`) and add alongside them:

```javascript
import uploadRoutes from './modules/upload/interfaces/http/uploadRoutes.js';

// Add alongside other route registrations:
app.use('/api/uploads', uploadRoutes);
```

- [ ] **Step 6: Test endpoint manually**

```bash
# Start the server and test with curl
curl -X POST http://localhost:5000/api/uploads \
  -H "Authorization: Bearer <test-token>" \
  -F "files=@test-image.jpg" \
  -F "conversationId=<uuid>"
```

Expected: 201 response with upload record.

- [ ] **Step 7: Commit**

```bash
git add src/modules/upload/ src/config/index.js src/index.js
git commit -m "feat: add file upload API endpoint with multer and R2 storage"
```

---

## Task 5: Backend — AI Integration (Inject Files into AI Messages)

**Files:**
- Modify: `src/modules/ai/interfaces/http/aiController.js`

- [ ] **Step 1: Add file attachment handling to chat/stream endpoints**

In `aiController.js`, import the repository:

```javascript
import FileUploadRepository from '../../../upload/infrastructure/repositories/FileUploadRepository.js';
```

- [ ] **Step 2: Add helper function to build file content blocks**

Add this function near the top of the controller:

```javascript
async function buildFileContentBlocks(fileIds) {
  if (!fileIds || fileIds.length === 0) return { imageUrls: [], documentTexts: [] };

  const files = await FileUploadRepository.findReadyByIds(fileIds);
  const imageUrls = [];
  const documentTexts = [];

  for (const file of files) {
    if (file.fileType === 'IMAGE' && file.publicUrl) {
      imageUrls.push({
        type: 'image_url',
        image_url: { url: file.variants?.original || file.publicUrl },
      });
    } else if (file.fileType === 'DOCUMENT' && file.extractedText) {
      documentTexts.push(
        `[Attached: ${file.fileName}]\n---\n${file.extractedText}\n---`
      );
    }
  }

  return { imageUrls, documentTexts };
}
```

- [ ] **Step 3: Modify the chat and chatStream methods**

In both `chat()` and `chatStream()`, where the user message is constructed from `req.body.message`, add file content injection. Look for where `messages` array is built and the user message is added.

Before the AI call, add:

```javascript
const { fileIds } = req.body;
const { imageUrls, documentTexts } = await buildFileContentBlocks(fileIds);

// Prepend document text to user message
let enrichedMessage = message;
if (documentTexts.length > 0) {
  enrichedMessage = documentTexts.join('\n\n') + '\n\n' + message;
}

// Build content array for vision support
const userContent = imageUrls.length > 0
  ? [{ type: 'text', text: enrichedMessage }, ...imageUrls]
  : enrichedMessage;
```

Use `userContent` instead of the plain `message` when building the messages array sent to the AI.

- [ ] **Step 4: Link files to message after creation**

After the `ai_messages` record is created for the user message, link the files:

```javascript
if (fileIds && fileIds.length > 0) {
  await Promise.all(
    fileIds.map((id) => FileUploadRepository.linkToMessage(id, userMessageId))
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/interfaces/http/aiController.js
git commit -m "feat: inject uploaded file content into AI chat messages"
```

---

## Task 6: Backend — Link Inspiration Images to Trip on Draft Apply

**Files:**
- Modify: `src/modules/trip/application/useCases/ApplyAIDraftUseCase.js`

- [ ] **Step 1: Import FileUploadRepository**

```javascript
import FileUploadRepository from '../../../upload/infrastructure/repositories/FileUploadRepository.js';
```

- [ ] **Step 2: After trip creation, link persistent files**

Find where the trip is created and the conversation is linked. After that block, add:

```javascript
// Link inspiration images from conversation to the new trip
if (draft.conversationId) {
  const conversationFiles = await FileUploadRepository.findByConversationId(
    draft.conversationId
  );
  const persistentFileIds = conversationFiles
    .filter((f) => f.persist && f.status === 'READY')
    .map((f) => f.id);

  if (persistentFileIds.length > 0) {
    await FileUploadRepository.linkToTrip(persistentFileIds, trip.id);
    console.log(`[ApplyDraft] Linked ${persistentFileIds.length} files to trip ${trip.id}`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/trip/application/useCases/ApplyAIDraftUseCase.js
git commit -m "feat: link uploaded inspiration images to trip on draft apply"
```

---

## Task 7: Frontend — Upload Types + Service

**Files:**
- Create: `frontend/src/types/upload.types.ts`
- Modify: `frontend/src/services/uploadService.ts`

- [ ] **Step 1: Create upload types**

```typescript
export interface FileUploadRecord {
  id: string;
  fileName: string;
  fileType: 'IMAGE' | 'DOCUMENT';
  mimeType: string;
  fileSize: number;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED';
  category: 'INSPIRATION' | 'REFERENCE_DOC' | 'BOOKING';
  publicUrl?: string;
  variants?: {
    thumb: string;
    card: string;
    hero: string;
    original: string;
  };
  extractedText?: string;
  extractionMeta?: Record<string, unknown>;
  createdAt: string;
}

export interface PendingAttachment {
  id: string;
  file: File;
  fileName: string;
  fileType: 'IMAGE' | 'DOCUMENT';
  previewUrl?: string;
  progress: number;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  record?: FileUploadRecord;
  error?: string;
}

export interface UploadResponse {
  uploads: FileUploadRecord[];
}
```

- [ ] **Step 2: Add backend upload methods to uploadService.ts**

Add these methods to the existing `uploadService` object or class:

```typescript
import api from '../lib/api';
import type { FileUploadRecord, UploadResponse } from '../types/upload.types';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType) || ALLOWED_DOC_TYPES.includes(mimeType);
}

export function isImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export function validateFile(file: File): string | null {
  if (!isAllowedFileType(file.type)) {
    return 'File type not supported. Use JPEG, PNG, WebP, PDF, DOCX, XLSX, or CSV.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File too large. Maximum size is 10MB.';
  }
  return null;
}

export async function uploadChatFile(
  file: File,
  conversationId: string,
  category?: string
): Promise<FileUploadRecord> {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('conversationId', conversationId);
  if (category) formData.append('category', category);

  const response = await api.post<UploadResponse>('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.uploads[0];
}

export async function getFileStatus(id: string): Promise<FileUploadRecord> {
  const response = await api.get<FileUploadRecord>(`/uploads/${id}`);
  return response.data;
}

export async function getConversationFiles(
  conversationId: string
): Promise<FileUploadRecord[]> {
  const response = await api.get<{ files: FileUploadRecord[] }>(
    `/uploads/conversation/${conversationId}`
  );
  return response.data.files;
}

export async function deleteUploadedFile(id: string): Promise<void> {
  await api.delete(`/uploads/${id}`);
}

export async function pollUntilReady(
  id: string,
  intervalMs = 1500,
  maxAttempts = 20
): Promise<FileUploadRecord> {
  for (let i = 0; i < maxAttempts; i++) {
    const record = await getFileStatus(id);
    if (record.status === 'READY' || record.status === 'FAILED') {
      return record;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('File processing timed out');
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/upload.types.ts frontend/src/services/uploadService.ts
git commit -m "feat: add frontend upload types and backend upload service methods"
```

---

## Task 8: Frontend — Chat Store File Attachment State

**Files:**
- Modify: `frontend/src/stores/chatStore.ts`

- [ ] **Step 1: Add file attachment state and actions to chatStore**

Add to the store's state interface:

```typescript
pendingAttachments: PendingAttachment[];
conversationFiles: FileUploadRecord[];
```

Add to the store's actions:

```typescript
addAttachment: (file: File) => Promise<void>;
removeAttachment: (id: string) => void;
clearAttachments: () => void;
loadConversationFiles: (conversationId: string) => Promise<void>;
```

- [ ] **Step 2: Implement the actions**

```typescript
addAttachment: async (file) => {
  const error = validateFile(file);
  if (error) {
    console.error('[ChatStore] File validation failed:', error);
    return;
  }

  const tempId = crypto.randomUUID();
  const fileType = isImageType(file.type) ? 'IMAGE' : 'DOCUMENT';
  const previewUrl = fileType === 'IMAGE' ? URL.createObjectURL(file) : undefined;

  const attachment: PendingAttachment = {
    id: tempId,
    file,
    fileName: file.name,
    fileType,
    previewUrl,
    progress: 0,
    status: 'UPLOADING',
  };

  set((state) => ({
    pendingAttachments: [...state.pendingAttachments, attachment],
  }));

  let { conversationId } = get();

  // If no conversation yet (first interaction), create one before uploading
  if (!conversationId) {
    const response = await api.post('/ai/conversations');
    conversationId = response.data.id;
    set({ conversationId });
  }

  try {
    const record = await uploadChatFile(file, conversationId);

    set((state) => ({
      pendingAttachments: state.pendingAttachments.map((a) =>
        a.id === tempId
          ? { ...a, id: record.id, status: 'PROCESSING', record }
          : a
      ),
    }));

    const readyRecord = await pollUntilReady(record.id);

    set((state) => ({
      pendingAttachments: state.pendingAttachments.map((a) =>
        a.id === record.id
          ? { ...a, status: readyRecord.status as PendingAttachment['status'], record: readyRecord }
          : a
      ),
    }));
  } catch (err) {
    set((state) => ({
      pendingAttachments: state.pendingAttachments.map((a) =>
        a.id === tempId
          ? { ...a, status: 'FAILED', error: (err as Error).message }
          : a
      ),
    }));
  }
},

removeAttachment: (id) => {
  const attachment = get().pendingAttachments.find((a) => a.id === id);
  if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  set((state) => ({
    pendingAttachments: state.pendingAttachments.filter((a) => a.id !== id),
  }));
},

clearAttachments: () => {
  for (const a of get().pendingAttachments) {
    if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
  }
  set({ pendingAttachments: [] });
},

loadConversationFiles: async (conversationId) => {
  const files = await getConversationFiles(conversationId);
  set({ conversationFiles: files });
},
```

- [ ] **Step 3: Modify `sendMessage` to include file IDs**

In the existing `sendMessage` action, before the API call, collect ready file IDs:

```typescript
const fileIds = get()
  .pendingAttachments
  .filter((a) => a.status === 'READY' && a.record)
  .map((a) => a.record!.id);
```

Pass `fileIds` alongside the message to the AI conversation service, then clear attachments after send.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/chatStore.ts
git commit -m "feat: add file attachment state management to chat store"
```

---

## Task 9: Frontend — AI Conversation Service (Send File IDs)

**Files:**
- Modify: `frontend/src/services/aiConversationService.ts`

- [ ] **Step 1: Add fileIds parameter to streamChat and sendChat**

Find the `streamChat` method signature and add `fileIds?: string[]` parameter. In the request body construction, include:

```typescript
body: JSON.stringify({
  message,
  conversationId,
  fileIds, // new field
  // ... existing fields
}),
```

Do the same for the non-streaming `sendChat` if it exists.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/aiConversationService.ts
git commit -m "feat: pass file IDs to AI chat API for context injection"
```

---

## Task 10: Frontend — Chat Input UI (Attach Button + File Preview)

**Files:**
- Create: `frontend/src/components/features/chat/conversation/FileAttachmentPreview.tsx`
- Modify: `frontend/src/components/features/chat/conversation/ChatInputArea.tsx`

- [ ] **Step 1: Create FileAttachmentPreview component**

```tsx
import { X, FileText, Image, SpinnerGap, Warning } from '@phosphor-icons/react';
import type { PendingAttachment } from '../../../../types/upload.types';

interface FileAttachmentPreviewProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileChip({ attachment, onRemove }: { attachment: PendingAttachment; onRemove: () => void }) {
  const isImage = attachment.fileType === 'IMAGE';
  const isFailed = attachment.status === 'FAILED';
  const isProcessing = attachment.status === 'UPLOADING' || attachment.status === 'PROCESSING';

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs
      ${isFailed ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-white/5'}`}
    >
      {isImage && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.fileName}
          className="h-8 w-8 rounded object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10">
          {isFailed ? (
            <Warning size={16} className="text-red-400" />
          ) : (
            <FileText size={16} className="text-white/60" />
          )}
        </div>
      )}

      <div className="max-w-[120px] overflow-hidden">
        <div className="truncate text-white/80">{attachment.fileName}</div>
        <div className="text-white/40">
          {isProcessing && 'Processing...'}
          {isFailed && (attachment.error || 'Failed')}
          {attachment.status === 'READY' && formatSize(attachment.file.size)}
        </div>
      </div>

      {isProcessing && (
        <SpinnerGap size={14} className="animate-spin text-white/40" />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="ml-auto text-white/40 hover:text-white/80"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function FileAttachmentPreview({
  attachments,
  onRemove,
}: FileAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {attachments.map((a) => (
        <FileChip key={a.id} attachment={a} onRemove={() => onRemove(a.id)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add attach button and preview to ChatInputArea**

In `ChatInputArea.tsx`:

1. Import the new component and store actions:
```tsx
import FileAttachmentPreview from './FileAttachmentPreview';
import { useChatStore } from '../../../../stores/chatStore';
```

2. Add a hidden file input ref:
```tsx
const fileInputRef = useRef<HTMLInputElement>(null);
const { pendingAttachments, addAttachment, removeAttachment } = useChatStore();
```

3. Add the attach button (📎) before the text input:
```tsx
<button
  type="button"
  onClick={() => fileInputRef.current?.click()}
  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white/60"
  title="Attach file"
>
  <Paperclip size={18} />
</button>

<input
  ref={fileInputRef}
  type="file"
  multiple
  accept="image/jpeg,image/png,image/webp,.pdf,.docx,.xlsx,.csv"
  className="hidden"
  onChange={(e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => addAttachment(f));
    e.target.value = '';
  }}
/>
```

4. Add `FileAttachmentPreview` above the input row:
```tsx
<FileAttachmentPreview
  attachments={pendingAttachments}
  onRemove={removeAttachment}
/>
```

5. Import `Paperclip` from `@phosphor-icons/react`.

6. Add clipboard paste support on the textarea:
```tsx
onPaste={(e) => {
  const items = Array.from(e.clipboardData.items);
  const imageItems = items.filter((item) => item.type.startsWith('image/'));
  if (imageItems.length > 0) {
    e.preventDefault();
    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (file) addAttachment(file);
    });
  }
}}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/features/chat/conversation/
git commit -m "feat: add file attach button and preview chips in chat input"
```

---

## Task 11: Frontend — Side Panel Drag & Drop + File List

**Files:**
- Create: `frontend/src/components/features/chat/page/FileDropZone.tsx`
- Create: `frontend/src/components/features/chat/page/ConversationFileList.tsx`
- Modify: `frontend/src/components/features/chat/page/TripPlanningSideCard.tsx`

- [ ] **Step 1: Create FileDropZone component**

```tsx
import { useState, useCallback } from 'react';
import { CloudArrowUp } from '@phosphor-icons/react';
import { useChatStore } from '../../../../stores/chatStore';

export default function FileDropZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const { addAttachment } = useChatStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      files.forEach((f) => addAttachment(f));
    },
    [addAttachment]
  );

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/jpeg,image/png,image/webp,.pdf,.docx,.xlsx,.csv';
    input.onchange = () => {
      const files = Array.from(input.files || []);
      files.forEach((f) => addAttachment(f));
    };
    input.click();
  }, [addAttachment]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors
        ${isDragOver ? 'border-blue-400 bg-blue-400/10' : 'border-white/10 hover:border-white/20'}`}
    >
      <CloudArrowUp size={28} className={isDragOver ? 'text-blue-400' : 'text-white/40'} />
      <span className="text-sm text-white/60">Drop files here</span>
      <span className="text-xs text-white/30">or click to browse</span>
    </div>
  );
}
```

- [ ] **Step 2: Create ConversationFileList component**

```tsx
import { FileText, Image, CheckCircle, SpinnerGap, XCircle } from '@phosphor-icons/react';
import type { FileUploadRecord } from '../../../../types/upload.types';

interface ConversationFileListProps {
  files: FileUploadRecord[];
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'READY') return <CheckCircle size={14} className="text-green-400" />;
  if (status === 'FAILED') return <XCircle size={14} className="text-red-400" />;
  return <SpinnerGap size={14} className="animate-spin text-amber-400" />;
}

export default function ConversationFileList({ files }: ConversationFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
        Uploaded Files ({files.length})
      </div>
      <div className="flex flex-col gap-1.5">
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5"
          >
            {f.fileType === 'IMAGE' ? (
              <Image size={16} className="text-white/50" />
            ) : (
              <FileText size={16} className="text-white/50" />
            )}
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-xs text-white/70">{f.fileName}</div>
            </div>
            <StatusIcon status={f.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add FileDropZone and ConversationFileList to TripPlanningSideCard**

In `TripPlanningSideCard.tsx`, import and add the components:

```tsx
import FileDropZone from './FileDropZone';
import ConversationFileList from './ConversationFileList';
import { useChatStore } from '../../../../stores/chatStore';
```

Add after the existing trip info section (before the activities list or at the end of the card):

```tsx
const { conversationFiles } = useChatStore();

// In the JSX, add at an appropriate position:
<FileDropZone />
<ConversationFileList files={conversationFiles} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/features/chat/page/
git commit -m "feat: add drag-and-drop zone and file list to trip planning side panel"
```

---

## Task 12: Backend — Scheduled Cleanup Job for Expired Files

**Files:**
- Create: `src/modules/upload/infrastructure/services/FileCleanupJob.js`
- Modify: `src/index.js` (register the scheduled job on startup)

- [ ] **Step 1: Create FileCleanupJob**

```javascript
import R2StorageService from '../../../image/infrastructure/services/R2StorageService.js';
import FileUploadRepository from '../repositories/FileUploadRepository.js';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runCleanup() {
  console.log('[FileCleanup] Starting cleanup of expired files...');

  const expiredFiles = await FileUploadRepository.findForCleanup(7);

  let deleted = 0;
  for (const file of expiredFiles) {
    try {
      if (file.r2Key) {
        await R2StorageService.delete(file.r2Key);
      }
      await FileUploadRepository.softDelete(file.id);
      deleted++;
    } catch (err) {
      console.error(`[FileCleanup] Failed to clean up file ${file.id}:`, err.message);
    }
  }

  console.log(`[FileCleanup] Cleaned up ${deleted}/${expiredFiles.length} expired files`);
}

export function startCleanupScheduler() {
  // Run once on startup (after 1 min delay), then every 24 hours
  setTimeout(() => {
    runCleanup().catch(console.error);
    setInterval(() => runCleanup().catch(console.error), CLEANUP_INTERVAL_MS);
  }, 60 * 1000);

  console.log('[FileCleanup] Cleanup scheduler started (runs every 24h)');
}
```

- [ ] **Step 2: Register cleanup scheduler on app startup**

In `src/index.js`, import and call the scheduler after the server starts:

```javascript
import { startCleanupScheduler } from './modules/upload/infrastructure/services/FileCleanupJob.js';

// After app.listen():
startCleanupScheduler();
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/upload/infrastructure/services/FileCleanupJob.js src/index.js
git commit -m "feat: add scheduled cleanup job for expired document uploads"
```

---

## Task 13: Integration Test — End-to-End Upload Flow

- [ ] **Step 1: Manual integration test**

1. Start backend: `npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Log in as a test user
4. Start a new AI conversation
5. Click 📎 in chat input → select an image → verify it uploads and shows as chip
6. Drag a PDF into the side panel → verify it appears in file list
7. Send a message with attachments → verify AI responds referencing the file content
8. Save the plan as a trip → verify inspiration images are linked to the trip

- [ ] **Step 2: Verify error cases**

1. Upload a file > 10MB → should be blocked client-side
2. Upload an unsupported type (.exe) → should be blocked
3. Upload 21 files in one conversation → should get 429 error after 20

- [ ] **Step 3: Final commit**

```bash
git add -A
git status  # Review all changes
git commit -m "feat: complete file upload during plan creation feature"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Database schema (Prisma migration) | None |
| 2 | FileUploadRepository | Task 1 |
| 3 | File process queue + worker + R2 download | Task 2 |
| 4 | Upload use case + controller + routes + rate limit | Task 2, 3 |
| 5 | AI integration (inject files into messages) | Task 2 |
| 6 | Trip linking on draft apply | Task 2 |
| 7 | Frontend upload types + service | Task 4 (API must exist) |
| 8 | Chat store file attachment state | Task 7 |
| 9 | AI conversation service (send file IDs) | Task 8 |
| 10 | Chat input UI (attach button + preview + paste) | Task 8 |
| 11 | Side panel (drop zone + file list) | Task 8 |
| 12 | Scheduled cleanup job for expired files | Task 2 |
| 13 | Integration testing | All tasks |

**Parallelizable:** Tasks 5, 6, and 12 can run in parallel with Tasks 3-4. Tasks 10 and 11 can run in parallel with each other.
