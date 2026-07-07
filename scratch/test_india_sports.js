require('dotenv').config();
const { getTrendsV2 } = require('../src/services/trendsV2/trendEngineV2');

async function test() {
  console.log('Fetching live Sports trends for India...');
  try {
    const trends = await getTrendsV2('India', 'sports', 'local');
    console.log('\n--- India Sports Trends ---');
    trends.forEach((t, i) => {
      console.log(`${i + 1}. Title: ${t.title}`);
      console.log(`   Description: ${t.description}`);
      console.log(`   Category: ${t.category}`);
      console.log(`   Sources: ${t.sources.join(', ')}`);
      console.log('------------------------');
    });
  } catch (err) {
    console.error('Error fetching trends:', err);
  }
}

test();
