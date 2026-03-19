/**
 * Info Handlers
 * Handles weather, distance, exchange rate, and travel tips
 */

import prisma from '../../../../../config/database.js';
import cacheService from '../../../../../shared/services/CacheService.js';

// Cache TTL for tool results (in seconds)
const TOOL_CACHE_TTL = {
  WEATHER: 1800,      // 30 minutes
  DISTANCE: 86400,    // 24 hours
  EXCHANGE_RATE: 3600, // 1 hour
};

/**
 * Create info handlers bound to executor context
 */
export function createInfoHandlers(executor) {
  return {
    getCurrentDatetime: getCurrentDatetime.bind(executor),
    getWeather: getWeather.bind(executor),
    calculateDistance: calculateDistance.bind(executor),
    getExchangeRate: getExchangeRate.bind(executor),
    getTravelTips: getTravelTips.bind(executor),
  };
}

/**
 * Get Current Datetime - Returns current date/time and calculates relative dates
 * Automatically uses user's timezone from profile if available
 */
async function getCurrentDatetime(args = {}) {
  const { timezone: timezoneParam, calculate_relative_date } = args || {};

  // Try to get timezone from user profile if not explicitly provided
  let timezone = timezoneParam;
  let timezoneSource = 'parameter';

  if (!timezone && this.currentUserId) {
    try {
      const userPref = await prisma.userPreference.findUnique({
        where: { userId: this.currentUserId },
        select: { timezone: true },
      });
      if (userPref?.timezone) {
        timezone = userPref.timezone;
        timezoneSource = 'user_profile';
      } else {
        timezone = 'Asia/Ho_Chi_Minh';
        timezoneSource = 'default';
      }
    } catch (error) {
      console.debug('Failed to fetch user timezone:', error.message);
      timezone = 'Asia/Ho_Chi_Minh';
      timezoneSource = 'default';
    }
  } else if (!timezone) {
    timezone = 'Asia/Ho_Chi_Minh';
    timezoneSource = 'default';
  }

  const now = new Date();

  // Format date in Vietnam timezone
  const options = { timeZone: timezone };
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    ...options,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    ...options,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Get current day of week (0 = Sunday, 6 = Saturday)
  const currentDayOfWeek = now.getDay();
  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  const result = {
    timezone,
    timezoneSource, // 'user_profile', 'parameter', or 'default'
    current: {
      formatted: formatter.format(now),
      date: dateFormatter.format(now), // YYYY-MM-DD format
      timestamp: now.toISOString(),
      dayOfWeek: currentDayOfWeek,
      dayName: dayNames[currentDayOfWeek],
    },
    weekInfo: {
      daysUntilSaturday: (6 - currentDayOfWeek + 7) % 7 || 7,
      daysUntilSunday: (7 - currentDayOfWeek) % 7 || 7,
      isWeekend: currentDayOfWeek === 0 || currentDayOfWeek === 6,
    },
  };

  // Calculate relative date if requested
  if (calculate_relative_date) {
    const relativeDate = calculateRelativeDate(now, calculate_relative_date, timezone);
    result.calculatedDate = relativeDate;
  }

  // Always include helpful upcoming dates
  result.upcomingDates = {
    tomorrow: formatDateYMD(addDays(now, 1), timezone),
    nextSaturday: formatDateYMD(getNextDayOfWeek(now, 6), timezone),
    nextSunday: formatDateYMD(getNextDayOfWeek(now, 0), timezone),
    nextWeekSameDay: formatDateYMD(addDays(now, 7), timezone),
    inTwoWeeks: formatDateYMD(addDays(now, 14), timezone),
    nextMonth: formatDateYMD(addMonths(now, 1), timezone),
  };

  return result;
}

/**
 * Calculate relative date based on expression
 */
