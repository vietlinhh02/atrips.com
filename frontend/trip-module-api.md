# Trip Module API Documentation

## Overview

Module Trip quản lý toàn bộ chức năng liên quan đến chuyến đi, bao gồm:
- CRUD operations cho Trip
- AI Draft (lịch trình được AI tạo)
- AI Modify (chỉnh sửa trip bằng AI)
- Quản lý Itinerary Days và Activities

**Base URL:** `/api/trips`

**Authentication:** Tất cả endpoints đều yêu cầu JWT token trong header:
```
Authorization: Bearer <access_token>
```

---

## Data Models

### Trip Object

```typescript
interface Trip {
  id: string;                    // UUID
  ownerId: string;               // User ID của chủ trip
  title: string;                 // Tiêu đề (1-200 ký tự)
  description: string | null;    // Mô tả (max 2000 ký tự)
  startDate: string;             // ISO 8601 date
  endDate: string;               // ISO 8601 date
  travelersCount: number;        // Số người đi (min 1)
  budgetTotal: number | null;    // Tổng ngân sách
  budgetCurrency: string;        // Mã tiền tệ ISO 4217 (VND, USD, EUR...)
  status: TripStatus;            // Trạng thái trip
  visibility: TripVisibility;    // Quyền xem
  coverImageUrl: string | null;  // URL ảnh bìa
  createdAt: string;             // ISO 8601 datetime
  updatedAt: string;             // ISO 8601 datetime
}
```

### Trip Status (Enum)

```typescript
type TripStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
```

**Status Transitions (Luồng chuyển trạng thái):**
```
DRAFT → ACTIVE → COMPLETED → ARCHIVED
  ↓        ↓
ARCHIVED  ARCHIVED
```

### Trip Visibility (Enum)

```typescript
type TripVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';
```

### Itinerary Day Object

```typescript
interface ItineraryDay {
  id: string;                    // UUID
  tripId: string;                // Trip ID
  date: string;                  // ISO 8601 date (YYYY-MM-DD)
  dayNumber: number;             // Số thứ tự ngày (1, 2, 3...)
  title: string;                 // Tiêu đề ngày
  notes: string | null;          // Ghi chú
  activities: Activity[];        // Danh sách hoạt động
  createdAt: string;
  updatedAt: string;
}
```

### Activity Object

```typescript
interface Activity {
  id: string;                    // UUID
  itineraryDayId: string;        // Day ID
  name: string;                  // Tên hoạt động (1-200 ký tự)
  type: ActivityType;            // Loại hoạt động
  description: string | null;    // Mô tả (max 2000 ký tự)
  startTime: string | null;      // Giờ bắt đầu (HH:mm hoặc HH:mm:ss)
  endTime: string | null;        // Giờ kết thúc
  duration: number | null;       // Thời lượng (phút)
  placeId: string | null;        // Google Place ID
  placeName: string | null;      // Tên địa điểm
  customAddress: string | null;  // Địa chỉ tùy chỉnh
  latitude: number | null;       // Vĩ độ (-90 đến 90)
  longitude: number | null;      // Kinh độ (-180 đến 180)
  estimatedCost: number | null;  // Chi phí dự kiến
  actualCost: number | null;     // Chi phí thực tế
  notes: string | null;          // Ghi chú
  orderIndex: number;            // Thứ tự hiển thị
  createdById: string;           // User ID người tạo
  createdAt: string;
  updatedAt: string;
}
```

### Activity Type (Enum)

```typescript
type ActivityType =
  | 'ATTRACTION'      // Điểm tham quan
  | 'DINING'          // Ăn uống
  | 'ACCOMMODATION'   // Chỗ ở
  | 'TRANSPORTATION'  // Di chuyển
  | 'ACTIVITY'        // Hoạt động
  | 'SHOPPING'        // Mua sắm
  | 'OTHER';          // Khác
```

### AI Draft Object

