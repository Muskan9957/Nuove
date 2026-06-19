const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'ashwin.avinav7', mode: 'insensitive' } },
        { email: { contains: 'notsoformal7', mode: 'insensitive' } }
      ]
    }
  });

  if (users.length === 0) {
    console.log('No matching users found.');
    return;
  }

  console.log(`Found ${users.length} matching users to delete:`);
  users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}`));

  for (const user of users) {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Successfully deleted user: ${user.email}`);
  }
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
