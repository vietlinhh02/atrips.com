'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  Airplane,
  AirplaneTilt,
  Backpack,
  Bed,
  Bicycle,
  Binoculars,
  Boat,
  BowlFood,
  CalendarBlank,
  Church,
  CookingPot,
  ForkKnife,
  Globe,
  ListChecks,
  MapPin,
  Mountains,
  Snowflake,
  SunHorizon,
  Tent,
  Train,
  TreePalm,
  Users,
} from '@phosphor-icons/react';

import travelProfileService, {
  type TravelProfile,
} from '@/src/services/travelProfileService';

export interface Suggestion {
  id: string;
  text: string;
  icon: Icon;
}

type SeasonalGroup = readonly Suggestion[];

const SEASONAL_SUGGESTIONS: Record<string, SeasonalGroup> = {
  'jan-feb': [
    { id: 's-ski-sapa', text: 'Ski trip to Sapa', icon: Snowflake },
    { id: 's-lunar-hoian', text: 'Lunar New Year in Hoi An', icon: SunHorizon },
    { id: 's-winter-alps', text: 'Winter escape to the Alps', icon: Mountains },
    { id: 's-hot-springs-jp', text: 'Hot springs in Japan', icon: Globe },
  ],
  'mar-apr': [
    { id: 's-cherry-tokyo', text: 'Cherry blossoms in Tokyo', icon: TreePalm },
    { id: 's-spring-bcn', text: 'Spring in Barcelona', icon: SunHorizon },
    { id: 's-cycling-nl', text: 'Cycling through the Netherlands', icon: Bicycle },
    { id: 's-hike-patagonia', text: 'Hiking in Patagonia', icon: Mountains },
  ],
  'may-jun': [
    { id: 's-summer-bali', text: 'Summer in Bali', icon: TreePalm },
    { id: 's-greek-islands', text: 'Greek islands getaway', icon: Boat },
    { id: 's-road-trip-cali', text: 'Road trip along California coast', icon: AirplaneTilt },
    { id: 's-safari-kenya', text: 'Wildlife safari in Kenya', icon: Binoculars },
  ],
  'jul-aug': [
    { id: 's-north-eu', text: 'Northern Europe road trip', icon: Train },
    { id: 's-beach-pq', text: 'Beach holiday in Phu Quoc', icon: TreePalm },
    { id: 's-camping-norway', text: 'Camping in Norway fjords', icon: Tent },
    { id: 's-island-maldives', text: 'Island hopping in the Maldives', icon: Boat },
  ],
  'sep-oct': [
    { id: 's-autumn-seoul', text: 'Autumn in Seoul', icon: SunHorizon },
    { id: 's-oktoberfest', text: 'Oktoberfest in Munich', icon: BowlFood },
    { id: 's-ruins-rome', text: 'Ancient ruins in Rome', icon: Church },
    { id: 's-trek-nepal', text: 'Trekking in Nepal', icon: Mountains },
  ],
  'nov-dec': [
    { id: 's-winter-hokkaido', text: 'Winter wonderland in Hokkaido', icon: Snowflake },
    { id: 's-xmas-prague', text: 'Christmas markets in Prague', icon: Globe },
    { id: 's-nye-sydney', text: 'New Year in Sydney', icon: SunHorizon },
    { id: 's-tropical-thai', text: 'Tropical escape to Thailand', icon: TreePalm },
  ],
};

const PROFILE_SUGGESTIONS: Record<string, Suggestion[]> = {
  // Traveler types
  foodie: [
    { id: 'p-street-bkk', text: 'Street food tour in Bangkok', icon: ForkKnife },
    { id: 'p-pasta-italy', text: 'Culinary tour of Italy', icon: CookingPot },
    { id: 'p-tapas-spain', text: 'Tapas crawl in Madrid', icon: BowlFood },
  ],
  adventurer: [
    { id: 'p-trek-nepal', text: 'Trekking in Nepal', icon: Mountains },
    { id: 'p-dive-philippines', text: 'Scuba diving in the Philippines', icon: Boat },
    { id: 'p-climb-kilimanjaro', text: 'Climbing Kilimanjaro', icon: Mountains },
  ],
  'culture-lover': [
    { id: 'p-angkor', text: 'Temple tour in Angkor Wat', icon: Church },
    { id: 'p-museums-paris', text: 'Museum hopping in Paris', icon: Globe },
    { id: 'p-heritage-kyoto', text: 'Cultural heritage of Kyoto', icon: Church },
  ],
  'budget-traveler': [
    { id: 'p-backpack-sea', text: 'Backpacking Southeast Asia under $30/day', icon: Backpack },
    { id: 'p-hostel-eu', text: 'Budget Europe by rail', icon: Train },
  ],
  'luxury-traveler': [
    { id: 'p-overwater-maldives', text: 'Overwater villa in the Maldives', icon: Bed },
    { id: 'p-luxury-safari', text: 'Luxury safari in Tanzania', icon: Binoculars },
  ],
  // Spending habits
  budget: [
    { id: 'p-budget-sea', text: 'Backpacking Southeast Asia under $30/day', icon: Backpack },
  ],
  // Travel companions
  family: [
    { id: 'p-family-sg', text: 'Family-friendly trip to Singapore', icon: Users },
    { id: 'p-family-disney', text: 'Family adventure in Tokyo Disney', icon: Users },
  ],
  solo: [
    { id: 'p-solo-vietnam', text: 'Solo backpacking through Vietnam', icon: Backpack },
    { id: 'p-solo-japan', text: 'Solo exploration of Japan', icon: Train },
  ],
  couple: [
    { id: 'p-romantic-santorini', text: 'Romantic getaway to Santorini', icon: Boat },
    { id: 'p-couple-paris', text: 'Couple retreat in Paris', icon: Globe },
  ],
  friends: [
    { id: 'p-friends-bali', text: 'Group trip to Bali', icon: Users },
    { id: 'p-friends-ibiza', text: 'Party weekend in Ibiza', icon: Users },
  ],
};

