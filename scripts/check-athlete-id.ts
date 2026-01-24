import { prisma } from '../lib/prisma';

async function checkAthleteById(athleteId: string) {
  try {
    console.log(`🔍 Checking athlete with ID: ${athleteId}\n`);

    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        go_fast_companies: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        run_crew_memberships: {
          include: {
            run_crews: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
          },
        },
      },
    });

    if (!athlete) {
      console.log('❌ Athlete NOT FOUND in database');
      console.log(`   ID: ${athleteId} does not exist\n`);
      return;
    }

    console.log('✅ Athlete FOUND in database:');
    console.log('=' .repeat(80));
    console.log(`ID: ${athlete.id}`);
    console.log(`Firebase ID: ${athlete.firebaseId || 'MISSING'}`);
    console.log(`Email: ${athlete.email || 'none'}`);
    console.log(`Name: ${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() || 'No name');
    console.log(`Handle: ${athlete.gofastHandle || 'none'}`);
    console.log(`Company: ${athlete.go_fast_companies?.name || 'Unknown'} (${athlete.companyId || 'MISSING'})`);
    console.log(`Created: ${athlete.createdAt}`);
    console.log(`Updated: ${athlete.updatedAt}`);
    console.log(`Garmin Connected: ${athlete.garmin_is_connected ? '✅ Yes' : '❌ No'} (${athlete.garmin_user_id || 'no ID'})`);
    
    if (athlete.run_crew_memberships && athlete.run_crew_memberships.length > 0) {
      console.log(`\nRunCrew Memberships (${athlete.run_crew_memberships.length}):`);
      athlete.run_crew_memberships.forEach((membership, index) => {
        const crew = membership.run_crews;
        console.log(`  ${index + 1}. ${crew.name || crew.handle} (${crew.handle})`);
        console.log(`     Role: ${membership.role || 'member'}, Joined: ${membership.joinedAt}`);
      });
    } else {
      console.log('\nRunCrew Memberships: None');
    }

    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    console.error('❌ Error checking athlete:', error);
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Get athlete ID from command line argument
const athleteId = process.argv[2];

if (!athleteId) {
  console.error('❌ Please provide an athlete ID as an argument');
  console.error('Usage: npx tsx scripts/check-athlete-id.ts <athlete-id>');
  process.exit(1);
}

checkAthleteById(athleteId);

