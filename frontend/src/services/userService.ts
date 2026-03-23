import api from '../lib/api';

interface UserPreferences {
  id?: string;
  userId?: string;
  language?: string;
  currency?: string;
  timezone?: string;
  travelStyle?: string[];
  budgetRange?: string | null;
  dietaryRestrictions?: string[];
  accessibilityNeeds?: string[];
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  profileVisibility?: string;
  profileCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface UserSubscription {
  id: string;
  userId: string;
  tier: 'FREE' | 'PRO' | 'BUSINESS';
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  aiQuotaUsed: number;
  aiQuotaLimit: number;
  tripsCreated: number;
  tripsLimit: number;
  createdAt: string;
  updatedAt: string;
  limits: {
    aiQuotaLimit: number;
    tripsLimit: number;
    features: {
      ai_basic: boolean;
      ai_advanced: boolean;
      unlimited_trips: boolean;
      collaboration: boolean;
      export_pdf: boolean;
      priority_support: boolean;
      white_label: boolean;
    };
  };
  usage: {
    aiQuota: {
      used: number;
      limit: number;
      remaining: number;
    };
    trips: {
      created: number;
      limit: number;
      remaining: number;
    };
  };
}

interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  preferences?: UserPreferences;
  subscription?: UserSubscription;
}

interface UpdateProfileData {
  name?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  coverImageOffsetY?: number;
  phone?: string;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface CheckoutSession {
  url: string;
  sessionId: string;
}

interface UserStats {
  totalTrips: number;
  totalAIRequests: number;
  accountAge: number;
}

class UserService {
  /**
   * Get user profile
   */
  async getProfile(): Promise<UserProfile> {
    const response = await api.get('/users/profile');
    return response.data.data;
  }

  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    const response = await api.patch('/users/profile', data);
    return response.data.data.user;
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    const response = await api.get('/users/preferences');
    return response.data.data.preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(data: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await api.patch('/users/preferences', data);
    return response.data.data.preferences;
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    const response = await api.post('/users/change-password', data);
    return response.data;
  }

  /**
   * Get subscription info
   */
  async getSubscription(): Promise<UserSubscription> {
    const response = await api.get('/users/subscription');
    return response.data.data;
  }

  /**
   * Create checkout session for upgrade
   */
  async createCheckoutSession(tier: 'PRO' | 'BUSINESS'): Promise<CheckoutSession> {
    const response = await api.post('/users/subscription/checkout', { tier });
    return response.data.data;
  }

  /**
   * Check feature access
   */
  async checkFeatureAccess(feature: string): Promise<boolean> {
    const response = await api.get(`/users/feature-access/${feature}`);
    return response.data.data.hasAccess;
  }

  /**
   * Get user stats
   */
  async getStats(): Promise<UserStats> {
    const response = await api.get('/users/stats');
    return response.data.data;
  }
}

const userService = new UserService();
export default userService;
export type {
  UserProfile,
  UpdateProfileData,
  UserPreferences,
  ChangePasswordData,
  UserSubscription,
  CheckoutSession,
  UserStats,
};
