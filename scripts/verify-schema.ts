import { prisma } from '../lib/prisma';

async function verifySchema() {
  try {
    console.log('🔍 Verifying database schema alignment...\n');

    // Test all main models
    const checks: Array<{ name: string; model: { count: () => Promise<number> } }> = [
      { name: 'Athlete', model: prisma.athlete },
      // TODO: Training models will be reintroduced in Schema Phase 3
      // TODO: AthleteActivity will be reintroduced in Schema Phase 3
      { name: 'run_crews', model: prisma.run_crews },
      { name: 'run_crew_memberships', model: prisma.run_crew_memberships },
      { name: 'run_crew_messages', model: prisma.run_crew_messages },
      { name: 'run_crew_announcements', model: prisma.run_crew_announcements },
      { name: 'run_crew_runs', model: prisma.run_crew_runs },
      { name: 'run_crew_run_rsvps', model: prisma.run_crew_run_rsvps },
      { name: 'run_crew_events', model: prisma.run_crew_events },
      { name: 'run_crew_event_rsvps', model: prisma.run_crew_event_rsvps },
      { name: 'join_codes', model: prisma.join_codes },
      { name: 'GoFastCompany', model: prisma.goFastCompany },
    ];

    console.log('📊 Testing model access...\n');
    for (const check of checks) {
      try {
        const count = await check.model.count();
        console.log(`✅ ${check.name.padEnd(25)} - Table exists (${count} records)`);
      } catch (error: any) {
        if (error.message?.includes('does not exist')) {
          console.log(`❌ ${check.name.padEnd(25)} - Table MISSING`);
        } else {
          console.log(`⚠️  ${check.name.padEnd(25)} - Error: ${error.message}`);
        }
      }
    }

    // Test relations
    console.log('\n🔗 Testing relations...\n');
    try {
      const athlete = await prisma.athlete.findFirst({
        include: {
          // TODO: activities will be reintroduced in Schema Phase 3
          run_crew_memberships: true,
          goFastCompany: true,
        },
      });
      console.log('✅ Athlete relations work correctly');
    } catch (error: any) {
      console.log(`⚠️  Athlete relations error: ${error.message}`);
    }

    console.log('\n✅ Schema verification complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Create a new athlete via the app');
    console.log('   2. Test Garmin connection');
    console.log('   3. Test RunCrew creation');

  } catch (error: any) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();

