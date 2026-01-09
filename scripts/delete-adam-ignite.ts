import { prisma } from '../lib/prisma';
import { adminAuth } from '../lib/firebaseAdmin';

async function deleteAdamIgnite() {
  try {
    const athleteId = 'cmk64ilon0001l4046co8a1zh';
    const email = 'adam.ignitestrategies@gmail.com';
    
    console.log(`🔍 Finding athlete: ${athleteId} (${email})`);
    
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
    });
    
    if (!athlete) {
      console.log('❌ Athlete not found');
      return;
    }
    
    console.log(`\n📊 Athlete found:`);
    console.log(`   ID: ${athlete.id}`);
    console.log(`   Email: ${athlete.email}`);
    console.log(`   Firebase ID: ${athlete.firebaseId}`);
    console.log(`   Name: ${athlete.firstName} ${athlete.lastName}`);
    console.log(`   Created: ${athlete.createdAt}`);
    
    // Check for related data
    const memberships = await prisma.run_crew_memberships.findMany({
      where: { athleteId: athlete.id },
    });
    
    console.log(`\n📊 Related data:`);
    console.log(`   RunCrew Memberships: ${memberships.length}`);
    
    if (memberships.length > 0) {
      console.log(`\n🗑️  Deleting ${memberships.length} membership(s)...`);
      for (const membership of memberships) {
        console.log(`   - Deleting membership ${membership.id} (RunCrew: ${membership.runCrewId})`);
        await prisma.run_crew_memberships.delete({
          where: { id: membership.id },
        });
      }
    }
    
    // Delete Firebase user if firebaseId exists
    if (athlete.firebaseId) {
      try {
        console.log(`\n🔥 Deleting Firebase user: ${athlete.firebaseId}...`);
        await adminAuth.deleteUser(athlete.firebaseId);
        console.log(`✅ Successfully deleted Firebase user: ${athlete.firebaseId}`);
      } catch (firebaseError: any) {
        if (firebaseError.code === 'auth/user-not-found') {
          console.log(`ℹ️  Firebase user not found (may have already been deleted)`);
        } else {
          console.error(`⚠️  Failed to delete Firebase user:`, firebaseError.message);
          // Continue with database deletion even if Firebase deletion fails
        }
      }
    }
    
    console.log(`\n🗑️  Deleting athlete from database...`);
    await prisma.athlete.delete({
      where: { id: athleteId },
    });
    
    console.log(`✅ Successfully deleted athlete: ${athleteId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Firebase ID: ${athlete.firebaseId}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteAdamIgnite();

