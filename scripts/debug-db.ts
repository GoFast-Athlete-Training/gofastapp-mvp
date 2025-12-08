import { prisma } from '../packages/shared-prisma-schema';

async function debugDatabase() {
  try {
    console.log('🔍 Debugging database...\n');

    // Check if we can connect
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Check tables using raw SQL
    console.log('📊 Checking tables...');
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log(`Found ${tables.length} tables:`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    // Check if athletes table exists
    const athletesTable = tables.find(t => t.table_name === 'athletes');
    if (!athletesTable) {
      console.log('\n❌ "athletes" table NOT FOUND!');
      console.log('⚠️  This is the problem - the table does not exist.');
      console.log('\nPossible causes:');
      console.log('  1. Database was reset/dropped');
      console.log('  2. Migration never ran to create the table');
      console.log('  3. Wrong database connection');
      console.log('  4. Table was accidentally dropped');
    } else {
      console.log('\n✅ "athletes" table EXISTS');
      
      // Try to query it
      try {
        const count = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM athletes;
        `;
        console.log(`\n📊 Athletes count: ${count[0].count}`);
        
        if (Number(count[0].count) === 0) {
          console.log('\n⚠️  Table exists but is EMPTY - data was deleted!');
        }
      } catch (err: any) {
        console.log(`\n❌ Error querying athletes table: ${err.message}`);
      }
    }

    // Check for athlete_activities
    const activitiesTable = tables.find(t => t.table_name === 'athlete_activities');
    if (activitiesTable) {
      const count = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM athlete_activities;
      `;
      console.log(`\n📈 Activities count: ${count[0].count}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error);
    console.error('Message:', error.message);
    console.error('Code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

debugDatabase();

