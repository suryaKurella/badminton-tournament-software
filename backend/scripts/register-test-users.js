require('dotenv').config();
const { prisma } = require('../src/config/database');

async function registerTestUsers() {
  const tournamentId = '0a5fcc3c-8198-4712-bd19-9748d0716022'; // Test Knock tournament

  try {
    // Get test users 1-10
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'test1@gmail.com', 'test2@gmail.com', 'test3@gmail.com', 'test4@gmail.com',
            'test5@gmail.com', 'test6@gmail.com', 'test7@gmail.com', 'test8@gmail.com',
            'test9@gmail.com', 'test10@gmail.com'
          ]
        }
      }
    });

    console.log('Found', users.length, 'test users');

    // Register each user
    for (const user of users) {
      // Check if already registered
      const existing = await prisma.registration.findFirst({
        where: { tournamentId, userId: user.id }
      });

      if (existing) {
        console.log('Already registered:', user.email);
        continue;
      }

      await prisma.registration.create({
        data: {
          tournamentId,
          userId: user.id,
          registrationStatus: 'APPROVED',
          paymentStatus: 'PAID'
        }
      });
      console.log('Registered:', user.email);
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

registerTestUsers();
