require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  console.log('Identifying test and fake users to delete...');
  try {
    // 1. Fetch all users to filter them safely in JS
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    // 2. Identify test and fake users based on patterns
    const usersToDelete = users.filter(u => {
      const email = u.email.toLowerCase();
      const name = (u.name || '').toLowerCase();

      return (
        email.includes('+') || // Developer test aliases (e.g. name+test@gmail.com)
        email.includes('deploycheck') ||
        email.includes('finaltest') ||
        email.includes('livecheck') ||
        email.includes('realverify') ||
        email.includes('uxtest') ||
        email.includes('testingfromspain') ||
        email === 'guyugug@gmail.com' || // Random keyboard-mash email
        email === 'jkhlgyt@gmail.com' || // Random keyboard-mash email
        name === 'test' ||
        name === 'testing' ||
        name === 'abcdef' ||
        name === 'abcde' ||
        name === 'haha'
      );
    });

    console.log(`\nFound ${usersToDelete.length} test/fake users out of ${users.length} total users.`);

    if (usersToDelete.length === 0) {
      console.log('No test users found to clean.');
      return;
    }

    // Print a sample of what is being deleted
    console.log('\nSample of users being deleted:');
    usersToDelete.slice(0, 15).forEach((u, i) => {
      console.log(`- ${u.name || 'N/A'} (${u.email})`);
    });
    if (usersToDelete.length > 15) {
      console.log(`... and ${usersToDelete.length - 15} more.`);
    }

    // 3. Delete matching users
    const idsToDelete = usersToDelete.map(u => u.id);
    
    console.log('\nExecuting deletion...');
    const result = await prisma.user.deleteMany({
      where: {
        id: {
          in: idsToDelete
        }
      }
    });

    console.log(`\nSuccessfully deleted ${result.count} test/fake users from the database!`);
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
