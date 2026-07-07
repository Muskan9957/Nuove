require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const emailsToDelete = [
  'khoihio@gmail.com',
  'lyflygtuhohy8@jkj.vpm',
  'mkldj@jlhh.jhjj',
  'jekjhi@gmail.com',
  'gydyggh@gmail.com',
  'notsoformal7@gmail.com',
  'nayanasinghi45@gmail.com',
  'notsoformal@gmail.com',
  'kshitijsohoni@gmail.com',
  'abcdgh@gmail.com',
  'lheoiu@gmail.com'
];

async function deleteUsers() {
  console.log('Deleting selected test/fake users...');
  try {
    const result = await prisma.user.deleteMany({
      where: {
        email: {
          in: emailsToDelete
        }
      }
    });

    console.log(`Successfully deleted ${result.count} selected users from the database!`);
  } catch (err) {
    console.error('Error deleting users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUsers();
