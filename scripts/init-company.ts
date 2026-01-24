import { prisma } from '../lib/prisma';
import { GOFAST_COMPANY_ID } from '../lib/goFastCompanyConfig';

const DEFAULT_COMPANY_ID = GOFAST_COMPANY_ID;
const DEFAULT_COMPANY_SLUG = 'gofast';

async function initCompany() {
  try {
    console.log('🔧 Initializing GoFast Company...\n');

    // First, try to find existing company by slug
    let company = await prisma.go_fast_companies.findUnique({
      where: { slug: DEFAULT_COMPANY_SLUG },
    });

    if (!company) {
      // Try to find by ID
      company = await prisma.go_fast_companies.findUnique({
        where: { id: DEFAULT_COMPANY_ID },
      });

      if (!company) {
        // Create new company
        console.log('📝 Creating new GoFast Company...');
        company = await prisma.go_fast_companies.create({
          data: {
            id: DEFAULT_COMPANY_ID,
            name: 'GoFast',
            slug: DEFAULT_COMPANY_SLUG,
            address: '2604 N. George Mason Dr.',
            city: 'Arlington',
            state: 'VA',
            zip: '22207',
            domain: 'gofastcrushgoals.com',
            updatedAt: new Date(),
          },
        });
      } else {
        // Update existing company to ensure slug is set
        console.log('🔄 Updating existing company with slug...');
        company = await prisma.go_fast_companies.update({
          where: { id: DEFAULT_COMPANY_ID },
          data: {
            slug: DEFAULT_COMPANY_SLUG,
            name: company.name || 'GoFast',
            address: company.address || '2604 N. George Mason Dr.',
            city: company.city || 'Arlington',
            state: company.state || 'VA',
            zip: company.zip || '22207',
            domain: company.domain || 'gofastcrushgoals.com',
          },
        });
      }
    } else {
      // Update existing company to ensure all fields are correct
      console.log('🔄 Updating existing GoFast Company...');
      company = await prisma.go_fast_companies.update({
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
    }

    console.log('\n✅ GoFast Company initialized:');
    console.log(`   ID: ${company.id}`);
    console.log(`   Name: ${company.name}`);
    console.log(`   Slug: ${company.slug}`);
    console.log(`   Domain: ${company.domain}`);
    console.log(`   Address: ${company.address}, ${company.city}, ${company.state} ${company.zip}`);

    // Check how many athletes are linked to this company
    const athleteCount = await prisma.athlete.count({
      where: { companyId: company.id },
    });
    console.log(`\n👥 Athletes linked to company: ${athleteCount}`);

    if (athleteCount === 0) {
      console.log('\n⚠️  No athletes are currently linked to this company.');
      console.log('   Run the backfill script if you have existing athletes without companyId.');
    }

  } catch (error: any) {
    console.error('\n❌ Error initializing company:', error);
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

initCompany();

