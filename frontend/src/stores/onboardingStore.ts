import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TravelProfileStep1,
  TravelProfileStep2,
  TravelProfileStep3,
} from '@/src/services/travelProfileService';
import travelProfileService from '@/src/services/travelProfileService';

interface OnboardingData {
  step1: TravelProfileStep1;
  step2: TravelProfileStep2;
  step3: TravelProfileStep3;
}

interface OnboardingStore {
  data: OnboardingData;
  updateStep1: (data: Partial<TravelProfileStep1>) => void;
  updateStep2: (data: Partial<TravelProfileStep2>) => void;
  updateStep3: (data: Partial<TravelProfileStep3>) => void;
  clearData: () => void;
  loadFromBackend: () => Promise<void>;
}

const defaultData: OnboardingData = {
  step1: {
    firstName: '',
    lastName: '',
    age: 0,
    gender: '',
    travelCompanions: [],
    location: '',
  },
  step2: {
    spendingHabits: '',
    dailyRhythm: '',
    socialPreference: '',
  },
  step3: {
    travelerTypes: [],
  },
};

const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      data: defaultData,

      updateStep1: (updates) =>
        set((state) => ({
          data: {
            ...state.data,
            step1: { ...state.data.step1, ...updates },
          },
        })),

      updateStep2: (updates) =>
        set((state) => ({
          data: {
            ...state.data,
            step2: { ...state.data.step2, ...updates },
          },
        })),

      updateStep3: (updates) =>
        set((state) => ({
          data: {
            ...state.data,
            step3: { ...state.data.step3, ...updates },
          },
        })),

      clearData: () => set({ data: defaultData }),

      loadFromBackend: async () => {
        try {
          const profile = await travelProfileService.getProfile();
          if (profile) {
            set({
              data: {
                step1: {
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  age: profile.age,
                  gender: profile.gender,
                  travelCompanions: profile.travelCompanions,
                  location: profile.location,
                  locationPlaceId: profile.locationPlaceId,
                },
                step2: {
                  spendingHabits: profile.spendingHabits,
                  dailyRhythm: profile.dailyRhythm,
                  socialPreference: profile.socialPreference,
                },
                step3: {
                  travelerTypes: profile.travelerTypes,
                },
              },
            });
          }
        } catch (error) {
          console.error('Failed to load profile from backend:', error);
        }
      },
    }),
    {
      name: 'onboarding_draft',
    }
  )
);

export default useOnboardingStore;
