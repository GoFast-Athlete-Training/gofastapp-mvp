import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Migrating race_registry data...');
  
  // Copy data from old fields to new fields
  await prisma.$executeRaw`
    UPDATE "race_registry"
    SET 
      "raceDate" = "date",
      "distanceMiles" = "miles"
    WHERE "raceDate" IS NULL OR "distanceMiles" IS NULL;
  `;
  
  // Generate slugs from name + date for existing races
  await prisma.$executeRaw`
    UPDATE "race_registry"
    SET "slug" = LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          name || '-' || TO_CHAR("raceDate", 'YYYY'),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      )
    )
    WHERE "slug" IS NULL;
  `;
  
  // Calculate distanceKm from distanceMiles
  await prisma.$executeRaw`
    UPDATE "race_registry"
    SET "distanceKm" = "distanceMiles" * 1.60934
    WHERE "distanceKm" IS NULL AND "distanceMiles" IS NOT NULL;
  `;
  
  // Set isActive = true for all existing races
  await prisma.$executeRaw`
    UPDATE "race_registry"
    SET "isActive" = true
    WHERE "isActive" IS NULL;
  `;
  
  console.log('✅ Data migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

