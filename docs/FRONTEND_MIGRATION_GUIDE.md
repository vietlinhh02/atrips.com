# Frontend Migration Guide - Removing Guest Mode Support

## Tổng Quan

Backend đã được cập nhật để **loại bỏ hoàn toàn hỗ trợ guest mode**. Tất cả các tính năng AI chat, tạo lịch trình, và quản lý conversations giờ đây **yêu cầu xác thực người dùng**.

**Ngày cập nhật:** 2026-02-01

---

## 🔴 Thay Đổi Quan Trọng

### Backend Changes

Tất cả endpoints sau đây giờ **YÊU CẦU authentication token**:

| Endpoint | Phương thức | Trước đây | Bây giờ |
|----------|------------|-----------|---------|
| `/api/ai/chat` | POST | Guest ✅ | Auth required 🔒 |
| `/api/ai/chat/stream` | GET | Guest ✅ | Auth required 🔒 |
| `/api/ai/generate-itinerary` | POST | Guest ✅ | Auth required 🔒 |
| `/api/ai/conversations` | POST | Guest ✅ | Auth required 🔒 |
| `/api/users/subscription` | GET | Guest ✅ | Auth required 🔒 |

### Error Response

Khi gọi API mà **không có token** hoặc **token không hợp lệ**, bạn sẽ nhận response:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No token provided"
  }
}
```

Status code: **401 Unauthorized**

---

## 📋 Checklist Frontend Cần Fix

### 1. **Xóa Guest Mode UI/UX**

- [ ] Xóa nút "Try as Guest" hoặc "Continue without login"
- [ ] Xóa banner "You're using guest mode"
- [ ] Xóa thông báo "Sign up to save your conversations"
- [ ] Xóa dialog "Import conversations from guest mode"

### 2. **Redirect Chưa Đăng Nhập**

- [ ] Redirect user đến trang login khi truy cập AI features mà chưa đăng nhập
- [ ] Hiển thị message rõ ràng: "Please sign in to use AI features"
- [ ] Lưu intended destination để redirect sau khi login thành công

### 3. **Update API Calls**

- [ ] Đảm bảo **TẤT CẢ** AI API calls đều gửi kèm `Authorization` header
- [ ] Xử lý 401 errors để redirect về login page
- [ ] Remove localStorage/sessionStorage logic cho guest conversations

### 4. **State Management**

- [ ] Xóa guest mode state từ Redux/Zustand/Context
- [ ] Remove guest conversation cache
- [ ] Clear guest-related localStorage keys

### 5. **Testing**

- [ ] Test tất cả AI features với user đã đăng nhập
- [ ] Test redirect flow khi chưa đăng nhập
- [ ] Test error handling cho 401 responses

---

## 🛠️ Code Examples

### ❌ BEFORE (Old Code - Guest Mode Support)

```javascript
// BAD: Gọi API không cần auth
const chatWithAI = async (message) => {
  const token = localStorage.getItem('authToken');

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Token optional - guest mode supported
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({ message })
  });

  return response.json();
};
```

```javascript
// BAD: Guest conversation trong localStorage
const saveGuestConversation = (conversation) => {
  const guestConvs = JSON.parse(localStorage.getItem('guestConversations') || '[]');
  guestConvs.push(conversation);
  localStorage.setItem('guestConversations', JSON.stringify(guestConvs));
};
```

### ✅ AFTER (New Code - Auth Required)

```javascript
// GOOD: Luôn yêu cầu auth token
const chatWithAI = async (message) => {
  const token = localStorage.getItem('authToken');

  if (!token) {
    // Redirect to login
    window.location.href = '/login?redirect=/chat';
    throw new Error('Authentication required');
  }

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // Required
    },
    body: JSON.stringify({ message })
  });

  // Handle 401
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login?redirect=/chat';
    throw new Error('Unauthorized');
  }

  return response.json();
};
```

### React Component Example

```jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

function ChatPage() {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();

  // Redirect nếu chưa đăng nhập
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/chat', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSendMessage = async (message) => {
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });

      if (response.status === 401) {
        // Token expired
        navigate('/login?redirect=/chat');
        return;
      }

      const data = await response.json();
      // Handle success
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  return (
    <div>
      {/* Chat UI */}
    </div>
  );
}
```

### Axios Interceptor (Recommended)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

// Request interceptor - thêm token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login?redirect=' + window.location.pathname;
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🗑️ Code Cleanup Checklist

### Files/Components to Remove

```bash
# Example file structure to clean up

src/
├── components/
│   ├── GuestModeBanner.jsx          # DELETE
│   ├── GuestConversationImport.jsx  # DELETE
│   └── TryAsGuestButton.jsx         # DELETE
├── hooks/
│   ├── useGuestChat.js              # DELETE
│   └── useGuestConversations.js     # DELETE
├── utils/
│   └── guestStorage.js              # DELETE
└── contexts/
    └── GuestModeContext.jsx         # DELETE
```

### localStorage Keys to Remove

```javascript
// Remove these keys from localStorage
const KEYS_TO_REMOVE = [
  'guestConversations',
  'guestMode',
  'isGuest',
  'guestChatHistory',
  'tempGuestData'
];

