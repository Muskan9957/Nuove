const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { contains: 'ashwin', mode: 'insensitive' }
    }
  });

  console.log(`Found ${users.length} users with 'ashwin' in email:`);
  users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}`));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
