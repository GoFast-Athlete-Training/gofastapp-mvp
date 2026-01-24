/**
 * Migrate and Drop Company Script
 * 
 * Comprehensive script that:
 * 1. Identifies the first company (oldest by createdAt)
 * 2. Migrates all athletes from other companies to the first company
 * 3. Ensures the first company has all proper fields (slug, etc.)
 * 4. Drops all other companies
 */

import { PrismaClient } from '@gofast/shared-db';
import { GOFAST_COMPANY_ID } from '../lib/goFastCompanyConfig';

const prisma = new PrismaClient();

async function migrateAndDropCompany() {
  try {
    console.log('\n🔍 Migrating athletes and cleaning up companies...\n');
    console.log('='.repeat(60));

    // Step 1: Get all companies ordered by creation date
    const companies = await prisma.go_fast_companies.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        Athlete: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            firebaseId: true,
            companyId: true,
          },
        },
      },
    });

    if (companies.length === 0) {
      console.log('❌ No companies found in database');
      return;
    }

    const firstCompany = companies[0];
    const otherCompanies = companies.slice(1);

    console.log('📋 Company Analysis:');
    console.log(`   First Company (KEEP): ${firstCompany.id}`);
    console.log(`     - Created: ${firstCompany.createdAt.toISOString()}`);
    console.log(`     - Name: ${firstCompany.name || '(no name)'}`);
    console.log(`     - Slug: ${firstCompany.slug || '(no slug)'}`);
    console.log(`     - Athletes: ${firstCompany.Athlete.length}`);

    if (otherCompanies.length > 0) {
      console.log(`\n   Other Companies (DROP): ${otherCompanies.length}`);
      otherCompanies.forEach((company, index) => {
        console.log(`     ${index + 1}. ${company.id} - Created: ${company.createdAt.toISOString()} - Athletes: ${company.Athlete.length}`);
      });
    } else {
      console.log(`\n   ✅ No other companies to drop`);
    }
    console.log('');

    // Step 2: Verify config matches first company
    if (GOFAST_COMPANY_ID !== firstCompany.id) {
      console.log(`⚠️  WARNING: Config GOFAST_COMPANY_ID (${GOFAST_COMPANY_ID}) does not match first company (${firstCompany.id})`);
      console.log(`   Config will need to be updated to match first company.`);
    } else {
      console.log(`✅ Config matches first company ID`);
    }

    // Step 3: Migrate athletes from other companies to first company
    let totalMigrated = 0;
    for (const company of otherCompanies) {
      if (company.Athlete.length > 0) {
        console.log(`\n👥 Migrating ${company.Athlete.length} athlete(s) from company ${company.id} to first company...`);
        
        for (const athlete of company.Athlete) {
          try {
            await prisma.athlete.update({
              where: { id: athlete.id },
              data: { companyId: firstCompany.id },
            });
            console.log(`   ✅ Migrated: ${athlete.email || athlete.firebaseId} (${athlete.firstName || ''} ${athlete.lastName || ''})`);
            totalMigrated++;
          } catch (error: any) {
            console.error(`   ❌ Failed to migrate athlete ${athlete.id}: ${error.message}`);
          }
        }
      }
    }

    if (totalMigrated > 0) {
      console.log(`\n✅ Successfully migrated ${totalMigrated} athlete(s) to first company`);
    } else if (otherCompanies.length > 0) {
      console.log(`\n✅ No athletes to migrate (all other companies are empty)`);
    }

    // Step 4: Ensure first company has all proper fields
    console.log(`\n🔧 Ensuring first company has all proper fields...`);
    const updateData: any = {
      name: firstCompany.name || 'GoFast',
      slug: firstCompany.slug || 'gofast',
    };

    // Only add address fields if they're missing
    if (!firstCompany.address) {
      updateData.address = '2604 N. George Mason Dr.';
    }
    if (!firstCompany.city) {
      updateData.city = 'Arlington';
    }
    if (!firstCompany.state) {
      updateData.state = 'VA';
    }
    if (!firstCompany.zip) {
      updateData.zip = '22207';
    }
    if (!firstCompany.domain) {
      updateData.domain = 'gofastcrushgoals.com';
    }

    if (Object.keys(updateData).length > 2) { // More than just name and slug
      await prisma.go_fast_companies.update({
        where: { id: firstCompany.id },
        data: updateData,
      });
      console.log(`   ✅ Updated first company with missing fields`);
    } else {
      console.log(`   ✅ First company already has all required fields`);
    }

    // Step 5: Drop other companies
    if (otherCompanies.length > 0) {
      console.log(`\n🗑️  Dropping ${otherCompanies.length} other company(ies)...`);
      
      for (const company of otherCompanies) {
        try {
          // Double-check no athletes (shouldn't happen after migration, but safety check)
          const athleteCount = await prisma.athlete.count({
            where: { companyId: company.id },
          });

          if (athleteCount > 0) {
            console.log(`   ⚠️  Skipping ${company.id} - still has ${athleteCount} athlete(s)`);
            continue;
          }

          await prisma.go_fast_companies.delete({
            where: { id: company.id },
          });
          console.log(`   ✅ Deleted company: ${company.id}`);
        } catch (error: any) {
          console.error(`   ❌ Failed to delete company ${company.id}: ${error.message}`);
        }
      }
    }

    // Step 6: Final verification
    console.log(`\n✅ Final Verification:`);
    const finalCompanies = await prisma.go_fast_companies.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        Athlete: {
          select: {
            id: true,
          },
        },
      },
    });

    console.log(`   Total companies: ${finalCompanies.length}`);
    console.log(`   First company ID: ${finalCompanies[0].id}`);
    console.log(`   First company athletes: ${finalCompanies[0].Athlete.length}`);
    
    if (finalCompanies.length === 1) {
      console.log(`\n✅ SUCCESS: Only one company remains - clean database!`);
    } else {
      console.log(`\n⚠️  WARNING: ${finalCompanies.length} companies still exist`);
    }

  } catch (error: any) {
    console.error('\n❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateAndDropCompany()
  .then(() => {
    console.log('\n✅ Migration and cleanup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration and cleanup failed:', error);
    process.exit(1);
  });