```typescript
interface AIDraft {
  id: string;                    // UUID
  conversationId: string | null; // AI Conversation ID
  sourcePrompt: string;          // Prompt gốc từ user
  generatedData: DraftData;      // Dữ liệu lịch trình được AI tạo
  appliedAt: string | null;      // Thời điểm đã apply
  appliedToTripId: string | null;// Trip ID đã apply
  createdAt: string;
  updatedAt: string;
}

interface DraftData {
  tripTitle: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
  currency: string;
  days: DraftDay[];
}

interface DraftDay {
  date: string;
  dayNumber: number;
  title: string;
  theme: string;
  notes: string;
  schedule: DraftActivity[];
}

interface DraftActivity {
  name: string;
  type: string;
  description: string;
  time: string;              // Giờ bắt đầu
  startTime: string;
  endTime: string;
  duration: number;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  estimatedCost: number;
  placeId: string;
  orderIndex: number;
}
```

---

## API Endpoints

### 1. Trip CRUD Operations

#### 1.1. Create Trip

Tạo trip mới (trạng thái mặc định: DRAFT).

```http
POST /api/trips
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "title": "Du lịch Đà Nẵng",
  "description": "Chuyến đi nghỉ dưỡng 5 ngày",
  "startDate": "2024-03-01",
  "endDate": "2024-03-05",
  "travelersCount": 2,
  "budgetTotal": 15000000,
  "budgetCurrency": "VND",
  "coverImageUrl": "https://example.com/image.jpg"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| title | string | ✅ | 1-200 ký tự |
| description | string | ❌ | Max 2000 ký tự |
| startDate | string | ✅ | ISO 8601 date |
| endDate | string | ✅ | ISO 8601 date, phải sau startDate |
| travelersCount | number | ❌ | Min 1, default 1 |
| budgetTotal | number | ❌ | Min 0 |
| budgetCurrency | string | ❌ | 3 ký tự ISO 4217, default "VND" |
| coverImageUrl | string | ❌ | Valid URL |

**Success Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "trip": {
      "id": "uuid-trip-id",
      "ownerId": "uuid-user-id",
      "title": "Du lịch Đà Nẵng",
      "description": "Chuyến đi nghỉ dưỡng 5 ngày",
      "startDate": "2024-03-01T00:00:00.000Z",
      "endDate": "2024-03-05T00:00:00.000Z",
      "travelersCount": 2,
      "budgetTotal": 15000000,
      "budgetCurrency": "VND",
      "status": "DRAFT",
      "visibility": "PRIVATE",
      "coverImageUrl": "https://example.com/image.jpg",
      "createdAt": "2024-02-15T10:30:00.000Z",
      "updatedAt": "2024-02-15T10:30:00.000Z"
    }
  },
  "message": "Trip created successfully"
}
```

---

#### 1.2. List Trips

Lấy danh sách trips của user hiện tại.