function calculateRelativeDate(baseDate, expression, timezone) {
  const expr = expression.toLowerCase().replace(/\s+/g, '_');
  let targetDate = new Date(baseDate);

  // Handle day of week expressions
  if (expr.includes('next_saturday') || expr === 'saturday') {
    targetDate = getNextDayOfWeek(baseDate, 6);
  } else if (expr.includes('next_sunday') || expr === 'sunday') {
    targetDate = getNextDayOfWeek(baseDate, 0);
  } else if (expr.includes('next_monday') || expr === 'monday') {
    targetDate = getNextDayOfWeek(baseDate, 1);
  } else if (expr.includes('next_tuesday') || expr === 'tuesday') {
    targetDate = getNextDayOfWeek(baseDate, 2);
  } else if (expr.includes('next_wednesday') || expr === 'wednesday') {
    targetDate = getNextDayOfWeek(baseDate, 3);
  } else if (expr.includes('next_thursday') || expr === 'thursday') {
    targetDate = getNextDayOfWeek(baseDate, 4);
  } else if (expr.includes('next_friday') || expr === 'friday') {
    targetDate = getNextDayOfWeek(baseDate, 5);
  }
  // Handle relative time expressions
  else if (expr === 'tomorrow') {
    targetDate = addDays(baseDate, 1);
  } else if (expr === 'next_week') {
    targetDate = addDays(baseDate, 7);
  } else if (expr === 'next_month') {
    targetDate = addMonths(baseDate, 1);
  } else if (expr === 'this_weekend') {
    // This weekend = upcoming Saturday
    targetDate = getNextDayOfWeek(baseDate, 6, true);
  } else if (expr === 'next_weekend') {
    // Next weekend = Saturday after this week
    const thisSaturday = getNextDayOfWeek(baseDate, 6, true);
    targetDate = addDays(thisSaturday, 7);
  }
  // Handle +N_days, +N_weeks patterns
  else if (expr.match(/^\+?(\d+)_?days?$/)) {
    const days = parseInt(expr.match(/(\d+)/)[1]);
    targetDate = addDays(baseDate, days);
  } else if (expr.match(/^\+?(\d+)_?weeks?$/)) {
    const weeks = parseInt(expr.match(/(\d+)/)[1]);
    targetDate = addDays(baseDate, weeks * 7);
  } else if (expr.match(/^\+?(\d+)_?months?$/)) {
    const months = parseInt(expr.match(/(\d+)/)[1]);
    targetDate = addMonths(baseDate, months);
  }

  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  return {
    expression,
    date: formatDateYMD(targetDate, timezone),
    dayOfWeek: targetDate.getDay(),
    dayName: dayNames[targetDate.getDay()],
    daysFromNow: Math.ceil((targetDate - baseDate) / (1000 * 60 * 60 * 24)),
  };
}

// Helper functions for date calculations
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getNextDayOfWeek(date, dayOfWeek, includeToday = false) {
  const result = new Date(date);
  const currentDay = result.getDay();
  let daysUntil = dayOfWeek - currentDay;

  if (daysUntil < 0 || (daysUntil === 0 && !includeToday)) {
    daysUntil += 7;
  }

  result.setDate(result.getDate() + daysUntil);
  return result;
}

