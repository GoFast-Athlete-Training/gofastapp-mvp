import { prisma } from '../lib/prisma';

async function findAdamCole() {
  try {
    console.log('🔍 Finding all Adam Cole athletes...');
    
    // Find by name
    const byName = await prisma.athlete.findMany({
      where: {
        OR: [
          { firstName: 'Adam' },
          { lastName: 'Cole' },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`\n📊 Found ${byName.length} athlete(s) with name Adam or Cole:`);
    byName.forEach((athlete, index) => {
      console.log(`\n${index + 1}. ID: ${athlete.id}`);
      console.log(`   Email: ${athlete.email || 'no email'}`);
      console.log(`   Firebase ID: ${athlete.firebaseId}`);
      console.log(`   Name: ${athlete.firstName} ${athlete.lastName}`);
      console.log(`   Created: ${athlete.createdAt}`);
    });
    
    // Also check by email pattern
    const byEmail = await prisma.athlete.findMany({
      where: {
        email: {
          contains: 'adam',
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`\n📧 Found ${byEmail.length} athlete(s) with 'adam' in email:`);
    byEmail.forEach((athlete, index) => {
      console.log(`\n${index + 1}. ID: ${athlete.id}`);
      console.log(`   Email: ${athlete.email}`);
      console.log(`   Name: ${athlete.firstName} ${athlete.lastName}`);
      console.log(`   Created: ${athlete.createdAt}`);
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

findAdamCole();






