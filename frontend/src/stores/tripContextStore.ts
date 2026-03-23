import { create } from 'zustand';

/**
 * Trip Planning Context Store
 * Manages the current trip planning context (destination, dates, travelers, budget)
 * Used by ChatHeader and AI chat system
 */

export interface TripContext {
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  budget: number | null;
  currency: string;
}

interface TripContextState {
  // Current context
  context: TripContext;

  // Whether context has been edited by user (vs loaded from draft)
  isEdited: boolean;

  // Actions
  setContext: (context: Partial<TripContext>) => void;
  setDestination: (destination: string | null) => void;
  setDates: (startDate: string | null, endDate: string | null) => void;
  setTravelers: (travelers: number) => void;
  setBudget: (budget: number | null) => void;
  setCurrency: (currency: string) => void;

  // Load context from itinerary data
  loadFromItinerary: (itinerary: {
    destination?: string;
    startDate?: string;
    endDate?: string;
    travelers?: number;
    budget?: number;
    currency?: string;
  } | null) => void;

  // Reset context
  resetContext: () => void;

  // Mark as edited (user made manual changes)
  markAsEdited: () => void;

  // Get context for AI message
  getContextForAI: () => string;
}

const defaultContext: TripContext = {
  destination: null,
  startDate: null,
  endDate: null,
  travelers: 1,
  budget: null,
  currency: 'VND',
};

const useTripContextStore = create<TripContextState>((set, get) => ({
  context: { ...defaultContext },
  isEdited: false,

  setContext: (newContext) => {
    set((state) => ({
      context: { ...state.context, ...newContext },
      isEdited: true,
    }));
  },

  setDestination: (destination) => {
    set((state) => ({
      context: { ...state.context, destination },
      isEdited: true,
    }));
  },

  setDates: (startDate, endDate) => {
    set((state) => ({
      context: { ...state.context, startDate, endDate },
      isEdited: true,
    }));
  },

  setTravelers: (travelers) => {
    set((state) => ({
      context: { ...state.context, travelers },
      isEdited: true,
    }));
  },

  setBudget: (budget) => {
    set((state) => ({
      context: { ...state.context, budget },
      isEdited: true,
    }));
  },

  setCurrency: (currency) => {
    set((state) => ({
      context: { ...state.context, currency },
      isEdited: true,
    }));
  },

  loadFromItinerary: (itinerary) => {
    if (!itinerary) {
      set({ context: { ...defaultContext }, isEdited: false });
      return;
    }

    // Handle budget - ensure it's a valid number
    let budgetValue: number | null = null;
    if (itinerary.budget !== undefined && itinerary.budget !== null) {
      const parsed = typeof itinerary.budget === 'number' ? itinerary.budget : Number(itinerary.budget);
      if (!isNaN(parsed) && parsed > 0) {
        budgetValue = parsed;
      }
    }

    set({
      context: {
        destination: itinerary.destination || null,
        startDate: itinerary.startDate || null,
        endDate: itinerary.endDate || null,
        travelers: itinerary.travelers || 1,
        budget: budgetValue,
        currency: itinerary.currency || 'VND',
      },
      isEdited: false,
    });
  },

  resetContext: () => {
    set({ context: { ...defaultContext }, isEdited: false });
  },

  markAsEdited: () => {
    set({ isEdited: true });
  },

  getContextForAI: () => {
    const { context } = get();
    const parts: string[] = [];

    if (context.destination) {
      parts.push(`Điểm đến: ${context.destination}`);
    }

    if (context.startDate && context.endDate) {
      parts.push(`Thời gian: ${context.startDate} đến ${context.endDate}`);
    } else if (context.startDate) {
      parts.push(`Ngày bắt đầu: ${context.startDate}`);
    }

    if (context.travelers > 1) {
      parts.push(`Số người: ${context.travelers}`);
    }

    if (context.budget) {
      const formattedBudget = new Intl.NumberFormat('vi-VN').format(context.budget);
      parts.push(`Ngân sách: ${formattedBudget} ${context.currency}`);
    }

    return parts.join(', ');
  },
}));

export default useTripContextStore;
