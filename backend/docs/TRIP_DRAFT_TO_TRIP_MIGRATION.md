# Trip Draft to Trip Migration - Cải tiến Apply Draft

## 📋 Tổng quan

Tài liệu này phân tích cấu trúc dữ liệu của Trip Plan (AI Draft) và Trip, đồng thời đề xuất cải tiến cho quy trình apply draft.

---

## 🗂️ Cấu trúc dữ liệu hiện tại

### 1. AI Draft Data (generatedData JSON)

Được generate bởi `TripPlannerService.generateItinerary()`:

```javascript
{
  // Metadata
  metadata: {
    generatedAt: "2024-01-01T00:00:00.000Z",
    algorithm: "atrips-v2",
    version: "2.0.0"
  },

  // Thông tin chuyến đi
  trip: {
    destination: "Đà Nẵng",           // ⚠️ QUAN TRỌNG - Không được lưu!
    startDate: "2024-06-01",
    endDate: "2024-06-05",
    duration: "5 ngày 4 đêm",
    travelers: 2,
    travelStyle: "comfort"            // ⚠️ Không được lưu
  },

  // Ngân sách
  budget: {
    total: 10000000,                  // ✅ Được lưu (budgetTotal)
    perDay: 2000000,
    currency: "VND",                  // ✅ Được lưu (budgetCurrency)
    breakdown: {                      // ⚠️ Chi tiết không được lưu
      accommodation: 3500000,
      food: 2500000,
      activities: 2500000,
      transport: 1000000,
      miscellaneous: 500000
    }
  },

  // Tóm tắt
  summary: {
    totalPlaces: 15,
    totalDistance: 125.5,
    selectionStats: {
      totalValue: 450.5,
      timeUtilization: 0.85,
      budgetUtilization: 0.92
    },
    totalTravelTime: 180,
    avgPlacesPerDay: 3.0
  },

  // Lịch trình từng ngày
  days: [
    {
      dayNumber: 1,
      date: "2024-06-01",
      theme: "Tham quan & khám phá",
      schedule: [
        {
          time: "08:00",
          endTime: "09:00",
          type: "meal",
          mealType: "breakfast",
          suggestion: "Bún chả cá Nha Trang",
          duration: 60
        },
        {
          time: "09:30",
          endTime: "11:30",
          type: "ATTRACTION",
          name: "Bảo tàng Chăm",
          address: "Số 2 Đường 2 Tháng 9",
          duration: 120,
          estimatedCost: 50000,
          rating: 4.5,
          coordinates: {
            lat: 16.0544,
            lng: 108.2022
          }
        },
        {
          time: "11:30",
          endTime: "11:45",
          type: "transport",
          from: "Bảo tàng Chăm",
          to: "Nhà hàng hải sản",
          duration: 15,
          mode: "car"
        }
        // ... more activities
      ],
      statistics: {
        totalActivities: 6,
        totalTravelTime: 45,
        estimatedCost: 500000
      },
      route: {
        totalDistance: 25.5,
        optimizationAlgorithm: "two_opt"
      }
    }
    // ... more days
  ],

  // Gợi ý
  tips: [
    "Mang theo tiền mặt vì một số địa điểm ở Đà Nẵng có thể không nhận thẻ",
    "Đặt trước vé tham quan các điểm nổi tiếng để tránh xếp hàng"
  ],

  // Danh sách đồ cần mang
  packingList: {
    essentials: ["Giấy tờ tùy thân", "Điện thoại và sạc"],
    clothing: ["3 bộ quần áo", "Áo khoác nhẹ"],
    accessories: ["Kem chống nắng", "Mũ/nón", "Kính mát"],
    optional: ["Đồ bơi", "Khăn tắm"]
  }
}
```

### 2. Trips Table Schema (Prisma)

```prisma
model trips {
  id                  String             @id @default(uuid())
  ownerId             String
  tenantId            String?

  // Thông tin cơ bản
  title               String             // ✅
  description         String?            // ✅
  coverImageUrl       String?            // Không có trong draft

  // Thời gian
  startDate           DateTime           @db.Date  // ✅
  endDate             DateTime           @db.Date  // ✅

  // Người tham gia & ngân sách
  travelersCount      Int                @default(1)  // ✅
  budgetTotal         Decimal?           @db.Decimal(12, 2)  // ✅
  budgetCurrency      String             @default("USD")     // ✅

  // Trạng thái
  status              TripStatus         @default(DRAFT)     // ✅
  visibility          TripVisibility     @default(PRIVATE)   // ✅

  shareToken          String?            @unique
  deletedAt           DateTime?
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  // Relations
  itinerary_days      itinerary_days[]
  trip_members        trip_members[]
  expenses            expenses[]
  // ... more relations
}
```

