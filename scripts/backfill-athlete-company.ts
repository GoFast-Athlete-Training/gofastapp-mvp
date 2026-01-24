import { prisma } from '../lib/prisma';

const DEFAULT_COMPANY_SLUG = 'gofast';

async function backfillAthleteCompany() {
  try {
    console.log('🔄 Backfilling companyId for athletes...\n');

    // Step 1: Ensure company exists
    let company = await prisma.go_fast_companies.findUnique({
      where: { slug: DEFAULT_COMPANY_SLUG },
    });

    if (!company) {
      console.log('⚠️  GoFast Company not found. Creating it first...');
      company = await prisma.go_fast_companies.create({
        data: {
          id: `c${Date.now().toString(36)}${Math.random().toString(36).substring(2, 15)}`,
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
      console.log(`✅ Created company with ID: ${company.id}\n`);
    } else {
      console.log(`✅ Found company: ${company.name} (ID: ${company.id})\n`);
    }

    // Step 2: Find athletes without companyId or with invalid companyId
    const allAthletes = await prisma.athlete.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyId: true,
      },
    });

    console.log(`📊 Total athletes found: ${allAthletes.length}`);

    // Check which athletes need updating
    const validCompanyIds = new Set([company.id]);
    const athletesToUpdate = allAthletes.filter(
      (athlete) => !athlete.companyId || !validCompanyIds.has(athlete.companyId)
    );

    console.log(`🔧 Athletes needing update: ${athletesToUpdate.length}`);

    if (athletesToUpdate.length === 0) {
      console.log('\n✅ All athletes already have valid companyId!');
      return;
    }

    // Step 3: Update athletes
    console.log('\n📝 Updating athletes...');
    let updatedCount = 0;
    let errorCount = 0;

    for (const athlete of athletesToUpdate) {
      try {
        await prisma.athlete.update({
          where: { id: athlete.id },
          data: { companyId: company.id },
        });
        updatedCount++;
        console.log(
          `  ✅ Updated: ${athlete.firstName || ''} ${athlete.lastName || ''} (${athlete.email || 'no email'})`
        );
      } catch (error: any) {
        errorCount++;
        console.error(
          `  ❌ Failed to update ${athlete.id}: ${error.message}`
        );
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully updated: ${updatedCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount}`);
    }

    // Step 4: Verify
    const finalCount = await prisma.athlete.count({
      where: { companyId: company.id },
    });
    console.log(`\n✅ Total athletes now linked to company: ${finalCount}`);

  } catch (error: any) {
    console.error('\n❌ Error backfilling athlete company:', error);
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

backfillAthleteCompany();

