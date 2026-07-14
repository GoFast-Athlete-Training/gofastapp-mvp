/**
 * Inventory athlete rows and Garmin-synced activities for logout/re-auth debugging.
 *
 * Usage:
 *   npx tsx scripts/garmin-activity-inventory.ts --email you@company.com
 *   npx tsx scripts/garmin-activity-inventory.ts --firebase <uid>
 *   npx tsx scripts/garmin-activity-inventory.ts --garmin-user <garminUserId>
 *   npx tsx scripts/garmin-activity-inventory.ts --athlete <athleteId>
 */
import { prisma } from '../lib/prisma';

type Args = {
  email?: string;
  firebase?: string;
  garminUser?: string;
  athlete?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!val) continue;
    if (key === '--email') out.email = val;
    if (key === '--firebase') out.firebase = val;
    if (key === '--garmin-user') out.garminUser = val;
    if (key === '--athlete') out.athlete = val;
  }
  return out;
}

async function summarizeAthlete(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      email: true,
      firebaseId: true,
      firstName: true,
      lastName: true,
      garmin_user_id: true,
      garmin_is_connected: true,
      garmin_connected_at: true,
      garmin_disconnected_at: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!athlete) {
    console.log(`❌ Athlete not found: ${athleteId}`);
    return;
  }

  const [totalActivities, garminActivities, recentGarmin, lastActivity] = await Promise.all([
    prisma.athlete_activities.count({ where: { athleteId } }),
    prisma.athlete_activities.count({ where: { athleteId, source: 'garmin' } }),
    prisma.athlete_activities.count({
      where: {
        athleteId,
        source: 'garmin',
        OR: [{ startTime: null }, { startTime: { gte: daysAgo(90) } }],
      },
    }),
    prisma.athlete_activities.findFirst({
      where: { athleteId, startTime: { not: null } },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        source: true,
        activityName: true,
        startTime: true,
        sourceActivityId: true,
      },
    }),
  ]);

  console.log('─'.repeat(80));
  console.log(`Athlete ${athlete.id}`);
  console.log(`  Name: ${[athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || '(none)'}`);
  console.log(`  Email: ${athlete.email ?? '(none)'}`);
  console.log(`  Firebase: ${athlete.firebaseId ?? '(none)'}`);
  console.log(
    `  Garmin: ${athlete.garmin_is_connected ? 'connected' : 'disconnected'} (${athlete.garmin_user_id ?? 'no user id'})`
  );
  if (athlete.garmin_connected_at) {
    console.log(`  Garmin connected at: ${athlete.garmin_connected_at.toISOString()}`);
  }
  if (athlete.garmin_disconnected_at) {
    console.log(`  Garmin disconnected at: ${athlete.garmin_disconnected_at.toISOString()}`);
  }
  console.log(`  Activities total: ${totalActivities}`);
  console.log(`  Activities source=garmin: ${garminActivities}`);
  console.log(`  Garmin activities in last 90d window: ${recentGarmin}`);
  if (lastActivity) {
    console.log(
      `  Last activity: ${lastActivity.activityName ?? lastActivity.source} @ ${lastActivity.startTime?.toISOString() ?? 'unknown'} (${lastActivity.id})`
    );
  } else {
    console.log('  Last activity: none');
  }
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email && !args.firebase && !args.garminUser && !args.athlete) {
    console.error(
      'Provide one of: --email, --firebase, --garmin-user, --athlete'
    );
    process.exit(1);
  }

  const athleteIds = new Set<string>();

  if (args.athlete) athleteIds.add(args.athlete);

  if (args.firebase) {
    const row = await prisma.athlete.findFirst({
      where: { firebaseId: args.firebase },
      select: { id: true },
    });
    if (row) athleteIds.add(row.id);
    else console.log(`No athlete for firebaseId=${args.firebase}`);
  }

  if (args.email) {
    const rows = await prisma.athlete.findMany({
      where: { email: args.email },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length === 0) {
      console.log(`No athlete for email=${args.email}`);
    } else if (rows.length > 1) {
      console.log(`⚠️  ${rows.length} athlete rows share email=${args.email}`);
    }
    rows.forEach((r) => athleteIds.add(r.id));
  }

  if (args.garminUser) {
    const rows = await prisma.athlete.findMany({
      where: { garmin_user_id: args.garminUser },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (rows.length === 0) {
      console.log(`No athlete currently linked to garmin_user_id=${args.garminUser}`);
      const activityOwners = await prisma.athlete_activities.findMany({
        where: { source: 'garmin' },
        select: { athleteId: true },
        distinct: ['athleteId'],
        take: 20,
      });
      if (activityOwners.length > 0) {
        console.log(
          'Tip: Garmin user id may have been cleared on disconnect; check candidate athletes with garmin activities:'
        );
        activityOwners.forEach((a) => athleteIds.add(a.athleteId));
      }
    } else {
      if (rows.length > 1) {
        console.log(`⚠️  ${rows.length} athlete rows share garmin_user_id=${args.garminUser}`);
      }
      rows.forEach((r) => athleteIds.add(r.id));
    }
  }

  if (athleteIds.size === 0) {
    console.log('No athlete rows to summarize.');
    return;
  }

  const ids = Array.from(athleteIds);
  console.log(`Found ${ids.length} athlete row(s) to inspect.\n`);
  for (const id of ids) {
    await summarizeAthlete(id);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