function formatDateYMD(date, timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Get Weather - OpenWeatherMap API
 */
async function getWeather(args) {
  const { location, date } = args;

  const cacheKey = `tool:weather:${location}:${date || 'current'}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  if (date) {
    const dbForecast = await getWeatherFromDB(location, date);
    if (dbForecast) {
      return { ...dbForecast, source: 'database' };
    }
  }

  if (!this.openWeatherKey) {
    return getWeatherFallback(location, date);
  }

  try {
    const coords = await geocodeLocation.call(this, location);

    if (!coords) {
      return getWeatherFallback(location, date);
    }

    let weatherData;

    if (date) {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?` +
        `lat=${coords.lat}&lon=${coords.lng}&appid=${this.openWeatherKey}&units=metric&lang=vi`
      );

      if (!response.ok) {
        throw new Error(`OpenWeather API error: ${response.status}`);
      }

      const data = await response.json();
      weatherData = extractForecastForDate(data, date);
    } else {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?` +
        `lat=${coords.lat}&lon=${coords.lng}&appid=${this.openWeatherKey}&units=metric&lang=vi`
      );

      if (!response.ok) {
        throw new Error(`OpenWeather API error: ${response.status}`);
      }

      const data = await response.json();
      weatherData = {
        location: data.name || location,
        date: new Date().toISOString().split('T')[0],
        temperature: {
          current: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          min: Math.round(data.main.temp_min),
          max: Math.round(data.main.temp_max),
        },
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        wind: {
          speed: data.wind.speed,
          direction: data.wind.deg,
        },
        condition: data.weather[0].description,
        icon: data.weather[0].icon,
        iconUrl: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
        clouds: data.clouds.all,
        visibility: data.visibility,
        sunrise: new Date(data.sys.sunrise * 1000).toLocaleTimeString('vi-VN'),
        sunset: new Date(data.sys.sunset * 1000).toLocaleTimeString('vi-VN'),
      };
    }

    const result = {
      source: 'openweathermap',
      ...weatherData,
    };

    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.WEATHER);
    saveWeatherToDB(result, coords);

    return result;
  } catch (error) {
    console.error('OpenWeather API error:', error.message);
    return getWeatherFallback(location, date);
  }
}

/**
 * Calculate Distance - Mapbox Directions API
 */
async function calculateDistance(args) {
  const { origin, destination, mode = 'driving' } = args;

  const cacheKey = `tool:distance:${origin}:${destination}:${mode}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  if (!this.mapboxToken) {
    return calculateDistanceFallback(origin, destination, mode);
  }

  try {
    const [originCoords, destCoords] = await Promise.all([
      geocodeLocation.call(this, origin),
      geocodeLocation.call(this, destination),
    ]);

    if (!originCoords || !destCoords) {
      return calculateDistanceFallback(origin, destination, mode);
    }

    const profile = mapModeToMapbox(mode);

    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
      `${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?` +
      `access_token=${this.mapboxToken}&language=vi&overview=full&steps=true`
    );

    if (!response.ok) {
      throw new Error(`Mapbox Directions API error: ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes[0];

    if (!route) {
      return calculateDistanceFallback(origin, destination, mode);
    }

    const result = {
      source: 'mapbox',
      origin,
      destination,
      mode,
      distance: (route.distance / 1000).toFixed(1),
      distanceUnit: 'km',
      duration: Math.round(route.duration / 60),
      durationUnit: 'phút',
      durationFormatted: formatDuration(route.duration),
      steps: route.legs[0].steps.slice(0, 5).map(step => ({
        instruction: step.maneuver.instruction,
        distance: (step.distance / 1000).toFixed(2) + ' km',
        duration: Math.round(step.duration / 60) + ' phút',
      })),
      coordinates: {
        origin: originCoords,
        destination: destCoords,
      },
    };

    await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.DISTANCE);
    return result;
  } catch (error) {
    console.error('Mapbox Directions error:', error.message);
    return calculateDistanceFallback(origin, destination, mode);
  }
}

/**
 * Get Exchange Rate
 */
async function getExchangeRate(args) {
  const { from_currency, to_currency, amount = 1 } = args;
  const fromUpper = from_currency.toUpperCase();
  const toUpper = to_currency.toUpperCase();

  const cacheKey = `tool:exchange:${fromUpper}:${toUpper}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      amount,
      converted: amount * cached.rate,
      source: 'cache',
    };
  }

  const dbRate = await getExchangeRateFromDB(fromUpper, toUpper);
  if (dbRate) {
    return {
      source: 'database',
      from: fromUpper,
      to: toUpper,
      rate: dbRate,
      amount,
      converted: amount * dbRate,
    };
  }

  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${fromUpper}`
    );

    if (response.ok) {
      const data = await response.json();
      const rate = data.rates[toUpper];

      if (rate) {
        const result = {
          source: 'exchangerate-api',
          from: fromUpper,
          to: toUpper,
          rate,
          amount,
          converted: amount * rate,
          lastUpdated: data.date,
        };

        await cacheService.set(cacheKey, { rate, from: fromUpper, to: toUpper }, TOOL_CACHE_TTL.EXCHANGE_RATE);
        saveExchangeRateToDB(fromUpper, toUpper, rate);

        return result;
      }
    }
  } catch (error) {
    console.error('Exchange rate API error:', error.message);
  }

  return getExchangeRateFallback(fromUpper, toUpper, amount);
}

/**
 * Get Travel Tips - Knowledge base
 */
async function getTravelTips(args) {
  const { destination, topics = [] } = args;

  const allTips = {
    safety: {
      title: 'An toàn',
      tips: [
        'Giữ đồ đạc cẩn thận ở nơi đông người',
        'Lưu số điện thoại khẩn cấp địa phương',
        'Mua bảo hiểm du lịch trước chuyến đi',
        'Thông báo hành trình cho người thân',
        'Photo/scan hộ chiếu và giấy tờ quan trọng',
        'Tránh đi một mình vào ban đêm ở khu vực vắng',
      ],
    },
    culture: {
      title: 'Văn hóa',
      tips: [
        'Tìm hiểu phong tục địa phương trước khi đến',
        'Ăn mặc phù hợp khi thăm đền chùa, nhà thờ',
        'Học vài câu giao tiếp cơ bản bằng ngôn ngữ địa phương',
        'Tôn trọng văn hóa và con người địa phương',
        'Xin phép trước khi chụp ảnh người dân',
        'Tìm hiểu về ngày lễ và phong tục đặc biệt',
      ],
    },
    food: {
      title: 'Ẩm thực',
      tips: [
        'Thử các món đặc sản địa phương',
        'Ăn ở quán đông khách để đảm bảo tươi ngon',
        'Cẩn thận với đồ ăn đường phố nếu dạ dày yếu',
        'Hỏi locals về quán ăn ngon',
        'Mang theo thuốc tiêu hóa phòng ngừa',
        'Uống nước đóng chai ở những nơi không chắc chắn về vệ sinh',
      ],
    },
    transport: {
      title: 'Di chuyển',
      tips: [
        'Đặt xe trước qua app uy tín (Grab, Gojek...)',
        'Thỏa thuận giá trước khi lên xe',
        'Giữ bản đồ offline phòng mất mạng',
        'Tìm hiểu phương tiện công cộng',
        'Thuê xe máy cần có bằng lái phù hợp',
        'Đặt vé máy bay/tàu sớm để có giá tốt',
      ],
    },
    money: {
      title: 'Tiền bạc',
      tips: [
        'Mang tiền mặt địa phương',
        'Kiểm tra tỷ giá trước khi đổi tiền',
        'Tránh đổi tiền ở sân bay (tỷ giá kém)',
        'Thông báo ngân hàng trước chuyến đi để tránh khóa thẻ',
        'Mang ít nhất 2 phương thức thanh toán',
        'Giữ tiền ở nhiều nơi khác nhau',
      ],
    },
    weather: {
      title: 'Thời tiết',
      tips: [
        'Kiểm tra dự báo thời tiết trước chuyến đi',
        'Mang theo áo mưa gọn nhẹ',
        'Chọn thời điểm du lịch phù hợp với khí hậu',
        'Chuẩn bị kem chống nắng SPF cao',
        'Mang theo mũ/nón và kính mát',
        'Uống đủ nước khi thời tiết nóng',
      ],
    },
    packing: {
      title: 'Đóng gói',
      tips: [
        'Mang đồ nhẹ, dễ mix-match',
        'Đừng quên sạc dự phòng và adapter ổ cắm',
        'Mang thuốc cá nhân cần thiết',
        'Để đồ quan trọng trong hành lý xách tay',
        'Mang túi gấp gọn để đựng đồ mua sắm',
        'Chuẩn bị túi chống nước cho đồ điện tử',
      ],
    },
  };

  const selectedTopics = topics.length > 0 ? topics : Object.keys(allTips);
  const result = {};

  for (const topic of selectedTopics) {
    if (allTips[topic]) {
      result[topic] = allTips[topic];
    }
  }

  let destinationTips = [];
  try {
    // Optional table: some deployments do not include travel_tips in Prisma schema.
    if (destination && prisma.travel_tips?.findMany) {
      const dbTips = await prisma.travel_tips.findMany({
        where: {
          destination: { contains: destination, mode: 'insensitive' },
        },
        take: 10,
      });
      destinationTips = dbTips.map(t => ({ topic: t.topic, tip: t.content }));
    }
  } catch (error) {
    console.debug('Failed to fetch destination-specific tips:', error.message);
  }

  return {
    destination,
    tips: result,
    destinationSpecific: destinationTips,
    generalAdvice: `Chúc bạn có chuyến đi ${destination} vui vẻ và an toàn!`,
  };
}

// Helper functions
async function geocodeLocation(location) {
  if (this.mapboxToken) {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?` +
        `access_token=${this.mapboxToken}&limit=1`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.features?.[0]) {
          return {
            lat: data.features[0].center[1],
            lng: data.features[0].center[0],
          };
        }
      }
    } catch (e) {
      console.debug('Mapbox geocoding failed, trying OpenWeather:', e.message);
    }
  }

  if (this.openWeatherKey) {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${this.openWeatherKey}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data[0]) {
          return { lat: data[0].lat, lng: data[0].lon };
        }
      }
    } catch (e) {
      console.debug('OpenWeather geocoding failed:', e.message);
    }
  }

  return null;
}