```http
GET /api/trips?status=ACTIVE&page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| status | string | ❌ | - | Filter theo status: DRAFT, ACTIVE, COMPLETED, ARCHIVED |
| page | number | ❌ | 1 | Số trang |
| limit | number | ❌ | 10 | Số items/trang |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "id": "uuid-1",
        "ownerId": "user-uuid",
        "title": "Du lịch Đà Nẵng",
        "description": "Chuyến đi nghỉ dưỡng",
        "startDate": "2024-03-01T00:00:00.000Z",
        "endDate": "2024-03-05T00:00:00.000Z",
        "travelersCount": 2,
        "budgetTotal": 15000000,
        "budgetCurrency": "VND",
        "status": "ACTIVE",
        "visibility": "PRIVATE",
        "coverImageUrl": "https://example.com/image.jpg",
        "createdAt": "2024-02-15T10:30:00.000Z",
        "updatedAt": "2024-02-15T10:30:00.000Z",
        "_count": {
          "itinerary_days": 5,
          "trip_members": 2
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

---

#### 1.3. Get Trip Detail

Lấy chi tiết trip với đầy đủ itinerary và activities.

```http
GET /api/trips/:id
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| id | string | Trip UUID |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "trip": {
      "id": "uuid-trip",
      "owner_id": "uuid-user",
      "title": "Du lịch Đà Nẵng",
      "description": "Chuyến đi nghỉ dưỡng 5 ngày",
      "start_date": "2024-03-01T00:00:00.000Z",
      "end_date": "2024-03-05T00:00:00.000Z",
      "travelers_count": 2,
      "budget_total": 15000000,
      "budget_currency": "VND",
      "status": "ACTIVE",
      "visibility": "PRIVATE",
      "cover_image_url": "https://example.com/image.jpg",
      "created_at": "2024-02-15T10:30:00.000Z",
      "updated_at": "2024-02-15T10:30:00.000Z",
      "itinerary_days": [
        {
          "id": "uuid-day-1",
          "trip_id": "uuid-trip",
          "date": "2024-03-01T00:00:00.000Z",
          "day_number": 1,
          "title": "Day 1: Khám phá Đà Nẵng",
          "notes": "Ngày đầu tiên",
          "activities": [
            {
              "id": "uuid-activity-1",
              "itinerary_day_id": "uuid-day-1",
              "name": "Cầu Rồng",
              "type": "ATTRACTION",
              "description": "Tham quan cầu Rồng",
              "start_time": "09:00",
              "end_time": "10:30",
              "duration": 90,
              "place_id": "google-place-id",
              "place_name": "Cầu Rồng",
              "custom_address": "Đà Nẵng",
              "latitude": 16.0612,
              "longitude": 108.2279,
              "estimated_cost": 0,
              "actual_cost": null,
              "notes": null,
              "order_index": 0,
              "created_by_id": "uuid-user",
              "created_at": "2024-02-15T10:30:00.000Z",
              "updated_at": "2024-02-15T10:30:00.000Z"
            }
          ]
        }
      ],
      "trip_members": [
        {
          "id": "uuid-member",
          "user": {
            "id": "uuid-user",
            "name": "John Doe",
            "display_name": "John",
            "avatar_url": "https://example.com/avatar.jpg"
          }
        }
      ],
      "_count": {
        "ai_conversations": 2
      }
    }
  }
}
```

**Error Responses:**

| Status | Code | Message |
|--------|------|---------|
| 404 | NOT_FOUND | Trip not found |
| 403 | FORBIDDEN | You do not have access to this trip |

---

#### 1.4. Update Trip

Cập nhật thông tin trip.

```http
PATCH /api/trips/:id
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| id | string | Trip UUID |

**Request Body (tất cả fields đều optional):**

```json
{
  "title": "Du lịch Đà Nẵng - Hội An",
  "description": "Cập nhật mô tả",
  "startDate": "2024-03-01",
  "endDate": "2024-03-07",
  "travelersCount": 3,
  "budgetTotal": 20000000,
  "budgetCurrency": "VND",
  "status": "ACTIVE",
  "visibility": "SHARED",
  "coverImageUrl": "https://example.com/new-image.jpg"
}
```

| Field | Type | Validation |
|-------|------|------------|
| title | string | 1-200 ký tự |
| description | string | Max 2000 ký tự |
| startDate | string | ISO 8601 date |
| endDate | string | ISO 8601 date |
| travelersCount | number | Min 1 |
| budgetTotal | number | Min 0 |
| budgetCurrency | string | 3 ký tự ISO 4217 |
| status | string | DRAFT, ACTIVE, COMPLETED, ARCHIVED |
| visibility | string | PRIVATE, SHARED, PUBLIC |
| coverImageUrl | string | Valid URL |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "trip": {
      "id": "uuid-trip",
      "title": "Du lịch Đà Nẵng - Hội An",
      "status": "ACTIVE",
      "visibility": "SHARED",
      "updatedAt": "2024-02-15T11:00:00.000Z"
    }
  },
  "message": "Trip updated successfully"
}
```

---

#### 1.5. Delete Trip

Xóa trip (soft delete hoặc hard delete tùy config).

```http
DELETE /api/trips/:id
Authorization: Bearer <token>
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": null,
  "message": "Trip deleted successfully"
}
```

---

### 2. AI Draft Operations

#### 2.1. Apply AI Draft to Trip

Chuyển đổi AI Draft thành Trip thực sự với đầy đủ itinerary.

```http
POST /api/trips/drafts/:draftId/apply
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| draftId | string | AI Draft UUID |

