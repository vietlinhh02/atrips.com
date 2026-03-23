import api from '../lib/api';
import mapConfigService from './mapConfigService';

interface SignupData {
  email: string;
  password: string;
  name: string;
  displayName?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  tier: 'FREE' | 'PRO' | 'BUSINESS';
  emailVerified: boolean;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: User;
  tokens: Tokens;
}

class AuthService {
  /**
   * Signup with email and password
   */
  async signup(data: SignupData): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data);
    const { user, tokens } = response.data.data;

    // TODO: Remove after Phase 4 - Backward compatibility
    if (tokens) {
      this.setTokens(tokens);
    }

    return { user, tokens };
  }

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post('/auth/login', data);
    const { user, tokens } = response.data.data;

    // TODO: Remove after Phase 4 - Backward compatibility
    if (tokens) {
      this.setTokens(tokens);
    }

    return { user, tokens };
  }

  /**
   * Login with Google OAuth
   * Redirects to Google OAuth consent screen
   */
  loginWithGoogle(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${api.defaults.baseURL}/auth/google`;
    }
  }

  /**
   * Handle Google OAuth callback
   * Called from redirect URL
   */
  async handleGoogleCallback(): Promise<User> {
    if (typeof window === 'undefined') {
      throw new Error('This function must be called on the client side');
    }


    // Optional: Check for error in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
      throw new Error(`Google OAuth error: ${error}`);
    }

    // Get user info using cookie
    const user = await this.getCurrentUser();
    return user;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      // Backend clears httpOnly cookies
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // TODO: Remove after Phase 4
      this.clearTokens();

      // Clear map config cache (contains token)
      mapConfigService.clearCache();
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    // Try multiple possible response structures to handle backend inconsistencies
    const user = response.data?.data?.user || response.data?.user || response.data;
    if (!user) {
      console.error('Auth response structure:', JSON.stringify(response.data, null, 2));
      throw new Error('Invalid response from /auth/me');
    }
    return user;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: { token: string; password: string }): Promise<{ message: string }> {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string; data: { alreadyVerified: boolean } }> {
    const response = await api.get(`/auth/verify-email/${token}`);
    return response.data;
  }

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  }

  /**
   * Store tokens in localStorage
   * TODO: Remove after Phase 4 - Backward compatibility only
   */
  setTokens(tokens: Tokens): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', tokens.accessToken);
      if (tokens.refreshToken) {
        localStorage.setItem('refreshToken', tokens.refreshToken);
      }
    }
  }

  /**
   * Clear tokens from localStorage
   * TODO: Remove after Phase 4 - Backward compatibility only
   */
  clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  /**
   * Check if user is authenticated
   *
   * ⚠️ DEPRECATED: This method does NOT work with httpOnly cookies!
   * httpOnly cookies cannot be accessed from JavaScript.
   *
   * For httpOnly cookie auth:
   * - Use Zustand authStore.isAuthenticated instead
   * - Or try calling getCurrentUser() and catch the error
   *
   * TODO: Remove this method after Phase 4 - backward compatibility only
   */
  isAuthenticated(): boolean {
    if (typeof window !== 'undefined') {
      // This only works if tokens are in localStorage (old behavior)
      // With httpOnly cookies, this will always return false
      return !!localStorage.getItem('accessToken');
    }
    return false;
  }
}

const authService = new AuthService();
export default authService;
export type { User, Tokens, SignupData, LoginData };
