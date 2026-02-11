# ATrips Authentication API Integration Guide

## Base URL
```
/api/auth    - Authentication endpoints
/api/users   - User profile endpoints
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Success message",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Validation Error (422)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        { "msg": "Error message", "path": "fieldName" }
      ]
    }
  }
}
```

---

## 1. REGISTER - Đăng ký tài khoản

### Endpoint
```
POST /api/auth/register
```

### Request Body
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "name": "Nguyen Van A"  // optional, max 100 chars
}
```

### Validation Rules
| Field | Rules |
|-------|-------|
| email | Required, valid email format |
| password | Min 8 chars, 1 uppercase, 1 lowercase, 1 number |
| name | Optional, max 100 characters |

### Success Response (201)
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Nguyen Van A",
      "displayName": "Nguyen Van A",
      "avatarUrl": null,
      "bio": null,
      "emailVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Cookies Set
- `access_token`: JWT access token (HttpOnly)
- `refresh_token`: JWT refresh token (HttpOnly)

### Error Responses
| Status | Code | Message |
|--------|------|---------|
| 409 | EMAIL_ALREADY_EXISTS | Email already registered |
| 422 | VALIDATION_ERROR | Validation failed |

---

## 2. LOGIN - Đăng nhập

### Endpoint
```
POST /api/auth/login
```

### Request Body
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Nguyen Van A",
      "displayName": "Nguyen Van A",
      "avatarUrl": "https://...",
      "bio": "Bio text",
      "emailVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Cookies Set
- `access_token`: JWT access token (HttpOnly)
- `refresh_token`: JWT refresh token (HttpOnly)

### Error Responses
| Status | Code | Message |
|--------|------|---------|
| 401 | INVALID_CREDENTIALS | Invalid email or password |
| 403 | ACCOUNT_DISABLED | Account has been disabled |
| 403 | EMAIL_NOT_VERIFIED | Please verify your email first |
| 400 | BAD_REQUEST | This account was created with Google. Please use Google to sign in. |

---

## 3. LOGOUT - Đăng xuất

### Endpoint
```
POST /api/auth/logout
```

### Request
- No body required
- Refresh token sent via cookie

### Success Response (200)
```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

### Side Effects
- Invalidates current session
- Clears auth cookies

---

## 4. REFRESH TOKEN - Làm mới token

### Endpoint
```
POST /api/auth/refresh
```

### Request
- No body required
- Refresh token sent via cookie

### Success Response (200)
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      ...
    }
  }
}
```

### Cookies Updated
- New `access_token`
- New `refresh_token` (token rotation)

### Error Responses
| Status | Code | Message |
|--------|------|---------|
| 401 | INVALID_TOKEN | Invalid or missing refresh token |
| 401 | TOKEN_EXPIRED | Refresh token has expired |

---

## 5. FORGOT PASSWORD - Quên mật khẩu

### Endpoint
```
POST /api/auth/forgot-password
```

### Request Body
```json
{
  "email": "user@example.com"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "If an account exists with this email, you will receive a password reset link.",
  "data": null
}
```

> **Note:** Always returns success to prevent email enumeration attacks

### Side Effects
- Sends password reset email (if account exists)
- Creates reset token valid for limited time

---

## 6. RESET PASSWORD - Đặt lại mật khẩu

### Endpoint
```
POST /api/auth/reset-password
```

### Request Body
```json
{
  "token": "reset_token_from_email_link",
  "password": "NewPassword123"
}
```

### Validation Rules
| Field | Rules |
|-------|-------|
| token | Required, min 32 chars |
| password | Min 8 chars, 1 uppercase, 1 lowercase, 1 number |

### Success Response (200)
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password.",
  "data": null
}
```

### Side Effects
- Updates password
- Invalidates ALL existing sessions (security)
- Clears auth cookies

### Error Responses
| Status | Code | Message |
|--------|------|---------|
| 400 | INVALID_TOKEN | Invalid reset token |
| 400 | TOKEN_EXPIRED | Reset token has expired |
| 400 | BAD_REQUEST | This reset link has already been used |
| 404 | NOT_FOUND | User not found |

---

## 7. VERIFY EMAIL - Xác minh email

### Endpoint
```
GET /api/auth/verify-email/:token
```

### URL Parameters
| Param | Description |
|-------|-------------|
| token | Email verification token from email link |

### Success Response (200)
```json
{
  "success": true,
  "message": "Email verified successfully. You can now use all features.",
  "data": {
    "alreadyVerified": false
  }
}
```

### Already Verified Response (200)
```json
{
  "success": true,
  "message": "Email has already been verified.",
  "data": {
    "alreadyVerified": true
  }
}
```

### Error Responses
| Status | Code | Message |
|--------|------|---------|
| 400 | INVALID_TOKEN | Invalid verification token |
| 400 | TOKEN_EXPIRED | Verification token has expired |
| 400 | BAD_REQUEST | This verification link has already been used |

