/**
 * Crawlee Service — Dual-Mode Scraper
 *
 * CheerioCrawler  → fast, lightweight, for static/SSR sites
 * PlaywrightCrawler → full browser, for JS-heavy SPAs (TripAdvisor, Booking, Airbnb …)
 *
 * The service automatically picks the right crawler based on the URL domain.
 */

import { CheerioCrawler, PlaywrightCrawler, log as crawleeLog, Configuration } from 'crawlee';
import cacheService from '../../../../shared/services/CacheService.js';
import { logger } from '../../../../shared/services/LoggerService.js';

// ─── Global config ─────────────────────────────────────────────────────

crawleeLog.setLevel(crawleeLog.LEVELS.ERROR);
Configuration.getGlobalConfig().set('persistStorage', false);

const CRAWL_CACHE_TTL = 3600;            // 1 hour
const CHEERIO_TIMEOUT_MS = 12000;        // 12 s
const CHEERIO_FALLBACK_TIMEOUT_MS = 8000; // 8 s  (shorter for fallback path)
const PLAYWRIGHT_TIMEOUT_MS = 30000;     // 30 s  (browser launch + JS render)
const CHEERIO_HANDLER_SECS = 10;
const PLAYWRIGHT_HANDLER_SECS = 20;

const REALISTIC_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ─── Domains that require a real browser ───────────────────────────────

const JS_HEAVY_DOMAINS = new Set([
  'tripadvisor.com',
  'tripadvisor.com.vn',
  'booking.com',
  'airbnb.com',
  'agoda.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'google.com',        // Google Flights / Maps use heavy JS
]);

function needsBrowser(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return [...JS_HEAVY_DOMAINS].some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// ─── Standalone extractor functions ────────────────────────────────────

function extractMainContent($, maxLength = 3000) {
  const selectors = [
    'article', 'main', '[role="main"]',
    '.content', '#content', '.post-content', '.entry-content',
    '.article-body', '.story-body',
  ];

  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length) {
      el.find('script, style, nav, footer, .ads, .sidebar, [aria-hidden="true"]').remove();
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 100) return text.substring(0, maxLength);
    }
  }

  const body = $('body').clone();
  body.find('script, style, nav, header, footer, .ads, .sidebar').remove();
  return body.text().replace(/\s+/g, ' ').trim().substring(0, maxLength);
}

function extractHighlights($) {
  const seen = new Set();
  const highlights = [];

  $('h1, h2, h3, strong, b, .highlight, [class*="title"]').each((_, elem) => {
    const text = $(elem).text().replace(/\s+/g, ' ').trim();
    if (text.length > 10 && text.length < 200 && !seen.has(text)) {
      seen.add(text);
      highlights.push(text);
    }
  });

  return highlights.slice(0, 5);
}

function extractMetadata($) {
  return {
    author: $('meta[name="author"]').attr('content') ||
            $('[rel="author"]').first().text().trim() || null,
    publishDate: $('meta[property="article:published_time"]').attr('content') ||
                 $('time').first().attr('datetime') || null,
    keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()).filter(Boolean) || [],
    ogImage: $('meta[property="og:image"]').attr('content') || null,
    ogType: $('meta[property="og:type"]').attr('content') || null,
    siteName: $('meta[property="og:site_name"]').attr('content') || null,
  };
}

function extractPrices($) {
  const prices = new Set();
  const patterns = [
    /(\d{1,3}(?:[.,]\d{3})+)\s*(?:VND|VNĐ|đ|₫)/gi,
    /(\d+)[KkMm]\b/g,
    /(?:giá|từ|chỉ|from)\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:VND|VNĐ|đ|₫)?/gi,
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /USD\s*(\d+)/gi,
  ];

  const priceText = $('[class*="price"], [id*="price"], .amount, [itemprop="price"], [data-price]')
    .map((_, el) => $(el).text()).get().join(' ');
  const combined = priceText + ' ' + $('body').text().substring(0, 5000);

  for (const pattern of patterns) {
    for (const match of combined.matchAll(pattern)) {
      prices.add(match[0].trim());
      if (prices.size >= 5) break;
    }
    if (prices.size >= 5) break;
  }
  return [...prices];
}

