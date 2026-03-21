import prisma from '../../../config/database.js';

const SEED_DESTINATIONS = [
  {
    city: 'Bangkok', country: 'Thailand', region: 'SOUTHEAST_ASIA',
    tagline: 'Street food capital meets temple grandeur',
    bestSeasons: ['winter', 'autumn'], avgDailyBudget: 35,
    tags: ['food', 'culture', 'nightlife', 'shopping'],
    lat: 13.7563, lng: 100.5018,
  },
  {
    city: 'Hanoi', country: 'Vietnam', region: 'SOUTHEAST_ASIA',
    tagline: 'Ancient charm meets vibrant street life',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 30,
    tags: ['culture', 'food', 'history'],
    lat: 21.0285, lng: 105.8542,
  },
  {
    city: 'Bali', country: 'Indonesia', region: 'SOUTHEAST_ASIA',
    tagline: 'Island of gods and endless sunsets',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 45,
    tags: ['beach', 'culture', 'nature', 'romantic'],
    lat: -8.3405, lng: 115.092,
  },
  {
    city: 'Singapore', country: 'Singapore', region: 'SOUTHEAST_ASIA',
    tagline: 'Future-forward city with hawker heritage',
    bestSeasons: ['spring', 'winter'], avgDailyBudget: 80,
    tags: ['food', 'shopping', 'culture'],
    lat: 1.3521, lng: 103.8198,
  },
  {
    city: 'Tokyo', country: 'Japan', region: 'EAST_ASIA',
    tagline: 'Where tradition dances with innovation',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 70,
    tags: ['culture', 'food', 'shopping', 'history'],
    lat: 35.6762, lng: 139.6503,
  },
  {
    city: 'Seoul', country: 'South Korea', region: 'EAST_ASIA',
    tagline: 'K-culture epicenter with palace-lined streets',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 55,
    tags: ['culture', 'food', 'shopping', 'nightlife'],
    lat: 37.5665, lng: 126.978,
  },
  {
    city: 'Taipei', country: 'Taiwan', region: 'EAST_ASIA',
    tagline: 'Night market paradise with mountain escapes',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 40,
    tags: ['food', 'culture', 'nature', 'nightlife'],
    lat: 25.033, lng: 121.5654,
  },
  {
    city: 'Paris', country: 'France', region: 'EUROPE',
    tagline: 'The city of light, love, and croissants',
    bestSeasons: ['spring', 'summer', 'autumn'], avgDailyBudget: 120,
    tags: ['culture', 'food', 'romantic', 'history'],
    lat: 48.8566, lng: 2.3522,
  },
  {
    city: 'Barcelona', country: 'Spain', region: 'EUROPE',
    tagline: "Gaud\u00ed's playground by the Mediterranean",
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 80,
    tags: ['beach', 'culture', 'food', 'nightlife'],
    lat: 41.3874, lng: 2.1686,
  },
  {
    city: 'Rome', country: 'Italy', region: 'EUROPE',
    tagline: 'Eternal city of gelato and gladiators',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 90,
    tags: ['history', 'food', 'culture', 'romantic'],
    lat: 41.9028, lng: 12.4964,
  },
  {
    city: 'London', country: 'United Kingdom', region: 'EUROPE',
    tagline: 'Royal heritage meets multicultural buzz',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 130,
    tags: ['culture', 'history', 'shopping', 'nightlife'],
    lat: 51.5074, lng: -0.1278,
  },
  {
    city: 'New York', country: 'United States', region: 'AMERICAS',
    tagline: 'The city that never sleeps',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 150,
    tags: ['culture', 'food', 'shopping', 'nightlife'],
    lat: 40.7128, lng: -74.006,
  },
  {
    city: 'Cancun', country: 'Mexico', region: 'AMERICAS',
    tagline: 'Caribbean blues and Mayan ruins',
    bestSeasons: ['winter', 'spring'], avgDailyBudget: 70,
    tags: ['beach', 'adventure', 'nightlife', 'history'],
    lat: 21.1619, lng: -86.8515,
  },
  {
    city: 'Dubai', country: 'UAE', region: 'MIDDLE_EAST',
    tagline: 'Desert luxury and record-breaking skyline',
    bestSeasons: ['winter', 'autumn'], avgDailyBudget: 120,
    tags: ['shopping', 'adventure', 'culture'],
    lat: 25.2048, lng: 55.2708,
  },
  {
    city: 'Istanbul', country: 'Turkey', region: 'MIDDLE_EAST',
    tagline: 'Where East meets West over Turkish tea',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 50,
    tags: ['culture', 'food', 'history', 'shopping'],
    lat: 41.0082, lng: 28.9784,
  },
  {
    city: 'Cape Town', country: 'South Africa', region: 'AFRICA',
    tagline: 'Table Mountain views and coastal wonders',
    bestSeasons: ['summer', 'spring'], avgDailyBudget: 55,
    tags: ['nature', 'adventure', 'beach', 'food'],
    lat: -33.9249, lng: 18.4241,
  },
  {
    city: 'Marrakech', country: 'Morocco', region: 'AFRICA',
    tagline: 'Spice-scented souks and riad retreats',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 40,
    tags: ['culture', 'food', 'shopping', 'history'],
    lat: 31.6295, lng: -7.9811,
  },
  {
    city: 'Sydney', country: 'Australia', region: 'OCEANIA',
    tagline: 'Harbor icons and sun-kissed beaches',
    bestSeasons: ['summer', 'spring'], avgDailyBudget: 110,
    tags: ['beach', 'culture', 'food', 'nature'],
    lat: -33.8688, lng: 151.2093,
  },
  {
    city: 'Queenstown', country: 'New Zealand', region: 'OCEANIA',
    tagline: 'Adventure capital of the Southern Alps',
    bestSeasons: ['summer', 'autumn'], avgDailyBudget: 100,
    tags: ['adventure', 'nature', 'romantic'],
    lat: -45.0312, lng: 168.6626,
  },
  {
    city: 'Da Nang', country: 'Vietnam', region: 'SOUTHEAST_ASIA',
    tagline: 'Coastal charm between two UNESCO sites',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 30,
    tags: ['beach', 'food', 'culture', 'nature'],
    lat: 16.0544, lng: 108.2022,
  },
];