**⚠️ VẤN ĐỀ:**
- Trips table **KHÔNG có field `destination`**
- Trips table **KHÔNG có field `travelStyle`**
- Budget breakdown chi tiết không được lưu
- Tips và packing list không được lưu

---

## 🔍 Logic Apply Draft hiện tại

### Flow hiện tại:

```
1. User tạo draft qua AI chat
   └─> generatedData được lưu vào ai_itinerary_drafts.generatedData (JSON)

2. User click "Apply Draft"
   └─> ApplyAIDraftUseCase.execute()
       ├─> Parse draft: TripService.parseAIDraftToTripData()
       │   ├─> Extract: title, destination, description
       │   ├─> Extract: startDate, endDate, travelersCount
       │   ├─> Extract: budgetTotal, budgetCurrency
       │   └─> Set: status=DRAFT, visibility=PRIVATE
       │
       ├─> Create Trip: TripRepository.createTrip()
       │   └─> ⚠️ destination bị BỎ QUA (không có trong schema)
       │
       ├─> Create Itinerary Days
       │   └─> Loop generatedData.days[]
       │       ├─> Create itinerary_day
       │       └─> Create activities[] from schedule
       │
       └─> Mark draft as applied
```

### Code hiện tại:

**TripService.parseAIDraftToTripData()** (line 133-152):
```javascript
parseAIDraftToTripData(draftData) {
  const generatedData = typeof draftData === 'string'
    ? JSON.parse(draftData) : draftData;
  const tripInfo = generatedData.trip || generatedData;
  const budgetInfo = generatedData.budget || {};

  return {
    title: tripInfo.title || tripInfo.destination || 'AI Generated Trip',
    destination: tripInfo.destination || null,  // ⚠️ Parse nhưng không lưu được
    description: tripInfo.description || null,
    startDate: tripInfo.startDate || generatedData.startDate,
    endDate: tripInfo.endDate || generatedData.endDate,
    travelersCount: tripInfo.travelers || 1,
    budgetTotal: budgetInfo.total || null,
    budgetCurrency: budgetInfo.currency || 'VND',
    status: 'DRAFT',
    visibility: 'PRIVATE',
  };
}
```

**TripRepository.createTrip()** (line 190-211):
```javascript
async createTrip(tripData, ownerId) {
  const data = {
    owner_id: ownerId,
    title: tripData.title,
    description: tripData.description,
    start_date: new Date(tripData.startDate),
    end_date: new Date(tripData.endDate),
    travelers_count: tripData.travelersCount || 1,
    budget_total: tripData.budgetTotal,
    budget_currency: tripData.budgetCurrency || 'VND',
    status: tripData.status || 'DRAFT',
    visibility: tripData.visibility || 'PRIVATE',
    cover_image_url: tripData.coverImageUrl,
    // ⚠️ tripData.destination bị bỏ qua
  };

  const trip = await prisma.trip.create({ data });
  return Trip.fromPersistence(trip);
}
```

---

## 🎯 Giải pháp đề xuất

### Option 1: Thêm fields mới vào Trips table (Khuyến nghị)

**Ưu điểm:**
- Đơn giản, rõ ràng
- Dễ query và filter
- Chuẩn hóa dữ liệu

**Thêm các fields:**

```prisma
model trips {
  // ... existing fields

  // Thêm mới
  destination         String?            // Đích đến chính
  travelStyle         String?            // budget|comfort|luxury|adventure|cultural
  budgetBreakdown     Json?              // Chi tiết phân bổ ngân sách
  tripMetadata        Json?              // Tips, packing list, summary stats

  // ... existing fields
}
```

**Migration plan:**

1. **Tạo migration file:**
```bash
npx prisma migrate dev --name add_trip_destination_and_metadata
```

2. **Migration SQL:**
```sql
ALTER TABLE trips
  ADD COLUMN destination VARCHAR(255),
  ADD COLUMN travel_style VARCHAR(50),
  ADD COLUMN budget_breakdown JSONB,
  ADD COLUMN trip_metadata JSONB;

CREATE INDEX idx_trips_destination ON trips(destination);
CREATE INDEX idx_trips_travel_style ON trips(travel_style);
```

3. **Update code:**

