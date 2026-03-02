/**
 * Script to populate bidirectional ID mappings for run clubs
 * 
 * This script matches run_clubs (Product app) with acq_run_clubs (Company) by slug
 * and populates:
 * - run_clubs.companyRunClubId = acq_run_clubs.id
 * - acq_run_clubs.runClubId = run_clubs.id
 * 
 * Run with: npm run db:populate-bidirectional-ids
 * Or: tsx scripts/populate-bidirectional-run-club-ids.ts
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Product app Prisma client (uses Product app schema)
const productPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Company database connection (raw SQL via Prisma - different schema)
// Use COMPANY_DATABASE_URL if available, otherwise assume same database
const companyDbUrl = process.env.COMPANY_DATABASE_URL || process.env.DATABASE_URL;
const companyPrisma = new PrismaClient({
  datasources: {
    db: {
      url: companyDbUrl,
    },
  },
});

interface RunClubMatch {
  productId: string;
  productSlug: string;
  companyId: string;
  companySlug: string | null;
}

async function populateBidirectionalIds() {
  console.log('🚀 Starting bidirectional ID population for run clubs...\n');

  try {
    // Fetch all run_clubs from Product app
    const productClubs = await productPrisma.run_clubs.findMany({
      where: {
        slug: { not: null },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        companyRunClubId: true,
      },
      orderBy: { name: 'asc' },
    });

    console.log(`📊 Found ${productClubs.length} run clubs in Product app\n`);

    // Fetch all acq_run_clubs from Company (using raw SQL since different schema)
    const companyResult = await companyPrisma.$queryRaw<Array<{
      id: string;
      slug: string | null;
      name: string;
      runClubId: string | null;
    }>>`
      SELECT id, slug, name, "runClubId"
      FROM acq_run_clubs
      WHERE slug IS NOT NULL
      ORDER BY name ASC
    `;
    
    const companyClubs = companyResult.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      runClubId: row.runClubId,
    }));

    console.log(`📊 Found ${companyClubs.length} run clubs in Company\n`);

    // Create slug-based lookup maps
    const productBySlug = new Map<string, typeof productClubs[0]>();
    const companyBySlug = new Map<string, typeof companyClubs[0]>();

    productClubs.forEach((club) => {
      if (club.slug) {
        productBySlug.set(club.slug.toLowerCase(), club);
      }
    });

    companyClubs.forEach((club) => {
      if (club.slug) {
        companyBySlug.set(club.slug.toLowerCase(), club);
      }
    });

    // Find matches by slug
    const matches: RunClubMatch[] = [];
    const productUpdated: string[] = [];
    const companyUpdated: string[] = [];
    const productSkipped: string[] = [];
    const companySkipped: string[] = [];
    const productNoMatch: string[] = [];
    const companyNoMatch: string[] = [];

    // Match Product → Company
    for (const productClub of productClubs) {
      if (!productClub.slug) {
        productNoMatch.push(`${productClub.name} (${productClub.id}) - no slug`);
        continue;
      }

      const companyClub = companyBySlug.get(productClub.slug.toLowerCase());

      if (companyClub) {
        matches.push({
          productId: productClub.id,
          productSlug: productClub.slug,
          companyId: companyClub.id,
          companySlug: companyClub.slug,
        });

        // Update Product app if not already set
        if (productClub.companyRunClubId !== companyClub.id) {
          try {
            await productPrisma.run_clubs.update({
              where: { id: productClub.id },
              data: { companyRunClubId: companyClub.id },
            });
            productUpdated.push(`${productClub.name} (${productClub.slug})`);
            console.log(`✅ Updated Product: ${productClub.name} → Company ID: ${companyClub.id}`);
          } catch (error: any) {
            console.error(`❌ Failed to update Product ${productClub.name}:`, error.message);
          }
        } else {
          productSkipped.push(`${productClub.name} (${productClub.slug}) - already set`);
        }

        // Update Company if not already set (using raw SQL)
        if (companyClub.runClubId !== productClub.id) {
          try {
            await companyPrisma.$executeRaw`
              UPDATE acq_run_clubs 
              SET "runClubId" = ${productClub.id}
              WHERE id = ${companyClub.id}
            `;
            companyUpdated.push(`${companyClub.name} (${companyClub.slug})`);
            console.log(`✅ Updated Company: ${companyClub.name} → Product ID: ${productClub.id}`);
          } catch (error: any) {
            console.error(`❌ Failed to update Company ${companyClub.name}:`, error.message);
          }
        } else {
          companySkipped.push(`${companyClub.name} (${companyClub.slug}) - already set`);
        }
      } else {
        productNoMatch.push(`${productClub.name} (${productClub.slug}) - no Company match`);
      }
    }

    // Find Company clubs without Product matches
    for (const companyClub of companyClubs) {
      if (!companyClub.slug) {
        companyNoMatch.push(`${companyClub.name} (${companyClub.id}) - no slug`);
        continue;
      }

      const productClub = productBySlug.get(companyClub.slug.toLowerCase());
      if (!productClub) {
        companyNoMatch.push(`${companyClub.name} (${companyClub.slug}) - no Product match`);
      }
    }

    // Summary
    console.log('\n📋 Summary:');
    console.log(`✅ Product app updated: ${productUpdated.length}`);
    console.log(`✅ Company updated: ${companyUpdated.length}`);
    console.log(`⏭️  Product skipped (already set): ${productSkipped.length}`);
    console.log(`⏭️  Company skipped (already set): ${companySkipped.length}`);
    console.log(`❌ Product no match: ${productNoMatch.length}`);
    console.log(`❌ Company no match: ${companyNoMatch.length}`);
    console.log(`📊 Total matches: ${matches.length}`);

    if (productNoMatch.length > 0) {
      console.log('\n⚠️  Product clubs without Company matches:');
      productNoMatch.forEach((item) => console.log(`   - ${item}`));
    }

    if (companyNoMatch.length > 0) {
      console.log('\n⚠️  Company clubs without Product matches:');
      companyNoMatch.forEach((item) => console.log(`   - ${item}`));
    }

    console.log('\n✅ Bidirectional ID population complete!');
  } catch (error: any) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await productPrisma.$disconnect();
    await companyPrisma.$disconnect();
  }
}

// Run the script
populateBidirectionalIds()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