function extractForecastForDate(forecastData, targetDate) {
  const forecasts = forecastData.list.filter(item => {
    const itemDate = new Date(item.dt * 1000).toISOString().split('T')[0];
    return itemDate === targetDate;
  });

  if (forecasts.length === 0) {
    const firstForecast = forecastData.list[0];
    return formatForecastItem(firstForecast, forecastData.city.name);
  }

  const middayForecast = forecasts.find(f => {
    const hour = new Date(f.dt * 1000).getHours();
    return hour >= 11 && hour <= 14;
  }) || forecasts[Math.floor(forecasts.length / 2)];

  return formatForecastItem(middayForecast, forecastData.city.name, forecasts);
}

function formatForecastItem(item, cityName, allForecasts = null) {
  const result = {
    location: cityName,
    date: new Date(item.dt * 1000).toISOString().split('T')[0],
    temperature: {
      current: Math.round(item.main.temp),
      feelsLike: Math.round(item.main.feels_like),
      min: Math.round(item.main.temp_min),
      max: Math.round(item.main.temp_max),
    },
    humidity: item.main.humidity,
    condition: item.weather[0].description,
    icon: item.weather[0].icon,
    iconUrl: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`,
    wind: {
      speed: item.wind.speed,
      direction: item.wind.deg,
    },
    clouds: item.clouds.all,
    precipitation: item.pop ? Math.round(item.pop * 100) : 0,
  };

  if (allForecasts && allForecasts.length > 0) {
    result.temperature.min = Math.min(...allForecasts.map(f => f.main.temp_min));
    result.temperature.max = Math.max(...allForecasts.map(f => f.main.temp_max));
  }

  return result;
}

async function getWeatherFromDB(location, date) {
  try {
    const forecast = await prisma.weather_forecasts.findFirst({
      where: {
        city: { contains: location, mode: 'insensitive' },
        date: new Date(date),
      },
    });

    if (forecast) {
      return {
        location: forecast.city,
        date: forecast.date.toISOString().split('T')[0],
        temperature: {
          min: forecast.tempMin,
          max: forecast.tempMax,
        },
        humidity: forecast.humidity,
        precipitation: forecast.precipitation,
        condition: forecast.condition,
        icon: forecast.icon,
      };
    }
  } catch (error) {
    console.warn('Failed to get weather forecast:', error.message);
  }
  return null;
}

async function saveWeatherToDB(weatherData, coords = null) {
  if (!coords?.lat || !coords?.lng) {
    return;
  }

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.weather_forecasts.upsert({
      where: {
        latitude_longitude_date: {
          latitude: coords.lat,
          longitude: coords.lng,
          date: new Date(weatherData.date),
        },
      },
      create: {
        city: weatherData.location,
        latitude: coords.lat,
        longitude: coords.lng,
        date: new Date(weatherData.date),
        tempMin: weatherData.temperature.min,
        tempMax: weatherData.temperature.max,
        humidity: weatherData.humidity,
        precipitation: weatherData.precipitation || 0,
        condition: weatherData.condition,
        icon: weatherData.icon,
        expiresAt,
      },
      update: {
        city: weatherData.location,
        tempMin: weatherData.temperature.min,
        tempMax: weatherData.temperature.max,
        humidity: weatherData.humidity,
        condition: weatherData.condition,
      },
    });
  } catch (error) {
    console.debug('Failed to save weather data to database:', error.message);
  }
}

function getWeatherFallback(location, date) {
  return {
    success: false,
    source: 'fallback',
    location,
    date: date || new Date().toISOString().split('T')[0],
    error: 'Không thể lấy dữ liệu thời tiết',
    note: 'DO NOT hallucinate weather data. The OpenWeather API might be missing.',
  };
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} giờ ${minutes} phút`;
  }
  return `${minutes} phút`;
}