**Request Body:**

```json
{
  "createNew": true,
  "existingTripId": null
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| createNew | boolean | ❌ | true | true = tạo trip mới, false = cập nhật trip có sẵn |
| existingTripId | string | Conditional | null | Bắt buộc nếu createNew = false |

**Use Cases:**

1. **Tạo Trip mới từ Draft:**
```json
{
  "createNew": true
}
```

2. **Cập nhật Trip có sẵn từ Draft:**
```json
{
  "createNew": false,
  "existingTripId": "uuid-existing-trip"
}
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "trip": {
      "id": "uuid-new-trip",
      "title": "Du lịch Đà Nẵng 5 ngày",
      "description": "Lịch trình được AI tạo",
      "start_date": "2024-03-01T00:00:00.000Z",
      "end_date": "2024-03-05T00:00:00.000Z",
      "status": "DRAFT",
      "itinerary_days": [
        {
          "id": "uuid-day-1",
          "day_number": 1,
          "title": "Day 1: Khám phá trung tâm",
          "activities": [
            {
              "id": "uuid-activity-1",
              "name": "Cầu Rồng",
              "type": "ATTRACTION",
              "start_time": "09:00",
              "order_index": 0
            }
          ]
        }
      ]
    }
  },
  "message": "Draft applied successfully"
}
```

**Error Responses:**

| Status | Code | Message |
|--------|------|---------|
| 404 | NOT_FOUND | Draft not found |
| 403 | FORBIDDEN | You do not have access to this draft |
| 400 | BAD_REQUEST | Draft has already been applied |
| 400 | BAD_REQUEST | existingTripId is required when createNew is false |

---

### 3. AI Modify Trip

#### 3.1. Modify Trip with AI

Sử dụng AI để chỉnh sửa trip bằng ngôn ngữ tự nhiên.

```http
POST /api/trips/:tripId/ai-modify
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| tripId | string | Trip UUID |

**Request Body:**

```json
{
  "message": "Thêm 2 ngày ở Hội An vào cuối chuyến đi",
  "conversationId": "uuid-conversation"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| message | string | ✅ | 1-2000 ký tự |
| conversationId | string | ❌ | UUID của conversation để lưu history |

**Example Messages:**

```
"Thêm một bữa ăn tối vào ngày 2"
"Đổi khách sạn sang Vinpearl Resort"
"Thêm 2 ngày ở Hội An"
"Bỏ hoạt động mua sắm ở ngày 3"
"Đổi thời gian check-in thành 14:00"
"Tăng ngân sách lên 20 triệu"
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "trip": {
      "id": "uuid-trip",
      "title": "Du lịch Đà Nẵng - Hội An",
      "end_date": "2024-03-07T00:00:00.000Z",
      "itinerary_days": [...]
    },
    "changes": {
      "extendDates": true,
      "newEndDate": "2024-03-07",
      "oldEndDate": "2024-03-05",
      "addActivities": [
        {
          "dayId": "uuid-day-6",
          "data": {
            "name": "Phố cổ Hội An",
            "type": "ATTRACTION"
          }
        }
      ],
      "removeActivities": [],
      "updateActivities": [],
      "updateTrip": null
    }
  },
  "message": "Trip updated successfully"
}
```

**Changes Object Structure:**

```typescript
interface AIChanges {
  extendDates: boolean;          // Có mở rộng ngày không
  newEndDate?: string;           // Ngày kết thúc mới
  oldEndDate?: string;           // Ngày kết thúc cũ
  addActivities: Array<{
    dayId?: string;              // Day ID (nếu có)
    date?: string;               // Hoặc ngày để tìm/tạo day
    data: Partial<Activity>;     // Dữ liệu activity
  }>;
  removeActivities: string[];    // Danh sách activity IDs cần xóa
  updateActivities: Array<{
    activityId: string;
    updates: Partial<Activity>;
  }>;
  updateTrip: Partial<Trip> | null; // Cập nhật thông tin trip
}
```

---

### 4. Activity Operations

#### 4.1. Add Activity to Day

Thêm activity mới vào một ngày cụ thể.

```http
POST /api/trips/:tripId/days/:dayId/activities
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| tripId | string | Trip UUID |
| dayId | string | Itinerary Day UUID |

