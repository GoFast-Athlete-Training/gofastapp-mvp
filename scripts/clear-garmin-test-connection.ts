/**
 * Clear Garmin **test** OAuth fields on an athlete so you can re-link another Garmin account
 * (e.g. after using adam@gofastcrushgoals.com in sandbox).
 *
 * Env:
 *   GARMIN_TRAINING_TEST_ATHLETE_ID    — optional; explicit athlete cuid (wins over email)
 *   GARMIN_TRAINING_TEST_ATHLETE_EMAIL — optional; substring match on athlete.email
 *
 * If neither is set, falls back to the same heuristics as set-test-garmin-token.ts (adam / Adam).
 *
 * Usage:
 *   export DATABASE_URL=...
 *   GARMIN_TRAINING_TEST_ATHLETE_ID=clxxx npx tsx scripts/clear-garmin-test-connection.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const athleteId = process.env.GARMIN_TRAINING_TEST_ATHLETE_ID?.trim();
  const emailHint = process.env.GARMIN_TRAINING_TEST_ATHLETE_EMAIL?.trim();

  let athlete = null;
  if (athleteId) {
    athlete = await prisma.athlete.findUnique({ where: { id: athleteId } });
  } else if (emailHint) {
    athlete = await prisma.athlete.findFirst({
      where: { email: { contains: emailHint, mode: "insensitive" } },
    });
  } else {
    athlete = await prisma.athlete.findFirst({
      where: {
        OR: [
          { email: { contains: "adam", mode: "insensitive" } },
          { firstName: { contains: "Adam", mode: "insensitive" } },
        ],
      },
    });
  }

  if (!athlete) {
    console.error(
      "No athlete found. Set GARMIN_TRAINING_TEST_ATHLETE_ID or GARMIN_TRAINING_TEST_ATHLETE_EMAIL."
    );
    process.exit(1);
  }

  console.log(`Clearing Garmin test fields for athlete: ${athlete.email || athlete.id}`);

  await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      garmin_test_access_token: null,
      garmin_test_user_id: null,
      garmin_use_test_tokens: false,
      garmin_test_linked_email: null,
    },
  });

  console.log(
    "OK — garmin_test_* cleared, garmin_use_test_tokens=false. Re-run test OAuth or set-test-garmin-token if needed."
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
