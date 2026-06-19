const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "creatorStyle" TEXT;`);
    console.log("Added creatorStyle");
  } catch (e) {
    console.log("Error adding creatorStyle:", e.message);
  }
  
  try {
    const result = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='User'`);
    console.log("Columns:", result);
  } catch(e) {
    console.log("Error querying columns:", e.message);
  }
  await prisma.$disconnect();
}
fix();