const QUICK_PROMPTS: Suggestion[] = [
  { id: 'q-weekend', text: 'Plan a weekend getaway', icon: CalendarBlank },
  { id: 'q-flights', text: 'Find the cheapest flights to...', icon: Airplane },
  { id: 'q-restaurants', text: 'Suggest restaurants near my hotel in...', icon: ForkKnife },
  { id: 'q-itinerary', text: 'Create a 5-day itinerary for...', icon: ListChecks },
  { id: 'q-packing', text: 'What should I pack for...', icon: Backpack },
  { id: 'q-hidden-gems', text: 'Hidden gems to visit in...', icon: MapPin },
];

function getSeasonKey(month: number): string {
  if (month <= 1) return 'jan-feb';
  if (month <= 3) return 'mar-apr';
  if (month <= 5) return 'may-jun';
  if (month <= 7) return 'jul-aug';
  if (month <= 9) return 'sep-oct';
  return 'nov-dec';
}

function shuffleArray<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function getProfileSuggestions(profile: TravelProfile): Suggestion[] {
  const matched: Suggestion[] = [];
  const seen = new Set<string>();

  const addUnique = (suggestions: Suggestion[]) => {
    for (const s of suggestions) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        matched.push(s);
      }
    }
  };

  for (const type of profile.travelerTypes ?? []) {
    const key = type.toLowerCase().replace(/\s+/g, '-');
    if (PROFILE_SUGGESTIONS[key]) {
      addUnique(PROFILE_SUGGESTIONS[key]);
    }
  }

  for (const companion of profile.travelCompanions ?? []) {
    const key = companion.toLowerCase().replace(/\s+/g, '-');
    if (PROFILE_SUGGESTIONS[key]) {
      addUnique(PROFILE_SUGGESTIONS[key]);
    }
  }

  if (profile.spendingHabits) {
    const key = profile.spendingHabits.toLowerCase().replace(/\s+/g, '-');
    if (PROFILE_SUGGESTIONS[key]) {
      addUnique(PROFILE_SUGGESTIONS[key]);
    }
  }

  return matched;
}

const TARGET_COUNT = 6;

function buildSuggestions(
  profile: TravelProfile | null,
  month: number
): Suggestion[] {
  const seasonKey = getSeasonKey(month);
  const seasonal = shuffleArray(SEASONAL_SUGGESTIONS[seasonKey] ?? []);
  const profileBased = profile
    ? shuffleArray(getProfileSuggestions(profile))
    : [];
  const quick = shuffleArray(QUICK_PROMPTS);

  const result: Suggestion[] = [];
  const seen = new Set<string>();

  const add = (s: Suggestion): boolean => {
    if (seen.has(s.id) || result.length >= TARGET_COUNT) return false;
    seen.add(s.id);
    result.push(s);
    return true;
  };

  // Mix: up to 2 seasonal, up to 2 profile, fill rest with quick
  for (const s of seasonal.slice(0, 2)) add(s);
  for (const s of profileBased.slice(0, 2)) add(s);
  for (const s of quick) {
    if (result.length >= TARGET_COUNT) break;
    add(s);
  }

  // If still short, backfill with remaining seasonal/profile
  const remaining = [...seasonal.slice(2), ...profileBased.slice(2)];
  for (const s of remaining) {
    if (result.length >= TARGET_COUNT) break;
    add(s);
  }

  return result;
}

export function useSuggestions(): {
  suggestions: Suggestion[];
  isLoading: boolean;
} {
  const [profile, setProfile] = useState<TravelProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    try {
      const result = await travelProfileService.getProfile();
      setProfile(result);
    } catch {
      // Profile unavailable -- fall back to generic suggestions
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchProfile();
  }, [fetchProfile]);

  const suggestions = useMemo(() => {
    const month = new Date().getMonth();
    return buildSuggestions(profile, month);
  }, [profile]);

  return { suggestions, isLoading };
}