---

## 8. GOOGLE OAUTH - Đăng nhập Google

### Step 1: Initiate OAuth
```
GET /api/auth/google
```
> Redirects user to Google OAuth consent screen

### Step 2: OAuth Callback (handled automatically)
```
GET /api/auth/google/callback
```

### Redirect Behavior
| Condition | Redirect URL |
|-----------|--------------|
| New user | `{frontendUrl}/onboarding` |
| Existing user | `{frontendUrl}/dashboard` |
| Auth failed | `{frontendUrl}/auth/callback?error=authentication_failed` |

### Cookies Set (on success)
- `access_token`: JWT access token (HttpOnly)
- `refresh_token`: JWT refresh token (HttpOnly)

---

## 9. GET CURRENT USER - Lấy thông tin user hiện tại

### Endpoint
```
GET /api/auth/me
```

### Headers Required
```
Authorization: Bearer {access_token}
```
Or cookie `access_token` is set

### Success Response (200)
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Nguyen Van A",
      "displayName": "Nguyen Van A",
      "avatarUrl": "https://...",
      "bio": "Bio text",
      "emailVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

## 10. GET PROFILE - Lấy profile đầy đủ

### Endpoint
```
GET /api/users/me
GET /api/users/profile
```

### Headers Required
```
Authorization: Bearer {access_token}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Nguyen Van A",
      "displayName": "Nguyen Van A",
      "avatarUrl": "https://...",
      "bio": "Bio text",
      "emailVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "subscription": {
      "tier": "FREE",
      "status": "TRIAL",
      "usage": {
        "aiQueries": 5,
        "aiLimit": 10,
        "trips": 1,
        "tripsLimit": 3
      },
      "currentPeriod": {
        "start": "2024-01-01T00:00:00.000Z",
        "end": "2024-02-01T00:00:00.000Z"
      }
    },
    "preferences": {
      "language": "en",
      "currency": "USD",
      "timezone": "UTC",
      "travelStyle": [],
      "budgetRange": null,
      "dietaryRestrictions": [],
      "accessibilityNeeds": [],
      "emailNotifications": true,
      "pushNotifications": true,
      "profileVisibility": "public"
    },
    "authProviders": [
      {
        "provider": "EMAIL",
        "lastLoginAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

## 11. UPDATE PROFILE - Cập nhật profile

### Endpoint
```
PATCH /api/users/me
PATCH /api/users/profile
```

### Headers Required
```
Authorization: Bearer {access_token}
```

### Request Body (all fields optional)
```json
{
  "name": "Nguyen Van B",
  "displayName": "Van B",
  "avatarUrl": "https://example.com/avatar.jpg",
  "bio": "Travel enthusiast",
  "phone": "+84123456789"
}
```

### Validation Rules
| Field | Rules |
|-------|-------|
| name | Max 100 characters |
| displayName | Max 50 characters |
| avatarUrl | Valid URL or null/empty |
| bio | Max 500 characters |

### Success Response (200)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Nguyen Van B",
      "displayName": "Van B",
      "avatarUrl": "https://example.com/avatar.jpg",
      "bio": "Travel enthusiast",
      "emailVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

## 12. GET PREFERENCES - Lấy preferences

### Endpoint
```
GET /api/users/me/preferences
GET /api/users/preferences
```

### Headers Required
```
Authorization: Bearer {access_token}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "preferences": {
      "language": "en",
      "currency": "USD",
      "timezone": "UTC",
      "travelStyle": ["adventure", "cultural"],
      "budgetRange": "moderate",
      "dietaryRestrictions": ["vegetarian"],
      "accessibilityNeeds": [],
      "emailNotifications": true,
      "pushNotifications": true,
      "profileVisibility": "public"
    },
    "fromCache": false
  }
}
```

---

## 13. UPDATE PREFERENCES - Cập nhật preferences (Onboarding)

### Endpoint
```
PATCH /api/users/me/preferences
PATCH /api/users/preferences
```

### Headers Required
```
Authorization: Bearer {access_token}
```

### Request Body (all fields optional)
```json
{
  "language": "vi",
  "currency": "VND",
  "timezone": "Asia/Ho_Chi_Minh",
  "travelStyle": ["adventure", "cultural", "relaxation"],
  "budgetRange": "moderate",
  "dietaryRestrictions": ["vegetarian", "halal"],
  "accessibilityNeeds": ["wheelchair"],
  "emailNotifications": true,
  "pushNotifications": false,
  "profileVisibility": "friends"
}
```

### Validation Rules

| Field | Valid Values |
|-------|--------------|
| language | `en`, `vi`, `es`, `fr`, `de`, `ja`, `ko`, `zh` |
| currency | `USD`, `EUR`, `GBP`, `VND`, `JPY`, `KRW`, `CNY`, `THB` |
| timezone | Any valid timezone string |
| travelStyle | Array of strings |
| budgetRange | `budget`, `moderate`, `mid-range`, `luxury`, `backpacker`, `comfort`, `premium`, `null` |
| dietaryRestrictions | Array of strings |
| accessibilityNeeds | Array of strings |
| emailNotifications | Boolean |
| pushNotifications | Boolean |
| profileVisibility | `public`, `private`, `friends` |

### Success Response (200)
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": {
    "preferences": {
      "language": "vi",
      "currency": "VND",
      ...
    }
  }
}
```

