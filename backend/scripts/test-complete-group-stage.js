require('dotenv').config();
const { prisma } = require('../src/config/database');
const bracketService = require('../src/services/bracket.service');

async function testCompleteGroupStage() {
  const tournamentId = process.argv[2] || '0a5fcc3c-8198-4712-bd19-9748d0716022';

  try {
    console.log('Testing completeGroupStage for tournament:', tournamentId);

    const result = await bracketService.completeGroupStage(tournamentId);
    console.log('\nResult:', JSON.stringify(result, null, 2));

    // Check how many knockout matches were created
    const knockoutMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        NOT: { round: { contains: 'Group' } }
      },
      include: {
        team1: { include: { player1: { select: { fullName: true } } } },
        team2: { include: { player1: { select: { fullName: true } } } }
      }
    });

    console.log('\n=== Knockout Matches Created ===');
    knockoutMatches.forEach(m => {
      const t1 = m.team1?.player1?.fullName || m.team1?.teamName || 'TBD';
      const t2 = m.team2?.player1?.fullName || m.team2?.teamName || 'TBD';
      console.log(`${m.round}: ${t1} vs ${t2}`);
    });
    console.log(`\nTotal knockout matches: ${knockoutMatches.length}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteGroupStage();
