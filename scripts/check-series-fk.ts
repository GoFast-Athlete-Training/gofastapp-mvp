/**
 * Script to check if any run_series are missing runClubId FK
 * 
 * Run with: npx tsx scripts/check-series-fk.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function checkSeriesFK() {
  console.log("🔍 Checking run_series for missing runClubId FK...\n");

  const allSeries = await prisma.run_series.findMany({
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      runClubId: true,
      runClub: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [{ runClubId: "asc" }, { dayOfWeek: "asc" }],
  });

  console.log(`📊 Total series: ${allSeries.length}`);

  const missingFK = allSeries.filter((s) => !s.runClubId);
  const withFK = allSeries.filter((s) => s.runClubId);

  console.log(`✅ Series with FK: ${withFK.length}`);
  console.log(`❌ Series missing FK: ${missingFK.length}\n`);

  if (missingFK.length > 0) {
    console.log("⚠️  Series missing runClubId FK:");
    missingFK.forEach((s) => {
      console.log(`  - ${s.name || "Unnamed"} (${s.dayOfWeek}) - ID: ${s.id}`);
    });
    console.log("\n💡 These series need to be linked to run_clubs.");
  } else {
    console.log("✅ All series have runClubId FK set!");
  }

  // Check for series with FK but no matching runClub
  const orphaned = withFK.filter((s) => !s.runClub);
  if (orphaned.length > 0) {
    console.log(`\n⚠️  Series with FK but no matching runClub (orphaned): ${orphaned.length}`);
    orphaned.forEach((s) => {
      console.log(`  - ${s.name || "Unnamed"} (${s.dayOfWeek}) - runClubId: ${s.runClubId}`);
    });
  }
}

checkSeriesFK()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
