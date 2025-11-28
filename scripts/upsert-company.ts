import { prisma } from '../lib/prisma';

async function upsertGoFastCompany() {
  try {
    console.log('🚀 Upserting GoFast Company...');

    const company = await prisma.goFastCompany.upsert({
      where: { slug: 'gofast' },
      update: {},
      create: {
        name: 'GoFast',
        slug: 'gofast',
        address: '2604 N. George Mason Dr.',
        city: 'Arlington',
        state: 'VA',
        zip: '22207',
        domain: 'gofastcrushgoals.com',
      },
    });

    console.log('✅ GoFast Company upserted successfully:');
    console.log(JSON.stringify(company, null, 2));
  } catch (error) {
    console.error('❌ Error upserting GoFast Company:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

upsertGoFastCompany();

