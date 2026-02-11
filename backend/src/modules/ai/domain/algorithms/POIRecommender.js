/**
 * POI Recommender
 * Recommends Points of Interest based on user preferences
 * Uses content-based filtering and collaborative filtering concepts
 */

/**
 * Interest categories and their related keywords
 */
export const INTEREST_KEYWORDS = {
  nature: ['park', 'garden', 'lake', 'mountain', 'beach', 'forest', 'river', 'waterfall', 'thiên nhiên', 'công viên', 'hồ', 'núi', 'biển', 'rừng'],
  culture: ['museum', 'temple', 'pagoda', 'church', 'historical', 'heritage', 'bảo tàng', 'đền', 'chùa', 'nhà thờ', 'di tích', 'lịch sử'],
  food: ['restaurant', 'cafe', 'street food', 'local cuisine', 'nhà hàng', 'quán ăn', 'đặc sản', 'ẩm thực'],
  shopping: ['mall', 'market', 'shop', 'store', 'boutique', 'chợ', 'trung tâm mua sắm', 'cửa hàng'],
  nightlife: ['bar', 'club', 'pub', 'rooftop', 'night market', 'quán bar', 'vũ trường'],
  adventure: ['hiking', 'diving', 'surfing', 'trekking', 'climbing', 'phượt', 'leo núi', 'lặn biển'],
  relaxation: ['spa', 'massage', 'resort', 'beach', 'hot spring', 'spa', 'nghỉ dưỡng', 'suối nước nóng'],
  photography: ['viewpoint', 'scenic', 'landmark', 'instagram', 'view đẹp', 'check-in', 'sống ảo'],
  family: ['amusement park', 'zoo', 'aquarium', 'playground', 'công viên giải trí', 'sở thú', 'thủy cung'],
  romantic: ['sunset', 'cruise', 'fine dining', 'couples', 'lãng mạn', 'hoàng hôn'],
};

/**
 * Travel style characteristics
 */
export const TRAVEL_STYLE_PROFILE = {
  budget: {
    preferredPriceLevel: ['budget', 'free'],
    avoidTypes: ['luxury', 'fine dining', 'resort'],
    bonusTypes: ['street food', 'local market', 'free attraction'],
  },
  comfort: {
    preferredPriceLevel: ['mid-range', 'budget'],
    avoidTypes: [],
    bonusTypes: ['well-reviewed', 'convenient location'],
  },
  luxury: {
    preferredPriceLevel: ['luxury', 'mid-range'],
    avoidTypes: ['budget', 'hostel'],
    bonusTypes: ['5-star', 'premium', 'exclusive', 'fine dining'],
  },
  adventure: {
    preferredPriceLevel: ['budget', 'mid-range'],
    avoidTypes: ['luxury resort', 'spa'],
    bonusTypes: ['outdoor', 'hiking', 'adventure', 'off-beaten-path'],
  },
  cultural: {
    preferredPriceLevel: ['budget', 'mid-range'],
    avoidTypes: ['nightclub', 'shopping mall'],
    bonusTypes: ['historical', 'museum', 'temple', 'local experience'],
  },
};

/**
 * Calculate content-based similarity score
 * @param {Object} place - Place to score
 * @param {Array} userInterests - User's interests
 * @returns {number} Similarity score (0-100)
 */
export function calculateInterestMatch(place, userInterests) {
  if (!userInterests || userInterests.length === 0) return 50;

  const placeText = [
    place.name,
    place.type,
    place.description,
    ...(place.categories || []),
    ...(place.tags || []),
  ].filter(Boolean).join(' ').toLowerCase();

  let matchScore = 0;
  let totalWeight = 0;

  for (const interest of userInterests) {
    const keywords = INTEREST_KEYWORDS[interest.toLowerCase()] || [interest.toLowerCase()];
    const weight = 1; // Can be customized based on user preference strength

    const matches = keywords.filter(keyword =>
      placeText.includes(keyword.toLowerCase())
    ).length;

    if (matches > 0) {
      matchScore += weight * Math.min(1, matches / 2); // Cap at 100% match per interest
    }
    totalWeight += weight;
  }

  return totalWeight > 0 ? (matchScore / totalWeight) * 100 : 50;
}

/**
 * Calculate travel style compatibility
 * @param {Object} place - Place to score
 * @param {string} travelStyle - User's travel style
 * @returns {number} Compatibility score (0-100)
 */