export async function seedDestinations() {
  console.log('Seeding destinations...');
  let created = 0;
  let skipped = 0;

  for (const dest of SEED_DESTINATIONS) {
    const existingPlace = await prisma.cached_places.findFirst({
      where: {
        city: dest.city,
        country: dest.country,
      },
    });

    let placeId;
    if (existingPlace) {
      placeId = existingPlace.id;
    } else {
      const newPlace = await prisma.cached_places.create({
        data: {
          externalId:
            `seed-${dest.city.toLowerCase().replace(/\s+/g, '-')}`,
          provider: 'seed',
          name: dest.city,
          type: 'ATTRACTION',
          city: dest.city,
          country: dest.country,
          latitude: dest.lat,
          longitude: dest.lng,
          photos: [],
          categories: dest.tags,
        },
      });
      placeId = newPlace.id;
    }

    const existingDest = await prisma.destinations.findFirst({
      where: { cachedPlaceId: placeId },
    });

    if (existingDest) {
      skipped++;
      continue;
    }

    await prisma.destinations.create({
      data: {
        cachedPlaceId: placeId,
        region: dest.region,
        tagline: dest.tagline,
        bestSeasons: dest.bestSeasons,
        avgDailyBudget: dest.avgDailyBudget,
        tags: dest.tags,
        coverImageAssetIds: [],
        popularityScore: Math.random() * 50 + 10,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`Seed complete: ${created} created, ${skipped} skipped`);
}

const isDirectRun = process.argv[1]?.includes('seedDestinations');
if (isDirectRun) {
  seedDestinations()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
