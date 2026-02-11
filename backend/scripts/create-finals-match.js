require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Creating finals match from completed semi-finals...\n');

  // Find the GROUP_KNOCKOUT tournament with completed semi-finals but no finals
  const tournament = await prisma.tournament.findFirst({
    where: {
      format: 'GROUP_KNOCKOUT',
      groupStageComplete: true,
      status: 'ACTIVE',
    },
    include: {
      matches: {
        where: {
          round: 'Semi-Final',
          matchStatus: 'COMPLETED',
        },
        include: {
          team1: {
            include: {
              player1: { select: { id: true, username: true, fullName: true } },
            },
          },
          team2: {
            include: {
              player1: { select: { id: true, username: true, fullName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!tournament) {
    console.error('No GROUP_KNOCKOUT tournament found with completed semi-finals');
    return;
  }

  console.log(`Found tournament: ${tournament.name} (ID: ${tournament.id})`);
  console.log(`Semi-final matches found: ${tournament.matches.length}`);

  if (tournament.matches.length < 2) {
    console.error('Need at least 2 completed semi-final matches');
    return;
  }

  // Check if finals match already exists
  const existingFinals = await prisma.match.findFirst({
    where: {
      tournamentId: tournament.id,
      round: 'Final',
    },
  });

  if (existingFinals) {
    console.log('\nFinals match already exists!');
    console.log(`Match ID: ${existingFinals.id}`);
    console.log(`Status: ${existingFinals.matchStatus}`);
    return;
  }

  // Get winners from semi-finals
  const winners = tournament.matches.map((match) => {
    const winner = match.winnerId === match.team1Id ? match.team1 : match.team2;
    console.log(`\nSemi-final winner: ${winner.player1.fullName || winner.player1.username}`);
    return winner;
  });

  if (winners.length < 2) {
    console.error('Could not find 2 winners from semi-finals');
    return;
  }

  // Find the finals bracket node
  const finalsNode = await prisma.bracketNode.findFirst({
    where: {
      tournamentId: tournament.id,
      bracketType: 'KNOCKOUT',
      roundNumber: 2, // Finals is round 2 when we have 4 teams (2 rounds total)
    },
  });

  // Create the finals match
  const finalsMatch = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      team1Id: winners[0].id,
      team2Id: winners[1].id,
      round: 'Final',
      matchStatus: 'UPCOMING',
    },
  });

  console.log(`\n✅ Finals match created!`);
  console.log(`Match ID: ${finalsMatch.id}`);
  console.log(`${winners[0].player1.fullName} vs ${winners[1].player1.fullName}`);

  // Link to bracket node if found
  if (finalsNode) {
    await prisma.bracketNode.update({
      where: { id: finalsNode.id },
      data: { matchId: finalsMatch.id },
    });
    console.log(`Linked to bracket node: ${finalsNode.id}`);
  }

  console.log('\nRefresh the tournament page to see the finals match.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
