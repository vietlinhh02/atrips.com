/**
 * Social Media Search Handlers
 * Handles search operations for YouTube, Facebook, TikTok, Instagram
 * Uses SearXNG (replaces Exa API)
 */

import cacheService from '../../../../../shared/services/CacheService.js';
import searxngService from '../SearxngService.js';

// Cache TTL for social media results (in seconds)
const CACHE_TTL = {
  SOCIAL: 1800,    // 30 minutes
  YOUTUBE: 3600,   // 1 hour
};

// Platform domain mappings
const PLATFORM_DOMAINS = {
  youtube: ['youtube.com', 'youtu.be'],
  facebook: ['facebook.com', 'fb.com', 'fb.watch'],
  tiktok: ['tiktok.com'],
  instagram: ['instagram.com'],
};

/**
 * Create social media handlers bound to executor context
 */
export function createSocialMediaHandlers(executor) {
  return {
    searchSocialMedia: searchSocialMedia.bind(executor),
    searchYouTubeVideos: searchYouTubeVideos.bind(executor),
  };
}

/**
 * Search Social Media - Uses SearXNG with domain filtering
 */
async function searchSocialMedia(args) {
  const {
    query,
    platforms = ['all'],
    numResults = 5,
    recency = '3months',
    contentType = 'all',
  } = args;

  const limit = Math.min(Math.max(1, numResults), 10);
  const cacheKey = `tool:social:${query}:${platforms.join(',')}:${limit}:${recency}`;

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  try {
    // Build domain list based on selected platforms
    const domains = buildDomainList(platforms);
    const enhancedQuery = buildSocialMediaQuery(query, contentType);

    console.log(`[SearXNG] Social media search: "${enhancedQuery}" on [${platforms.join(', ')}]`);

    const searchResults = await searxngService.domainSearch(enhancedQuery, domains, {
      limit: limit * 2, // Get more for filtering
      language: 'vi',
    });

    const results = searchResults.results.slice(0, limit);

    const result = {
      source: 'searxng',
      query: enhancedQuery,
      platforms,
      contentType,
      results: results.map(r => ({
        title: r.title,
        url: r.url,
        platform: detectPlatform(r.url),
        publishedDate: r.publishedDate,
        author: r.author,
        score: r.score,
        text: r.content,
        highlights: [],
        engine: r.engine,
      })),
      totalResults: results.length,
      suggestions: searchResults.suggestions || [],
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.SOCIAL);
    return result;
  } catch (error) {
    console.error('Social media search error:', error.message);
    return socialMediaFallback(query, platforms);
  }
}

/**
 * Search YouTube Videos - Uses YouTube Data API v3 or SearXNG fallback
 */
async function searchYouTubeVideos(args) {
  const {
    query,
    maxResults = 5,
    videoDuration = 'any',
    order = 'relevance',
    publishedAfter,
  } = args;

  const limit = Math.min(Math.max(1, maxResults), 10);
  const cacheKey = `tool:youtube:${query}:${limit}:${order}:${videoDuration}`;

  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // If user has YouTube API key, use it
  if (this.youtubeApiKey) {
    return await searchYouTubeWithAPI.call(this, args);
  }

  // Fallback: SearXNG search on YouTube domain
  return await searchYouTubeWithSearxng(args);
}

/**
 * Search YouTube using official YouTube Data API v3
 */
async function searchYouTubeWithAPI(args) {
  const { query, maxResults = 5, videoDuration = 'any', order = 'relevance', publishedAfter } = args;

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: Math.min(maxResults, 10),
      order,
      videoDuration,
      key: this.youtubeApiKey,
    });

    if (publishedAfter) {
      params.append('publishedAfter', new Date(publishedAfter).toISOString());
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();

    // Get video statistics (views, likes, etc.)
    const videoIds = data.items?.map(item => item.id.videoId).join(',');
    const statsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${this.youtubeApiKey}`
    );

    const statsData = statsResponse.ok ? await statsResponse.json() : null;
    const statsMap = new Map(
      statsData?.items?.map(item => [item.id, item]) || []
    );

    const result = {
      source: 'youtube_api',
      query,
      videos: data.items?.map(item => {
        const stats = statsMap.get(item.id.videoId);
        return {
          title: item.snippet.title,
          videoId: item.id.videoId,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description,
          views: stats?.statistics?.viewCount || 'N/A',
          likes: stats?.statistics?.likeCount || 'N/A',
          duration: stats?.contentDetails?.duration || 'N/A',
        };
      }) || [],
      totalResults: data.pageInfo?.totalResults || 0,
    };

    const cacheKey = `tool:youtube:${query}:${maxResults}:${order}:${videoDuration}`;
    await cacheService.set(cacheKey, result, CACHE_TTL.YOUTUBE);

    return result;
  } catch (error) {
    console.error('YouTube API search error:', error.message);
    // Fall back to SearXNG if YouTube API fails
    return await searchYouTubeWithSearxng(args);
  }
}

/**
 * Search YouTube using SearXNG as fallback
 */
async function searchYouTubeWithSearxng(args) {
  const { query, maxResults = 5 } = args;

  try {
    console.log(`[SearXNG] YouTube search: "${query}"`);

    const searchResults = await searxngService.domainSearch(
      query,
      ['youtube.com', 'youtu.be'],
      { limit: maxResults, language: 'vi' }
    );

    const result = {
      source: 'searxng_youtube',
      query,
      note: 'Kết quả từ SearXNG. Để có thông tin chi tiết (views, likes), hãy cấu hình YOUTUBE_API_KEY.',
      videos: searchResults.results.map(r => ({
        title: r.title,
        url: r.url,
        videoId: extractYouTubeVideoId(r.url),
        thumbnail: extractYouTubeVideoId(r.url)
          ? `https://img.youtube.com/vi/${extractYouTubeVideoId(r.url)}/hqdefault.jpg`
          : null,
        publishedAt: r.publishedDate,
        description: r.content,
        score: r.score,
      })),
      totalResults: searchResults.results.length,
      suggestions: searchResults.suggestions || [],
    };

    const cacheKey = `tool:youtube:${query}:${maxResults}`;
    await cacheService.set(cacheKey, result, CACHE_TTL.YOUTUBE);

    return result;
  } catch (error) {
    console.error('SearXNG YouTube search error:', error.message);
    return youTubeFallback(query);
  }
}

// ─── Helper Functions ──────────────────────────────────────────────────

function buildDomainList(platforms) {
  if (platforms.includes('all')) {
    return Object.values(PLATFORM_DOMAINS).flat();
  }
  return platforms.flatMap(platform => PLATFORM_DOMAINS[platform] || []);
}

function buildSocialMediaQuery(query, contentType) {
  const typeKeywords = {
    video: 'video',
    post: 'post',
    review: 'review',
    vlog: 'vlog travel',
    all: '',
  };
  const keyword = typeKeywords[contentType] || '';
  return keyword ? `${query} ${keyword}` : query;
}

function detectPlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return 'unknown';
}

function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function socialMediaFallback(query, platforms) {
  return {
    source: 'fallback',
    query,
    platforms,
    results: [],
    message: 'Social media search không khả dụng.',
    note: 'Kiểm tra SearXNG service: docker compose logs searxng',
  };
}

function youTubeFallback(query) {
  return {
    source: 'fallback',
    query,
    videos: [],
    message: 'YouTube search không khả dụng.',
    note: 'Cần YOUTUBE_API_KEY hoặc SearXNG service chạy.',
  };
}
