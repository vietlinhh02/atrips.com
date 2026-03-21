import cacheService from '../../../../shared/services/CacheService.js';

const CACHE_TTL = {
  USER_SCORES: 3600,
  GLOBAL_SCORES: 21600,
};

const WEIGHTS = {
  AUTH: { season: 0.25, profile: 0.35, popularity: 0.25, recency: 0.15 },
  GUEST: { season: 0.40, popularity: 0.60 },
};

const MONTH_TO_SEASON_NORTH = {
  0: 'winter', 1: 'winter', 2: 'spring',
  3: 'spring', 4: 'spring', 5: 'summer',
  6: 'summer', 7: 'summer', 8: 'autumn',
  9: 'autumn', 10: 'autumn', 11: 'winter',
};

const FLIP_SEASON = {
  spring: 'autumn',
  summer: 'winter',
  autumn: 'spring',
  winter: 'summer',
};

class ScoringService {
  getSeasonForLatitude(latitude) {
    const month = new Date().getMonth();
    const northSeason = MONTH_TO_SEASON_NORTH[month];
    return latitude >= 0 ? northSeason : FLIP_SEASON[northSeason];
  }

  scoreSeasonMatch(destination) {
    const lat = destination.cached_place?.latitude ?? 0;
    const currentSeason = this.getSeasonForLatitude(lat);
    return destination.bestSeasons.includes(currentSeason) ? 1.0 : 0.2;
  }

  scoreProfileMatch(destination, travelProfile) {
    if (!travelProfile) return 0;

    const profileTypes = travelProfile.travelerTypes ?? [];
    const tagMapping = {
      ADVENTURE: ['adventure', 'nature'],
      LUXURY: ['shopping', 'romantic'],
      BUDGET: ['food', 'culture'],
      CULTURAL: ['culture', 'history'],
      FAMILY: ['family', 'nature'],
      FOODIE: ['food'],
      BEACH: ['beach'],
      NIGHTLIFE: ['nightlife'],
    };

    const relevantTags = profileTypes
      .flatMap((type) => tagMapping[type] ?? []);

    if (relevantTags.length === 0) return 0.5;

    const matchCount = destination.tags
      .filter((tag) => relevantTags.includes(tag)).length;
    return Math.min(matchCount / Math.max(relevantTags.length, 1), 1.0);
  }

  scorePopularity(destination, maxPopularity) {
    if (maxPopularity <= 0) return 0.5;
    return destination.popularityScore / maxPopularity;
  }

  scoreRecency(destination, userTrips) {
    if (!userTrips || userTrips.length === 0) return 1.0;

    const destCity = destination.cached_place?.city?.toLowerCase();
    const recentTrip = userTrips.find((trip) => {
      const tripCities = (trip.activities ?? [])
        .map((a) => a.cached_places?.city?.toLowerCase())
        .filter(Boolean);
      return tripCities.includes(destCity);
    });

    if (!recentTrip) return 1.0;

    const daysSince = Math.floor(
      (Date.now() - new Date(recentTrip.endDate).getTime())
      / (1000 * 60 * 60 * 24)
    );
    return Math.min(daysSince / 365, 1.0);
  }

  scoreDestination(destination, { travelProfile, userTrips, maxPopularity }) {
    const seasonScore = this.scoreSeasonMatch(destination);
    const popularityScore = this.scorePopularity(
      destination, maxPopularity,
    );

    if (!travelProfile) {
      const w = WEIGHTS.GUEST;
      return seasonScore * w.season + popularityScore * w.popularity;
    }

    const profileScore = this.scoreProfileMatch(
      destination, travelProfile,
    );
    const recencyScore = this.scoreRecency(destination, userTrips);
    const w = WEIGHTS.AUTH;

    return (
      seasonScore * w.season
      + profileScore * w.profile
      + popularityScore * w.popularity
      + recencyScore * w.recency
    );
  }

  rankDestinations(destinations, context) {
    const maxPopularity = Math.max(
      ...destinations.map((d) => d.popularityScore),
      1,
    );

    return destinations
      .map((dest) => ({
        ...dest,
        score: this.scoreDestination(dest, {
          ...context,
          maxPopularity,
        }),
      }))
      .sort((a, b) => b.score - a.score);
  }

  async getRankedDestinations(destinations, context, cacheKey) {
    if (cacheKey) {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;
    }

    const ranked = this.rankDestinations(destinations, context);

    if (cacheKey) {
      const ttl = context.travelProfile
        ? CACHE_TTL.USER_SCORES
        : CACHE_TTL.GLOBAL_SCORES;
      await cacheService.set(cacheKey, ranked, ttl);
    }

    return ranked;
  }
}

export default new ScoringService();
