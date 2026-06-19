const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2,
  });

  if (users.length === 0) {
    console.log('No users found in database.');
    return;
  }

  console.log('Found last 2 users to delete:');
  users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}, CreatedAt: ${u.createdAt}`));

  for (const user of users) {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Successfully deleted user: ${user.email}`);
  }
}

main()
  .catch(e => {
    console.error('Error deleting users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
