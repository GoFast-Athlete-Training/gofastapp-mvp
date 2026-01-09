import { adminAuth } from '../lib/firebaseAdmin';

async function deleteFirebaseUser() {
  try {
    const firebaseId = 'pEJYKWGiGDducWzaddxHl8BGhA02';
    const email = 'adam.ignitestrategies@gmail.com';
    
    console.log(`🔍 Attempting to delete Firebase user...`);
    console.log(`   Firebase ID: ${firebaseId}`);
    console.log(`   Email: ${email}`);
    
    // Try to get user first to verify it exists
    try {
      const user = await adminAuth.getUser(firebaseId);
      console.log(`\n📊 Firebase user found:`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Created: ${user.metadata.creationTime}`);
      
      // Delete the user
      await adminAuth.deleteUser(firebaseId);
      console.log(`\n✅ Successfully deleted Firebase user: ${firebaseId}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log(`\nℹ️  Firebase user not found (may have already been deleted)`);
      } else {
        throw error;
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    throw error;
  }
}

deleteFirebaseUser();