function extractAirlines($) {
  const airlines = new Set();
  const names = ['Vietnam Airlines', 'VietJet', 'Bamboo Airways', 'Vietravel Airlines', 'Pacific Airlines', 'VASCO'];
  const text = $('body').text();
  for (const n of names) { if (text.includes(n)) airlines.add(n); }
  return [...airlines];
}

function extractRatings($) {
  const ratings = [];
  $('[class*="rating"], [itemprop="ratingValue"], [data-rating]').each((_, el) => {
    const val = $(el).attr('content') || $(el).text().trim();
    const m = val.match(/(\d+(?:\.\d+)?)\s*\/?\s*(\d+)?/);
    if (m) ratings.push(m[0]);
  });
  return [...new Set(ratings)].slice(0, 3);
}

function extractLocation($) {
  return $('[itemprop="address"]').first().text().trim() ||
         $('[class*="location"]').first().text().trim() ||
         $('[class*="address"]').first().text().trim() || null;
}

// ─── Core scraping: auto-pick CheerioCrawler vs PlaywrightCrawler ─────

function scrapeWithCheerio(url, extractors, timeoutMs = CHEERIO_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Cheerio scrape timeout')), timeoutMs);
    let settled = false;
    const settle = (fn, val) => { if (settled) return; settled = true; clearTimeout(timer); fn(val); };

    const crawler = new CheerioCrawler({
      maxConcurrency: 1,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: CHEERIO_HANDLER_SECS,

      async requestHandler({ $, request }) {
        const data = {};
        for (const [key, fn] of Object.entries(extractors)) {
          try { data[key] = fn($); } catch { data[key] = null; }
        }
        data.crawler = 'cheerio';
        data.scrapedUrl = request.loadedUrl || url;
        data.scrapedAt = new Date().toISOString();
        settle(resolve, data);
      },
      async failedRequestHandler() { settle(reject, new Error(`Cheerio failed: ${url}`)); },
    });

    crawler.run([url]).catch(err => settle(reject, err));
  });
}

function scrapeWithPlaywright(url, extractors, timeoutMs = PLAYWRIGHT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Playwright scrape timeout')), timeoutMs);
    let settled = false;
    const settle = (fn, val) => { if (settled) return; settled = true; clearTimeout(timer); fn(val); };

    const crawler = new PlaywrightCrawler({
      maxConcurrency: 1,
      maxRequestRetries: 2,
      requestHandlerTimeoutSecs: PLAYWRIGHT_HANDLER_SECS,
      navigationTimeoutSecs: 20,
      headless: true,
      useSessionPool: false,
      browserPoolOptions: {
        useFingerprints: true,
      },
      launchContext: {
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
          ],
        },
      },

      preNavigationHooks: [
        async ({ page }) => {
          // Stealth: set realistic headers
          await page.setExtraHTTPHeaders({
            'User-Agent': REALISTIC_USER_AGENT,
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          });

          // Stealth: remove navigator.webdriver flag
          await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
          });

          // Block heavy resources to speed up rendering
          await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot,mp4,webm}', route => route.abort());
        },
      ],

      async requestHandler({ page, request }) {
        await page.waitForLoadState('domcontentloaded');
        // Give JS frameworks time to hydrate
        await page.waitForTimeout(2500);

        const html = await page.content();
        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);

        const data = {};
        for (const [key, fn] of Object.entries(extractors)) {
          try { data[key] = fn($); } catch { data[key] = null; }
        }
        data.crawler = 'playwright';
        data.scrapedUrl = request.loadedUrl || url;
        data.scrapedAt = new Date().toISOString();
        settle(resolve, data);
      },
      async failedRequestHandler(_, error) {
        settle(reject, new Error(`Playwright failed: ${url} — ${error?.message || 'blocked'}`));
      },
    });

    crawler.run([url]).catch(err => settle(reject, err));
  });
}

/**
 * Smart scrape — auto-picks the right crawler for the URL.
 * Falls back to Cheerio if Playwright fails (403 / timeout).
 */
