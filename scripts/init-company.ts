import { prisma } from '../lib/prisma';

async function initCompany() {
  try {
    console.log('🔧 Initializing GoFast Company...\n');

    const company = await prisma.goFastCompany.upsert({
      where: { slug: 'gofast' },
      update: {
        name: 'GoFast',
        address: '2604 N. George Mason Dr.',
        city: 'Arlington',
        state: 'VA',
        zip: '22207',
        domain: 'gofastcrushgoals.com',
      },
      create: {
        id: 'cmhpqe7kl0000nw1uvcfhf2hs', // Hardcoded ID for single tenant
        name: 'GoFast',
        slug: 'gofast',
        address: '2604 N. George Mason Dr.',
        city: 'Arlington',
        state: 'VA',
        zip: '22207',
        domain: 'gofastcrushgoals.com',
      },
    });

    console.log('✅ GoFast Company initialized:');
    console.log(`   ID: ${company.id}`);
    console.log(`   Name: ${company.name}`);
    console.log(`   Slug: ${company.slug}`);
    console.log(`   Domain: ${company.domain}`);

  } catch (error: any) {
    console.error('❌ Error initializing company:', error);
    console.error('Message:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

initCompany();

