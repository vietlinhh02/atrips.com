/**
 * Google Maps Provider — Playwright-based place data crawler
 *
 * Crawls Google Maps search results to extract rich place data:
 * name, rating, ratingCount, address, openingHours, phone, type, coordinates
 *
 * Follows CrawleeService patterns:
 * - Standalone requestHandler (not class method)
 * - persistStorage: false
 * - useSessionPool: false, useFingerprints: true
 * - Block heavy resources, stealth headers, webdriver removal
 */

import { PlaywrightCrawler, log as crawleeLog, Configuration } from 'crawlee';
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

// ─── Global config ─────────────────────────────────────────────────────
crawleeLog.setLevel(crawleeLog.LEVELS.ERROR);
Configuration.getGlobalConfig().set('persistStorage', false);

const CRAWL_TIMEOUT_MS = 45000;       // 45s max for entire crawl
const HANDLER_TIMEOUT_SECS = 35;
const SCROLL_PAUSE_MS = 1500;
const MAX_SCROLLS = 3;

const DETAIL_TIMEOUT_MS = 8000;        // 8s per detail page
const DETAIL_TOTAL_TIMEOUT_MS = 40000; // 40s total for all detail pages
const MAX_DETAIL_PLACES = 5;           // Only top 5 places (was 10)
const DETAIL_PAGE_WAIT_MS = 2500;      // Wait for JS rendering

const REALISTIC_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ─── Type mapping: Google Maps Vietnamese categories → PlaceType enum ──

const TYPE_MAP = {
  // Vietnamese
  'nhà hàng': 'RESTAURANT',
  'quán ăn': 'RESTAURANT',
  'quán cà phê': 'RESTAURANT',
  'quán cafe': 'RESTAURANT',
  'quán bar': 'ACTIVITY',
  'khách sạn': 'HOTEL',
  'nhà nghỉ': 'HOTEL',
  'resort': 'HOTEL',
  'homestay': 'HOTEL',
  'bảo tàng': 'ATTRACTION',
  'công viên': 'ATTRACTION',
  'đền': 'ATTRACTION',
  'chùa': 'ATTRACTION',
  'nhà thờ': 'ATTRACTION',
  'di tích': 'ATTRACTION',
  'điểm tham quan': 'ATTRACTION',
  'khu du lịch': 'ATTRACTION',
  'spa': 'ACTIVITY',
  'chợ': 'ACTIVITY',
  'trung tâm mua sắm': 'ACTIVITY',
  'siêu thị': 'ACTIVITY',

  // English
  'restaurant': 'RESTAURANT',
  'cafe': 'RESTAURANT',
  'coffee shop': 'RESTAURANT',
  'bar': 'ACTIVITY',
  'hotel': 'HOTEL',
  'hostel': 'HOTEL',
  'motel': 'HOTEL',
  'museum': 'ATTRACTION',
  'park': 'ATTRACTION',
  'temple': 'ATTRACTION',
  'church': 'ATTRACTION',
  'pagoda': 'ATTRACTION',
  'monument': 'ATTRACTION',
  'tourist attraction': 'ATTRACTION',
  'shopping mall': 'ACTIVITY',
  'market': 'ACTIVITY',
  'spa': 'ACTIVITY',
};

function mapPriceLevel(level) {
  if (!level) return null;
  const mapping = { 1: 'BUDGET', 2: 'MODERATE', 3: 'EXPENSIVE', 4: 'LUXURY' };
  return mapping[level] || null;
}

function mapType(categoryText) {
  if (!categoryText) return 'ATTRACTION';
  const lower = categoryText.toLowerCase().trim();
  for (const [keyword, type] of Object.entries(TYPE_MAP)) {
    if (lower.includes(keyword)) return type;
  }
  return 'ATTRACTION';
}

// ─── JSON Network Extractor ───────────────────────────────────────────

