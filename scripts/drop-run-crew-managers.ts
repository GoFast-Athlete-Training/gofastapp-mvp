/**
 * Script to drop the deprecated run_crew_managers table
 * This table is deprecated - roles are now in run_crew_memberships.role
 */

import { prisma } from '../lib/prisma';

async function dropRunCrewManagersTable() {
  console.log('🗑️  Dropping deprecated run_crew_managers table...');
  
  try {
    // Check if table exists
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'run_crew_managers'
      ) as exists;
    `;

    if (!tableExists[0]?.exists) {
      console.log('   ✅ Table does not exist (already dropped)');
      return;
    }

    // Drop the table
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "run_crew_managers" CASCADE;');
    
    console.log('   ✅ Successfully dropped run_crew_managers table');
    console.log('   ℹ️  Role information is now stored in run_crew_memberships.role');
  } catch (err: any) {
    if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
      console.log('   ✅ Table does not exist (already dropped)');
    } else {
      console.error('   ❌ Error dropping table:', err);
      throw err;
    }
  }
}

dropRunCrewManagersTable()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

