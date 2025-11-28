import { prisma } from '../lib/prisma';

const GOFAST_COMPANY_ID = 'GoFast';

async function upsertGoFastCompany() {
  try {
    console.log('🚀 Upserting GoFast Company...');

    const company = await prisma.goFastCompany.upsert({
      where: { id: GOFAST_COMPANY_ID },
      update: {
        companyName: 'GoFast',
        description: 'Training and fitness social app',
        address: '2604 N. George Mason Dr.',
        city: 'Arlington',
        state: 'VA',
        zipCode: '22207',
      },
      create: {
        id: GOFAST_COMPANY_ID,
        companyName: 'GoFast',
        description: 'Training and fitness social app',
        address: '2604 N. George Mason Dr.',
        city: 'Arlington',
        state: 'VA',
        zipCode: '22207',
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

