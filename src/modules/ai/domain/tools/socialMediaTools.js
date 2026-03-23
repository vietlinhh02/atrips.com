/**
 * Social Media Search Tools
 * Tools for searching content on YouTube, Facebook, TikTok, Instagram
 */

export const SOCIAL_MEDIA_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_social_media',
      description: 'Search for travel content across social media platforms — YouTube, Facebook, TikTok, Instagram. Finds videos, reviews, vlogs, and posts about travel destinations. Results sorted by newest first by default. Use when the user wants social media content, video reviews, vlogs, or influencer recommendations.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keywords (e.g., "Da Lat resort review", "Phu Quoc travel", "Hanoi food")',
          },
          platforms: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['youtube', 'facebook', 'tiktok', 'instagram', 'all'],
            },
            description: 'Platforms to search. Default: "all" (all platforms).',
          },
          numResults: {
            type: 'number',
            description: 'Number of results. Default: 3. Max: 8.',
          },
          recency: {
            type: 'string',
            enum: ['week', 'month', '3months', '6months', 'year', 'all'],
            description: 'Filter by publish date. Default: 3months.',
          },
          contentType: {
            type: 'string',
            enum: ['video', 'post', 'review', 'vlog', 'all'],
            description: 'Content type filter (video, post, review, vlog)',
          },
          sortBy: {
            type: 'string',
            enum: ['date', 'viewCount', 'relevance', 'engagement'],
            description: 'Sort order. Default: date (newest). Use viewCount for "most popular" requests.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_youtube_videos',
      description: 'Search YouTube for travel videos with detailed metadata — views, likes, duration, channel info. Results sorted by newest first by default. Use when the user specifically wants YouTube videos or needs video details like view counts and channel information. For multi-platform searches, use search_social_media instead.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Video search query (e.g., "Da Lat travel guide", "Hanoi food tour")',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum videos. Default: 3. Max: 8.',
          },
          videoDuration: {
            type: 'string',
            enum: ['short', 'medium', 'long', 'any'],
            description: 'Duration filter: short (<4min), medium (4-20min), long (>20min).',
          },
          order: {
            type: 'string',
            enum: ['relevance', 'date', 'viewCount', 'rating'],
            description: 'Sort order. Default: date (newest). Use viewCount for "most viewed" requests.',
          },
          publishedAfter: {
            type: 'string',
            description: 'Only videos published after this date (YYYY-MM-DD)',
          },
        },
        required: ['query'],
      },
    },
  },
];

/**
 * Social media tool names
 */
export const SOCIAL_MEDIA_TOOL_NAMES = SOCIAL_MEDIA_TOOLS.map(t => t.function.name);

/**
 * Social media tool handlers mapping
 */
export const SOCIAL_MEDIA_TOOL_HANDLERS = {
  search_social_media: 'handleSearchSocialMedia',
  search_youtube_videos: 'handleSearchYouTubeVideos',
};
