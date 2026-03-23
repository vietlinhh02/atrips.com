// ============================================
// Itinerary Types - Based on Backend Schema
// ============================================

export interface OverviewData {
    summary?: string;
    weather?: {
        season?: string;
        condition?: string;
        avgTemp?: number | string;
    };
    highlights?: string[];
    culturalNotes?: string;
    bestTimeToVisit?: string;
}

export interface TravelTips {
    safety?: string[];
    food?: string[];
    budget?: string[];
    transportation?: string[];
    general?: string[];
}

export interface BookingSuggestion {
    title: string;
    type?: string;
    provider?: string;
    estimatedCost?: number;
    notes?: string;
}

export interface BudgetCategoryDetail {
    total?: number;
    perDay?: number;
}

export interface BudgetBreakdown {
    accommodation?: BudgetCategoryDetail | number;
    food?: BudgetCategoryDetail | number;
    transportation?: BudgetCategoryDetail | number;
    activities?: BudgetCategoryDetail | number;
    miscellaneous?: BudgetCategoryDetail | number;
}

export interface TransportFromPrevious {
    mode?: string;
    distance?: number | string;
    cost?: number;
    duration?: number | string;
    instructions?: string;
}

export interface GoogleMapsInfo {
    rating?: number;
    ratingCount?: number;
    openingHours?: string;
    reviewQuote?: string;
    amenities?: string[] | string;
}

export interface YouTubeVideo {
    videoId: string;
    title: string;
    url: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt?: string;
    description?: string;
    views?: number;
    likes?: number;
    duration?: string;
}

export interface ItineraryStructuredData {
    tripTitle?: string;
    destination: string;
    startDate: string;
    endDate: string;
    budget?: number;
    currency?: string;
    travelers?: number;
    description?: string;
    overview?: string;
    overviewData?: OverviewData;
    travelTips?: TravelTips;
    bookingSuggestions?: BookingSuggestion[];
    budgetBreakdown?: BudgetBreakdown;
    selectedVideos?: YouTubeVideo[];
    days: ItineraryDayData[];
}

export interface DayWeather {
    condition: string;
    tempHigh: number;
    tempLow: number;
    humidity?: number;
    precipitation?: number;
}

export interface ItineraryDayData {
    date: string;
    dayNumber: number;
    day?: number;
    title?: string; // Theme might be mapped to title or separate
    theme?: string;
    dailyCost?: number;
    weather?: DayWeather;
    meals?: {
        breakfast?: string;
        lunch?: string;
        dinner?: string;
    };
    notes?: string;
    activities: ActivityData[]; // JSON uses 'activities', type uses 'schedule'. Need to be careful with mapping.
    schedule?: ActivityData[]; // Keeping schedule for backward compatibility if needed, but JSON has 'activities' inside 'days'
}

export interface ActivityData {
    name: string; // generatedData uses 'title', we might need to map it or allow both
    title?: string; // Add title as it appears in the JSON
    type: string;
    time?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
    estimatedCost?: number;
    description?: string;
    details?: string;
    address?: string;
    location?: string;
    coordinates?: {
        lat: number;
        lng: number;
        placeName?: string;
        placeType?: string;
    };
    image?: string;
    thumbnail?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    photos?: string[];
    placeId?: string;
    orderIndex?: number;
    transportFromPrevious?: TransportFromPrevious;
    googleMapsInfo?: GoogleMapsInfo;
}

// ============================================
// Destination Overlay Type
// ============================================

export interface SelectedDestination {
  name: string;
  type?: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  sideImages?: string[];
  coordinates?: { lat: number; lng: number };
  address?: string;
  city?: string;
  website?: string;
  phone?: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: string;
  openingHours?: string | null;
  categories?: string[];
}

// ============================================
// AI Draft Types
// ============================================

export interface AIItineraryDraft {
    id: string;
    conversationId: string | null;
    sourcePrompt: string;
    generatedData: ItineraryStructuredData;
    appliedAt: string | null;
    appliedToTripId: string | null;
    createdAt: string;
    conversation?: {
        id: string;
        userId: string;
        title: string;
    };
}
