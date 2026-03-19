/**
 * Open-Meteo Weather Service
 * Fetches weather forecasts from the free Open-Meteo API
 */

import axios from 'axios';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 10000;

const WMO_CODES = new Map([
  [0, { condition: 'Clear sky', icon: 'clear' }],
  [1, { condition: 'Mainly clear', icon: 'partly-cloudy' }],
  [2, { condition: 'Partly cloudy', icon: 'partly-cloudy' }],
  [3, { condition: 'Overcast', icon: 'cloudy' }],
  [45, { condition: 'Fog', icon: 'fog' }],
  [48, { condition: 'Depositing rime fog', icon: 'fog' }],
  [51, { condition: 'Light drizzle', icon: 'drizzle' }],
  [53, { condition: 'Moderate drizzle', icon: 'drizzle' }],
  [55, { condition: 'Dense drizzle', icon: 'drizzle' }],
  [61, { condition: 'Slight rain', icon: 'rain' }],
  [63, { condition: 'Moderate rain', icon: 'rain' }],
  [65, { condition: 'Heavy rain', icon: 'rain' }],
  [71, { condition: 'Slight snow', icon: 'snow' }],
  [73, { condition: 'Moderate snow', icon: 'snow' }],
  [75, { condition: 'Heavy snow', icon: 'snow' }],
  [80, { condition: 'Slight rain showers', icon: 'showers' }],
  [81, { condition: 'Moderate rain showers', icon: 'showers' }],
  [82, { condition: 'Violent rain showers', icon: 'showers' }],
  [95, { condition: 'Thunderstorm', icon: 'thunderstorm' }],
  [96, { condition: 'Thunderstorm with slight hail', icon: 'thunderstorm' }],
  [99, { condition: 'Thunderstorm with heavy hail', icon: 'thunderstorm' }],
]);

const UNKNOWN_WEATHER = { condition: 'Unknown', icon: 'unknown' };

class OpenMeteoService {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  /**
   * Fetch daily forecast from Open-Meteo for a coordinate range.
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} startDate  ISO date string (YYYY-MM-DD)
   * @param {string} endDate    ISO date string (YYYY-MM-DD)
   * @returns {Promise<Array<{date,tempMin,tempMax,humidity,precipitation,condition,icon}>>}
   */
  async fetchForecast(latitude, longitude, startDate, endDate) {
    // Clamp dates to Open-Meteo's forecast range (max ~16 days ahead)
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 15);
    const maxStr = maxDate.toISOString().slice(0, 10);

    const clampedStart = startDate < today.toISOString().slice(0, 10)
      ? today.toISOString().slice(0, 10) : startDate;
    const clampedEnd = endDate > maxStr ? maxStr : endDate;

    if (clampedStart > clampedEnd) {
      return [];
    }

    const params = {
      latitude,
      longitude,
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'relative_humidity_2m_max',
        'weathercode',
      ].join(','),
      timezone: 'auto',
      start_date: clampedStart,
      end_date: clampedEnd,
    };

    let response;
    try {
      response = await this.client.get('', { params });
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.reason || error.message;
      throw new Error(
        `Open-Meteo API request failed (${status || 'network'}): ${msg}`
      );
    }

    const { daily } = response.data;
    if (!daily || !daily.time) {
      throw new Error('Open-Meteo returned an unexpected response format');
    }

    return daily.time.map((date, i) => {
      const code = daily.weathercode[i];
      const weather = WMO_CODES.get(code) || UNKNOWN_WEATHER;

      return {
        date,
        tempMin: daily.temperature_2m_min[i],
        tempMax: daily.temperature_2m_max[i],
        humidity: daily.relative_humidity_2m_max[i] ?? null,
        precipitation: daily.precipitation_sum[i] ?? null,
        condition: weather.condition,
        icon: weather.icon,
      };
    });
  }
}

export default new OpenMeteoService();
