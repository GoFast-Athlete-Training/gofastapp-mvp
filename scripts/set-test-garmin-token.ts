/**
 * Script to set Garmin test token for evaluation
 * Usage: npx tsx scripts/set-test-garmin-token.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function setTestToken() {
  try {
    // Find Adam Cole user
    const athlete = await prisma.athlete.findFirst({
      where: {
        OR: [
          { email: { contains: "adam", mode: "insensitive" } },
          { firstName: { contains: "Adam", mode: "insensitive" } },
          { lastName: { contains: "Cole", mode: "insensitive" } },
        ],
      },
    });

    if (!athlete) {
      console.error("❌ Adam Cole user not found");
      process.exit(1);
    }

    console.log(`✅ Found user: ${athlete.email || athlete.id}`);

    // Set test token
    const testToken = "CCPT1772536776.VI7K5M1Mgv0";
    const testUserId = "1772536776"; // Extract from token prefix

    const updated = await prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        garmin_test_access_token: testToken,
        garmin_test_user_id: testUserId,
        garmin_use_test_tokens: true,
      },
    });

    console.log("✅ Test token set successfully!");
    console.log(`   User ID: ${updated.id}`);
    console.log(`   Test Token: ${updated.garmin_test_access_token?.substring(0, 20)}...`);
    console.log(`   Test User ID: ${updated.garmin_test_user_id}`);
    console.log(`   Use Test Tokens: ${updated.garmin_use_test_tokens}`);
    console.log("\n🧪 Test mode enabled - production tokens will NOT be used");
  } catch (error: any) {
    console.error("❌ Error setting test token:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setTestToken();