---

## 14. GET SUBSCRIPTION - Lấy thông tin subscription

### Endpoint
```
GET /api/users/me/subscription
GET /api/users/subscription
```

### Headers Required
```
Authorization: Bearer {access_token}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Subscription retrieved successfully",
  "data": {
    "subscription": {
      "tier": "PRO",
      "status": "ACTIVE",
      "usage": {
        "aiQueries": 45,
        "aiLimit": 100,
        "trips": 8,
        "tripsLimit": 20
      },
      "currentPeriod": {
        "start": "2024-01-01T00:00:00.000Z",
        "end": "2024-02-01T00:00:00.000Z"
      },
      "trialEndsAt": null,
      "canceledAt": null,
      "cancelAtPeriodEnd": false,
      "limits": {
        "maxTrips": 20,
        "maxAIQueries": 100,
        "maxCollaboratorsPerTrip": 5,
        "maxPhotosPerTrip": 100,
        "offlineMaps": true,
        "advancedAnalytics": true
      },
      "features": [
        "basic_trip_planning",
        "place_discovery",
        "unlimited_ai_assistant",
        "advanced_itinerary",
        "budget_tracking",
        "offline_mode",
        "trip_collaboration",
        "weather_integration",
        "export_to_pdf"
      ]
    }
  }
}
```

### Subscription Tiers

| Tier | Trips | AI Queries | Collaborators |
|------|-------|------------|---------------|
| FREE | 3 | 10 | 0 |
| PRO | 20 | 100 | 5 |
| BUSINESS | Unlimited | 1000 | Unlimited |

---

## 15. GET USER STATS - Lấy thống kê user

### Endpoint
```
GET /api/users/stats
```

### Headers Required
```
Authorization: Bearer {access_token}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "tripsCount": 10,
    "completedTrips": 5,
    "upcomingTrips": 3,
    "activeTrips": 5,
    "fromCache": false
  }
}
```

---

## Frontend Onboarding Flow

### Recommended Steps

```
1. User registers or login via Google
   → POST /api/auth/register
   → GET /api/auth/google

2. If new user → redirect to /onboarding

3. Onboarding Step 1: Basic Profile
   → PATCH /api/users/me
   {
     "name": "...",
     "displayName": "...",
     "avatarUrl": "..."
   }

4. Onboarding Step 2: Language & Currency
   → PATCH /api/users/me/preferences
   {
     "language": "vi",
     "currency": "VND",
     "timezone": "Asia/Ho_Chi_Minh"
   }

5. Onboarding Step 3: Travel Preferences
   → PATCH /api/users/me/preferences
   {
     "travelStyle": ["adventure", "cultural"],
     "budgetRange": "moderate"
   }

6. Onboarding Step 4: Special Requirements
   → PATCH /api/users/me/preferences
   {
     "dietaryRestrictions": ["vegetarian"],
     "accessibilityNeeds": []
   }

7. Onboarding Step 5: Notifications
   → PATCH /api/users/me/preferences
   {
     "emailNotifications": true,
     "pushNotifications": true,
     "profileVisibility": "public"
   }

8. Complete → redirect to /dashboard
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 422 | Request validation failed |
| INVALID_CREDENTIALS | 401 | Wrong email or password |
| INVALID_TOKEN | 400/401 | Invalid JWT/reset/verify token |
| TOKEN_EXPIRED | 401 | Token has expired |
| EMAIL_NOT_VERIFIED | 403 | Email verification required |
| EMAIL_ALREADY_EXISTS | 409 | Email already registered |
| ACCOUNT_DISABLED | 403 | Account has been deactivated |
| NOT_FOUND | 404 | Resource not found |
| UNAUTHORIZED | 401 | Not authenticated |
| FORBIDDEN | 403 | Not authorized |
| INTERNAL_ERROR | 500 | Server error |

---

## Authentication Notes

### Token Storage
- Tokens are stored in **HttpOnly cookies** for security
- Access token: Short-lived (15-60 mins)
- Refresh token: Long-lived (7-30 days)

### Token Refresh Flow
```javascript
// Frontend axios interceptor example
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Try to refresh token
      try {
        await axios.post('/api/auth/refresh');
        // Retry original request
        return axios(error.config);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### CORS & Cookies
Frontend must include credentials:
```javascript
axios.defaults.withCredentials = true;

// or fetch
fetch(url, { credentials: 'include' });
```