function extractPlacesFromNetworkData(rawBatches) {
  const places = [];
  const seen = new Set();
  const categoryPatterns = [
    'Nhà hàng', 'Quán ăn', 'Quán cà phê', 'Quán cafe', 'Quán bar',
    'Khách sạn', 'Nhà nghỉ', 'Resort', 'Homestay',
    'Bảo tàng', 'Công viên', 'Chùa', 'Đền', 'Nhà thờ',
    'Chợ', 'Trung tâm mua sắm', 'Spa',
    'Restaurant', 'Cafe', 'Hotel', 'Museum', 'Park', 'Market'
  ];

  function walk(node, currentPlace = {}) {
    if (!node) return;

    if (Array.isArray(node)) {
      let currentURL = currentPlace.url;
      let hasNewURL = false;
      const urlIndex = node.findIndex(item => typeof item === 'string' && item.startsWith('https://www.google.com/maps/place/'));
      if (urlIndex !== -1) {
        currentURL = node[urlIndex];
        hasNewURL = true;
      }

      if (hasNewURL && node.length > 5) {
        const nameMatch = currentURL.match(/place\/([^/]+)\/@/);
        if (nameMatch) {
          const baseName = decodeURIComponent(nameMatch[1].replace(/\+/g, ' '));

          if (!seen.has(baseName)) {
            let rating = null, ratingCount = null, lat = null, lng = null, phone = null, address = null, photoUrl = null, category = null;
            const flatStrings = [];

            function getPrimitives(n) {
              if (Array.isArray(n)) n.forEach(getPrimitives);
              else if (typeof n === 'string') {
                flatStrings.push(n);
              } else if (typeof n === 'number') {
                if (n > 0 && n <= 5 && !Number.isInteger(n)) if (!rating) rating = parseFloat(n.toFixed(1));
                if (Number.isInteger(n) && n > 10) if (!ratingCount) ratingCount = n;
              }
            }
            getPrimitives(node);

            const urlCoord = currentURL.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (urlCoord) {
              lat = parseFloat(urlCoord[1]);
              lng = parseFloat(urlCoord[2]);
            }

            for (const str of flatStrings) {
              if (str.match(/(?:\+84|0)\d[\d\s.-]{7,}/) && str.length < 20) {
                if (!phone) phone = str.replace(/[\s.-]/g, '');
              }
              if (str.length > 15 && str.length < 150 && (str.includes('P.') || str.includes('Phường') || str.includes('Đường') || str.includes('Quận') || str.includes('TP'))) {
                if (!address) address = str;
              }
              if (str.startsWith('https://lh5.googleusercontent') || str.includes('ggpht.com')) {
                if (!photoUrl && !str.includes('icon') && !str.includes('branding')) {
                  photoUrl = str.replace(/=w\d+-h\d+/, '=w400-h300');
                }
              }
              if (!category && str.length < 30) {
                for (const cat of categoryPatterns) {
                  if (str.toLowerCase().includes(cat.toLowerCase())) {
                    category = cat; break;
                  }
                }
              }
            }

            places.push({
              name: baseName,
              googleMapsUrl: currentURL,
              rating,
              ratingCount,
              latitude: lat,
              longitude: lng,
              phone,
              address,
              photoUrl,
              category,
              source: 'google_maps_network'
            });
            seen.add(baseName);
          }
        }
      }
      node.forEach(child => walk(child, { url: currentURL }));
    } else if (typeof node === 'object') {
      Object.values(node).forEach(child => walk(child, currentPlace));
    }
  }

  for (const block of rawBatches) {
    if (!block) continue;
    try {
      walk(JSON.parse(block));
    } catch (e) {
      try {
        const cleaned = block.replace(/^\/\*""\*\/\s*/, '');
        const obj = JSON.parse(cleaned);
        if (obj.d) {
          try { walk(JSON.parse(obj.d)); } catch (e3) { walk(obj); }
        } else {
          walk(obj);
        }
      } catch (e2) { /* ignore */ }
    }
  }
  return places;
}

// ─── Standalone request handler (avoids `this` context issues) ─────────

