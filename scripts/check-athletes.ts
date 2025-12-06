import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAthletes() {
  try {
    console.log('🔍 Checking athletes in database...\n');

    // Get total count
    const count = await prisma.athlete.count();
    console.log(`📊 Total athletes: ${count}\n`);

    if (count === 0) {
      console.log('❌ No athletes found in database!');
      return;
    }

    // Get all athletes
    const athletes = await prisma.athlete.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        firebaseId: true,
        gofastHandle: true,
        garmin_user_id: true,
        garmin_is_connected: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('👥 Recent athletes:');
    console.log('='.repeat(80));
    athletes.forEach((athlete, index) => {
      console.log(`\n${index + 1}. ${athlete.firstName || ''} ${athlete.lastName || ''} (${athlete.email || 'no email'})`);
      console.log(`   ID: ${athlete.id}`);
      console.log(`   Firebase ID: ${athlete.firebaseId}`);
      console.log(`   Handle: ${athlete.gofastHandle || 'none'}`);
      console.log(`   Garmin: ${athlete.garmin_is_connected ? '✅ Connected' : '❌ Not connected'} (${athlete.garmin_user_id || 'no ID'})`);
      console.log(`   Created: ${athlete.createdAt}`);
      console.log(`   Updated: ${athlete.updatedAt}`);
    });

    // TODO: Activities will be reintroduced in Schema Phase 3
    // const activitiesCount = await prisma.athleteActivity.count();
    // console.log(`\n\n📈 Total activities: ${activitiesCount}`);

    // Check for RunCrew memberships
    try {
      const membershipsCount = await prisma.runCrewMembership.count();
      console.log(`👥 Total RunCrew memberships: ${membershipsCount}`);
    } catch (err: any) {
      if (err.message?.includes('does not exist')) {
        console.log('⚠️  RunCrew tables not found (expected if migration not run)');
      } else {
        console.log(`⚠️  Error checking memberships: ${err.message}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error checking athletes:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

checkAthletes();