**TripService.parseAIDraftToTripData():**
```javascript
parseAIDraftToTripData(draftData) {
  const generatedData = typeof draftData === 'string'
    ? JSON.parse(draftData) : draftData;
  const tripInfo = generatedData.trip || generatedData;
  const budgetInfo = generatedData.budget || {};

  return {
    // Basic info
    title: tripInfo.title || `Chuyến đi ${tripInfo.destination}` || 'AI Generated Trip',
    destination: tripInfo.destination || null,  // ✅ Sẽ được lưu
    description: tripInfo.description || generatedData.summary?.overview || null,

    // Dates & travelers
    startDate: tripInfo.startDate || generatedData.startDate,
    endDate: tripInfo.endDate || generatedData.endDate,
    travelersCount: tripInfo.travelers || 1,

    // Budget
    budgetTotal: budgetInfo.total || null,
    budgetCurrency: budgetInfo.currency || 'VND',
    budgetBreakdown: budgetInfo.breakdown || null,  // ✅ Chi tiết

    // Style & metadata
    travelStyle: tripInfo.travelStyle || null,  // ✅ Lưu travel style
    tripMetadata: {
      summary: generatedData.summary || null,
      tips: generatedData.tips || [],
      packingList: generatedData.packingList || null,
      algorithm: generatedData.metadata?.algorithm || 'atrips-v2',
    },

    // Status
    status: 'DRAFT',
    visibility: 'PRIVATE',
  };
}
```

**TripRepository.createTrip():**
```javascript
async createTrip(tripData, ownerId) {
  const data = {
    owner_id: ownerId,
    title: tripData.title,
    destination: tripData.destination,           // ✅ NEW
    description: tripData.description,
    start_date: new Date(tripData.startDate),
    end_date: new Date(tripData.endDate),
    travelers_count: tripData.travelersCount || 1,
    budget_total: tripData.budgetTotal,
    budget_currency: tripData.budgetCurrency || 'VND',
    budget_breakdown: tripData.budgetBreakdown,  // ✅ NEW
    travel_style: tripData.travelStyle,          // ✅ NEW
    trip_metadata: tripData.tripMetadata,        // ✅ NEW
    status: tripData.status || 'DRAFT',
    visibility: tripData.visibility || 'PRIVATE',
    cover_image_url: tripData.coverImageUrl,
  };

  const trip = await prisma.trip.create({ data });
  return Trip.fromPersistence(trip);
}
```

---

### Option 2: Sử dụng trip_cities table (Phức tạp hơn)

**Ưu điểm:**
- Không cần migration trips table
- Hỗ trợ multi-city trips

**Nhược điểm:**
- Phức tạp hơn
- Query destination cần JOIN
- Không phù hợp cho single destination

```javascript
// Trong ApplyAIDraftUseCase.execute()
// Sau khi create trip
if (tripData.destination) {
  await prisma.trip_cities.create({
    data: {
      tripId: trip.id,
      cityName: tripData.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      orderIndex: 0,
    }
  });
}
```

---

### Option 3: Lưu trong title/description (Không khuyến nghị)

Chỉ sử dụng nếu không muốn thay đổi schema:

```javascript
title: `Chuyến đi ${tripInfo.destination}`,
description: `Khám phá ${tripInfo.destination} từ ${startDate} đến ${endDate}...`
```

**Nhược điểm:**
- Khó query theo destination
- Không chuẩn hóa
- Khó filter và search

---

## 🚀 Tính năng bổ sung khi Apply Draft

### 1. Cho phép user customize trước khi apply

Thay đổi API endpoint từ:
```
POST /api/trips/apply-draft/:draftId
```

Thành:
```
POST /api/trips/apply-draft/:draftId
Body: {
  "customizations": {
    "title": "Custom Title",         // Optional
    "coverImageUrl": "url",          // Optional
    "visibility": "PUBLIC",          // Optional
    "addNotes": "Personal notes",    // Optional
    "travelersCount": 3              // Optional override
  }
}
```

**Update ApplyAIDraftUseCase.execute():**
```javascript
async execute({
  draftId,
  userId,
  createNew = true,
  existingTripId = null,
  customizations = {}  // ✅ NEW
}) {
  // ... existing code

  const tripData = tripService.parseAIDraftToTripData(draft.generated_data);

  // Apply customizations
  if (customizations.title) {
    tripData.title = customizations.title;
  }
  if (customizations.coverImageUrl) {
    tripData.coverImageUrl = customizations.coverImageUrl;
  }
  if (customizations.visibility) {
    tripData.visibility = customizations.visibility;
  }
  if (customizations.travelersCount) {
    tripData.travelersCount = customizations.travelersCount;
  }

  // ... continue with create trip
}
```