**Request Body:**

```json
{
  "name": "Tham quan Bà Nà Hills",
  "type": "ATTRACTION",
  "description": "Tham quan khu du lịch Bà Nà với cáp treo",
  "startTime": "08:00",
  "endTime": "17:00",
  "duration": 540,
  "latitude": 15.9957,
  "longitude": 107.9875,
  "estimatedCost": 750000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | string | ✅ | 1-200 ký tự |
| type | string | ❌ | ATTRACTION, DINING, ACCOMMODATION, TRANSPORTATION, ACTIVITY, SHOPPING, OTHER |
| description | string | ❌ | Max 2000 ký tự |
| startTime | string | ❌ | Format HH:mm hoặc HH:mm:ss |
| endTime | string | ❌ | Format HH:mm hoặc HH:mm:ss |
| duration | number | ❌ | Số phút (min 0) |
| latitude | number | ❌ | -90 đến 90 |
| longitude | number | ❌ | -180 đến 180 |
| estimatedCost | number | ❌ | Min 0 |

**Success Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "activity": {
      "id": "uuid-activity",
      "itinerary_day_id": "uuid-day",
      "name": "Tham quan Bà Nà Hills",
      "type": "ATTRACTION",
      "description": "Tham quan khu du lịch Bà Nà với cáp treo",
      "start_time": "08:00",
      "end_time": "17:00",
      "duration": 540,
      "latitude": 15.9957,
      "longitude": 107.9875,
      "estimated_cost": 750000,
      "order_index": 0,
      "created_by_id": "uuid-user",
      "created_at": "2024-02-15T10:30:00.000Z"
    }
  },
  "message": "Activity added successfully"
}
```

---

#### 4.2. Update Activity

Cập nhật thông tin activity.

```http
PATCH /api/trips/:tripId/activities/:activityId
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| tripId | string | Trip UUID |
| activityId | string | Activity UUID |

**Request Body (tất cả fields đều optional):**

```json
{
  "name": "Bà Nà Hills - Sun World",
  "startTime": "07:30",
  "estimatedCost": 850000
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "activity": {
      "id": "uuid-activity",
      "name": "Bà Nà Hills - Sun World",
      "start_time": "07:30",
      "estimated_cost": 850000,
      "updated_at": "2024-02-15T11:00:00.000Z"
    }
  },
  "message": "Activity updated successfully"
}
```

---

#### 4.3. Delete Activity

Xóa activity.

```http
DELETE /api/trips/:tripId/activities/:activityId
Authorization: Bearer <token>
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": null,
  "message": "Activity deleted successfully"
}
```

---

#### 4.4. Reorder Activities

Sắp xếp lại thứ tự activities trong một ngày.

```http
PATCH /api/trips/:tripId/days/:dayId/activities/reorder
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| tripId | string | Trip UUID |
| dayId | string | Itinerary Day UUID |

**Request Body:**

