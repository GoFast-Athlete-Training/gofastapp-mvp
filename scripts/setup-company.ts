import { prisma } from '../lib/prisma';
import { GOFAST_COMPANY_ID } from '../lib/goFastCompanyConfig';

const DEFAULT_COMPANY_ID = GOFAST_COMPANY_ID;
const DEFAULT_COMPANY_SLUG = 'gofast';

/**
 * Comprehensive setup script that:
 * 1. Initializes/ensures GoFastCompany exists
 * 2. Backfills companyId for any athletes missing it
 * 3. Verifies the setup
 */
async function setupCompany() {
  try {
    console.log('🚀 GoFast Company Setup Script\n');
    console.log('='.repeat(60));

    // Step 1: Initialize Company
    console.log('\n📦 Step 1: Ensuring GoFastCompany exists...');
    let company = await prisma.goFastCompany.findUnique({
      where: { slug: DEFAULT_COMPANY_SLUG },
    });

    if (!company) {
      company = await prisma.goFastCompany.findUnique({
        where: { id: DEFAULT_COMPANY_ID },
      });
    }

    if (!company) {
      console.log('   Creating new company...');
      company = await prisma.goFastCompany.create({
        data: {
          id: DEFAULT_COMPANY_ID,
          name: 'GoFast',
          slug: DEFAULT_COMPANY_SLUG,
          address: '2604 N. George Mason Dr.',
          city: 'Arlington',
          state: 'VA',
          zip: '22207',
          domain: 'gofastcrushgoals.com',
        },
      });
      console.log(`   ✅ Company created: ${company.id}`);
    } else {
      console.log(`   ✅ Company exists: ${company.name} (${company.id})`);
    }

    // Step 2: Backfill Athletes
    console.log('\n👥 Step 2: Checking athletes...');
    const totalAthletes = await prisma.athlete.count();
    console.log(`   Total athletes: ${totalAthletes}`);

    if (totalAthletes > 0) {
      // Get all athletes to check their companyId
      const allAthletes = await prisma.athlete.findMany({
        select: {
          id: true,
          companyId: true,
        },
      });

      // Find athletes that need updating (wrong companyId or we need to check for nulls via raw query)
      const athletesNeedingUpdate = allAthletes.filter(
        (athlete) => !athlete.companyId || athlete.companyId !== company.id
      );

      if (athletesNeedingUpdate.length > 0) {
        console.log(`   Found ${athletesNeedingUpdate.length} athletes needing companyId update...`);
        
        // Update each athlete individually to handle any database-level nulls
        let updatedCount = 0;
        for (const athlete of athletesNeedingUpdate) {
          try {
            await prisma.athlete.update({
              where: { id: athlete.id },
              data: { companyId: company.id },
            });
            updatedCount++;
          } catch (error: any) {
            console.error(`   ⚠️  Failed to update athlete ${athlete.id}: ${error.message}`);
          }
        }
        console.log(`   ✅ Updated ${updatedCount} athletes`);
      } else {
        console.log('   ✅ All athletes already have correct companyId');
      }
    } else {
      console.log('   ℹ️  No athletes in database yet');
    }

    // Step 3: Verification
    console.log('\n✅ Step 3: Verification...');
    const companyAthleteCount = await prisma.athlete.count({
      where: { companyId: company.id },
    });

    console.log(`   Company ID: ${company.id}`);
    console.log(`   Company Name: ${company.name}`);
    console.log(`   Athletes linked: ${companyAthleteCount}`);
    
    if (companyAthleteCount === totalAthletes) {
      console.log('   ✅ All athletes have correct companyId');
    } else if (companyAthleteCount < totalAthletes) {
      console.log(`   ⚠️  Warning: ${totalAthletes - companyAthleteCount} athletes may still need companyId`);
    }

    // Step 4: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Setup Summary:');
    console.log(`   Company: ${company.name} (${company.slug})`);
    console.log(`   Total Athletes: ${totalAthletes}`);
    console.log(`   Linked Athletes: ${companyAthleteCount}`);
    console.log('\n✅ Setup complete!');

  } catch (error: any) {
    console.error('\n❌ Error during setup:', error);
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

setupCompany();

