/**
 * Inspect Companies Script
 * 
 * Lists all companies in the database and their associated athletes
 * to help identify which company to keep and which to drop.
 */

import { PrismaClient } from '@gofast/shared-db';

const prisma = new PrismaClient();

async function inspectCompanies() {
  try {
    console.log('\n🔍 Inspecting all companies in database...\n');

    // Get all companies ordered by creation date
    const companies = await prisma.go_fast_companies.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        Athlete: {
          select: {
            id: true,
            firebaseId: true,
            email: true,
            firstName: true,
            lastName: true,
            gofastHandle: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (companies.length === 0) {
      console.log('❌ No companies found in database');
      return;
    }

    console.log(`✅ Found ${companies.length} company(ies):\n`);

    companies.forEach((company, index) => {
      const isFirst = index === 0;
      const athleteCount = company.Athlete.length;
      
      console.log(`${isFirst ? '👉' : '  '} Company ${index + 1} (${isFirst ? 'FIRST - KEEP THIS ONE' : 'DROP THIS ONE'}):`);
      console.log(`   ID: ${company.id}`);
      console.log(`   Name: ${company.name || '(no name)'}`);
      console.log(`   Slug: ${company.slug || '(no slug)'}`);
      console.log(`   Created: ${company.createdAt.toISOString()}`);
      console.log(`   Updated: ${company.updatedAt.toISOString()}`);
      console.log(`   Athletes: ${athleteCount}`);
      
      if (athleteCount > 0) {
        console.log(`   Athlete IDs (first 5):`);
        company.Athlete.slice(0, 5).forEach((athlete) => {
          console.log(`     - ${athlete.id} (${athlete.email || athlete.firebaseId}) - ${athlete.firstName || ''} ${athlete.lastName || ''}`);
        });
        if (athleteCount > 5) {
          console.log(`     ... and ${athleteCount - 5} more`);
        }
      }
      console.log('');
    });

    const firstCompany = companies[0];
    const secondCompany = companies[1];

    if (companies.length === 1) {
      console.log('✅ Only one company exists - nothing to drop');
      console.log(`\n📋 Recommended config value:`);
      console.log(`   GOFAST_COMPANY_ID = '${firstCompany.id}'`);
    } else {
      console.log('\n📋 SUMMARY:');
      console.log(`   First Company (KEEP): ${firstCompany.id} - ${firstCompany.name || firstCompany.slug || 'unnamed'}`);
      console.log(`     - Created: ${firstCompany.createdAt.toISOString()}`);
      console.log(`     - Athletes: ${firstCompany.Athlete.length}`);
      
      if (secondCompany) {
        console.log(`   Second Company (DROP): ${secondCompany.id} - ${secondCompany.name || secondCompany.slug || 'unnamed'}`);
        console.log(`     - Created: ${secondCompany.createdAt.toISOString()}`);
        console.log(`     - Athletes: ${secondCompany.Athlete.length}`);
        
        if (secondCompany.Athlete.length > 0) {
          console.log(`\n⚠️  WARNING: Second company has ${secondCompany.Athlete.length} athlete(s) that need to be migrated!`);
        }
      }

      console.log(`\n📋 Recommended config value:`);
      console.log(`   GOFAST_COMPANY_ID = '${firstCompany.id}'`);
    }

  } catch (error: any) {
    console.error('❌ Error inspecting companies:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

inspectCompanies()
  .then(() => {
    console.log('\n✅ Inspection complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Inspection failed:', error);
    process.exit(1);
  });