function mapModeToMapbox(mode) {
  const mapping = {
    driving: 'driving',
    walking: 'walking',
    bicycling: 'cycling',
    transit: 'driving',
  };
  return mapping[mode] || 'driving';
}

function calculateDistanceFallback(origin, destination, mode) {
  return {
    success: false,
    source: 'fallback',
    origin,
    destination,
    mode,
    error: 'Không thể tính toán khoảng cách',
    note: 'DO NOT hallucinate distance and DO NOT assume they are close. Ask user or state that transit time is unknown.',
  };
}

async function getExchangeRateFromDB(from, to) {
  try {
    const rate = await prisma.currency_rates.findFirst({
      where: {
        baseCurrency: from,
        targetCurrency: to,
        expiresAt: { gt: new Date() },
      },
      orderBy: { fetchedAt: 'desc' },
    });
    return rate?.rate;
  } catch (error) {
    console.warn('Failed to get cached exchange rate:', error.message);
    return null;
  }
}

async function saveExchangeRateToDB(from, to, rate) {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.currency_rates.upsert({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency: from,
          targetCurrency: to,
        },
      },
      create: {
        baseCurrency: from,
        targetCurrency: to,
        rate,
        fetchedAt: new Date(),
        expiresAt,
      },
      update: {
        rate,
        fetchedAt: new Date(),
        expiresAt,
      },
    });
  } catch (error) {
    console.debug('Failed to cache exchange rate:', error.message);
  }
}

function getExchangeRateFallback(from, to, amount) {
  const mockRates = {
    'USD_VND': 24500,
    'EUR_VND': 26500,
    'JPY_VND': 165,
    'KRW_VND': 18.5,
    'THB_VND': 700,
    'SGD_VND': 18200,
    'GBP_VND': 31000,
    'AUD_VND': 16000,
    'VND_USD': 0.000041,
  };

  const key = `${from}_${to}`;
  const rate = mockRates[key] || 1;

  return {
    source: 'fallback',
    from,
    to,
    rate,
    amount,
    converted: amount * rate,
    note: 'Tỷ giá tham khảo - có thể không chính xác',
  };
}

// Export geocodeLocation for use in other handlers
export { geocodeLocation };
