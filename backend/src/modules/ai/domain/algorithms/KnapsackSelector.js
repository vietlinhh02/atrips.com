/**
 * Knapsack Selector
 * Selects the best combination of places within time/budget constraints
 * Uses dynamic programming and greedy approaches
 */

/**
 * Calculate value score for a place based on multiple factors
 * @param {Object} place - Place object
 * @param {Object} preferences - User preferences
 * @returns {number} Value score (0-100)
 */
export function calculatePlaceValue(place, preferences = {}) {
  const {
    interests = [],
    travelStyle = 'comfort',
    prioritizeRating = true,
    prioritizePopular = false,
  } = preferences;

  let score = 50; // Base score

  // Rating contribution (0-25 points)
  if (place.rating) {
    const ratingScore = (place.rating / 5) * 25;
    score += prioritizeRating ? ratingScore * 1.5 : ratingScore;
  }

  // Popularity contribution (0-15 points)
  if (place.ratingCount || place.reviewCount) {
    const reviewCount = place.ratingCount || place.reviewCount;
    const popularityScore = Math.min(15, Math.log10(reviewCount + 1) * 5);
    score += prioritizePopular ? popularityScore * 1.5 : popularityScore;
  }

  // Interest match contribution (0-20 points)
  if (interests.length > 0) {
    const placeCategories = [
      place.type?.toLowerCase(),
      ...(place.categories || []).map(c => c.toLowerCase()),
    ].filter(Boolean);

    const matchCount = interests.filter(interest =>
      placeCategories.some(cat =>
        cat.includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(cat)
      )
    ).length;

    score += (matchCount / Math.max(interests.length, 1)) * 20;
  }

  // Price level contribution (depends on travel style)
  if (place.priceLevel) {
    const priceLevels = { budget: 1, 'mid-range': 2, luxury: 3 };
    const stylePreference = {
      budget: 1,
      comfort: 2,
      luxury: 3,
    };

    const placePrice = priceLevels[place.priceLevel] || 2;
    const userPreference = stylePreference[travelStyle] || 2;

    // Higher score if price level matches preference
    const priceDiff = Math.abs(placePrice - userPreference);
    score += (3 - priceDiff) * 5; // 0-15 points
  }

  // Must-see attraction bonus
  if (place.mustSee || place.landmark) {
    score += 15;
  }

  // Unique experience bonus
  if (place.unique || place.authentic) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * 0/1 Knapsack using Dynamic Programming
 * Selects places maximizing total value within time constraint
 * @param {Array} places - Array of places with value and duration
 * @param {number} maxTime - Maximum available time in minutes
 * @returns {Object} {selected: Array, totalValue: number, totalTime: number}
 */
export function knapsackDP(places, maxTime) {
  const n = places.length;

  // Discretize time to 15-minute slots for efficiency
  const timeUnit = 15;
  const capacity = Math.floor(maxTime / timeUnit);

  // DP table: dp[i][w] = max value using first i items with capacity w
  const dp = Array(n + 1).fill(null).map(() =>
    Array(capacity + 1).fill(0)
  );

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    const place = places[i - 1];
    const weight = Math.ceil(place.duration / timeUnit);
    const value = place.value;

    for (let w = 0; w <= capacity; w++) {
      if (weight <= w) {
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - weight] + value);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Backtrack to find selected items
  const selected = [];
  let w = capacity;

  for (let i = n; i > 0 && w > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(places[i - 1]);
      w -= Math.ceil(places[i - 1].duration / timeUnit);
    }
  }

  selected.reverse();

  const totalValue = selected.reduce((sum, p) => sum + p.value, 0);
  const totalTime = selected.reduce((sum, p) => sum + p.duration, 0);

  return {
    selected,
    totalValue,
    totalTime,
    utilizationRate: (totalTime / maxTime) * 100,
  };
}

/**
 * Greedy selection by value-to-time ratio
 * Faster but may not be optimal
 * @param {Array} places - Array of places
 * @param {number} maxTime - Maximum time
 * @returns {Object} Selection result
 */
export function greedySelect(places, maxTime) {
  // Sort by value/duration ratio (efficiency)
  const sorted = [...places].sort((a, b) => {
    const ratioA = a.value / (a.duration || 60);
    const ratioB = b.value / (b.duration || 60);
    return ratioB - ratioA;
  });

  const selected = [];
  let remainingTime = maxTime;

  for (const place of sorted) {
    if (place.duration <= remainingTime) {
      selected.push(place);
      remainingTime -= place.duration;
    }
  }

  const totalValue = selected.reduce((sum, p) => sum + p.value, 0);
  const totalTime = selected.reduce((sum, p) => sum + p.duration, 0);

  return {
    selected,
    totalValue,
    totalTime,
    utilizationRate: (totalTime / maxTime) * 100,
  };
}

/**
 * Multi-constraint Knapsack
 * Considers both time AND budget constraints
 * @param {Array} places - Places with value, duration, and cost
 * @param {number} maxTime - Maximum time in minutes
 * @param {number} maxBudget - Maximum budget
 * @returns {Object} Selection result
 */