```json
{
  "activityIds": [
    "uuid-activity-3",
    "uuid-activity-1",
    "uuid-activity-2"
  ]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| activityIds | string[] | ✅ | Mảng không rỗng, mỗi phần tử là string |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": null,
  "message": "Activities reordered successfully"
}
```

---

## Error Response Format

Tất cả errors đều có format thống nhất:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | BAD_REQUEST | Request không hợp lệ |
| 401 | UNAUTHORIZED | Chưa đăng nhập |
| 403 | FORBIDDEN | Không có quyền truy cập |
| 404 | NOT_FOUND | Resource không tồn tại |
| 422 | VALIDATION_ERROR | Lỗi validation |
| 500 | INTERNAL_ERROR | Lỗi server |

### Validation Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "title",
          "message": "Title must be between 1 and 200 characters",
          "value": ""
        },
        {
          "field": "startDate",
          "message": "Start date must be a valid ISO 8601 date",
          "value": "invalid-date"
        }
      ]
    }
  }
}
```

---

## Frontend Integration Examples

### TypeScript Types

```typescript
// types/trip.ts

export interface Trip {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  travelersCount: number;
  budgetTotal: number | null;
  budgetCurrency: string;
  status: TripStatus;
  visibility: TripVisibility;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type TripVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

export interface ItineraryDay {
  id: string;
  tripId: string;
  date: string;
  dayNumber: number;
  title: string;
  notes: string | null;
  activities: Activity[];
}

export interface Activity {
  id: string;
  itineraryDayId: string;
  name: string;
  type: ActivityType;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  placeId: string | null;
  placeName: string | null;
  customAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  estimatedCost: number | null;
  actualCost: number | null;
  notes: string | null;
  orderIndex: number;
}

export type ActivityType =
  | 'ATTRACTION'
  | 'DINING'
  | 'ACCOMMODATION'
  | 'TRANSPORTATION'
  | 'ACTIVITY'
  | 'SHOPPING'
  | 'OTHER';

export interface TripWithItinerary extends Trip {
  itinerary_days: ItineraryDay[];
  trip_members: TripMember[];
  _count: {
    ai_conversations: number;
  };
}

export interface TripMember {
  id: string;
  user: {
    id: string;
    name: string;
    display_name: string;
    avatar_url: string | null;
  };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateTripRequest {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  travelersCount?: number;
  budgetTotal?: number;
  budgetCurrency?: string;
  coverImageUrl?: string;
}

export interface UpdateTripRequest {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  travelersCount?: number;
  budgetTotal?: number;
  budgetCurrency?: string;
  status?: TripStatus;
  visibility?: TripVisibility;
  coverImageUrl?: string;
}

export interface ApplyDraftRequest {
  createNew?: boolean;
  existingTripId?: string;
}

export interface AIModifyRequest {
  message: string;
  conversationId?: string;
}

export interface CreateActivityRequest {
  name: string;
  type?: ActivityType;
  description?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  latitude?: number;
  longitude?: number;
  estimatedCost?: number;
}

export interface ReorderActivitiesRequest {
  activityIds: string[];
}
```

### API Service Example

```typescript
// services/tripApi.ts

import axios from 'axios';
import type {
  Trip,
  TripWithItinerary,
  Activity,
  CreateTripRequest,
  UpdateTripRequest,
  ApplyDraftRequest,
  AIModifyRequest,
  CreateActivityRequest,
  ReorderActivitiesRequest,
  ApiResponse,
  PaginatedResponse,
} from '../types/trip';

const API_BASE = '/api/trips';

export const tripApi = {
  // Trip CRUD
  async createTrip(data: CreateTripRequest): Promise<ApiResponse<{ trip: Trip }>> {
    const response = await axios.post(API_BASE, data);
    return response.data;
  },

  async listTrips(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ trips: Trip[]; pagination: PaginatedResponse<Trip>['pagination'] }>> {
    const response = await axios.get(API_BASE, { params });
    return response.data;
  },

  async getTrip(id: string): Promise<ApiResponse<{ trip: TripWithItinerary }>> {
    const response = await axios.get(`${API_BASE}/${id}`);
    return response.data;
  },

  async updateTrip(id: string, data: UpdateTripRequest): Promise<ApiResponse<{ trip: Trip }>> {
    const response = await axios.patch(`${API_BASE}/${id}`, data);
    return response.data;
  },

  async deleteTrip(id: string): Promise<ApiResponse<null>> {
    const response = await axios.delete(`${API_BASE}/${id}`);
    return response.data;
  },

  // AI Draft
  async applyDraft(
    draftId: string,
    data: ApplyDraftRequest
  ): Promise<ApiResponse<{ trip: TripWithItinerary }>> {
    const response = await axios.post(`${API_BASE}/drafts/${draftId}/apply`, data);
    return response.data;
  },

  // AI Modify
  async modifyWithAI(
    tripId: string,
    data: AIModifyRequest
  ): Promise<ApiResponse<{ trip: TripWithItinerary; changes: any }>> {
    const response = await axios.post(`${API_BASE}/${tripId}/ai-modify`, data);
    return response.data;
  },

  // Activities
  async addActivity(
    tripId: string,
    dayId: string,
    data: CreateActivityRequest
  ): Promise<ApiResponse<{ activity: Activity }>> {
    const response = await axios.post(
      `${API_BASE}/${tripId}/days/${dayId}/activities`,
      data
    );
    return response.data;
  },

  async updateActivity(
    tripId: string,
    activityId: string,
    data: Partial<CreateActivityRequest>
  ): Promise<ApiResponse<{ activity: Activity }>> {
    const response = await axios.patch(
      `${API_BASE}/${tripId}/activities/${activityId}`,
      data
    );
    return response.data;
  },

  async deleteActivity(tripId: string, activityId: string): Promise<ApiResponse<null>> {
    const response = await axios.delete(
      `${API_BASE}/${tripId}/activities/${activityId}`
    );
    return response.data;
  },

  async reorderActivities(
    tripId: string,
    dayId: string,
    data: ReorderActivitiesRequest
  ): Promise<ApiResponse<null>> {
    const response = await axios.patch(
      `${API_BASE}/${tripId}/days/${dayId}/activities/reorder`,
      data
    );
    return response.data;
  },
};
```

### React Hook Example

```typescript
// hooks/useTrip.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripApi } from '../services/tripApi';

export const useTrips = (params?: { status?: string; page?: number }) => {
  return useQuery({
    queryKey: ['trips', params],
    queryFn: () => tripApi.listTrips(params),
  });
};

export const useTrip = (id: string) => {
  return useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripApi.getTrip(id),
    enabled: !!id,
  });
};

export const useCreateTrip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tripApi.createTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
};

export const useUpdateTrip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      tripApi.updateTrip(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
};

export const useApplyDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: any }) =>
      tripApi.applyDraft(draftId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
};

export const useModifyTripWithAI = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, data }: { tripId: string; data: any }) =>
      tripApi.modifyWithAI(tripId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip', variables.tripId] });
    },
  });
};
```

---

## File Structure Reference

```
src/modules/trip/
├── domain/
│   └── entities/
│       └── Trip.js              # Trip entity với business logic
├── application/
│   ├── services/
│   │   └── TripService.js       # Business logic services
│   └── useCases/
│       ├── CreateTripUseCase.js
│       ├── ApplyAIDraftUseCase.js
│       └── ModifyTripWithAIUseCase.js
├── infrastructure/
│   └── repositories/
│       ├── TripRepository.js
│       ├── ItineraryDayRepository.js
│       ├── ActivityRepository.js
│       └── AIItineraryDraftRepository.js
└── interfaces/
    └── http/
        ├── tripRoutes.js        # Route definitions
        └── tripController.js    # HTTP handlers
```