async function handleGoogleMapsRequest({ page, request }, resolveResult) {
  // 1. Handle Google consent / cookie popup (many variants)
  try {
    const consentSelectors = [
      'button:has-text("Accept all")',
      'button:has-text("Chấp nhận tất cả")',
      'button:has-text("Đồng ý")',
      'button:has-text("I agree")',
      'form[action*="consent"] button',
      'button[aria-label*="Accept"]',
      'button[aria-label*="Consent"]',
      '[role="dialog"] button:first-of-type',
    ];
    for (const sel of consentSelectors) {
      try {
        const btn = page.locator(sel).first();
        const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
        if (visible) {
          await btn.click();
          await page.waitForTimeout(1500);
          logger.info('[GoogleMaps] Dismissed consent popup');
          break;
        }
      } catch {
        // Try next selector
      }
    }
  } catch {
    // No consent popup — continue
  }

  // 2. Extract Data via Network Intercept / APP_INITIALIZATION_STATE
  const networkData = request.userData?.rawJsonBatches || [];

  const appStateStr = await page.evaluate(() => {
    const s = Array.from(document.querySelectorAll('script')).find(s => s.textContent.includes('window.APP_INITIALIZATION_STATE'));
    if (s) {
      const match = s.textContent.match(/window\.APP_INITIALIZATION_STATE\s*=\s*(\[.*\]);/);
      return match ? match[1] : null;
    }
    return null;
  }).catch(() => null);

  if (appStateStr) networkData.push(appStateStr);

  const networkPlaces = extractPlacesFromNetworkData(networkData);
  if (networkPlaces.length >= 5) {
    logger.info(`[GoogleMaps] Extracted ${networkPlaces.length} places instantly via Network Intercept JSON parsing (Fast path)`);
    resolveResult(networkPlaces);
    return;
  }

  logger.info('[GoogleMaps] Network intercept yielded few results, falling back to DOM parsing');

  // 3. Fallback to DOM: Wait for the feed container to load
  try {
    await page.waitForSelector('[role="feed"], div[aria-label*="Results"]', { timeout: 8000 });
  } catch {
    logger.warn('[GoogleMaps] Feed container not found, trying extraction anyway');
  }

  await page.waitForTimeout(2000);

  // 4. Scroll feed to load more results
  const feedSelector = '[role="feed"]';
  for (let i = 0; i < MAX_SCROLLS; i++) {
    try {
      await page.evaluate((sel) => {
        const feed = document.querySelector(sel);
        if (feed) feed.scrollTop = feed.scrollHeight;
      }, feedSelector);
      await page.waitForTimeout(SCROLL_PAUSE_MS);
    } catch {
      break;
    }
  }

  // 4. Extract places — use FULL card text (not narrow container) + regex parsing
  //    Core fix: walk up from each link to the feed's direct child to get the FULL card text
  const places = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    const feed = document.querySelector('[role="feed"]');
    if (!feed) return results;

    const placeLinks = feed.querySelectorAll('a[href*="/maps/place/"]');

    for (const link of placeLinks) {
      const href = link.getAttribute('href') || '';
      const name = link.getAttribute('aria-label') || '';
      if (!name || name.length < 2 || seen.has(name)) continue;
      seen.add(name);

      // Walk UP from the link to find the card — the direct child of feed
      // This ensures we capture the FULL card text (rating, address, hours, etc.)
      let card = link;
      while (card.parentElement && card.parentElement !== feed) {
        card = card.parentElement;
      }
      // If we didn't reach feed (link might be deeply nested), use a broader selector
      if (card.parentElement !== feed) {
        card = link.closest('[data-result-index]')
          || link.parentElement?.parentElement?.parentElement?.parentElement
          || link.parentElement?.parentElement;
      }

      // Get the FULL text content of the card — this is the raw data source
      const fullText = card?.textContent || '';

      // ─── Parse everything from card text using regex ───

      // Coordinates from URL (reliable — from href, not DOM)
      let latitude = null;
      let longitude = null;
      const coordMatch = href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
        href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        latitude = parseFloat(coordMatch[1]);
        longitude = parseFloat(coordMatch[2]);
      }

      // Rating: X.X or X,X followed by ( — e.g., "4,5(1.234)" or "4.5 (234)"
      let rating = null;
      // First try: aria-label on star spans (most reliable when present)
      const starSpans = card?.querySelectorAll?.('span[role="img"][aria-label]') || [];
      for (const span of starSpans) {
        const ariaLabel = span.getAttribute('aria-label') || '';
        const m = ariaLabel.match(/(\d[.,]\d)/);
        if (m) {
          const val = parseFloat(m[1].replace(',', '.'));
          if (val >= 1 && val <= 5) { rating = val; break; }
        }
      }
      // Fallback: regex on card text
      if (rating === null) {
        // Match "X,X(" or "X.X(" or "X,X (" — rating immediately before review count
        const ratingMatch = fullText.match(/(\d[.,]\d)\s*\(/);
        if (ratingMatch) {
          const val = parseFloat(ratingMatch[1].replace(',', '.'));
          if (val >= 1 && val <= 5) rating = val;
        }
      }

      // Rating count: (N) or (N.NNN) or (N,NNN)
      let ratingCount = null;
      const countMatch = fullText.match(/\((\d[\d.,]*)\)/);
      if (countMatch) {
        ratingCount = parseInt(countMatch[1].replace(/[.,]/g, ''), 10);
        if (ratingCount > 10000000) ratingCount = null; // sanity check
      }

      // Category: common Vietnamese/English place types
      let category = null;
      const categoryPatterns = [
        'Nhà hàng', 'Quán ăn', 'Quán cà phê', 'Quán cafe', 'Quán bar', 'Quán nước',
        'Khách sạn', 'Nhà nghỉ', 'Resort', 'Homestay',
        'Bảo tàng', 'Công viên', 'Chùa', 'Đền', 'Nhà thờ', 'Đình',
        'Khu du lịch', 'Khu vui chơi', 'Điểm tham quan',
        'Chợ', 'Trung tâm mua sắm', 'Spa',
        'Restaurant', 'Cafe', 'Hotel', 'Museum', 'Park', 'Temple',
        'Tourist attraction', 'Shopping mall', 'Market',
      ];
      for (const cat of categoryPatterns) {
        if (fullText.includes(cat)) { category = cat; break; }
      }

      // Opening hours: "Đang mở cửa", "Open", "Đóng cửa", "Closed" + trailing text
      let openingHours = null;
      const hoursMatch = fullText.match(/((?:Đang mở cửa|Open|Đóng cửa|Closed|Mở cửa)[^·\n]{0,60})/i);
      if (hoursMatch) openingHours = hoursMatch[1].trim();

      // Address: Vietnamese address patterns (street number + street name, or district/ward)
      // "P." = Phố, "Đ." = Đường — space after prefix is optional (e.g. "P.Điện Biên Phủ")
      let address = null;
      const addrPatterns = [
        /(\d+[A-Za-z]?\s+(?:Đ\.|Đường|P\.|Phố|Ngõ|Hẻm|Tổ)\s*[^\n·,]{3,50})/,
        /((?:Số\s+)?\d+\s+[^\n·,]{5,40},\s*(?:Phường|Quận|Huyện|P\.|Q\.)[^\n·]{3,30})/,
        /((?:Phường|Quận|Huyện|Xã|Thị trấn)\s+[^\n·]{3,40})/,
      ];
      for (const p of addrPatterns) {
        const m = fullText.match(p);
        if (m) { address = m[1].trim(); break; }
      }

      // Phone: Vietnamese phone patterns
      let phone = null;
      const phoneMatch = fullText.match(/(?:\+84|0)\d[\d\s.-]{7,}/);
      if (phoneMatch) phone = phoneMatch[0].replace(/[\s.-]/g, '');

      // ─── NEW: Photo URL from <img> elements in card ───
      // Google Maps place photos are on googleusercontent.com or ggpht.com (no file extension)
      let photoUrl = null;
      const allImgs = card?.querySelectorAll?.('img') || [];
      for (const img of allImgs) {
        // Check src, data-src, and srcset (lazy loading variants)
        const candidates = [
          img.getAttribute('src'),
          img.getAttribute('data-src'),
          img.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0],
        ].filter(Boolean);
        for (const src of candidates) {
          if (src.length > 30 &&
            (src.includes('googleusercontent.com') || src.includes('ggpht.com') ||
              (src.includes('googleapis.com') && src.includes('photo'))) &&
            !src.includes('branding') && !src.includes('icon')) {
            // Upgrade thumbnail to higher resolution: change =w80-h106 → =w400-h300
            photoUrl = src.replace(/=w\d+-h\d+/, '=w400-h300');
            break;
          }
        }
        if (photoUrl) break;
      }
      // Fallback: background-image on styled elements (Google Maps sometimes uses this)
      if (!photoUrl) {
        const styledEls = card?.querySelectorAll?.('[style]') || [];
        for (const el of styledEls) {
          const style = el.getAttribute('style') || '';
          const bgMatch = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
          if (bgMatch && bgMatch[1].length > 30 &&
            (bgMatch[1].includes('googleusercontent') || bgMatch[1].includes('ggpht'))) {
            photoUrl = bgMatch[1].replace(/=w\d+-h\d+/, '=w400-h300');
            break;
          }
        }
      }

      // ─── NEW: Review snippet from quoted text in card ───
      // Google Maps shows highlighted user reviews in quotes: "Great place to visit"
      let reviewSnippet = null;
      const quotePatterns = [
        /["\u201C]([^"\u201D]{8,250})["\u201D]/,    // Standard or smart double quotes
        /\\"([^"]{8,250})\\"/,                        // Escaped quotes in text
        /«([^»]{8,250})»/,                            // Guillemets
      ];
      for (const qp of quotePatterns) {
        const qm = fullText.match(qp);
        if (qm) { reviewSnippet = qm[1].trim(); break; }
      }

      // ─── NEW: Description — short descriptive text from Google Maps ───
      // Google Maps shows a one-liner description for some places
      // e.g., "Khu bảo tồn linh trưởng quý hiếm", "Bảo tàng lịch sử quân đội quốc gia"
      let description = null;
      // Look for fontBodyMedium spans that contain descriptive text (not category/hours)
      const descSpans = card?.querySelectorAll?.('.fontBodyMedium span, [class*="fontBody"] span') || [];
      for (const span of descSpans) {
        const text = span.textContent?.trim() || '';
        // Description is typically 15-100 chars, not a category, not hours, not address
        if (text.length >= 15 && text.length <= 150 &&
          !text.match(/^[\d.,]+$/) &&
          !text.match(/(?:mở cửa|đóng cửa|open|closed)/i) &&
          !text.match(/^\d+\s+(?:P\.|Đ\.|Đường|Phố)/) &&
          !text.match(/^(?:Nhà hàng|Quán|Khách sạn|Bảo tàng|Công viên|Điểm thu hút)/i)) {
          description = text;
          break;
        }
      }

      // ─── NEW: Price level — $ or ₫ symbols in card ───
      let priceLevel = null;
      // Google Maps shows price as: · ₫₫ · or · $$ · between dots
      const priceLevelMatch = fullText.match(/·\s*([₫$]{1,4})\s*·/) || fullText.match(/([₫$]{2,4})/);
      if (priceLevelMatch) {
        priceLevel = priceLevelMatch[1].length;
      }

      results.push({
        name,
        rating,
        ratingCount,
        address,
        category,
        openingHours,
        phone,
        latitude,
        longitude,
        googleMapsUrl: href.startsWith('http') ? href : `https://www.google.com${href}`,
        photoUrl,
        reviewSnippet,
        description,
        priceLevel,
        // Include raw card text so AI can extract additional info
        rawText: fullText.replace(/\s+/g, ' ').trim().substring(0, 2000),
      });
    }

    return results;
  });

  resolveResult(places);
}