export function multiConstraintSelect(places, maxTime, maxBudget) {
  const n = places.length;

  // Early return if no places available
  if (n === 0) {
    return {
      selected: [],
      totalValue: 0,
      totalTime: 0,
      totalCost: 0,
      timeUtilization: 0,
      budgetUtilization: 0,
    };
  }

  // Use greedy approach with multiple constraints for efficiency
  // Sort by combined efficiency score
  const sorted = [...places].map(place => ({
    ...place,
    efficiency: place.value / (
      (place.duration || 60) / maxTime +
      (place.cost || 0) / (maxBudget || Infinity) +
      0.1 // Prevent division by zero
    ),
  })).sort((a, b) => b.efficiency - a.efficiency);

  const selected = [];
  let remainingTime = maxTime;
  let remainingBudget = maxBudget;

  for (const place of sorted) {
    const cost = place.cost || 0;
    const duration = place.duration || 60;

    if (duration <= remainingTime && cost <= remainingBudget) {
      selected.push(place);
      remainingTime -= duration;
      remainingBudget -= cost;
    }
  }

  const totalValue = selected.reduce((sum, p) => sum + p.value, 0);
  const totalTime = selected.reduce((sum, p) => sum + p.duration, 0);
  const totalCost = selected.reduce((sum, p) => sum + (p.cost || 0), 0);

  return {
    selected,
    totalValue,
    totalTime,
    totalCost,
    timeUtilization: (totalTime / maxTime) * 100,
    budgetUtilization: maxBudget ? (totalCost / maxBudget) * 100 : 0,
  };
}

/**
 * Select places for multiple days
 * Distributes places across days while maximizing total value
 * @param {Array} places - All places
 * @param {number} numDays - Number of days
 * @param {number} timePerDay - Available time per day in minutes
 * @param {Object} options - Additional options
 * @returns {Array} Array of day selections
 */
export function selectForMultipleDays(places, numDays, timePerDay, options = {}) {
  const { budgetPerDay = Infinity, mustSeeFirst = true } = options;

  // Sort places by value
  let sortedPlaces = [...places].sort((a, b) => b.value - a.value);

  // Prioritize must-see attractions
  if (mustSeeFirst) {
    const mustSee = sortedPlaces.filter(p => p.mustSee || p.landmark);
    const others = sortedPlaces.filter(p => !p.mustSee && !p.landmark);
    sortedPlaces = [...mustSee, ...others];
  }

  const daySelections = [];
  const usedPlaces = new Set();
  const MIN_PLACES_PER_DAY = 3;

  for (let day = 0; day < numDays; day++) {
    // Get available places for this day
    const availablePlaces = sortedPlaces.filter(p => !usedPlaces.has(p.id || p.name));

    // Select for this day
    const selection = multiConstraintSelect(
      availablePlaces,
      timePerDay,
      budgetPerDay
    );

    // Ensure minimum places per day: if Knapsack selected too few but more are available,
    // force-add top-scored remaining places (they'll still fit in the 08:00-21:00 day window)
    if (selection.selected.length < MIN_PLACES_PER_DAY && availablePlaces.length > selection.selected.length) {
      const selectedIds = new Set(selection.selected.map(p => p.id || p.name));
      const remaining = availablePlaces
        .filter(p => !selectedIds.has(p.id || p.name))
        .sort((a, b) => b.value - a.value);

      const needed = MIN_PLACES_PER_DAY - selection.selected.length;
      const extra = remaining.slice(0, needed);
      selection.selected.push(...extra);
      selection.totalValue += extra.reduce((sum, p) => sum + p.value, 0);
      selection.totalTime += extra.reduce((sum, p) => sum + (p.duration || 60), 0);
      selection.totalCost += extra.reduce((sum, p) => sum + (p.cost || 0), 0);
    }

    // Mark places as used
    selection.selected.forEach(p => usedPlaces.add(p.id || p.name));

    daySelections.push({
      day: day + 1,
      ...selection,
    });
  }

  // Calculate overall statistics
  const totalSelected = daySelections.reduce((sum, d) => sum + d.selected.length, 0);
  const totalValue = daySelections.reduce((sum, d) => sum + d.totalValue, 0);
  const totalTime = daySelections.reduce((sum, d) => sum + d.totalTime, 0);
  const totalCost = daySelections.reduce((sum, d) => sum + d.totalCost, 0);

  return {
    days: daySelections,
    summary: {
      totalPlacesSelected: totalSelected,
      totalPlacesAvailable: places.length,
      totalValue,
      totalTime,
      totalCost,
      coverageRate: (totalSelected / places.length) * 100,
    },
  };
}

/**
 * Main selection function - chooses best algorithm based on input
 * @param {Array} places - Places to select from
 * @param {Object} constraints - Time/budget constraints
 * @param {Object} preferences - User preferences
 * @returns {Object} Selection result
 */
export function selectBestPlaces(places, constraints = {}, preferences = {}) {
  const {
    maxTime = 480, // 8 hours default
    maxBudget = Infinity,
    numDays = 1,
    timePerDay = null,
  } = constraints;

  // Calculate value for each place
  const scoredPlaces = places.map(place => ({
    ...place,
    value: calculatePlaceValue(place, preferences),
    duration: place.duration || place.estimatedDuration || 60,
    cost: place.cost || place.estimatedCost || 0,
  }));

  // Multi-day selection
  if (numDays > 1) {
    const dailyTime = timePerDay || maxTime / numDays;
    return selectForMultipleDays(
      scoredPlaces,
      numDays,
      dailyTime,
      { budgetPerDay: maxBudget / numDays }
    );
  }

  // Single day selection
  const n = scoredPlaces.length;

  // Choose algorithm based on problem size
  if (n <= 20) {
    // Use DP for small problems (optimal solution)
    return knapsackDP(scoredPlaces, maxTime);
  } else if (maxBudget < Infinity) {
    // Use multi-constraint for budget-limited problems
    return multiConstraintSelect(scoredPlaces, maxTime, maxBudget);
  } else {
    // Use greedy for large problems (fast, near-optimal)
    return greedySelect(scoredPlaces, maxTime);
  }
}

export default {
  calculatePlaceValue,
  knapsackDP,
  greedySelect,
  multiConstraintSelect,
  selectForMultipleDays,
  selectBestPlaces,
};
