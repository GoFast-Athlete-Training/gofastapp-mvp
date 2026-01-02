import { prisma } from '../lib/prisma';

const DEFAULT_COMPANY_SLUG = 'gofast';

async function upsertGoFastCompany() {
  try {
    console.log('🚀 Upserting GoFast Company...\n');

    // Check if company exists by slug
    let company = await prisma.goFastCompany.findUnique({
      where: { slug: DEFAULT_COMPANY_SLUG },
    });

    if (company) {
      console.log('📝 Updating existing company...');
      company = await prisma.goFastCompany.update({
        where: { slug: DEFAULT_COMPANY_SLUG },
        data: {
          name: 'GoFast',
          address: '2604 N. George Mason Dr.',
          city: 'Arlington',
          state: 'VA',
          zip: '22207',
          domain: 'gofastcrushgoals.com',
        },
      });
      console.log('✅ Company updated successfully');
    } else {
      console.log('📝 Creating new company...');
      company = await prisma.goFastCompany.create({
        data: {
          name: 'GoFast',
          slug: DEFAULT_COMPANY_SLUG,
          address: '2604 N. George Mason Dr.',
          city: 'Arlington',
          state: 'VA',
          zip: '22207',
          domain: 'gofastcrushgoals.com',
        },
      });
      console.log('✅ Company created successfully');
    }

    console.log('\n📋 Company Details:');
    console.log(JSON.stringify(company, null, 2));

    // Check athlete count
    const athleteCount = await prisma.athlete.count({
      where: { companyId: company.id },
    });
    console.log(`\n👥 Linked athletes: ${athleteCount}`);

  } catch (error: any) {
    console.error('\n❌ Error upserting GoFast Company:', error);
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    if (error.meta) {
      console.error('Meta:', error.meta);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

upsertGoFastCompany();

