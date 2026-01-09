import { prisma } from '../lib/prisma';
import { adminAuth } from '../lib/firebaseAdmin';

async function deleteDuplicateAthlete() {
  try {
    const email = 'adam.ignitestrategies@gmail.com';
    
    console.log(`🔍 Finding athletes with email: ${email}`);
    
    // Find all athletes with this email
    const athletes = await prisma.athlete.findMany({
      where: { email },
      orderBy: { createdAt: 'asc' }, // Oldest first
    });
    
    console.log(`📊 Found ${athletes.length} athlete(s) with this email:`);
    athletes.forEach((athlete, index) => {
      console.log(`\n${index + 1}. ID: ${athlete.id}`);
      console.log(`   Firebase ID: ${athlete.firebaseId}`);
      console.log(`   Name: ${athlete.firstName} ${athlete.lastName}`);
      console.log(`   Created: ${athlete.createdAt}`);
      console.log(`   Updated: ${athlete.updatedAt}`);
    });
    
    if (athletes.length === 0) {
      console.log('❌ No athletes found with this email');
      return;
    }
    
    if (athletes.length === 1) {
      console.log('ℹ️ Only one athlete found - nothing to delete');
      return;
    }
    
    // Delete the second one (newest, or you can specify which one)
    const toDelete = athletes[athletes.length - 1]; // Last one (newest)
    console.log(`\n🗑️  Deleting athlete ID: ${toDelete.id} (created: ${toDelete.createdAt})`);
    
    // Check for related data first
    const memberships = await prisma.run_crew_memberships.count({
      where: { athleteId: toDelete.id },
    });
    
    if (memberships > 0) {
      console.log(`⚠️  Warning: This athlete has ${memberships} RunCrew membership(s).`);
      console.log('   Deleting memberships first...');
      await prisma.run_crew_memberships.deleteMany({
        where: { athleteId: toDelete.id },
      });
    }
    
    // Delete Firebase user if firebaseId exists
    if (toDelete.firebaseId) {
      try {
        console.log(`\n🔥 Deleting Firebase user: ${toDelete.firebaseId}...`);
        await adminAuth.deleteUser(toDelete.firebaseId);
        console.log(`✅ Successfully deleted Firebase user: ${toDelete.firebaseId}`);
      } catch (firebaseError: any) {
        if (firebaseError.code === 'auth/user-not-found') {
          console.log(`ℹ️  Firebase user not found (may have already been deleted)`);
        } else {
          console.error(`⚠️  Failed to delete Firebase user:`, firebaseError.message);
          // Continue with database deletion even if Firebase deletion fails
        }
      }
    }
    
    // Delete the athlete
    await prisma.athlete.delete({
      where: { id: toDelete.id },
    });
    
    console.log(`✅ Successfully deleted athlete ID: ${toDelete.id}`);
    console.log(`\n📊 Remaining athletes with this email: ${athletes.length - 1}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteDuplicateAthlete();

