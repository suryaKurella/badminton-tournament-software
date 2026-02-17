require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const featureFlags = [
  { name: 'double_elimination', enabled: false, description: 'Double elimination tournament format (bracket visualization coming soon)' },
  { name: 'live_scoring', enabled: true, description: 'Real-time point-by-point match scoring' },
  { name: 'club_features', enabled: true, description: 'Club creation, membership, and club-scoped tournaments' },
  { name: 'tournament_structure_preview', enabled: true, description: 'Visual bracket/structure preview on tournament pages' },
  { name: 'match_deletion', enabled: true, description: 'Admin/organizer ability to delete individual matches' },
  { name: 'leaderboard', enabled: true, description: 'Global player leaderboard and ranking statistics' },
  { name: 'admin_player_registration', enabled: true, description: 'Admin ability to directly register players/teams for tournaments' },
];

async function main() {
  console.log('Seeding feature flags...');
  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: {},
      create: flag,
    });
    console.log(`  -> ${flag.name}: ${flag.enabled ? 'enabled' : 'disabled'}`);
  }
  console.log('Feature flags seeded successfully.');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
