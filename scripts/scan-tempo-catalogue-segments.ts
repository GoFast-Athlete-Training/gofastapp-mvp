/**
 * Scan Tempo catalogue rows that use interval-style distanceMeters in segmentPaceDist.
 *
 * Usage:
 *   npx tsx scripts/scan-tempo-catalogue-segments.ts
 *   npx tsx scripts/scan-tempo-catalogue-segments.ts --name=rolling
 */

import { prisma } from "../lib/prisma";
import { segmentPaceDistUsesDistanceMeters } from "../lib/training/catalogue-segment-distance";

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || null : null;
}

async function main() {
  const nameFilter = readArg("name")?.toLowerCase() ?? null;

  const rows = await prisma.workout_catalogue.findMany({
    where: { workoutType: "Tempo" },
    select: {
      id: true,
      name: true,
      segmentPaceDist: true,
    },
    orderBy: { name: "asc" },
  });

  const flagged = rows.filter((r) => {
    if (nameFilter && !r.name.toLowerCase().includes(nameFilter)) return false;
    return segmentPaceDistUsesDistanceMeters(r.segmentPaceDist);
  });

  console.info("[scan-tempo-catalogue] tempo catalogue rows", {
    totalTempo: rows.length,
    usesDistanceMeters: flagged.length,
    nameFilter,
  });

  for (const row of flagged) {
    console.log(
      JSON.stringify({
        id: row.id,
        name: row.name,
        segmentPaceDist: row.segmentPaceDist,
      })
    );
  }

  if (flagged.length === 0) {
    console.info("No Tempo catalogues with distanceMeters found.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
