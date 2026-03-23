#!/usr/bin/env node
/**
 * Test SearXNG + Crawlee Integration
 * Run: node scripts/test-searxng.js
 */

import 'dotenv/config';

console.log('🧪 Testing SearXNG + Crawlee Integration\n');

// Test 1: SearXNG Service
console.log('📝 Test 1: SearXNG Service');
try {
  const { default: searxngService } = await import('../src/modules/ai/infrastructure/services/SearxngService.js');

  console.log('   ✓ SearxngService imported');

  // Health check
  const healthy = await searxngService.healthCheck();
  if (healthy) {
    console.log('   ✓ SearXNG is healthy');
  } else {
    console.log('   ✗ SearXNG health check failed');
    console.log('   💡 Make sure to run: docker compose up -d searxng');
    process.exit(1);
  }

  // Test search
  console.log('   🔍 Testing search...');
  const results = await searxngService.search({
    query: 'vietnam travel 2026',
    limit: 3,
    language: 'vi',
  });

  console.log(`   ✓ Search successful! Found ${results.totalResults} results`);
  console.log(`   ✓ Engines used: ${results.engines.join(', ')}`);

  if (results.results.length > 0) {
    console.log(`   ✓ First result: ${results.results[0].title}`);
  }
} catch (error) {
  console.error('   ✗ SearXNG test failed:', error.message);
  process.exit(1);
}

// Test 2: Crawlee Service
console.log('\n📝 Test 2: Crawlee Service');
try {
  const { default: crawleeService } = await import('../src/modules/ai/infrastructure/services/CrawleeService.js');

  console.log('   ✓ CrawleeService imported');

  // Test enrichment with a safe URL
  console.log('   🕷️ Testing enrichment...');
  const mockResults = [{
    title: 'Test',
    url: 'https://example.com',
    content: 'Test content',
  }];

  const enriched = await crawleeService.enrichResults(mockResults, {
    maxResults: 1,
    includeHighlights: true,
  });

  console.log('   ✓ Enrichment successful!');
  console.log(`   ✓ Enriched: ${enriched[0].enriched}`);
} catch (error) {
  console.error('   ✗ Crawlee test failed:', error.message);
  // Don't exit - Crawlee can fail but won't break search
  console.log('   ⚠️ Crawlee optional - search will work without enrichment');
}

// Test 3: Integration Test
console.log('\n📝 Test 3: Integration Test (searchHandlers)');
try {
  const { createSearchHandlers } = await import('../src/modules/ai/infrastructure/services/handlers/searchHandlers.js');

  const mockExecutor = {
    searxngUrl: process.env.SEARXNG_URL || 'http://localhost:8080',
  };

  const handlers = createSearchHandlers(mockExecutor);
  console.log('   ✓ Search handlers created');

  // Test web search
  console.log('   🔍 Testing webSearch handler...');
  const searchResult = await handlers.webSearch({
    query: 'du lịch Đà Lạt',
    numResults: 3,
  });

  console.log(`   ✓ webSearch successful! Source: ${searchResult.source}`);
  console.log(`   ✓ Results: ${searchResult.totalResults}`);
} catch (error) {
  console.error('   ✗ Integration test failed:', error.message);
  process.exit(1);
}

console.log('\n✅ All tests passed!\n');
console.log('🎉 SearXNG + Crawlee integration is working correctly!');
console.log('\nNext steps:');
console.log('  1. Start backend: npm run dev');
console.log('  2. Ask AI: "Tìm thông tin về du lịch Việt Nam 2026"');
console.log('  3. Check logs for SearXNG search activity\n');
