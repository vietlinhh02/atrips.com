# Phase 1 Testing Guide

## 🧪 API Testing với Postman/curl

### Prerequisites
```bash
# 1. Start the server
npm run dev

# 2. Get authentication token
# Login hoặc register để lấy JWT token
POST http://localhost:3000/api/auth/login
{
  "email": "your@email.com",
  "password": "your_password"
}

# 3. Set token in headers
Authorization: Bearer <your_jwt_token>
```

---

## 📋 Test Scenarios

### **1. Create Trip with Phase 1 Data (via AI)**

```bash
# Step 1: Start AI conversation
POST http://localhost:3000/api/ai/chat
Content-Type: application/json
Authorization: Bearer <token>

{
  "message": "Tạo cho tôi 1 plan đi Ninh Bình 2 ngày 3 đêm cho 5 người với kinh phí 1 triệu/người"
}

# Response will include draftId and auto-created tripId
```

**Expected Response:**
```json
{
  "success": true,
  "action": "trip_created",
  "tripId": "uuid-here",
  "draftId": "uuid-here",
  "trip": {
    "title": "Ninh Bình 2 Ngày 3 Đêm...",
    "startDate": "2026-02-06",
    "endDate": "2026-02-08",
    "daysCount": 3
  }
}
```

---

### **2. Get Trip Overview**

```bash
GET http://localhost:3000/api/trips/:tripId/overview
Authorization: Bearer <token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "summary": "A perfect 7-day trip exploring Munich and Berlin...",
      "highlights": [
        "Oktoberfest in Munich",
        "Brandenburg Gate",
        "Neuschwanstein Castle"
      ],
      "weather": {
        "avgTemp": 22,
        "condition": "Partly cloudy",
        "season": "Summer"
      },
      "culturalNotes": "Germany is known for...",
      "bestTimeToVisit": "May to September"
    }
  }
}
```

---

### **3. Update Trip Overview**

```bash
PUT http://localhost:3000/api/trips/:tripId/overview
Content-Type: application/json
Authorization: Bearer <token>

{
  "summary": "Updated summary...",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "weather": {
    "avgTemp": 25,
    "condition": "Sunny",
    "season": "Summer"
  }
}
```

---

### **4. Get Transportation Details**

```bash
GET http://localhost:3000/api/trips/:tripId/transportation
Authorization: Bearer <token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalDistance": 45.8,
    "totalDuration": 180,
    "totalCost": 450000,
    "days": [
      {
        "dayId": "uuid",
        "date": "2026-02-06",
        "dayNumber": 1,
        "totalDistance": 15.3,
        "totalDuration": 60,
        "totalCost": 150000,
        "segments": [
          {
            "from": "Chùa Bái Đính",
            "to": "Tam Cốc",
            "distance": 8.5,
            "duration": 25,
            "mode": "TAXI",
            "cost": 85000,
            "instructions": "Di chuyển bằng taxi..."
          }
        ]
      }
    ]
  }
}
```

---

### **5. Recalculate Routes After Changes**

```bash
POST http://localhost:3000/api/trips/:tripId/recalculate-routes
Content-Type: application/json
Authorization: Bearer <token>

{
  "dayIds": ["day-uuid-1", "day-uuid-2"]
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "updatedActivities": 12
  },
  "message": "Successfully recalculated transportation for 12 activities"
}
```

---

### **6. Get Budget Breakdown**

```bash
GET http://localhost:3000/api/trips/:tripId/budget-breakdown
Authorization: Bearer <token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "planned": {
      "accommodation": { "total": 3500000, "perDay": 500000 },
      "food": { "total": 2100000, "perDay": 300000 },
      "transportation": { "total": 700000, "perDay": 100000 },
      "activities": { "total": 1400000, "perDay": 200000 },
      "miscellaneous": { "total": 350000, "perDay": 50000 }
    },
    "actual": {
      "accommodation": 3200000,
      "food": 2500000,
      "transportation": 650000,
      "activities": 1500000,
      "miscellaneous": 300000
    },
    "totalPlanned": 8050000,
    "totalActual": 8150000,
    "currency": "VND",
    "differences": {
      "accommodation": {
        "planned": 3500000,
        "actual": 3200000,
        "difference": -300000,
        "percentage": "-8.6"
      },
      "food": {
        "planned": 2100000,
        "actual": 2500000,
        "difference": 400000,
        "percentage": "19.0"
      }
    }
  }
}
```

---

### **7. Get Travel Tips**

```bash
GET http://localhost:3000/api/trips/:tripId/tips
Authorization: Bearer <token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tips": {
      "general": [
        "Bring comfortable walking shoes",
        "Download offline maps"
      ],
      "transportation": [
        "Buy Bayern ticket for trains",
        "Use MVV app in Munich"
      ],
      "food": [
        "Try traditional beer gardens",
        "Book restaurants in advance"
      ],
      "safety": [
        "Watch for pickpockets at tourist spots"
      ],
      "budget": [
        "Supermarkets cheaper than restaurants"
      ]
    }
  }
}
```

---

### **8. Create Booking**

