require('dotenv').config();
const { prisma } = require('../src/config/database');

async function randomlyAssignPartners() {
  const tournamentId = '79b43647-bf96-4552-b2ff-119b4e6a23b8';

  try {
    // Get all approved registrations without partners
    const registrations = await prisma.registration.findMany({
      where: {
        tournamentId,
        registrationStatus: 'APPROVED',
        partnerId: null
      },
      include: { user: true }
    });

    console.log('Found', registrations.length, 'registrations without partners');

    // Shuffle registrations randomly
    const shuffled = [...registrations].sort(() => Math.random() - 0.5);

    // Pair them
    const pairs = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
    }

    // Handle odd player
    if (shuffled.length % 2 === 1) {
      console.log('Odd player:', shuffled[shuffled.length - 1].user.fullName, '- will be dropped');
    }

    console.log('Creating', pairs.length, 'teams...');

    // Delete existing teams for this tournament
    await prisma.team.deleteMany({ where: { tournamentId } });

    // Create teams and update registrations
    for (const [reg1, reg2] of pairs) {
      const teamName = (reg1.user.fullName || reg1.user.username) + ' & ' + (reg2.user.fullName || reg2.user.username);

      // Create team
      const team = await prisma.team.create({
        data: {
          tournamentId,
          player1Id: reg1.userId,
          player2Id: reg2.userId,
          teamName
        }
      });

      // Update registrations with partner info
      await prisma.registration.update({
        where: { id: reg1.id },
        data: { partnerId: reg2.userId }
      });

      await prisma.registration.update({
        where: { id: reg2.id },
        data: { partnerId: reg1.userId }
      });

      console.log('Created team:', teamName);
    }

    // If odd player, reject their registration
    if (shuffled.length % 2 === 1) {
      const oddReg = shuffled[shuffled.length - 1];
      await prisma.registration.update({
        where: { id: oddReg.id },
        data: { registrationStatus: 'REJECTED' }
      });
      console.log('Rejected odd player registration:', oddReg.user.fullName);
    }

    console.log('Done! Created', pairs.length, 'teams');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

randomlyAssignPartners();