// ─── Standalone detail page extractor (avoids `this` context issues) ──

async function extractPlaceDetail(page) {
  try {
    return await page.evaluate(() => {
      const getText = (selectors, maxLen = 500) => {
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            const text = Array.from(els).map(el => el.textContent?.trim()).filter(Boolean).join(' ');
            if (text.length > 5) return text.substring(0, maxLen);
          }
        }
        return null;
      };

      // rawAbout — description/editorial text
      const rawAbout = getText([
        '[aria-label*="About"] .fontBodyMedium',
        '[aria-label*="About"]',
        'div[class*="editorial"] .fontBodyMedium',
        '.section-editorial .section-editorial-text',
      ], 1000);

      // rawReviews — user reviews
      let rawReviews = null;
      const reviewEls = document.querySelectorAll('[data-review-id] .wiI7pd, [data-review-id] .MyEned, [role="article"] .wiI7pd, .review-full-text');
      if (reviewEls.length > 0) {
        rawReviews = Array.from(reviewEls)
          .slice(0, 10)
          .map(el => el.textContent?.trim())
          .filter(t => t && t.length > 10)
          .join(' --- ')
          .substring(0, 3000);
      }
      if (!rawReviews) {
        // Fallback: any quoted text blocks
        const quoteEls = document.querySelectorAll('.wiI7pd, [jsan*="review"]');
        if (quoteEls.length > 0) {
          rawReviews = Array.from(quoteEls)
            .slice(0, 10)
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 10)
            .join(' --- ')
            .substring(0, 3000);
        }
      }

      // rawHours — opening hours per day
      let rawHours = null;
      const hoursTable = document.querySelector('[aria-label*="Hours"], [aria-label*="hours"], [aria-label*="Giờ"]');
      if (hoursTable) {
        rawHours = hoursTable.textContent?.replace(/\s+/g, ' ').trim().substring(0, 500);
      }
      if (!rawHours) {
        // Fallback: look for day-of-week patterns in text
        const allText = document.body.innerText || '';
        const hoursMatch = allText.match(/((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Thứ\s*\d|Chủ nhật)[^\n]{5,200}(?:\n(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Thứ\s*\d|Chủ nhật)[^\n]{5,200}){1,6})/i);
        if (hoursMatch) rawHours = hoursMatch[0].replace(/\s+/g, ' ').trim().substring(0, 500);
      }

      // rawAmenities — amenities/highlights
      const rawAmenities = getText([
        '[aria-label*="Amenities"] .fontBodyMedium',
        '[aria-label*="Highlights"] .fontBodyMedium',
        '[aria-label*="Amenities"]',
        '[aria-label*="Highlights"]',
        '[aria-label*="Tiện nghi"]',
      ], 500);

      // rawServiceOptions — dine-in, takeaway, delivery etc
      const rawServiceOptions = getText([
        '[aria-label*="Service options"]',
        '[aria-label*="Tùy chọn dịch vụ"]',
        '[data-item-id*="service"]',
      ], 300);

      // allPhotoUrls — up to 5 high-res Google Maps photos
      const allPhotoUrls = [];
      const imgs = document.querySelectorAll('img[src*="googleusercontent"], img[src*="ggpht"], img[data-src*="googleusercontent"]');
      const seenUrls = new Set();
      for (const img of imgs) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (src.length > 30 && !src.includes('branding') && !src.includes('icon') && !seenUrls.has(src)) {
          // Upgrade to higher resolution
          const upgraded = src.replace(/=w\d+-h\d+/, '=w600-h400');
          seenUrls.add(src);
          allPhotoUrls.push(upgraded);
          if (allPhotoUrls.length >= 5) break;
        }
      }

      // fullAddress
      let fullAddress = null;
      const addrEl = document.querySelector('[data-item-id="address"] .fontBodyMedium, [data-item-id="address"]');
      if (addrEl) fullAddress = addrEl.textContent?.trim().substring(0, 200);

      // businessPhone
      let businessPhone = null;
      const phoneEl = document.querySelector('[data-item-id*="phone"] .fontBodyMedium, [data-item-id*="phone"]');
      if (phoneEl) {
        const phoneText = phoneEl.textContent?.trim();
        const phoneMatch = phoneText?.match(/(?:\+84|0)\d[\d\s.-]{7,}/);
        if (phoneMatch) businessPhone = phoneMatch[0].replace(/[\s.-]/g, '').substring(0, 30);
      }

      // businessWebsite — actual business URL (not google.com)
      let businessWebsite = null;
      const websiteEl = document.querySelector('[data-item-id="authority"] a, a[data-item-id="authority"]');
      if (websiteEl) {
        const href = websiteEl.getAttribute('href') || '';
        if (href && !href.includes('google.com') && !href.includes('google.com.vn')) {
          businessWebsite = href;
        }
      }

      // menuUrl — menu link for restaurants
      let menuUrl = null;
      const menuEl = document.querySelector('[data-item-id*="menu"] a, a[aria-label*="Menu"], a[aria-label*="menu"]');
      if (menuEl) {
        const href = menuEl.getAttribute('href') || '';
        if (href && href.startsWith('http')) menuUrl = href;
      }

      return {
        rawAbout,
        rawReviews,
        rawHours,
        rawAmenities,
        rawServiceOptions,
        allPhotoUrls: allPhotoUrls.length > 0 ? allPhotoUrls : null,
        fullAddress,
        businessPhone,
        businessWebsite,
        menuUrl,
        crawledAt: new Date().toISOString(),
      };
    });
  } catch (err) {
    logger.debug(`[GoogleMaps] Detail extraction error: ${err.message}`);
    return null;
  }
}

