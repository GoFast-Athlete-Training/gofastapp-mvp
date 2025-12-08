import { prisma } from '../packages/shared-prisma-schema';

async function verifySchema() {
  try {
    console.log('🔍 Verifying database schema alignment...\n');

    // Test all main models
    const checks: Array<{ name: string; model: { count: () => Promise<number> } }> = [
      { name: 'Athlete', model: prisma.athlete },
      // TODO: Training models will be reintroduced in Schema Phase 3
      // TODO: AthleteActivity will be reintroduced in Schema Phase 3
      { name: 'RunCrew', model: prisma.runCrew },
      { name: 'RunCrewMembership', model: prisma.runCrewMembership },
      { name: 'RunCrewManager', model: prisma.runCrewManager },
      { name: 'RunCrewMessage', model: prisma.runCrewMessage },
      { name: 'RunCrewAnnouncement', model: prisma.runCrewAnnouncement },
      { name: 'RunCrewRun', model: prisma.runCrewRun },
      { name: 'RunCrewRunRSVP', model: prisma.runCrewRunRSVP },
      { name: 'RunCrewEvent', model: prisma.runCrewEvent },
      { name: 'RunCrewEventRSVP', model: prisma.runCrewEventRSVP },
      { name: 'JoinCode', model: prisma.joinCode },
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
          runCrewMemberships: true,
          runCrewManagers: true,
          company: true,
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

