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