### 2. Lưu thêm metadata

```javascript
tripMetadata: {
  // AI generation info
  generatedBy: 'gemini-pro',
  algorithm: 'atrips-v2',
  generatedAt: draft.createdAt,

  // Trip summary
  summary: {
    totalPlaces: 15,
    totalDistance: 125.5,
    avgPlacesPerDay: 3.0,
  },

  // AI recommendations
  tips: [
    "Mang theo tiền mặt",
    "Đặt trước vé tham quan"
  ],

  // Packing suggestions
  packingList: {
    essentials: [...],
    clothing: [...],
    accessories: [...],
    optional: [...]
  },

  // User notes (can be added later)
  userNotes: ""
}
```

### 3. Support preview trước khi apply

```
GET /api/drafts/:draftId/preview
Response: {
  "draft": {...},
  "parsedTripData": {...},
  "estimatedDays": 5,
  "estimatedActivities": 20,
  "conflicts": []  // Nếu có conflict với existing trips
}
```

---

## 📝 Implementation Checklist

### Phase 1: Database Migration
- [ ] Tạo migration thêm fields: `destination`, `travel_style`, `budget_breakdown`, `trip_metadata`
- [ ] Chạy migration trên staging
- [ ] Test backward compatibility
- [ ] Chạy migration trên production

### Phase 2: Backend Code Updates
- [ ] Update Prisma schema
- [ ] Update `TripService.parseAIDraftToTripData()`
- [ ] Update `TripRepository.createTrip()`
- [ ] Update `TripRepository.updateTrip()`
- [ ] Update Trip entity/model

### Phase 3: Apply Draft Enhancements
- [ ] Update `ApplyAIDraftUseCase` để support customizations
- [ ] Add validation cho customizations
- [ ] Add preview endpoint
- [ ] Update API documentation

### Phase 4: Testing
- [ ] Unit tests cho parse logic
- [ ] Integration tests cho apply draft flow
- [ ] Test với existing drafts (backward compatibility)
- [ ] Test customizations
- [ ] Test preview endpoint

### Phase 5: Frontend Integration
- [ ] Update apply draft UI
- [ ] Add customization form
- [ ] Add preview before apply
- [ ] Update trip detail page để show metadata

---

## 🔄 Backward Compatibility

Để đảm bảo drafts cũ vẫn hoạt động:

```javascript
parseAIDraftToTripData(draftData) {
  const generatedData = typeof draftData === 'string'
    ? JSON.parse(draftData) : draftData;

  // Support old format
  if (!generatedData.trip && !generatedData.destination) {
    return this.parseOldDraftFormat(generatedData);
  }

  // New format
  return this.parseNewDraftFormat(generatedData);
}
```

---

## 📊 Example Usage

### Before (Current):
```javascript
// Trip được tạo thiếu thông tin
{
  "id": "uuid",
  "title": "AI Generated Trip",  // Generic title
  "destination": null,            // ❌ Lost
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "budgetTotal": 10000000,
  "budgetCurrency": "VND"
}
```

### After (Improved):
```javascript
{
  "id": "uuid",
  "title": "Chuyến đi Đà Nẵng",
  "destination": "Đà Nẵng",      // ✅ Saved
  "travelStyle": "comfort",       // ✅ Saved
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "budgetTotal": 10000000,
  "budgetCurrency": "VND",
  "budgetBreakdown": {            // ✅ Saved
    "accommodation": 3500000,
    "food": 2500000,
    "activities": 2500000
  },
  "tripMetadata": {               // ✅ Saved
    "summary": {...},
    "tips": [...],
    "packingList": {...}
  }
}
```

---

## 🎓 Best Practices

1. **Validation:** Validate tất cả customizations trước khi apply
2. **Audit Log:** Log changes khi apply draft với customizations
3. **Versioning:** Lưu version của algorithm để support future changes
4. **Error Handling:** Handle gracefully khi draft data bị corrupt
5. **Performance:** Cache parsed draft data nếu preview nhiều lần

---

## 📚 Related Files

- `src/modules/ai/domain/algorithms/TripPlannerService.js` - Generate draft
- `src/modules/trip/application/services/TripService.js` - Parse draft
- `src/modules/trip/application/useCases/ApplyAIDraftUseCase.js` - Apply logic
- `src/modules/trip/infrastructure/repositories/TripRepository.js` - Database operations
- `prisma/schema.prisma` - Database schema

---

**Last Updated:** 2026-02-04
**Author:** System Analysis
**Status:** 📝 Pending Implementation
