require('dotenv').config();
const { getTrendsV2 } = require('../src/services/trendsV2/trendEngineV2');

async function test() {
  console.log('Fetching live local trends for Canada...');
  try {
    const trends = await getTrendsV2('Canada', 'general', 'local');
    console.log('\n--- Canadian Trends ---');
    trends.forEach((t, i) => {
      console.log(`${i + 1}. Title: ${t.title}`);
      console.log(`   Description: ${t.description}`);
      console.log(`   Category: ${t.category}`);
      console.log(`   Sources: ${t.sources.join(', ')}`);
      console.log(`   Creator Relevance: ${t.creatorRelevanceScore}`);
      console.log('------------------------');
    });
  } catch (err) {
    console.error('Error fetching trends:', err);
  }
}

test();
