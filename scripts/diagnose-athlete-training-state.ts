/**
 * Trace canonical training plan / goal / Garmin state for one athlete.
 * Run: npx tsx scripts/diagnose-athlete-training-state.ts <athleteId>
 */

import {
  diagnoseAthleteTrainingState,
  formatAthleteTrainingDiagnosis,
} from "../lib/training/diagnose-athlete-training-state";

async function main() {
  const athleteId = process.argv[2]?.trim();
  if (!athleteId) {
    console.error("Usage: npx tsx scripts/diagnose-athlete-training-state.ts <athleteId>");
    process.exit(1);
  }

  const diagnosis = await diagnoseAthleteTrainingState(athleteId);
  console.log(formatAthleteTrainingDiagnosis(diagnosis));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