// Cleanup function
const cleanupGuestMode = () => {
  KEYS_TO_REMOVE.forEach(key => {
    localStorage.removeItem(key);
  });
};
```

---

## 🚀 Migration Steps

### Step 1: Update Auth Check

```javascript
// Create a higher-order component for protected routes
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Usage in routes
<Route
  path="/chat"
  element={
    <ProtectedRoute>
      <ChatPage />
    </ProtectedRoute>
  }
/>
```

### Step 2: Update API Service Layer

```javascript
// services/aiService.js
class AIService {
  async chat(message, conversationId) {
    const token = this.getToken();

    if (!token) {
      throw new Error('AUTH_REQUIRED');
    }

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message, conversationId })
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.handleUnauthorized();
      }
      throw new Error('API_ERROR');
    }

    return response.json();
  }

  getToken() {
    return localStorage.getItem('authToken');
  }

  handleUnauthorized() {
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  }
}

export default new AIService();
```

### Step 3: Update UI Components

```jsx
// Before: Guest mode banner
{!isAuthenticated && (
  <Banner>
    You're using guest mode.
    <Link to="/signup">Sign up</Link> to save conversations.
  </Banner>
)}

// After: Simple CTA
{!isAuthenticated && (
  <div className="auth-required">
    <h2>AI Trip Planner</h2>
    <p>Sign in to start planning your next adventure</p>
    <Button onClick={() => navigate('/login')}>
      Sign In
    </Button>
    <Button onClick={() => navigate('/signup')}>
      Create Account
    </Button>
  </div>
)}
```

### Step 4: Remove Import Conversations Feature

```javascript
// DELETE this entire feature - no longer needed
const ImportGuestConversations = () => {
  // This component is obsolete
  return null;
};
```

---

## ⚠️ Breaking Changes

### 1. Guest Users Cannot Access AI Features

**Impact:** Users không đăng nhập sẽ nhận 401 error khi gọi AI APIs

**Fix:** Redirect họ đến trang login/signup

### 2. No Client-Side Conversation Storage

**Impact:** Không thể lưu conversations trong localStorage nữa

**Fix:** Tất cả conversations phải được lưu trên server (đã đăng nhập)

### 3. Quota System Requires Authentication

**Impact:** Không thể check quota cho guest users

**Fix:** Quota API chỉ hoạt động với authenticated users

---

## 📱 User Experience Recommendations

### Landing Page for Unauthenticated Users

```jsx
function AIFeatureLanding() {
  return (
    <div className="landing">
      <h1>Plan Your Perfect Trip with AI</h1>

      <div className="features">
        <Feature
          icon="🤖"
          title="AI-Powered Planning"
          description="Get personalized itineraries in seconds"
        />
        <Feature
          icon="💾"
          title="Save & Share"
          description="Keep all your plans in one place"
        />
        <Feature
          icon="⚡"
          title="Smart Suggestions"
          description="Discover hidden gems and local favorites"
        />
      </div>

      <div className="cta">
        <Button size="large" onClick={() => navigate('/signup')}>
          Get Started Free
        </Button>
        <Link to="/login">Already have an account?</Link>
      </div>
    </div>
  );
}
```

### Smart Redirect with Intent Preservation

```javascript
// Save user's intended action
const saveRedirectIntent = () => {
  sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
  sessionStorage.setItem('pendingMessage', currentMessage);
};

// After login success
const handleLoginSuccess = (token) => {
  localStorage.setItem('authToken', token);

  const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
  const pendingMessage = sessionStorage.getItem('pendingMessage');

  sessionStorage.removeItem('redirectAfterLogin');
  sessionStorage.removeItem('pendingMessage');

  navigate(redirectPath);

  // Auto-send pending message if exists
  if (pendingMessage) {
    sendMessage(pendingMessage);
  }
};
```

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] Mở trang chat khi chưa đăng nhập → Redirect to login
- [ ] Gửi message khi chưa đăng nhập → Show auth required error
- [ ] Token expired → Auto redirect to login
- [ ] Login thành công → Redirect to intended page
- [ ] All AI features work sau khi login

### Automated Tests

```javascript
// Example Jest test
describe('AI Chat - Auth Required', () => {
  it('should redirect to login when not authenticated', () => {
    render(<ChatPage />);
    expect(window.location.pathname).toBe('/login');
  });

  it('should show error when API returns 401', async () => {
    // Mock 401 response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      })
    );

    const { getByText } = render(<ChatPage />);
    // Assert error handling
  });
});
```

---

## 📞 Support

Nếu có vấn đề trong quá trình migration:

1. Check console logs cho 401 errors
2. Verify token được gửi trong Authorization header
3. Test API endpoints với Postman/curl
4. Review backend logs

### Example Debug Command

```bash
# Test API với curl
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message": "Plan a trip to Tokyo"}'

# Expected: 200 OK
# Without token: 401 Unauthorized
```

---

## 🎯 Summary

**TL;DR:**

1. ❌ **Xóa tất cả** guest mode UI/logic
2. 🔒 **Thêm auth check** trước khi gọi AI APIs
3. ↪️ **Redirect** users chưa đăng nhập đến login page
4. 🧹 **Cleanup** localStorage, unused components
5. ✅ **Test** thoroughly

**Timeline:** Nên hoàn thành migration trong 1-2 sprints

---

**Last Updated:** 2026-02-01
**Backend Version:** 2.0.0 (Guest Mode Removed)
