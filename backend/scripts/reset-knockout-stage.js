require('dotenv').config();
const { prisma } = require('../src/config/database');

async function resetKnockoutStage() {
  const tournamentId = process.argv[2];

  if (!tournamentId) {
    console.error('Usage: node reset-knockout-stage.js <tournament-id>');
    process.exit(1);
  }

  try {
    console.log('Resetting knockout stage for tournament:', tournamentId);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      console.error('Tournament not found');
      process.exit(1);
    }

    if (tournament.format !== 'GROUP_KNOCKOUT') {
      console.error('Tournament is not GROUP_KNOCKOUT format');
      process.exit(1);
    }

    // Delete knockout matches (rounds that don't contain 'Group')
    const deletedMatches = await prisma.match.deleteMany({
      where: {
        tournamentId,
        NOT: {
          round: { contains: 'Group' }
        }
      }
    });
    console.log('Deleted', deletedMatches.count, 'knockout matches');

    // Delete knockout bracket nodes
    const deletedNodes = await prisma.bracketNode.deleteMany({
      where: {
        tournamentId,
        bracketType: 'KNOCKOUT'
      }
    });
    console.log('Deleted', deletedNodes.count, 'knockout bracket nodes');

    // Reset groupStageComplete flag
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { groupStageComplete: false }
    });
    console.log('Reset groupStageComplete flag to false');

    console.log('\nDone! You can now trigger "Complete Group Stage" again from the UI.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetKnockoutStage();
