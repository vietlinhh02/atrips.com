import prisma from '../../../config/database.js';

const SEED_DESTINATIONS = [
  {
    city: 'Bangkok', country: 'Thailand', region: 'SOUTHEAST_ASIA',
    tagline: 'Street food capital meets temple grandeur',
    bestSeasons: ['winter', 'autumn'], avgDailyBudget: 35,
    tags: ['food', 'culture', 'nightlife', 'shopping'],
    lat: 13.7563, lng: 100.5018,
    photos: ['https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80'],
  },
  {
    city: 'Hanoi', country: 'Vietnam', region: 'SOUTHEAST_ASIA',
    tagline: 'Ancient charm meets vibrant street life',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 30,
    tags: ['culture', 'food', 'history'],
    lat: 21.0285, lng: 105.8542,
    photos: ['https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80'],
  },
  {
    city: 'Bali', country: 'Indonesia', region: 'SOUTHEAST_ASIA',
    tagline: 'Island of gods and endless sunsets',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 45,
    tags: ['beach', 'culture', 'nature', 'romantic'],
    lat: -8.3405, lng: 115.092,
    photos: ['https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80'],
  },
  {
    city: 'Singapore', country: 'Singapore', region: 'SOUTHEAST_ASIA',
    tagline: 'Future-forward city with hawker heritage',
    bestSeasons: ['spring', 'winter'], avgDailyBudget: 80,
    tags: ['food', 'shopping', 'culture'],
    lat: 1.3521, lng: 103.8198,
    photos: ['https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80'],
  },
  {
    city: 'Tokyo', country: 'Japan', region: 'EAST_ASIA',
    tagline: 'Where tradition dances with innovation',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 70,
    tags: ['culture', 'food', 'shopping', 'history'],
    lat: 35.6762, lng: 139.6503,
    photos: ['https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80'],
  },
  {
    city: 'Seoul', country: 'South Korea', region: 'EAST_ASIA',
    tagline: 'K-culture epicenter with palace-lined streets',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 55,
    tags: ['culture', 'food', 'shopping', 'nightlife'],
    lat: 37.5665, lng: 126.978,
    photos: ['https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80'],
  },
  {
    city: 'Taipei', country: 'Taiwan', region: 'EAST_ASIA',
    tagline: 'Night market paradise with mountain escapes',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 40,
    tags: ['food', 'culture', 'nature', 'nightlife'],
    lat: 25.033, lng: 121.5654,
    photos: ['https://images.unsplash.com/photo-1470004914212-05527e49370b?w=600&q=80'],
  },
  {
    city: 'Paris', country: 'France', region: 'EUROPE',
    tagline: 'The city of light, love, and croissants',
    bestSeasons: ['spring', 'summer', 'autumn'], avgDailyBudget: 120,
    tags: ['culture', 'food', 'romantic', 'history'],
    lat: 48.8566, lng: 2.3522,
    photos: ['https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80'],
  },
  {
    city: 'Barcelona', country: 'Spain', region: 'EUROPE',
    tagline: "Gaud\u00ed's playground by the Mediterranean",
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 80,
    tags: ['beach', 'culture', 'food', 'nightlife'],
    lat: 41.3874, lng: 2.1686,
    photos: ['https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&q=80'],
  },
  {
    city: 'Rome', country: 'Italy', region: 'EUROPE',
    tagline: 'Eternal city of gelato and gladiators',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 90,
    tags: ['history', 'food', 'culture', 'romantic'],
    lat: 41.9028, lng: 12.4964,
    photos: ['https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80'],
  },
  {
    city: 'London', country: 'United Kingdom', region: 'EUROPE',
    tagline: 'Royal heritage meets multicultural buzz',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 130,
    tags: ['culture', 'history', 'shopping', 'nightlife'],
    lat: 51.5074, lng: -0.1278,
    photos: ['https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80'],
  },
  {
    city: 'New York', country: 'United States', region: 'AMERICAS',
    tagline: 'The city that never sleeps',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 150,
    tags: ['culture', 'food', 'shopping', 'nightlife'],
    lat: 40.7128, lng: -74.006,
    photos: ['https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80'],
  },
  {
    city: 'Cancun', country: 'Mexico', region: 'AMERICAS',
    tagline: 'Caribbean blues and Mayan ruins',
    bestSeasons: ['winter', 'spring'], avgDailyBudget: 70,
    tags: ['beach', 'adventure', 'nightlife', 'history'],
    lat: 21.1619, lng: -86.8515,
    photos: ['https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=600&q=80'],
  },
  {
    city: 'Dubai', country: 'UAE', region: 'MIDDLE_EAST',
    tagline: 'Desert luxury and record-breaking skyline',
    bestSeasons: ['winter', 'autumn'], avgDailyBudget: 120,
    tags: ['shopping', 'adventure', 'culture'],
    lat: 25.2048, lng: 55.2708,
    photos: ['https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80'],
  },
  {
    city: 'Istanbul', country: 'Turkey', region: 'MIDDLE_EAST',
    tagline: 'Where East meets West over Turkish tea',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 50,
    tags: ['culture', 'food', 'history', 'shopping'],
    lat: 41.0082, lng: 28.9784,
    photos: ['https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80'],
  },
  {
    city: 'Cape Town', country: 'South Africa', region: 'AFRICA',
    tagline: 'Table Mountain views and coastal wonders',
    bestSeasons: ['summer', 'spring'], avgDailyBudget: 55,
    tags: ['nature', 'adventure', 'beach', 'food'],
    lat: -33.9249, lng: 18.4241,
    photos: ['https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&q=80'],
  },
  {
    city: 'Marrakech', country: 'Morocco', region: 'AFRICA',
    tagline: 'Spice-scented souks and riad retreats',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 40,
    tags: ['culture', 'food', 'shopping', 'history'],
    lat: 31.6295, lng: -7.9811,
    photos: ['https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=600&q=80'],
  },
  {
    city: 'Sydney', country: 'Australia', region: 'OCEANIA',
    tagline: 'Harbor icons and sun-kissed beaches',
    bestSeasons: ['summer', 'spring'], avgDailyBudget: 110,
    tags: ['beach', 'culture', 'food', 'nature'],
    lat: -33.8688, lng: 151.2093,
    photos: ['https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=600&q=80'],
  },
  {
    city: 'Queenstown', country: 'New Zealand', region: 'OCEANIA',
    tagline: 'Adventure capital of the Southern Alps',
    bestSeasons: ['summer', 'autumn'], avgDailyBudget: 100,
    tags: ['adventure', 'nature', 'romantic'],
    lat: -45.0312, lng: 168.6626,
    photos: ['https://images.unsplash.com/photo-1589871973318-9ca1258faa96?w=600&q=80'],
  },
  {
    city: 'Da Nang', country: 'Vietnam', region: 'SOUTHEAST_ASIA',
    tagline: 'Coastal charm between two UNESCO sites',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 30,
    tags: ['beach', 'food', 'culture', 'nature'],
    lat: 16.0544, lng: 108.2022,
    photos: ['https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&q=80'],
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
      if (existingPlace.photos.length === 0 && dest.photos?.length > 0) {
        await prisma.cached_places.update({
          where: { id: placeId },
          data: { photos: dest.photos },
        });
      }
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
          photos: dest.photos ?? [],
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
