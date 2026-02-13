require('dotenv').config();
const { prisma } = require('../src/config/database');

async function resetTournamentBracket() {
  const tournamentId = process.argv[2];

  if (!tournamentId) {
    // List recent tournaments to help user find the ID
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        tournamentType: true,
        format: true,
        status: true,
        bracketGenerated: true,
        createdAt: true,
      }
    });

    console.log('\nRecent tournaments:');
    console.log('===================');
    tournaments.forEach(t => {
      console.log(`\nID: ${t.id}`);
      console.log(`Name: ${t.name}`);
      console.log(`Type: ${t.tournamentType}, Format: ${t.format}`);
      console.log(`Status: ${t.status}, Bracket: ${t.bracketGenerated ? 'Generated' : 'Not generated'}`);
    });

    console.log('\n\nUsage: node reset-tournament-bracket.js <tournament-id>');
    await prisma.$disconnect();
    process.exit(0);
  }

  try {
    console.log('Resetting bracket for tournament:', tournamentId);

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: {
          select: { matches: true, teams: true }
        }
      }
    });

    if (!tournament) {
      console.error('Tournament not found');
      process.exit(1);
    }

    console.log(`\nTournament: ${tournament.name}`);
    console.log(`Type: ${tournament.tournamentType}, Format: ${tournament.format}`);
    console.log(`Current matches: ${tournament._count.matches}, teams: ${tournament._count.teams}`);

    // Delete all matches
    const deletedMatches = await prisma.match.deleteMany({
      where: { tournamentId }
    });
    console.log('\nDeleted', deletedMatches.count, 'matches');

    // Delete all bracket nodes
    const deletedNodes = await prisma.bracketNode.deleteMany({
      where: { tournamentId }
    });
    console.log('Deleted', deletedNodes.count, 'bracket nodes');

    // Delete all teams
    const deletedTeams = await prisma.team.deleteMany({
      where: { tournamentId }
    });
    console.log('Deleted', deletedTeams.count, 'teams');

    // Reset tournament flags
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        bracketGenerated: false,
        groupStageComplete: false,
        status: 'OPEN'
      }
    });
    console.log('Reset tournament status to OPEN and bracketGenerated to false');

    console.log('\nDone! You can now start the tournament again from the UI.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetTournamentBracket();
