import cacheService from '../../../../shared/services/CacheService.js';
import prisma from '../../../../config/database.js';
import { getFastModel } from '../../../ai/infrastructure/services/provider.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const CACHE_TTL = 86400; // 24 hours

class ExploreEnhancementService {
  getModel() {
    return getFastModel();
  }

  async enhance(destinationIds, userId) {
    const cacheKey =
      `explore:enhance:${userId}:${destinationIds.sort().join(',')}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const [destinations, profile] = await Promise.all([
      prisma.destinations.findMany({
        where: { id: { in: destinationIds } },
        include: {
          cached_place: {
            select: { city: true, country: true, categories: true },
          },
        },
      }),
      prisma.travel_profiles.findUnique({ where: { userId } }),
    ]);

    if (!profile || destinations.length === 0) {
      return { enhancements: {} };
    }

    const prompt = this.buildPrompt(destinations, profile);

    try {
      const model = this.getModel();
      const response = await model.invoke(prompt);
      const parsed = this.parseResponse(
        response.content, destinationIds,
      );

      await cacheService.set(cacheKey, parsed, CACHE_TTL);
      return parsed;
    } catch (error) {
      logger.warn('[ExploreEnhancement] AI enhancement failed', {
        error: error.message,
      });
      return { enhancements: {} };
    }
  }

  buildPrompt(destinations, profile) {
    const destList = destinations
      .map(
        (d) =>
          `- ${d.cached_place.city}, ${d.cached_place.country} (tags: ${d.tags.join(', ')})`,
      )
      .join('\n');

    const profileDesc = [
      profile.travelerTypes?.length
        ? `Traveler types: ${profile.travelerTypes.join(', ')}`
        : null,
      profile.spendingHabits
        ? `Spending: ${profile.spendingHabits}`
        : null,
      profile.dailyRhythm
        ? `Daily rhythm: ${profile.dailyRhythm}`
        : null,
      profile.socialPreference
        ? `Social preference: ${profile.socialPreference}`
        : null,
    ].filter(Boolean).join('. ');

    const idList = destinations.map((d) => d.id).join(', ');

    return `You are a travel recommendation assistant. Given a user profile and destinations, generate personalized taglines and explanations.

User Profile: ${profileDesc}

Destinations:
${destList}

For each destination, respond with ONLY valid JSON (no markdown, no code blocks):
{
  "enhancements": {
    "<destination_id>": {
      "personalizedTagline": "<short catchy tagline for this user, max 60 chars>",
      "whyForYou": "<1 sentence explaining why this matches their profile>"
    }
  }
}

Destination IDs in order: ${idList}`;
  }

  async enrichDetail(destination) {
    const city = destination.cached_place?.city;
    const country = destination.cached_place?.country;
    if (!city) return null;

    const cacheKey = `explore:detail-enrich:${destination.id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const prompt = `You are a travel guide writer. Write rich content about ${city}, ${country} for a travel destination page.

Tags: ${destination.tags?.join(', ') || 'general'}
Average daily budget: $${destination.avgDailyBudget || 'unknown'}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "description": "<2-3 paragraph overview of the destination, what makes it special, the vibe and atmosphere. Write in engaging second person.>",
  "highlights": ["<top thing to do/see 1>", "<top thing 2>", "<top thing 3>", "<top thing 4>", "<top thing 5>"],
  "bestFor": "<1 sentence about who this destination is best for>",
  "localTips": ["<practical tip 1>", "<practical tip 2>", "<practical tip 3>"],
  "budgetBreakdown": {
    "accommodation": "<price range per night>",
    "food": "<price range per meal>",
    "transport": "<typical daily transport cost>",
    "activities": "<typical activity cost>"
  },
  "knownFor": ["<thing city is famous for 1>", "<thing 2>", "<thing 3>"]
}`;

    try {
      const model = this.getModel();
      const response = await model.invoke(prompt);
      const cleaned = response.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      await cacheService.set(cacheKey, parsed, CACHE_TTL);
      return parsed;
    } catch (error) {
      logger.warn('[ExploreEnhancement] Detail enrichment failed', {
        error: error.message,
        city,
      });
      return null;
    }
  }

  parseResponse(content, destinationIds) {
    try {
      const cleaned = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.enhancements) return { enhancements: {} };

      const valid = {};
      for (const id of destinationIds) {
        if (parsed.enhancements[id]) {
          valid[id] = {
            personalizedTagline:
              parsed.enhancements[id].personalizedTagline ?? '',
            whyForYou: parsed.enhancements[id].whyForYou ?? '',
          };
        }
      }

      return { enhancements: valid };
    } catch {
      return { enhancements: {} };
    }
  }
}

export default new ExploreEnhancementService();
