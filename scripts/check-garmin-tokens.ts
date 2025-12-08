/**
 * Script to check Garmin tokens for a specific athlete
 * Usage: npx tsx scripts/check-garmin-tokens.ts <athleteId>
 */

import { prisma } from '../packages/shared-prisma-schema';

async function checkGarminTokens(athleteId: string) {
  try {
    console.log(`🔍 Checking Garmin tokens for athleteId: ${athleteId}`);
    
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        garmin_user_id: true,
        garmin_access_token: true,
        garmin_refresh_token: true,
        garmin_expires_in: true,
        garmin_scope: true,
        garmin_connected_at: true,
        garmin_last_sync_at: true,
        garmin_is_connected: true,
        garmin_disconnected_at: true,
      },
    });

    if (!athlete) {
      console.log('❌ Athlete not found');
      return;
    }

    console.log('\n✅ Athlete found:');
    console.log(`  ID: ${athlete.id}`);
    console.log(`  Email: ${athlete.email || 'N/A'}`);
    console.log(`  Name: ${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() || 'N/A');
    
    console.log('\n📊 Garmin Connection Status:');
    console.log(`  Connected: ${athlete.garmin_is_connected ? '✅ Yes' : '❌ No'}`);
    console.log(`  Garmin User ID: ${athlete.garmin_user_id || '❌ Not set'}`);
    console.log(`  Connected At: ${athlete.garmin_connected_at ? athlete.garmin_connected_at.toISOString() : '❌ Not set'}`);
    console.log(`  Last Sync: ${athlete.garmin_last_sync_at ? athlete.garmin_last_sync_at.toISOString() : '❌ Never'}`);
    console.log(`  Disconnected At: ${athlete.garmin_disconnected_at ? athlete.garmin_disconnected_at.toISOString() : 'N/A'}`);
    
    console.log('\n🔑 Garmin Tokens:');
    console.log(`  Access Token: ${athlete.garmin_access_token ? `✅ Present (${athlete.garmin_access_token.substring(0, 20)}...)` : '❌ Missing'}`);
    console.log(`  Refresh Token: ${athlete.garmin_refresh_token ? `✅ Present (${athlete.garmin_refresh_token.substring(0, 20)}...)` : '❌ Missing'}`);
    console.log(`  Expires In: ${athlete.garmin_expires_in ? `${athlete.garmin_expires_in} seconds` : '❌ Not set'}`);
    console.log(`  Scope: ${athlete.garmin_scope || '❌ Not set'}`);

    if (athlete.garmin_access_token && athlete.garmin_refresh_token) {
      console.log('\n✅ Tokens are present in database!');
    } else {
      console.log('\n⚠️ Tokens are missing or incomplete');
    }

  } catch (error) {
    console.error('❌ Error checking tokens:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get athleteId from command line args
const athleteId = process.argv[2];

if (!athleteId) {
  console.error('❌ Usage: npx tsx scripts/check-garmin-tokens.ts <athleteId>');
  process.exit(1);
}

checkGarminTokens(athleteId);

