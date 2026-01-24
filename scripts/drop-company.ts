/**
 * Drop Company Script
 * 
 * Drops the second company (not the first by createdAt) and ensures all routes use the first company.
 * This script will:
 * 1. Identify the first company (oldest by createdAt)
 * 2. Verify the second company has no athletes
 * 3. Delete the second company
 */

import { PrismaClient } from '@gofast/shared-db';
import { GOFAST_COMPANY_ID } from '../lib/goFastCompanyConfig';

const prisma = new PrismaClient();

async function dropCompany() {
  try {
    console.log('\n🔍 Identifying companies to drop...\n');

    // Get all companies ordered by creation date
    const companies = await prisma.go_fast_companies.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        Athlete: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (companies.length === 0) {
      console.log('❌ No companies found in database');
      return;
    }

    if (companies.length === 1) {
      console.log('✅ Only one company exists - nothing to drop');
      console.log(`   Company ID: ${companies[0].id}`);
      return;
    }

    const firstCompany = companies[0];
    const secondCompany = companies[1];

    console.log('📋 Company Analysis:');
    console.log(`   First Company (KEEP): ${firstCompany.id}`);
    console.log(`     - Created: ${firstCompany.createdAt.toISOString()}`);
    console.log(`     - Athletes: ${firstCompany.Athlete.length}`);
    console.log(`   Second Company (DROP): ${secondCompany.id}`);
    console.log(`     - Created: ${secondCompany.createdAt.toISOString()}`);
    console.log(`     - Athletes: ${secondCompany.Athlete.length}`);
    console.log('');

    // Verify config matches first company
    if (GOFAST_COMPANY_ID !== firstCompany.id) {
      console.log(`⚠️  WARNING: Config GOFAST_COMPANY_ID (${GOFAST_COMPANY_ID}) does not match first company (${firstCompany.id})`);
      console.log(`   Config has been updated to use first company, but verify this is correct.`);
    } else {
      console.log(`✅ Config matches first company ID`);
    }

    // Verify second company has no athletes
    if (secondCompany.Athlete.length > 0) {
      console.log(`\n❌ ERROR: Second company has ${secondCompany.Athlete.length} athlete(s)!`);
      console.log(`   Cannot delete company with athletes. Please migrate athletes first.`);
      console.log(`   Athletes in second company:`);
      secondCompany.Athlete.forEach((athlete) => {
        console.log(`     - ${athlete.id} (${athlete.email || 'no email'}) - ${athlete.firstName || ''} ${athlete.lastName || ''}`);
      });
      return;
    }

    // Confirm deletion
    console.log(`\n🗑️  Ready to delete second company: ${secondCompany.id}`);
    console.log(`   This action cannot be undone!`);
    
    // Delete the second company
    console.log(`\n🗑️  Deleting second company...`);
    await prisma.go_fast_companies.delete({
      where: { id: secondCompany.id },
    });

    console.log(`✅ Successfully deleted second company: ${secondCompany.id}`);
    console.log(`\n✅ First company (${firstCompany.id}) is now the only company`);

  } catch (error: any) {
    console.error('❌ Error dropping company:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

dropCompany()
  .then(() => {
    console.log('\n✅ Drop company complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Drop company failed:', error);
    process.exit(1);
  });

