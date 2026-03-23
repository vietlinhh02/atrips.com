/**
 * Cached Auth Service
 *
 * Wrapper around authService with automatic caching.
 * Handles auth state caching and proper invalidation on logout.
 */

import authService, { User, SignupData, LoginData, Tokens } from './authService';
import { cacheService } from '../lib/cache/cacheService';
import { CacheTTL, CacheNamespace } from '../lib/cache/types';

// ============================================================
// Cache Keys
// ============================================================

const CacheKeys = {
  CURRENT_USER: 'currentUser',
  IS_AUTHENTICATED: 'isAuthenticated',
  LAST_LOGIN: 'lastLogin',
} as const;

// ============================================================
// Cached Auth Service
// ============================================================

class CachedAuthService {
  /**
   * Signup with email and password
   * Caches user data after successful signup
   */
  async signup(data: SignupData): Promise<{ user: User; tokens: Tokens }> {
    const result = await authService.signup(data);

    // Cache the new user
    this.cacheUser(result.user);

    return result;
  }

  /**
   * Login with email and password
   * Caches user data after successful login
   */
  async login(data: LoginData): Promise<{ user: User; tokens: Tokens }> {
    const result = await authService.login(data);

    // Cache the user
    this.cacheUser(result.user);

    // Cache last login time
    cacheService.set(CacheKeys.LAST_LOGIN, Date.now(), {
      namespace: CacheNamespace.AUTH,
      ttl: CacheTTL.DAY,
      storage: 'localStorage',
    });

    return result;
  }

  /**
   * Login with Google OAuth
   */
  loginWithGoogle(): void {
    authService.loginWithGoogle();
  }

  /**
   * Handle Google OAuth callback
   * Caches user data after successful callback
   */
  async handleGoogleCallback(): Promise<User> {
    const user = await authService.handleGoogleCallback();

    // Cache the user
    this.cacheUser(user);

    // Cache last login time
    cacheService.set(CacheKeys.LAST_LOGIN, Date.now(), {
      namespace: CacheNamespace.AUTH,
      ttl: CacheTTL.DAY,
      storage: 'localStorage',
    });

    return user;
  }

  /**
   * Logout and clear all caches
   */
  async logout(): Promise<void> {
    await authService.logout();

    // Clear all auth-related caches
    this.clearAllCaches();
  }

  /**
   * Get current user with caching
   * Uses stale-while-revalidate pattern
   */
  async getCurrentUser(forceRefresh = false): Promise<User> {
    if (!forceRefresh) {
      // Try cache first
      const cached = cacheService.get<User>(CacheKeys.CURRENT_USER, {
        namespace: CacheNamespace.AUTH,
        storage: 'memory',
      });

      if (cached) {
        // Revalidate in background
        this.revalidateUserInBackground();
        return cached;
      }
    }

    // Fetch from API
    const user = await authService.getCurrentUser();

    // Cache the user
    this.cacheUser(user);

    return user;
  }

  /**
   * Get cached current user (synchronous)
   * Returns null if not cached
   */
  getCachedUser(): User | null {
    return cacheService.get<User>(CacheKeys.CURRENT_USER, {
      namespace: CacheNamespace.AUTH,
      storage: 'memory',
    });
  }

  /**
   * Request password reset (no caching needed)
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return authService.requestPasswordReset(email);
  }

  /**
   * Reset password with token
   * Clears all caches after password reset for security
   */
  async resetPassword(data: { token: string; password: string }): Promise<{ message: string }> {
    const result = await authService.resetPassword(data);

    // Clear all caches for security
    this.clearAllCaches();

    return result;
  }

  /**
   * Verify email with token
   * Updates cached user after verification
   */
  async verifyEmail(token: string): Promise<{ message: string; data: { alreadyVerified: boolean } }> {
    const result = await authService.verifyEmail(token);

    // Update cached user's emailVerified status
    const cachedUser = this.getCachedUser();
    if (cachedUser) {
      const updatedUser: User = { ...cachedUser, emailVerified: true };
      this.cacheUser(updatedUser);
    }

    return result;
  }

  /**
   * Resend verification email (no caching needed)
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    return authService.resendVerification(email);
  }

  /**
   * Check if user is authenticated (cached)
   */
  isAuthenticated(): boolean {
    // Check cache first
    const cached = cacheService.get<boolean>(CacheKeys.IS_AUTHENTICATED, {
      namespace: CacheNamespace.AUTH,
      storage: 'memory',
    });

    if (cached !== null) {
      return cached;
    }

    // Fall back to authService check
    const isAuth = authService.isAuthenticated();

    // Cache the result
    cacheService.set(CacheKeys.IS_AUTHENTICATED, isAuth, {
      namespace: CacheNamespace.AUTH,
      ttl: CacheTTL.SHORT,
      storage: 'memory',
    });

    return isAuth;
  }

  // ============================================================
  // Cache Management
  // ============================================================

  /**
   * Cache user data
   */
  private cacheUser(user: User): void {
    // Cache in memory for fast access
    cacheService.set(CacheKeys.CURRENT_USER, user, {
      namespace: CacheNamespace.AUTH,
      ttl: CacheTTL.MEDIUM,
      storage: 'memory',
      tags: ['user', `user:${user.id}`],
    });

    // Cache authentication state
    cacheService.set(CacheKeys.IS_AUTHENTICATED, true, {
      namespace: CacheNamespace.AUTH,
      ttl: CacheTTL.MEDIUM,
      storage: 'memory',
    });
  }

  /**
   * Revalidate user in background
   */
  private async revalidateUserInBackground(): Promise<void> {
    try {
      const user = await authService.getCurrentUser();
      this.cacheUser(user);
    } catch (error) {
      // If revalidation fails (e.g., token expired), clear cache
      console.error('Background user revalidation failed:', error);

      // Don't clear cache immediately - let the UI handle the error
      // This prevents flash of logged-out state on network hiccups
    }
  }

  /**
   * Clear all auth-related caches
   */
  clearAllCaches(): void {
    // Clear auth namespace
    cacheService.clear(CacheNamespace.AUTH);

    // Clear user namespace
    cacheService.clear(CacheNamespace.USERS);

    // Clear settings namespace
    cacheService.clear(CacheNamespace.SETTINGS);

    // Clear travel profile namespace
    cacheService.clear(CacheNamespace.TRAVEL_PROFILE);
  }

  /**
   * Update cached user
   */
  updateCachedUser(updates: Partial<User>): void {
    const cachedUser = this.getCachedUser();
    if (cachedUser) {
      const updatedUser: User = { ...cachedUser, ...updates };
      this.cacheUser(updatedUser);
    }
  }

  /**
   * Invalidate current user cache
   */
  invalidateCurrentUser(): void {
    cacheService.delete(CacheKeys.CURRENT_USER, CacheNamespace.AUTH);
    cacheService.delete(CacheKeys.IS_AUTHENTICATED, CacheNamespace.AUTH);
  }

  /**
   * Get last login time
   */
  getLastLoginTime(): number | null {
    return cacheService.get<number>(CacheKeys.LAST_LOGIN, {
      namespace: CacheNamespace.AUTH,
      storage: 'localStorage',
    });
  }

  /**
   * Prefetch auth data
   */
  async prefetch(): Promise<void> {
    if (this.isAuthenticated()) {
      await this.getCurrentUser();
    }
  }
}

// ============================================================
// Export
// ============================================================

const cachedAuthService = new CachedAuthService();
export default cachedAuthService;
export { CacheKeys as AuthCacheKeys };
