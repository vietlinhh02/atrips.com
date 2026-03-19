/**
 * Weather Repository
 * Handles caching and retrieval of weather forecast data
 */

import prisma from '../../../../config/database.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Round a coordinate to 2 decimal places so cache keys
 * align with Open-Meteo's effective precision.
 */
function roundCoord(value) {
  return Math.round(value * 100) / 100;
}

class WeatherRepository {
  /**
   * Return cached (non-expired) forecasts for a coordinate + date window.
   */
  async getCachedForecast(latitude, longitude, startDate, endDate) {
    const lat = roundCoord(latitude);
    const lng = roundCoord(longitude);

    const rows = await prisma.weather_forecasts.findMany({
      where: {
        latitude: lat,
        longitude: lng,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        expiresAt: { gt: new Date() },
      },
      orderBy: { date: 'asc' },
    });

    return rows;
  }

  /**
   * Upsert an array of forecast records with a 6-hour TTL.
   * @param {string} city
   * @param {string|null} countryCode
   * @param {number} latitude
   * @param {number} longitude
   * @param {Array} forecasts  Output from OpenMeteoService.fetchForecast
   */
  async cacheForecast(city, countryCode, latitude, longitude, forecasts) {
    const lat = roundCoord(latitude);
    const lng = roundCoord(longitude);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    const operations = forecasts.map((f) => {
      const dateObj = new Date(f.date);
      const data = {
        city,
        countryCode: countryCode || null,
        latitude: lat,
        longitude: lng,
        date: dateObj,
        tempMin: f.tempMin,
        tempMax: f.tempMax,
        humidity: f.humidity,
        precipitation: f.precipitation,
        condition: f.condition,
        icon: f.icon,
        fetchedAt: now,
        expiresAt,
      };

      return prisma.weather_forecasts.upsert({
        where: {
          latitude_longitude_date: {
            latitude: lat,
            longitude: lng,
            date: dateObj,
          },
        },
        update: data,
        create: data,
      });
    });

    await prisma.$transaction(operations);
  }

  /**
   * Get weather for every city + date in a trip via trip_cities.
   * Returns an array grouped by city.
   */
  async getForecastForTrip(tripId) {
    const cities = await prisma.trip_cities.findMany({
      where: { tripId },
      orderBy: { orderIndex: 'asc' },
    });

    if (cities.length === 0) {
      return [];
    }

    const results = [];

    for (const city of cities) {
      if (city.latitude == null || city.longitude == null) {
        results.push({
          city: city.cityName,
          countryCode: city.countryCode || null,
          latitude: null,
          longitude: null,
          startDate: city.startDate,
          endDate: city.endDate,
          forecasts: [],
        });
        continue;
      }

      const forecasts = await this.getCachedForecast(
        city.latitude,
        city.longitude,
        city.startDate,
        city.endDate,
      );

      results.push({
        city: city.cityName,
        countryCode: city.countryCode || null,
        latitude: city.latitude,
        longitude: city.longitude,
        startDate: city.startDate,
        endDate: city.endDate,
        forecasts,
      });
    }

    return results;
  }

  /**
   * Delete all expired forecast rows.
   * @returns {number} Number of deleted rows.
   */
  async cleanExpired() {
    const result = await prisma.weather_forecasts.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }
}

export default new WeatherRepository();
