require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('Fetching all users from database...');
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`\nFound ${users.length} users in the database:\n`);
    users.forEach((u, i) => {
      console.log(`${i + 1}. Name: ${u.name || 'N/A'} | Email: ${u.email} | Joined: ${u.createdAt.toISOString()}`);
    });
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
