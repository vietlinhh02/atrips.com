import api from '@/src/lib/api';

export interface WeatherForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  humidity: number | null;
  precipitation: number | null;
  condition: string;
  icon: string;
}

export interface CityWeather {
  city: string;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  startDate: string;
  endDate: string;
  forecasts: WeatherForecast[];
}

interface ForecastResponse {
  forecasts: WeatherForecast[];
  source: 'cache' | 'api';
}

interface TripWeatherResponse {
  cities: CityWeather[];
}

class WeatherService {
  async getForecast(
    lat: number,
    lng: number,
    startDate: string,
    endDate: string,
  ): Promise<WeatherForecast[]> {
    const response = await api.get<{ data: ForecastResponse }>(
      '/weather/forecast',
      {
        params: { latitude: lat, longitude: lng, startDate, endDate },
      },
    );
    return response.data.data.forecasts;
  }

  async getTripWeather(tripId: string): Promise<CityWeather[]> {
    const response = await api.get<{ data: TripWeatherResponse }>(
      `/weather/trips/${tripId}/weather`,
    );
    return response.data.data.cities;
  }
}

export const weatherService = new WeatherService();
export default weatherService;