```bash
POST http://localhost:3000/api/trips/:tripId/bookings
Content-Type: application/json
Authorization: Bearer <token>

{
  "bookingType": "HOTEL",
  "provider": "Booking.com",
  "confirmationCode": "BKG123456",
  "title": "Hilton Munich City",
  "description": "Deluxe room with city view",
  "checkInDate": "2026-02-06",
  "checkOutDate": "2026-02-08",
  "checkInTime": "14:00",
  "checkOutTime": "12:00",
  "totalCost": 3500000,
  "currency": "VND",
  "guestsCount": 2,
  "guestNames": ["John Doe", "Jane Doe"],
  "address": "Rosenheimer Str. 15, Munich",
  "contactPhone": "+49 89 123456",
  "contactEmail": "reservation@hilton.com",
  "details": {
    "roomType": "Deluxe King",
    "bedType": "King",
    "amenities": ["WiFi", "Breakfast", "Gym"]
  }
}
```

---

### **9. List Bookings**

```bash
GET http://localhost:3000/api/trips/:tripId/bookings
Authorization: Bearer <token>

# Filter by type
GET http://localhost:3000/api/trips/:tripId/bookings?type=HOTEL

# Filter by status
GET http://localhost:3000/api/trips/:tripId/bookings?status=CONFIRMED
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "uuid",
        "bookingType": "HOTEL",
        "provider": "Booking.com",
        "confirmationCode": "BKG123456",
        "title": "Hilton Munich City",
        "status": "CONFIRMED",
        "checkInDate": "2026-02-06",
        "checkOutDate": "2026-02-08",
        "totalCost": 3500000,
        "currency": "VND",
        "paymentStatus": "PAID"
      }
    ],
    "total": 1
  }
}
```

---

### **10. Update Booking**

```bash
PUT http://localhost:3000/api/bookings/:bookingId
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "CONFIRMED",
  "confirmationCode": "BKG123456-UPDATED",
  "totalCost": 3200000
}
```

---

### **11. Update Booking Status**

```bash
PUT http://localhost:3000/api/bookings/:bookingId/status
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "CONFIRMED"
}
```

---

### **12. Update Payment Status**

```bash
PUT http://localhost:3000/api/bookings/:bookingId/payment-status
Content-Type: application/json
Authorization: Bearer <token>

{
  "paymentStatus": "PAID"
}
```

---

### **13. Delete Booking**

```bash
DELETE http://localhost:3000/api/bookings/:bookingId
Authorization: Bearer <token>
```

---

## 🔍 Database Verification

```sql
-- Check if trip has Phase 1 data
SELECT
  id, title,
  overview::text as overview_json,
  metadata::text as metadata_json
FROM trips
WHERE id = 'your-trip-id';

-- Check activities with transportation
SELECT
  id, name,
  transport_from_previous::text as transport_json
FROM activities
WHERE itinerary_day_id IN (
  SELECT id FROM itinerary_days WHERE trip_id = 'your-trip-id'
)
ORDER BY order_index;

-- Check bookings
SELECT * FROM trip_bookings WHERE trip_id = 'your-trip-id';

-- Check accommodation details
SELECT
  aa.*, a.name as activity_name
FROM accommodation_activities aa
JOIN activities a ON aa.activity_id = a.id
WHERE a.itinerary_day_id IN (
  SELECT id FROM itinerary_days WHERE trip_id = 'your-trip-id'
);
```

---

## ✅ Test Checklist

### Phase 1 Features
- [ ] Trip overview created by AI
- [ ] Overview can be retrieved via API
- [ ] Overview can be updated
- [ ] Transportation calculated between activities
- [ ] Transportation API returns correct data
- [ ] Routes can be recalculated after reordering
- [ ] Budget breakdown available
- [ ] Actual expenses compared with planned
- [ ] Travel tips available by category
- [ ] Tips can be updated
- [ ] Bookings can be created (all types)
- [ ] Bookings can be listed and filtered
- [ ] Bookings can be updated
- [ ] Booking status can be changed
- [ ] Payment status can be updated
- [ ] Bookings can be deleted (soft delete)

### Data Integrity
- [ ] Overview stored in trips.overview
- [ ] Tips stored in trips.metadata.tips
- [ ] Budget breakdown in trips.metadata.budgetBreakdown
- [ ] Transportation in activities.transport_from_previous
- [ ] Bookings in trip_bookings table
- [ ] Accommodation details in accommodation_activities

---

## 🐛 Common Issues & Solutions

### 1. **"Trip not found" error**
- Verify tripId exists
- Check user has access to the trip
- Ensure trip not soft-deleted

### 2. **Transportation showing null/0**
- Verify activities have lat/lng coordinates
- Check at least 2 activities exist in the day
- Run recalculate-routes endpoint

### 3. **Budget differences not showing**
- Ensure budgetBreakdown exists in metadata
- Create some expenses to see actual vs planned
- Check expense categories match budget categories

### 4. **Booking creation fails**
- Verify required fields: title, bookingType
- Check enum values match schema (BookingType, BookingStatus, PaymentStatus)
- Ensure tripId exists and user owns it

---

## 📊 Performance Testing

```bash
# Test with multiple days/activities
# Create a trip with 7 days, 30+ activities
# Then test transportation API performance

time curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/trips/:tripId/transportation

# Expected: < 500ms for 30 activities
```

---

## 🚀 Next Steps (Phase 2)

After Phase 1 is verified:
- [ ] Reviews & Media Links (YouTube/TikTok)
- [ ] Review Summaries (AI-generated)
- [ ] Team Chat (WebSocket)
- [ ] Packing List
- [ ] Emergency Info

---

**Last Updated:** 2026-02-06
