import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import authService, { User, SignupData, LoginData } from '../services/authService';
import userService, { UserSubscription, UpdateProfileData } from '../services/userService';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscription: UserSubscription | null;
  _hasHydrated: boolean;

  // Actions
  signup: (data: SignupData) => Promise<User>;
  login: (data: LoginData) => Promise<User>;
  loginWithGoogle: () => void;
  handleGoogleCallback: () => Promise<User>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<User>;
  fetchSubscription: () => Promise<void>;

  // Helpers
  hasFeatureAccess: (feature: string) => boolean;
  canUseAI: () => boolean;
  setHasHydrated: (state: boolean) => void;
}

// Module-level flag to deduplicate concurrent fetchCurrentUser calls
let isFetchingUser = false;

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: true,
      subscription: null,
      _hasHydrated: false,

      // Actions
      signup: async (data: SignupData) => {
        const { user } = await authService.signup(data);
        set({ user, isAuthenticated: true });

        // Fetch subscription info
        get().fetchSubscription();

        return user;
      },

      login: async (data: LoginData) => {
        const { user } = await authService.login(data);
        set({ user, isAuthenticated: true });

        // Fetch subscription info
        get().fetchSubscription();

        return user;
      },

      loginWithGoogle: () => {
        authService.loginWithGoogle();
      },

      handleGoogleCallback: async () => {
        const user = await authService.handleGoogleCallback();
        set({ user, isAuthenticated: true });

        // Fetch subscription info
        get().fetchSubscription();

        return user;
      },

      logout: async () => {
        await authService.logout();
        set({ user: null, isAuthenticated: false, subscription: null });
      },

      fetchCurrentUser: async () => {
        if (isFetchingUser) return;
        isFetchingUser = true;

        try {
          const user = await authService.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
          get().fetchSubscription();
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } finally {
          isFetchingUser = false;
        }
      },

      updateProfile: async (data: UpdateProfileData) => {
        const updatedProfile = await userService.updateProfile(data);

        const currentUser = get().user;
        const user: User = {
          id: updatedProfile.id,
          email: updatedProfile.email,
          name: updatedProfile.name,
          displayName: updatedProfile.displayName,
          avatarUrl: updatedProfile.avatarUrl ?? undefined,
          bio: updatedProfile.bio ?? undefined,
          phone: updatedProfile.phone ?? undefined,
          emailVerified: updatedProfile.emailVerified,
          // Use tier from subscription if present, otherwise fall back to current user's tier or FREE
          tier: updatedProfile.subscription?.tier || currentUser?.tier || 'FREE'
        };

        set({ user });
        return user;
      },

      fetchSubscription: async () => {
        try {
          const subscription = await userService.getSubscription();
          // Backend might return null if not authenticated
          if (subscription) {
            set({ subscription });
          } else {
            set({ subscription: null });
          }
        } catch (error) {
          console.error('Failed to fetch subscription:', error);
          // If error (e.g. 401), set null
          set({ subscription: null });
        }
      },

      // Helpers
      hasFeatureAccess: (feature: string) => {
        const { subscription } = get();
        if (!subscription) return false;

        // Check if feature is available in current tier
        return (subscription.limits?.features as Record<string, boolean> | undefined)?.[feature] === true;
      },

      canUseAI: () => {
        const { subscription } = get();
        if (!subscription) return false;

        return subscription.usage.aiQuota.remaining > 0;
      },

      setHasHydrated: (state: boolean) => {
        set({
          _hasHydrated: state
        });
      },
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        
        // Cleanup guest mode localStorage keys
        if (typeof window !== 'undefined') {
          const KEYS_TO_REMOVE = [
            'atrips_guest_conversations',
            'guestConversations',
            'guestMode',
            'isGuest',
            'guestChatHistory',
            'tempGuestData'
          ];
          KEYS_TO_REMOVE.forEach(key => {
            localStorage.removeItem(key);
          });
        }
      },
      partialize: (state) => ({
        // Only persist user data and subscription
        // Tokens are now in httpOnly cookies (not accessible to JS)
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        subscription: state.subscription
      }),
    }
  )
);

export default useAuthStore;
