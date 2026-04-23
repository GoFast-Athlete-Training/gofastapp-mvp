/**
 * One-time upsert of canonical workout_catalogue rows (local/staging/prod).
 * Run: npx tsx scripts/seed-catalogue.ts
 */
import { prisma } from "../lib/prisma";
import { runCatalogueSeed } from "../lib/training/run-catalogue-seed";

async function main() {
  const { created, updated } = await runCatalogueSeed(prisma);
  console.log(`Catalogue seed: ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
