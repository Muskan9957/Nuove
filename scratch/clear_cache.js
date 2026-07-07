require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearCache() {
  console.log('Clearing all entries from trendingCache...');
  try {
    const result = await prisma.trendingCache.deleteMany({});
    console.log(`Successfully cleared ${result.count} cached trend records from the database!`);
    console.log('The next time anyone loads the dashboard or trending page, fresh trends will be fetched live.');
  } catch (err) {
    console.error('Error clearing cache:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clearCache();
