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
  console.log('Setting up GROUP_KNOCKOUT tournament test...\n');

  // Get admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'ROOT' },
    select: { id: true, username: true, fullName: true },
  });

  if (!admin) {
    console.error('No admin user found!');
    return;
  }
  console.log('Admin user:', admin.username);

  // Get or create 8 test players
  const playerUsernames = [
    'player1', 'player2', 'player3', 'player4',
    'player5', 'player6', 'player7', 'player8'
  ];

  const players = [];
  for (const username of playerUsernames) {
    let user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      // Create a placeholder user
      user = await prisma.user.create({
        data: {
          id: require('crypto').randomUUID(),
          username,
          fullName: `Test ${username.charAt(0).toUpperCase() + username.slice(1)}`,
          email: `${username}@test.com`,
          role: 'PLAYER',
        },
      });
      console.log(`Created user: ${username}`);
    } else {
      console.log(`Found existing user: ${username}`);
    }
    players.push(user);
  }

  // Create the tournament
  const tournament = await prisma.tournament.create({
    data: {
      name: 'Group Knockout Test Tournament',
      description: 'Testing GROUP_KNOCKOUT format with 2 groups, 8 players',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      location: 'Test Court',
      maxParticipants: 16,
      tournamentType: 'SINGLES',
      format: 'GROUP_KNOCKOUT',
      status: 'OPEN',
      numberOfGroups: 2,
      advancingPerGroup: 2,
      createdById: admin.id,
    },
  });
  console.log(`\nCreated tournament: ${tournament.name} (ID: ${tournament.id})`);

  // Register all 8 players
  for (const player of players) {
    const registration = await prisma.registration.create({
      data: {
        userId: player.id,
        tournamentId: tournament.id,
        registrationStatus: 'APPROVED',
        paymentStatus: 'PAID',
      },
    });
    console.log(`Registered and approved: ${player.username}`);
  }

  // Auto-assign players to groups using snake seeding
  const registrations = await prisma.registration.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { registeredAt: 'asc' },
  });

  const numberOfGroups = 2;
  for (let i = 0; i < registrations.length; i++) {
    const round = Math.floor(i / numberOfGroups);
    let groupIndex;
    if (round % 2 === 0) {
      groupIndex = i % numberOfGroups;
    } else {
      groupIndex = numberOfGroups - 1 - (i % numberOfGroups);
    }
    const groupName = String.fromCharCode(65 + groupIndex); // A or B

    await prisma.registration.update({
      where: { id: registrations[i].id },
      data: { groupAssignment: groupName },
    });
  }
  console.log('\nAssigned players to groups using snake seeding');

  // Show group assignments
  const groupA = await prisma.registration.findMany({
    where: { tournamentId: tournament.id, groupAssignment: 'A' },
    include: { user: { select: { username: true, fullName: true } } },
  });
  const groupB = await prisma.registration.findMany({
    where: { tournamentId: tournament.id, groupAssignment: 'B' },
    include: { user: { select: { username: true, fullName: true } } },
  });

  console.log('\n=== Group A ===');
  groupA.forEach((r, i) => console.log(`  ${i + 1}. ${r.user.fullName}`));

  console.log('\n=== Group B ===');
  groupB.forEach((r, i) => console.log(`  ${i + 1}. ${r.user.fullName}`));

  console.log(`\n✅ Tournament setup complete!`);
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`\nNext steps:`);
  console.log(`1. Go to the tournament page and click "Start Tournament" to generate bracket`);
  console.log(`2. Complete all group stage matches`);
  console.log(`3. Click "Complete Group Stage & Generate Knockout"`);
  console.log(`4. Complete knockout matches and verify finals are created`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