export function calculateStyleCompatibility(place, travelStyle) {
  const profile = TRAVEL_STYLE_PROFILE[travelStyle] || TRAVEL_STYLE_PROFILE.comfort;

  let score = 50; // Base score

  const placeText = [
    place.name,
    place.type,
    place.priceLevel,
    ...(place.categories || []),
  ].filter(Boolean).join(' ').toLowerCase();

  // Check price level preference
  if (place.priceLevel) {
    if (profile.preferredPriceLevel.includes(place.priceLevel.toLowerCase())) {
      score += 20;
    }
  }

  // Check avoid types
  for (const avoidType of profile.avoidTypes) {
    if (placeText.includes(avoidType.toLowerCase())) {
      score -= 15;
    }
  }

  // Check bonus types
  for (const bonusType of profile.bonusTypes) {
    if (placeText.includes(bonusType.toLowerCase())) {
      score += 10;
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate rating-based score with Bayesian average
 * Prevents new places with few reviews from ranking too high
 * @param {Object} place - Place with rating data
 * @param {Object} globalStats - Global rating statistics
 * @returns {number} Adjusted rating score (0-100)
 */
export function calculateRatingScore(place, globalStats = {}) {
  const {
    avgRating = 4.0,
    minReviews = 10, // Minimum reviews for full confidence
  } = globalStats;

  const rating = place.rating || 0;
  const reviewCount = place.ratingCount || place.reviewCount || 0;

  if (rating === 0) return 40; // Default for unrated places

  // Bayesian average: weighted average of place rating and global average
  const confidence = reviewCount / (reviewCount + minReviews);
  const adjustedRating = confidence * rating + (1 - confidence) * avgRating;

  // Convert to 0-100 scale
  return (adjustedRating / 5) * 100;
}

/**
 * Calculate freshness/recency bonus
 * Newer or recently updated places get a small boost
 * @param {Object} place - Place object
 * @returns {number} Freshness bonus (0-10)
 */
export function calculateFreshnessBonus(place) {
  if (!place.updatedAt && !place.createdAt) return 0;

  const lastUpdate = new Date(place.updatedAt || place.createdAt);
  const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < 7) return 10;
  if (daysSinceUpdate < 30) return 5;
  if (daysSinceUpdate < 90) return 2;
  return 0;
}

/**
 * Calculate diversity penalty
 * Reduces score for places similar to already selected places
 * @param {Object} place - Place to score
 * @param {Array} selectedPlaces - Already selected places
 * @returns {number} Diversity penalty (0-20)
 */
export function calculateDiversityPenalty(place, selectedPlaces) {
  if (!selectedPlaces || selectedPlaces.length === 0) return 0;

  let penalty = 0;

  // Check for same type — soft penalty, don't over-penalize
  // e.g., a food tour trip legitimately has many RESTAURANTs
  const sameType = selectedPlaces.filter(p => p.type === place.type).length;
  penalty += sameType * 3; // Reduced from 5

  // Check for nearby places
  if (place.latitude && place.longitude) {
    const veryNearby = selectedPlaces.filter(p => {
      if (!p.latitude || !p.longitude) return false;
      const dist = Math.sqrt(
        Math.pow(p.latitude - place.latitude, 2) +
        Math.pow(p.longitude - place.longitude, 2)
      );
      return dist < 0.005; // Tightened to ~500m (was 1km) — only penalize very close duplicates
    }).length;
    penalty += veryNearby * 2; // Reduced from 3
  }

  return Math.min(15, penalty); // Reduced cap from 20
}

/**
 * Main recommendation scoring function
 * Combines all factors into a final score
 * @param {Object} place - Place to score
 * @param {Object} userProfile - User preferences
 * @param {Array} selectedPlaces - Already selected places
 * @returns {Object} Scored place with breakdown
 */
export function scorePlace(place, userProfile = {}, selectedPlaces = []) {
  const {
    interests = [],
    travelStyle = 'comfort',
    prioritizeRating = true,
    prioritizeDiversity = true,
    dietaryRestrictions = [],
  } = userProfile;

  // Calculate individual scores
  const interestScore = calculateInterestMatch(place, interests);
  const styleScore = calculateStyleCompatibility(place, travelStyle);
  const ratingScore = calculateRatingScore(place);
  const freshnessBonus = calculateFreshnessBonus(place);
  const diversityPenalty = prioritizeDiversity
    ? calculateDiversityPenalty(place, selectedPlaces)
    : 0;

  // Dietary compatibility bonus/penalty for restaurants
  let dietaryBonus = 0;
  if (dietaryRestrictions.length > 0 && (place.type === 'RESTAURANT' || place.type === 'CAFE')) {
    const placeText = [
      place.name,
      place.description,
      ...(place.categories || []),
      ...(place.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();

    // Boost places that match dietary keywords
    const dietaryKeywords = {
      vegetarian: ['chay', 'vegetarian', 'vegan', 'plant-based', 'rau'],
      vegan: ['vegan', 'chay', 'plant-based', 'thuần chay'],
      halal: ['halal'],
      'gluten-free': ['gluten-free', 'gluten free'],
      kosher: ['kosher'],
    };

    for (const restriction of dietaryRestrictions) {
      const keywords = dietaryKeywords[restriction.toLowerCase()] || [restriction.toLowerCase()];
      if (keywords.some(kw => placeText.includes(kw))) {
        dietaryBonus += 10; // Boost matching restaurants
      }
    }
  }

  // Weighted combination
  const weights = {
    interest: 0.35,
    style: 0.20,
    rating: prioritizeRating ? 0.35 : 0.25,
    freshness: 0.10,
  };

  const baseScore =
    interestScore * weights.interest +
    styleScore * weights.style +
    ratingScore * weights.rating +
    freshnessBonus +
    dietaryBonus;

  const finalScore = Math.max(0, baseScore - diversityPenalty);

  return {
    ...place,
    score: Math.round(finalScore * 100) / 100,
    scoreBreakdown: {
      interest: Math.round(interestScore),
      style: Math.round(styleScore),
      rating: Math.round(ratingScore),
      freshness: freshnessBonus,
      dietaryBonus,
      diversityPenalty,
    },
  };
}

/**
 * Filter places based on hard constraints
 * @param {Array} places - All places
 * @param {Object} constraints - Filter constraints
 * @returns {Array} Filtered places
 */
export function filterPlaces(places, constraints = {}) {
  const {
    types = [], // Include only these types
    excludeTypes = [],
    minRating = 0,
    maxPrice = Infinity,
    mustHaveCoordinates = false,
    mustHavePhotos = false,
    openNow = false,
    currentTime = null,
  } = constraints;

  return places.filter(place => {
    // Type filter
    if (types.length > 0 && !types.includes(place.type)) {
      return false;
    }

    // Exclude type filter
    if (excludeTypes.length > 0 && excludeTypes.includes(place.type)) {
      return false;
    }

    // Rating filter
    if (place.rating && place.rating < minRating) {
      return false;
    }

    // Price filter
    const priceMap = { budget: 1, 'mid-range': 2, luxury: 3 };
    const placePrice = priceMap[place.priceLevel] || 2;
    if (placePrice > maxPrice) {
      return false;
    }

    // Coordinates filter
    if (mustHaveCoordinates && (!place.latitude || !place.longitude)) {
      return false;
    }

    // Photos filter
    if (mustHavePhotos && (!place.photos || place.photos.length === 0)) {
      return false;
    }

    // Open now filter (simplified)
    if (openNow && place.openingHours && currentTime) {
      // This would need proper time parsing logic
    }

    return true;
  });
}

/**
 * Get personalized recommendations
 * @param {Array} places - All available places
 * @param {Object} userProfile - User preferences
 * @param {Object} options - Recommendation options
 * @returns {Array} Sorted and scored places
 */
export function getRecommendations(places, userProfile = {}, options = {}) {
  const {
    limit = 20,
    filterConstraints = {},
    selectedPlaces = [],
    includeScoreBreakdown = false,
  } = options;

  // Step 1: Filter places
  let filteredPlaces = filterPlaces(places, filterConstraints);

  // Step 2: Score remaining places
  const scoredPlaces = filteredPlaces.map(place =>
    scorePlace(place, userProfile, selectedPlaces)
  );

  // Step 3: Sort by score
  scoredPlaces.sort((a, b) => b.score - a.score);

  // Step 4: Apply limit
  const recommendations = scoredPlaces.slice(0, limit);

  // Step 5: Clean up output if needed
  if (!includeScoreBreakdown) {
    return recommendations.map(({ scoreBreakdown, ...place }) => {
      // Validate scoreBreakdown exists for debugging
      if (scoreBreakdown && Object.keys(scoreBreakdown).length === 0) {
        console.warn('Empty scoreBreakdown detected for place:', place.id);
      }
      return place;
    });
  }

  return recommendations;
}

/**
 * Get diverse recommendations
 * Ensures variety in the recommended places
 * @param {Array} places - All places
 * @param {Object} userProfile - User preferences
 * @param {number} count - Number of recommendations
 * @returns {Array} Diverse recommendations
 */
export function getDiverseRecommendations(places, userProfile, count = 10) {
  const selected = [];
  const availablePlaces = [...places];

  while (selected.length < count && availablePlaces.length > 0) {
    // Score all available places considering already selected
    const scoredPlaces = availablePlaces.map(place =>
      scorePlace(place, { ...userProfile, prioritizeDiversity: true }, selected)
    );

    // Sort by score
    scoredPlaces.sort((a, b) => b.score - a.score);

    // Select top place
    const topPlace = scoredPlaces[0];
    selected.push(topPlace);

    // Remove from available
    const index = availablePlaces.findIndex(p =>
      (p.id && p.id === topPlace.id) || p.name === topPlace.name
    );
    if (index > -1) {
      availablePlaces.splice(index, 1);
    }
  }

  return selected;
}

/**
 * Get places by category distribution
 * Ensures balanced selection across categories
 * @param {Array} places - All places
 * @param {Object} distribution - Desired category distribution
 * @param {Object} userProfile - User preferences
 * @returns {Array} Balanced recommendations
 */
export function getBalancedRecommendations(places, distribution, userProfile = {}) {
  // Example distribution: { ATTRACTION: 5, RESTAURANT: 3, CAFE: 2 }
  const results = [];

  for (const [type, count] of Object.entries(distribution)) {
    const typePlaces = places.filter(p => p.type === type);
    const recommendations = getRecommendations(typePlaces, userProfile, {
      limit: count,
      selectedPlaces: results,
    });
    results.push(...recommendations);
  }

  return results;
}

export default {
  calculateInterestMatch,
  calculateStyleCompatibility,
  calculateRatingScore,
  scorePlace,
  filterPlaces,
  getRecommendations,
  getDiverseRecommendations,
  getBalancedRecommendations,
  INTEREST_KEYWORDS,
  TRAVEL_STYLE_PROFILE,
};
