/**
 * One-time: deactivate the June-13 DC Half Prod row left after Company race delete.
 * Usage: npx tsx scripts/retire-dc-half-orphan-registry.ts
 */
import { PrismaClient } from '@prisma/client';

const ORPHAN_ID = '83729e85-d34f-4ccd-bdd7-59f2836b5462';
const CANONICAL_ID = 'a6b14a99-c40a-4407-9b26-7c2367f116dc';

const prisma = new PrismaClient();

async function main() {
  const orphan = await prisma.race_registry.findUnique({
    where: { id: ORPHAN_ID },
    select: { id: true, name: true, slug: true, isActive: true, companyRaceId: true },
  });

  if (!orphan) {
    console.log('Orphan row not found — already removed.');
    return;
  }

  const claims = await prisma.athlete_races.count({
    where: { raceRegistryId: ORPHAN_ID },
  });
  if (claims > 0) {
    console.log(`Remapping ${claims} athlete_races to canonical ${CANONICAL_ID}`);
    await prisma.athlete_races.updateMany({
      where: { raceRegistryId: ORPHAN_ID },
      data: { raceRegistryId: CANONICAL_ID },
    });
  }

  await prisma.race_registry.update({
    where: { id: ORPHAN_ID },
    data: { isActive: false, updatedAt: new Date() },
  });

  console.log(
    `Deactivated orphan ${orphan.slug} (${orphan.id}). Canonical row: ${CANONICAL_ID}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
