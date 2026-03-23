import api from '../lib/api';

export interface TravelProfileStep1 {
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  travelCompanions: string[];
  location: string;
  locationPlaceId?: string;
}

export interface TravelProfileStep2 {
  spendingHabits: string;
  dailyRhythm: string;
  socialPreference: string;
}

export interface TravelProfileStep3 {
  travelerTypes: string[];
}

export interface TravelProfile extends TravelProfileStep1, TravelProfileStep2, TravelProfileStep3 {
  id: string;
  userId: string;
  personaTitle?: string;
  personaDescription?: string;
  personaSuggestedQuestions?: string[];
  personaAnswers?: Record<string, string> | null;
  currentStep: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelProfileOptions {
  travelCompanions: Array<{
    value: string;
    label: string;
    icon: string;
    description: string;
  }>;
  genders: Array<{
    value: string;
    label: string;
  }>;
  spendingHabits: Array<{
    value: string;
    label: string;
    icon: string;
    description: string;
    color: string;
  }>;
  dailyRhythm: Array<{
    value: string;
    label: string;
    icon: string;
    description: string;
    color: string;
  }>;
  socialPreference: Array<{
    value: string;
    label: string;
    icon: string;
    description: string;
  }>;
  travelerTypes: Array<{
    value: string;
    label: string;
    icon: string;
    color: string;
    description: string;
    suggestedQuestions: string[];
    persona: {
      title: string;
      description: string;
    };
  }>;
  uiCopy: {
    step1: {
      title: string;
      subtitle: string;
      question: string;
      ctaNext: string;
      ctaBack: string;
    };
    step2: {
      title: string;
      subtitle: string;
      question1: string;
      question2: string;
      question3: string;
      ctaNext: string;
      ctaBack: string;
    };
    step3: {
      title: string;
      subtitle: string;
      question: string;
      selectionCount: string;
      ctaNext: string;
      ctaBack: string;
    };
    result: {
      interestsTitle: string;
      questionsTitle: string;
      readMore: string;
      ctaNext: string;
      ctaViewFullPersona: string;
    };
  };
  placeholders: {
    firstName: string;
    lastName: string;
    age: string;
    location: string;
  };
  validationMessages: {
    [key: string]: string;
  };
}

class TravelProfileService {
  /**
   * Check if user needs onboarding
   */
  async needsOnboarding(): Promise<{ needsOnboarding: boolean; currentStep: number }> {
    const response = await api.get('/profile/travel/needs-onboarding');
    const payload = response.data?.data ?? response.data ?? {};
    return {
      needsOnboarding: Boolean(payload.needsOnboarding),
      currentStep: typeof payload.currentStep === 'number' ? payload.currentStep : 1,
    };
  }

  /**
   * Get travel profile
   */
  async getProfile(): Promise<TravelProfile | null> {
    try {
      const response = await api.get('/profile/travel');
      const payload = response.data?.data ?? response.data ?? {};
      const profile = payload.profile ?? payload;
      if (!profile || Array.isArray(profile)) {
        return null;
      }
      return profile as TravelProfile;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return null;
        }
      }
      throw error;
    }
  }

  /**
   * Get travel profile options
   */
  async getOptions(): Promise<TravelProfileOptions> {
    const response = await api.get('/profile/travel/options');
    const rawOptions =
      response.data?.data?.options ??
      response.data?.options ??
      response.data?.data ??
      response.data ??
      {};
    const defaultUiCopy = {
      step1: {
        title: 'Tell us about you',
        subtitle: 'Help us personalize your trip plan',
        question: 'Who are you?',
        ctaNext: 'Next',
        ctaBack: 'Back',
      },
      step2: {
        title: 'Your travel style',
        subtitle: 'Let us know your preferences',
        question1: 'Spending habits',
        question2: 'Daily rhythm',
        question3: 'Social preference',
        ctaNext: 'Next',
        ctaBack: 'Back',
      },
      step3: {
        title: 'Traveler types',
        subtitle: 'Select what matches you',
        question: 'Choose up to 3',
        selectionCount: 'Select up to 3',
        ctaNext: 'Finish',
        ctaBack: 'Back',
      },
      result: {
        interestsTitle: 'Your Interests',
        questionsTitle: 'Suggested Questions',
        readMore: 'Read more',
        ctaNext: 'Continue',
        ctaViewFullPersona: 'View full persona',
      },
    };

    const defaultPlaceholders = {
      firstName: 'First name',
      lastName: 'Last name',
      age: 'Age',
      location: 'Location',
    };

    return {
      ...rawOptions,
      uiCopy: {
        ...defaultUiCopy,
        ...(rawOptions.uiCopy || {}),
        step1: { ...defaultUiCopy.step1, ...(rawOptions.uiCopy?.step1 || {}) },
        step2: { ...defaultUiCopy.step2, ...(rawOptions.uiCopy?.step2 || {}) },
        step3: { ...defaultUiCopy.step3, ...(rawOptions.uiCopy?.step3 || {}) },
        result: { ...defaultUiCopy.result, ...(rawOptions.uiCopy?.result || {}) },
      },
      placeholders: {
        ...defaultPlaceholders,
        ...(rawOptions.placeholders || {}),
      },
      validationMessages: rawOptions.validationMessages || {},
    } as TravelProfileOptions;
  }

  /**
   * Update step 1
   */
  async updateStep1(data: TravelProfileStep1): Promise<TravelProfile> {
    const response = await api.put('/profile/travel/step1', data);
    return (
      response.data?.data?.profile ||
      response.data?.profile ||
      response.data?.data ||
      response.data
    );
  }

  /**
   * Update step 2
   */
  async updateStep2(data: TravelProfileStep2): Promise<TravelProfile> {
    const response = await api.put('/profile/travel/step2', data);
    return (
      response.data?.data?.profile ||
      response.data?.profile ||
      response.data?.data ||
      response.data
    );
  }

  /**
   * Update step 3
   */
  async updateStep3(data: TravelProfileStep3): Promise<TravelProfile> {
    const response = await api.put('/profile/travel/step3', data);
    return (
      response.data?.data?.profile ||
      response.data?.profile ||
      response.data?.data ||
      response.data
    );
  }

  /**
   * Update step 4 - persona answers
   */
  async updateStep4(answers: Record<string, string> | string[]): Promise<TravelProfile> {
    const response = await api.put('/profile/travel/step4', { answers });
    return (
      response.data?.data?.profile ||
      response.data?.profile ||
      response.data?.data ||
      response.data
    );
  }
}

const travelProfileService = new TravelProfileService();
export default travelProfileService;
