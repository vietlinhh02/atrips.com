#!/usr/bin/env node
/**
 * Test dual-mode CrawleeService — Cheerio vs Playwright
 * Run: node scripts/test-playwright-crawlee.js
 */

import 'dotenv/config';

console.log('🧪 Testing Dual-Mode CrawleeService (Cheerio + Playwright)\n');

// ── Test 1: Import & needsBrowser() ──────────────────────────────────

console.log('📝 Test 1: Import & needsBrowser()');
let needsBrowser, JS_HEAVY_DOMAINS, crawleeService;

try {
  const mod = await import('../src/modules/ai/infrastructure/services/CrawleeService.js');
  crawleeService = mod.default;
  needsBrowser = mod.needsBrowser;
  JS_HEAVY_DOMAINS = mod.JS_HEAVY_DOMAINS;

  console.log('   ✓ CrawleeService imported');
  console.log(`   ✓ JS_HEAVY_DOMAINS: ${[...JS_HEAVY_DOMAINS].join(', ')}`);

  // Verify needsBrowser
  const tests = [
    ['https://www.tripadvisor.com/Hotel-Review', true],
    ['https://www.booking.com/hotel/vn/abc', true],
    ['https://www.airbnb.com/rooms/123', true],
    ['https://agoda.com/hotel', true],
    ['https://example.com', false],
    ['https://vnexpress.net/article', false],
    ['https://traveloka.com/hotels', false],
  ];

  let passed = 0;
  for (const [url, expected] of tests) {
    const result = needsBrowser(url);
    const ok = result === expected;
    if (ok) passed++;
    console.log(`   ${ok ? '✓' : '✗'} needsBrowser("${url}") = ${result} (expected ${expected})`);
  }
  console.log(`   → ${passed}/${tests.length} passed`);
} catch (error) {
  console.error('   ✗ Import failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// ── Test 2: Cheerio scrape (static site) ─────────────────────────────

console.log('\n📝 Test 2: Cheerio scrape (static site — example.com)');
try {
  const start = Date.now();
  const results = await crawleeService.enrichResults(
    [{ title: 'Example', url: 'https://example.com', content: '' }],
    { maxResults: 1, includeHighlights: true, withMetadata: true }
  );
  const elapsed = Date.now() - start;

  const r = results[0];
  console.log(`   ✓ Enriched in ${elapsed}ms`);
  console.log(`   ✓ Crawler used: ${r.crawler || 'N/A'}`);
  console.log(`   ✓ Title: ${r.title || 'N/A'}`);
  console.log(`   ✓ Content length: ${(r.content || '').length} chars`);
  console.log(`   ✓ Highlights: ${JSON.stringify(r.highlights || [])}`);
  console.log(`   ✓ Metadata: ${JSON.stringify(r.metadata || {})}`);

  if (r.crawler !== 'cheerio') {
    console.log('   ⚠️ Expected cheerio crawler for example.com');
  }
} catch (error) {
  console.error('   ✗ Cheerio scrape failed:', error.message);
}

// ── Test 3: Playwright scrape (JS-heavy site — TripAdvisor) ──────────

console.log('\n📝 Test 3: Playwright scrape (JS-heavy site — TripAdvisor)');
try {
  const url = 'https://www.tripadvisor.com/Tourism-g293921-Vietnam-Vacations.html';
  console.log(`   🎭 Scraping: ${url}`);
  console.log('   ⏳ This may take 10-25 seconds (browser launch + JS render)...');

  const start = Date.now();
  const results = await crawleeService.enrichResults(
    [{ title: 'Vietnam Travel', url, content: '' }],
    { maxResults: 1, includeHighlights: true, withMetadata: true }
  );
  const elapsed = Date.now() - start;

  const r = results[0];
  console.log(`   ✓ Completed in ${elapsed}ms`);
  console.log(`   ✓ Enriched: ${r.enriched}`);
  console.log(`   ✓ Crawler used: ${r.crawler || 'N/A'}`);
  console.log(`   ✓ Title: ${(r.title || 'N/A').substring(0, 80)}`);
  console.log(`   ✓ Content length: ${(r.content || '').length} chars`);
  console.log(`   ✓ Content preview: ${(r.content || '').substring(0, 200)}...`);
  console.log(`   ✓ Highlights: ${JSON.stringify((r.highlights || []).slice(0, 3))}`);

  if (r.crawler !== 'playwright') {
    console.log('   ⚠️ Expected playwright crawler for TripAdvisor');
  }

  if ((r.content || '').length < 50) {
    console.log('   ⚠️ Content is very short — JS rendering may not have worked');
  } else {
    console.log('   🎉 TripAdvisor content extracted successfully!');
  }
} catch (error) {
  console.error('   ✗ Playwright scrape failed:', error.message);
  if (error.message.includes('browserType.launch')) {
    console.log('   💡 Run: npx playwright install chromium');
  }
}

// ── Test 4: Playwright scrape — Booking.com ──────────────────────────

console.log('\n📝 Test 4: Playwright scrape (Booking.com)');
try {
  const url = 'https://www.booking.com/city/vn/ho-chi-minh-city.html';
  console.log(`   🎭 Scraping: ${url}`);
  console.log('   ⏳ Waiting for browser render...');

  const start = Date.now();
  const results = await crawleeService.enrichResults(
    [{ title: 'Booking HCMC', url, content: '' }],
    { maxResults: 1, includeHighlights: true, withMetadata: true }
  );
  const elapsed = Date.now() - start;

  const r = results[0];
  console.log(`   ✓ Completed in ${elapsed}ms`);
  console.log(`   ✓ Enriched: ${r.enriched}`);
  console.log(`   ✓ Crawler: ${r.crawler || 'N/A'}`);
  console.log(`   ✓ Title: ${(r.title || 'N/A').substring(0, 80)}`);
  console.log(`   ✓ Content length: ${(r.content || '').length} chars`);
  console.log(`   ✓ Content preview: ${(r.content || '').substring(0, 200)}...`);

  if ((r.content || '').length > 50) {
    console.log('   🎉 Booking.com content extracted successfully!');
  }
} catch (error) {
  console.error('   ✗ Booking.com scrape failed:', error.message);
}

// ── Test 5: Mixed batch (Cheerio + Playwright together) ──────────────

console.log('\n📝 Test 5: Mixed batch (static + JS-heavy URLs)');
try {
  const mixedUrls = [
    { title: 'VnExpress', url: 'https://vnexpress.net/du-lich', content: '' },
    { title: 'TripAdvisor Da Nang', url: 'https://www.tripadvisor.com/Tourism-g298085-Da_Nang-Vacations.html', content: '' },
  ];

  console.log('   🕷️ Scraping 2 URLs (1 Cheerio + 1 Playwright)...');
  const start = Date.now();
  const results = await crawleeService.enrichResults(mixedUrls, { maxResults: 2 });
  const elapsed = Date.now() - start;

  console.log(`   ✓ Completed in ${elapsed}ms`);
  for (const r of results) {
    const status = r.enriched ? '✓ enriched' : '✗ failed';
    console.log(`   ${status} | ${r.crawler || 'N/A'} | ${(r.title || 'N/A').substring(0, 50)} | ${(r.content || '').length} chars`);
  }
} catch (error) {
  console.error('   ✗ Mixed batch failed:', error.message);
}

// ── Test 6: scrapeTravelInfo with Playwright domain ──────────────────

console.log('\n📝 Test 6: scrapeTravelInfo (hotels type, Agoda)');
try {
  const urls = ['https://www.agoda.com/city/ho-chi-minh-city-vn.html'];
  console.log(`   🎭 Scraping travel info: ${urls[0]}`);

  const start = Date.now();
  const results = await crawleeService.scrapeTravelInfo(urls, 'hotels');
  const elapsed = Date.now() - start;

  console.log(`   ✓ Completed in ${elapsed}ms`);
  if (results.length > 0) {
    const r = results[0];
    console.log(`   ✓ Crawler: ${r.crawler || 'N/A'}`);
    console.log(`   ✓ Title: ${(r.title || 'N/A').substring(0, 80)}`);
    console.log(`   ✓ Prices: ${JSON.stringify(r.prices || [])}`);
    console.log(`   ✓ Ratings: ${JSON.stringify(r.ratings || [])}`);
    console.log(`   ✓ Location: ${r.location || 'N/A'}`);
    console.log(`   ✓ Content: ${(r.content || '').length} chars`);
  } else {
    console.log('   ⚠️ No results returned');
  }
} catch (error) {
  console.error('   ✗ scrapeTravelInfo failed:', error.message);
}

console.log('\n═══════════════════════════════════════════════');
console.log('🏁 Dual-mode CrawleeService test complete!');
console.log('═══════════════════════════════════════════════\n');
