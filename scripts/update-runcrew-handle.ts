/**
 * Script to update a specific RunCrew handle
 */

import { prisma } from '../lib/prisma';

async function updateHandle() {
  console.log('🔍 Finding RunCrew "Crushin\' Miles"...');
  
  const crew = await prisma.run_crews.findFirst({
    where: {
      name: {
        contains: "Crushin' Miles",
      },
    },
  });

  if (!crew) {
    console.error('❌ RunCrew not found');
    process.exit(1);
  }

  console.log(`📊 Found crew: ${crew.name} (${crew.id})`);
  console.log(`   Current handle: ${crew.handle}`);

  try {
    await prisma.run_crews.update({
      where: { id: crew.id },
      data: { handle: 'crushinmiles' },
    });
    console.log('✅ Updated handle to: crushinmiles');
  } catch (err: any) {
    if (err.code === 'P2002') {
      console.error('❌ Handle "crushinmiles" already exists. Checking...');
      const existing = await prisma.run_crews.findUnique({
        where: { handle: 'crushinmiles' },
      });
      if (existing && existing.id === crew.id) {
        console.log('✅ Handle is already set correctly!');
      } else {
        console.error('❌ Another crew already has this handle');
      }
    } else {
      console.error('❌ Failed to update handle:', err);
    }
  }
}

updateHandle()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