// ─── GoogleMapsProvider class ──────────────────────────────────────────

class GoogleMapsProvider {
  /**
   * Search places on Google Maps and extract rich data
   * @param {string} destination - City/area to search
   * @param {object} options
   * @param {number} options.limit - Max places to return (default 20)
   * @param {string} options.query - Optional search query (default: "top places to visit in {destination}")
   * @returns {{ source: string, places: Array }}
   */
  async searchPlaces(destination, options = {}) {
    const { limit = 20, query } = options;
    const searchQuery = query || `top places to visit in ${destination}`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://www.google.com/maps/search/${encodedQuery}`;

    logger.info(`[GoogleMaps] Crawling: "${searchQuery}"`);
    logger.info(`[GoogleMaps] URL: ${url}`);

    let places = [];
    let lastError = null;

    // Retry once on failure
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        places = await this._crawl(url);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          logger.warn(`[GoogleMaps] Crawl failed (attempt 1): ${error.message}, retrying...`);
        } else {
          logger.warn(`[GoogleMaps] Crawl failed (attempt 2): ${error.message}`);
        }
      }
    }

    if (lastError && places.length === 0) {
      // If structured crawl failed, try full page text as fallback
      try {
        logger.info(`[GoogleMaps] Trying full page text fallback...`);
        const pageData = await this.crawlFullPageText(url);
        if (pageData?.fullText) {
          return {
            source: 'google_maps_fulltext',
            places: [],
            fullPageText: pageData.fullText,
            url,
            note: 'Structured extraction failed. Raw page text provided for AI analysis.',
          };
        }
      } catch (fallbackError) {
        logger.warn(`[GoogleMaps] Full page fallback also failed: ${fallbackError.message}`);
      }
      return { source: 'google_maps', places: [] };
    }

    // Post-process: map types, deduplicate, limit
    const processed = places
      .filter(p => p.name && p.name.length >= 2)
      .map(p => ({
        name: p.name,
        rating: p.rating,
        ratingCount: p.ratingCount,
        address: p.address,
        type: mapType(p.category),
        openingHours: p.openingHours,
        phone: p.phone,
        latitude: p.latitude,
        longitude: p.longitude,
        website: p.googleMapsUrl,
        source: 'google_maps',
        photoUrl: p.photoUrl || null,
        reviewSnippet: p.reviewSnippet || null,
        description: p.description || null,
        priceLevel: p.priceLevel || null,
        rawText: p.rawText || null,
      }))
      .slice(0, limit);

    // Log extraction quality stats
    const withRating = processed.filter(p => p.rating != null).length;
    const withCoords = processed.filter(p => p.latitude != null).length;
    const withAddress = processed.filter(p => p.address != null).length;
    const withPhoto = processed.filter(p => p.photoUrl != null).length;
    const withReview = processed.filter(p => p.reviewSnippet != null).length;
    logger.info(`[GoogleMaps] Extracted ${processed.length} places (rating: ${withRating}, coords: ${withCoords}, address: ${withAddress}, photos: ${withPhoto}, reviews: ${withReview})`);

    // Save to DB in background (don't await)
    if (processed.length > 0) {
      this._saveToDB(processed, destination).catch(err => {
        logger.warn(`[GoogleMaps] DB save failed: ${err.message}`);
      });
    }

    return { source: 'google_maps', places: processed };
  }

  /**
   * Crawl a Google Maps page and return the full page text content.
   * Used as a fallback when structured extraction fails, allowing AI to parse the raw text.
   * @param {string} url - Google Maps search URL
   * @returns {{ fullText: string, url: string }}
   */
  crawlFullPageText(url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Google Maps full page crawl timeout')), CRAWL_TIMEOUT_MS);
      let settled = false;
      const settle = (fn, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(val);
      };

      const crawler = new PlaywrightCrawler({
        maxConcurrency: 1,
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: HANDLER_TIMEOUT_SECS,
        navigationTimeoutSecs: 30,
        headless: true,
        useSessionPool: false,
        browserPoolOptions: {
          useFingerprints: true,
        },
        launchContext: {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
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

            await page.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            // Block heavy resources but keep images for context
            await page.route('**/*.{woff,woff2,ttf,eot,mp4,webm}', route => route.abort());
          },
        ],

        async requestHandler({ page }) {
          // Wait for page to render
          await page.waitForTimeout(5000);

          // Scroll to load more content
          for (let i = 0; i < MAX_SCROLLS; i++) {
            try {
              await page.evaluate(() => {
                const feed = document.querySelector('[role="feed"]');
                if (feed) feed.scrollTop = feed.scrollHeight;
                else window.scrollTo(0, document.body.scrollHeight);
              });
              await page.waitForTimeout(SCROLL_PAUSE_MS);
            } catch {
              break;
            }
          }

          // Extract full page text
          const fullText = await page.evaluate(() => {
            // Try to get text from the main content area first
            const feed = document.querySelector('[role="feed"]');
            if (feed) {
              return feed.innerText?.substring(0, 15000) || '';
            }
            // Fallback: get body text
            return document.body.innerText?.substring(0, 15000) || '';
          });

          settle(resolve, { fullText, url });
        },

        async failedRequestHandler(_, error) {
          settle(reject, new Error(`Google Maps full page crawl failed: ${error?.message || 'blocked'}`));
        },
      });

      crawler.run([url]).catch(err => settle(reject, err));
    });
  }

  /**
   * Crawl Google Maps search results page
   */
  _crawl(url) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Google Maps crawl timeout')), CRAWL_TIMEOUT_MS);
      let settled = false;
      const settle = (fn, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(val);
      };

      const resolveResult = (places) => settle(resolve, places);

      const crawler = new PlaywrightCrawler({
        maxConcurrency: 1,
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: HANDLER_TIMEOUT_SECS,
        navigationTimeoutSecs: 30,
        headless: true,
        useSessionPool: false,
        browserPoolOptions: {
          useFingerprints: true,
        },
        launchContext: {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
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
          async ({ page, request }) => {
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

            await page.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            // Block heavy resources
            await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot,mp4,webm}', route => route.abort());

            // --- NEW: Network Interception ---
            request.userData = request.userData || {};
            request.userData.rawJsonBatches = [];
            page.on('response', async (res) => {
              if (res.url().includes('/search?') || res.url().includes('batchexecute')) {
                try {
                  const text = await res.text();
                  if (text && text.length > 50) {
                    request.userData.rawJsonBatches.push(text);
                  }
                } catch (e) { /* ignore text error */ }
              }
            });

            // Use domcontentloaded instead of load — Google Maps is SPA, full load waits for all XHRs
            request.skipNavigation = false;
          },
        ],

        async requestHandler(ctx) {
          await handleGoogleMapsRequest(ctx, resolveResult);
        },

        async failedRequestHandler(_, error) {
          settle(reject, new Error(`Google Maps crawl failed: ${error?.message || 'blocked'}`));
        },
      });

      crawler.run([url]).catch(err => settle(reject, err));
    });
  }

  /**
   * Crawl detail pages for top places to extract enriched data
   * @param {Array} places - Places with googleMapsUrl from feed crawl
   * @returns {Map<string, object>} Map of placeName → detailData
   */
  async getPlaceDetails(places) {
    const detailMap = new Map();
    const toVisit = places
      .filter(p => p.website?.includes('/maps/place/') || p.googleMapsUrl?.includes('/maps/place/'))
      .slice(0, MAX_DETAIL_PLACES);

    if (toVisit.length === 0) return detailMap;

    logger.info(`[GoogleMaps] Detail crawl starting for ${toVisit.length} places`);

    const totalStart = Date.now();

    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(), DETAIL_TOTAL_TIMEOUT_MS);
        let settled = false;

        const crawler = new PlaywrightCrawler({
          maxConcurrency: 1,
          maxRequestRetries: 0,
          requestHandlerTimeoutSecs: Math.ceil(DETAIL_TIMEOUT_MS / 1000) + DETAIL_PAGE_WAIT_MS / 1000 + 2,
          navigationTimeoutSecs: Math.ceil(DETAIL_TIMEOUT_MS / 1000),
          headless: true,
          useSessionPool: false,
          browserPoolOptions: {
            useFingerprints: true,
          },
          launchContext: {
            launchOptions: {
              executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
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

              await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
              });

              // Block fonts/videos but NOT images (need photo URLs)
              await page.route('**/*.{woff,woff2,ttf,eot,mp4,webm}', route => route.abort());
            },
          ],

          async requestHandler({ page, request }) {
            // Check total timeout
            if (Date.now() - totalStart > DETAIL_TOTAL_TIMEOUT_MS) return;

            const placeName = request.userData?.placeName;
            logger.debug(`[GoogleMaps] Detail page: ${placeName}`);

            // Wait for content to render
            await page.waitForTimeout(DETAIL_PAGE_WAIT_MS);

            const detail = await extractPlaceDetail(page);
            if (detail && placeName) {
              detailMap.set(placeName, detail);
              logger.debug(`[GoogleMaps] Detail crawled: ${placeName} (reviews: ${detail.rawReviews ? 'yes' : 'no'}, photos: ${detail.allPhotoUrls?.length || 0})`);
            }
          },

          async failedRequestHandler(_, error) {
            logger.debug(`[GoogleMaps] Detail page failed: ${error?.message}`);
          },
        });

        const requests = toVisit.map(p => ({
          url: p.website || p.googleMapsUrl,
          userData: { placeName: p.name },
        }));

        crawler.run(requests)
          .then(() => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } })
          .catch(err => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } });
      });
    } catch (err) {
      logger.warn(`[GoogleMaps] Detail crawl error: ${err.message}`);
    }

    logger.info(`[GoogleMaps] Detail crawl complete: ${detailMap.size}/${toVisit.length} places enriched in ${((Date.now() - totalStart) / 1000).toFixed(1)}s`);
    return detailMap;
  }

  /**
   * Save enriched detail data to cached_places
   */
  async _saveEnrichedToDB(detailMap, city) {
    let saved = 0;
    for (const [name, detail] of detailMap) {
      try {
        const updateData = {
          enrichedData: detail,
          lastFetchedAt: new Date(),
        };

        // Update photos if we got better ones from detail page
        if (detail.allPhotoUrls?.length > 0) {
          updateData.photos = detail.allPhotoUrls;
        }
        if (detail.businessPhone) updateData.phone = detail.businessPhone;
        if (detail.businessWebsite) updateData.website = detail.businessWebsite;
        if (detail.fullAddress) updateData.address = detail.fullAddress;

        const result = await prisma.cached_places.updateMany({
          where: {
            name: { equals: name, mode: 'insensitive' },
            ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
          },
          data: updateData,
        });

        if (result.count > 0) saved++;
      } catch (err) {
        logger.debug(`[GoogleMaps] Failed to save enriched data for "${name}": ${err.message}`);
      }
    }
    logger.info(`[GoogleMaps] Saved enriched data for ${saved}/${detailMap.size} places`);
  }

  /**
   * Save crawled places to cached_places table
   */
  async _saveToDB(places, city) {
    let saved = 0;
    for (const place of places) {
      // Skip places without coordinates — Prisma requires Float (not nullable)
      if (!place.latitude || !place.longitude) continue;

      try {
        const externalId = `gmaps_${place.name}_${city}`.substring(0, 255);

        await prisma.cached_places.upsert({
          where: {
            provider_externalId: {
              provider: 'google_maps',
              externalId,
            },
          },
          create: {
            externalId,
            provider: 'google_maps',
            name: place.name,
            type: place.type || 'ATTRACTION',
            address: place.address,
            city,
            latitude: place.latitude,
            longitude: place.longitude,
            rating: place.rating,
            ratingCount: place.ratingCount,
            phone: place.phone,
            openingHours: place.openingHours ? { text: place.openingHours } : undefined,
            website: place.website,
            photos: place.photoUrl ? [place.photoUrl] : [],
            priceLevel: mapPriceLevel(place.priceLevel),
            enrichedData: place.enrichedData || undefined,
            categories: [],
          },
          update: {
            rating: place.rating,
            ratingCount: place.ratingCount,
            phone: place.phone,
            openingHours: place.openingHours ? { text: place.openingHours } : undefined,
            website: place.website,
            address: place.address,
            photos: place.photoUrl ? [place.photoUrl] : undefined,
            priceLevel: mapPriceLevel(place.priceLevel) || undefined,
            enrichedData: place.enrichedData || undefined,
            lastFetchedAt: new Date(),
          },
        });
        saved++;
      } catch (err) {
        logger.debug(`[GoogleMaps] Failed to save "${place.name}": ${err.message}`);
      }
    }
    logger.info(`[GoogleMaps] Saved ${saved}/${places.length} places to DB`);
  }
}

export default new GoogleMapsProvider();
