/**
 * Script to populate handle field for existing RunCrews
 * Generates handles from crew names and ensures uniqueness
 */

import { prisma } from '../lib/prisma';

function generateHandle(name: string): string {
  // Convert to lowercase, remove special chars, replace spaces with hyphens
  let base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  // Ensure minimum length
  if (base.length < 3) {
    base = base + '-crew';
  }
  
  return base;
}

async function populateHandles() {
  console.log('🔍 Fetching all RunCrews without handles...');
  
  const crews = await prisma.run_crews.findMany({
    where: {
      handle: null,
    },
  });

  console.log(`📊 Found ${crews.length} crews without handles`);

  for (const crew of crews) {
    let handle = generateHandle(crew.name);
    let attempts = 0;
    let isUnique = false;

    // Try to find a unique handle
    while (!isUnique && attempts < 20) {
      const existing = await prisma.run_crews.findUnique({
        where: { handle },
      });

      if (!existing) {
        isUnique = true;
      } else {
        // Append number to make unique
        handle = `${generateHandle(crew.name)}-${attempts + 1}`;
        attempts++;
      }
    }

    // Final fallback if we can't generate a unique handle
    if (!isUnique) {
      handle = `${generateHandle(crew.name)}-${Date.now()}`;
    }

    try {
      await prisma.run_crews.update({
        where: { id: crew.id },
        data: { handle },
      });
      console.log(`✅ Updated crew "${crew.name}" with handle: ${handle}`);
    } catch (err) {
      console.error(`❌ Failed to update crew "${crew.name}":`, err);
    }
  }

  console.log('✅ Done populating handles!');
}

populateHandles()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

