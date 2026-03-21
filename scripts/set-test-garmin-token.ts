/**
 * Apply Garmin Health API sandbox / evaluation credentials to an athlete row.
 *
 * Env (recommended — do not commit real tokens):
 *   GARMIN_TRAINING_TEST_ACCESS_TOKEN  — bearer token for Training + Wellness APIs in test
 *   GARMIN_TRAINING_TEST_USER_ID         — Garmin user id string webhooks send as userId
 *   GARMIN_TRAINING_TEST_ATHLETE_EMAIL   — optional; match athlete by email (substring)
 *   GARMIN_TRAINING_TEST_ATHLETE_ID      — optional; explicit athlete cuid (wins over email)
 *
 * Usage:
 *   GARMIN_TRAINING_TEST_ACCESS_TOKEN=... GARMIN_TRAINING_TEST_USER_ID=... npx tsx scripts/set-test-garmin-token.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const testToken = process.env.GARMIN_TRAINING_TEST_ACCESS_TOKEN?.trim();
  const testUserId = process.env.GARMIN_TRAINING_TEST_USER_ID?.trim();
  const athleteId = process.env.GARMIN_TRAINING_TEST_ATHLETE_ID?.trim();
  const emailHint = process.env.GARMIN_TRAINING_TEST_ATHLETE_EMAIL?.trim();

  if (!testToken || !testUserId) {
    console.error(
      "Set GARMIN_TRAINING_TEST_ACCESS_TOKEN and GARMIN_TRAINING_TEST_USER_ID in .env.local (see docs/GARMIN_TRAINING_TEST_ENV.md)"
    );
    process.exit(1);
  }

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
    console.error("No athlete found. Set GARMIN_TRAINING_TEST_ATHLETE_ID or GARMIN_TRAINING_TEST_ATHLETE_EMAIL.");
    process.exit(1);
  }

  console.log(`Applying test Garmin to athlete: ${athlete.email || athlete.id}`);

  const updated = await prisma.athlete.update({
    where: { id: athlete.id },
    data: {
      garmin_test_access_token: testToken,
      garmin_test_user_id: testUserId,
      garmin_use_test_tokens: true,
    },
  });

  console.log("OK — garmin_use_test_tokens=true, test user id:", updated.garmin_test_user_id);
  console.log("Token prefix:", updated.garmin_test_access_token?.slice(0, 12) + "...");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