async function scrapeOnce(url, extractors) {
  if (needsBrowser(url)) {
    logger.info('[Playwright] Scraping URL', { url });
    try {
      return await scrapeWithPlaywright(url, extractors);
    } catch (err) {
      // Cheerio fallback with shorter timeout (last resort, may also be blocked)
      logger.warn('[Playwright] Failed, Cheerio fallback', { error: err.message, url });
      try {
        const data = await scrapeWithCheerio(url, extractors, CHEERIO_FALLBACK_TIMEOUT_MS);
        data.crawler = 'cheerio-fallback';
        return data;
      } catch {
        throw new Error(`Both Playwright and Cheerio failed for ${url}`);
      }
    }
  }
  return scrapeWithCheerio(url, extractors);
}

// ─── CrawleeService class ─────────────────────────────────────────────

class CrawleeService {
  /**
   * Enrich search results with scraped content (concurrent, auto-mode)
   */
  async enrichResults(results, options = {}) {
    const { maxResults = 3, includeHighlights = true, withMetadata = true } = options;
    if (!results || results.length === 0) return [];

    const toScrape = results.slice(0, maxResults);

    const jsCount = toScrape.filter(r => needsBrowser(r.url)).length;
    const staticCount = toScrape.length - jsCount;
    logger.info('[Crawlee] Enriching results', { total: toScrape.length, cheerio: staticCount, playwright: jsCount });

    const extractors = {
      title: $ => $('title').text().trim() || $('h1').first().text().trim(),
      description: $ => $('meta[name="description"]').attr('content') || '',
      content: extractMainContent,
      ...(includeHighlights && { highlights: extractHighlights }),
      ...(withMetadata && { metadata: extractMetadata }),
    };

    const promises = toScrape.map(async (result) => {
      const cacheKey = `crawl:${result.url}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) return { ...result, ...cached, enriched: true };

      try {
        const data = await scrapeOnce(result.url, extractors);
        await cacheService.set(cacheKey, data, CRAWL_CACHE_TTL);
        return { ...result, ...data, enriched: true };
      } catch (error) {
        return { ...result, enriched: false, enrichError: error.message };
      }
    });

    const settled = await Promise.allSettled(promises);
    const enriched = settled.map(s => s.status === 'fulfilled' ? s.value : s.reason);

    const remaining = results.slice(maxResults).map(r => ({ ...r, enriched: false }));
    return [...enriched, ...remaining];
  }

  /**
   * Scrape a single URL for detailed content (called by scrape_url tool)
   */
  async scrapeUrl(url, options = {}) {
    const { maxLength = 5000 } = options;

    const cacheKey = `crawl:detail:${url}:${maxLength}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return { ...cached, source: 'cache' };

    logger.info('[Crawlee] Deep scrape', { url, maxLength });

    const extractors = {
      title: $ => $('title').text().trim() || $('h1').first().text().trim(),
      description: $ => $('meta[name="description"]').attr('content') || '',
      content: $ => extractMainContent($, maxLength),
      highlights: extractHighlights,
      metadata: extractMetadata,
      prices: extractPrices,
      ratings: extractRatings,
      location: extractLocation,
    };

    const data = await scrapeOnce(url, extractors);
    await cacheService.set(cacheKey, data, CRAWL_CACHE_TTL);
    return data;
  }

  /**
   * Scrape URLs for travel-specific information (auto-mode)
   */
  async scrapeTravelInfo(urls, type) {
    const extractorSets = {
      flights: { title: $ => $('title').text().trim(), prices: extractPrices, airlines: extractAirlines, highlights: extractHighlights, content: extractMainContent },
      hotels:  { title: $ => $('title').text().trim(), prices: extractPrices, ratings: extractRatings, location: extractLocation, highlights: extractHighlights, content: extractMainContent },
      events:  { title: $ => $('title').text().trim(), prices: extractPrices, location: extractLocation, highlights: extractHighlights, content: extractMainContent, metadata: extractMetadata },
    };

    const extractors = extractorSets[type] || {
      title: $ => $('title').text().trim(),
      content: extractMainContent, highlights: extractHighlights, metadata: extractMetadata,
    };

    const promises = urls.map(async (url) => {
      try {
        const data = await scrapeOnce(url, extractors);
        return { url, type, ...data };
      } catch (error) {
        logger.warn('[Crawlee] Scrape failed', { url, error: error.message });
        return null;
      }
    });

    const settled = await Promise.allSettled(promises);
    return settled.filter(s => s.status === 'fulfilled' && s.value !== null).map(s => s.value);
  }
}

export { needsBrowser, JS_HEAVY_DOMAINS };
export default new CrawleeService();
