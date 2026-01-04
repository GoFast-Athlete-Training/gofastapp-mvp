import { prisma } from '../lib/prisma';

/**
 * Quick script to check and fix admin roles for a specific user
 * Usage: tsx scripts/fix-admin-role.ts <email_or_firebaseId>
 */
async function fixAdminRole(identifier: string) {
  try {
    console.log(`🔍 Looking up athlete: ${identifier}\n`);

    // Find athlete by email or firebaseId
    const athlete = await prisma.athlete.findFirst({
      where: {
        OR: [
          { email: { contains: identifier, mode: 'insensitive' } },
          { firebaseId: identifier },
          { firstName: { contains: identifier, mode: 'insensitive' } },
        ],
      },
      include: {
        runCrewMemberships: {
          include: {
            runCrew: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!athlete) {
      console.log('❌ Athlete not found');
      process.exit(1);
    }

    console.log(`✅ Found athlete: ${athlete.firstName} ${athlete.lastName} (${athlete.email})`);
    console.log(`   Firebase ID: ${athlete.firebaseId}`);
    console.log(`   Athlete ID: ${athlete.id}\n`);

    if (athlete.runCrewMemberships.length === 0) {
      console.log('⚠️  No RunCrew memberships found\n');
      await prisma.$disconnect();
      return;
    }

    console.log(`📋 Found ${athlete.runCrewMemberships.length} membership(s):\n`);
    
    for (const membership of athlete.runCrewMemberships) {
      const runCrew = membership.runCrew;
      console.log(`   RunCrew: ${runCrew.name} (${runCrew.id})`);
      console.log(`   Membership ID: ${membership.id}`);
      console.log(`   Current Role: ${membership.role || 'NULL'}`);
      
      // Ask if we should set this to admin
      if (membership.role !== 'admin') {
        console.log(`   ⚠️  Role is not 'admin'`);
        console.log(`   🔧 Setting role to 'admin'...`);
        
        await prisma.runCrewMembership.update({
          where: { id: membership.id },
          data: { role: 'admin' },
        });
        
        console.log(`   ✅ Updated to 'admin'\n`);
      } else {
        console.log(`   ✅ Already admin\n`);
      }
    }

    console.log('✅ Done!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const identifier = process.argv[2];
if (!identifier) {
  console.log('Usage: tsx scripts/fix-admin-role.ts <email_or_firebaseId>');
  console.log('Example: tsx scripts/fix-admin-role.ts adam@gofastcrushgoals.com');
  process.exit(1);
}

fixAdminRole(identifier);

