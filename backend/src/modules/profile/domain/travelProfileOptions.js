/**
 * Travel Profile Options
 * Static options data for onboarding UI
 */

export const TRAVEL_PROFILE_OPTIONS = {
  travelCompanions: [
    {
      value: 'solo',
      label: 'Solo',
      icon: 'User',
      description: 'Traveling on my own',
    },
    {
      value: 'couple',
      label: 'Couple',
      icon: 'Heart',
      description: 'Traveling as a couple',
    },
    {
      value: 'family',
      label: 'Family',
      icon: 'UsersThree',
      description: 'Traveling with family',
    },
    {
      value: 'friends',
      label: 'Friends',
      icon: 'UsersFour',
      description: 'Traveling with friends',
    },
    {
      value: 'group',
      label: 'Group',
      icon: 'Users',
      description: 'Group travel',
    },
  ],

  genders: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'non_binary', label: 'Non-binary' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  ],

  spendingHabits: [
    {
      value: 'budget',
      label: 'Budget',
      icon: 'Wallet',
      description: 'I prefer affordable options and saving money',
      color: '#22c55e',
    },
    {
      value: 'moderate',
      label: 'Mid-range',
      icon: 'CurrencyCircleDollar',
      description: 'I balance comfort with cost',
      color: '#3b82f6',
    },
    {
      value: 'luxury',
      label: 'Luxury',
      icon: 'Crown',
      description: 'I enjoy premium experiences and comfort',
      color: '#a855f7',
    },
  ],

  dailyRhythm: [
    {
      value: 'early_bird',
      label: 'Early bird',
      icon: 'SunHorizon',
      description: 'I like to start my day early',
      color: '#f59e0b',
    },
    {
      value: 'flexible',
      label: 'Flexible',
      icon: 'Clock',
      description: 'I go with the flow',
      color: '#3b82f6',
    },
    {
      value: 'night_owl',
      label: 'Night owl',
      icon: 'Moon',
      description: 'I come alive at night',
      color: '#6366f1',
    },
  ],

  socialPreference: [
    {
      value: 'solo',
      label: 'Self-guided',
      icon: 'Compass',
      description: 'I prefer exploring on my own',
    },
    {
      value: 'small_group',
      label: 'Small group',
      icon: 'UsersThree',
      description: 'I enjoy small group experiences',
    },
    {
      value: 'guided_group',
      label: 'Guided tours',
      icon: 'Flag',
      description: 'I prefer organized guided tours',
    },
  ],

  travelerTypes: [
    {
      value: 'adventurer',
      label: 'Adventure Seeker',
      icon: 'Mountains',
      color: '#ef4444',
      description: 'Thrill-seeking and outdoor activities',
      suggestedQuestions: [
        'What extreme sports are available?',
        'Best hiking trails nearby?',
        'Any adventure tour operators?',
      ],
      persona: {
        title: 'The Adventurer',
        description: 'You thrive on adrenaline and love pushing your limits with outdoor activities and extreme sports.',
      },
    },
    {
      value: 'explorer',
      label: 'Explorer',
      icon: 'Compass',
      color: '#f59e0b',
      description: 'Discovering hidden gems and off-the-beaten-path',
      suggestedQuestions: [
        'What are the hidden gems here?',
        'Best local neighborhoods to explore?',
        'Any secret spots locals love?',
      ],
      persona: {
        title: 'The Explorer',
        description: 'You love discovering new places and going off the beaten path to find unique experiences.',
      },
    },
    {
      value: 'culture_seeker',
      label: 'Culture Enthusiast',
      icon: 'Bank',
      color: '#8b5cf6',
      description: 'Museums, history, and local traditions',
      suggestedQuestions: [
        'What museums are must-visit?',
        'Any local festivals happening?',
        'Best cultural experiences here?',
      ],
      persona: {
        title: 'The Culture Enthusiast',
        description: 'You seek to understand the history, art, and traditions of every place you visit.',
      },
    },
    {
      value: 'foodie',
      label: 'Food Lover',
      icon: 'ForkKnife',
      color: '#ec4899',
      description: 'Local cuisine and culinary experiences',
      suggestedQuestions: [
        'Best local dishes to try?',
        'Any food tours available?',
        'Where do locals eat?',
      ],
      persona: {
        title: 'The Foodie',
        description: 'You travel with your taste buds, seeking authentic local flavors and culinary adventures.',
      },
    },
    {
      value: 'photographer',
      label: 'Photography Enthusiast',
      icon: 'Camera',
      color: '#06b6d4',
      description: 'Scenic views and Instagram-worthy spots',
      suggestedQuestions: [
        'Best photo spots in the area?',
        'Golden hour viewpoints?',
        'Any photography tours?',
      ],
      persona: {
        title: 'The Photographer',
        description: 'You see the world through a lens, always looking for the perfect shot and scenic views.',
      },
    },
    {
      value: 'relaxation',
      label: 'Relaxation Focused',
      icon: 'Sun',
      color: '#22c55e',
      description: 'Spas, beaches, and unwinding',
      suggestedQuestions: [
        'Best spas and wellness centers?',
        'Most relaxing beaches nearby?',
        'Any retreat or resort recommendations?',
      ],
      persona: {
        title: 'The Relaxer',
        description: 'You travel to recharge, seeking peaceful settings and rejuvenating experiences.',
      },
    },
    {
      value: 'budget_traveler',
      label: 'Budget Conscious',
      icon: 'Piggy',
      color: '#14b8a6',
      description: 'Getting the most value for money',
      suggestedQuestions: [
        'Best free things to do?',
        'Affordable accommodation options?',
        'Budget-friendly restaurants?',
      ],
      persona: {
        title: 'The Budget Traveler',
        description: 'You maximize every dollar, finding incredible experiences without breaking the bank.',
      },
    },
    {
      value: 'luxury_traveler',
      label: 'Luxury Traveler',
      icon: 'Diamond',
      color: '#a855f7',
      description: 'Premium experiences and top-tier service',
      suggestedQuestions: [
        'Best luxury hotels in the area?',
        'Fine dining recommendations?',
        'VIP experiences available?',
      ],
      persona: {
        title: 'The Luxury Traveler',
        description: 'You appreciate the finer things and seek premium, curated travel experiences.',
      },
    },
  ],
};
