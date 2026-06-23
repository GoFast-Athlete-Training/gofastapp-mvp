import { countReadAppNotificationsSince, countUnreadAppNotifications } from '@/lib/app-notifications/feed';
import { prisma } from './prisma';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY);
}

function computeAge(birthday: Date | null | undefined): number | null {
  if (!birthday) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age;
}

export type AthleteEngagement = {
  athleteId: string;
  lastSeenAt: string | null;
  avgWeeklyMilesSnapshot: number | null;
  mileageSnapshotUpdatedAt: string | null;
  runClubMemberships: Array<{
    clubId: string;
    clubSlug: string;
    clubName: string;
    joinedAt: string;
    status: string;
  }>;
  runsAttended: {
    lifetime: number;
    last30d: number;
    lastAttendedAt: string | null;
  };
  runsRsvpdGoing: {
    lifetime: number;
    last30d: number;
    upcoming: number;
  };
  clubEventsRsvpd: number;
  raceSignups: number;
  raceResults: number;
  activityCountLast30d: number;
  notifications: {
    unread: number;
    readLast30d: number;
  };
};

export async function getAthleteEngagement(athleteId: string): Promise<AthleteEngagement | null> {
  const now = new Date();
  const thirtyDaysAgo = daysAgo(30);

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      lastSeenAt: true,
      avgWeeklyMilesSnapshot: true,
      mileageSnapshotUpdatedAt: true,
    },
  });

  if (!athlete) return null;

  const [
    runClubMemberships,
    runsAttendedLifetime,
    runsAttendedLast30d,
    lastCheckin,
    runsRsvpdLifetime,
    runsRsvpdLast30d,
    upcomingRunsGoing,
    clubEventsRsvpd,
    raceSignups,
    raceResults,
    activityCountLast30d,
    notificationsUnread,
    notificationsReadLast30d,
  ] = await Promise.all([
    prisma.run_club_memberships.findMany({
      where: { athleteId, status: 'active' },
      select: {
        joinedAt: true,
        status: true,
        run_clubs: {
          select: { id: true, slug: true, name: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    }),
    prisma.city_run_checkins.count({ where: { athleteId } }),
    prisma.city_run_checkins.count({
      where: { athleteId, checkedInAt: { gte: thirtyDaysAgo } },
    }),
    prisma.city_run_checkins.findFirst({
      where: { athleteId },
      orderBy: { checkedInAt: 'desc' },
      select: { checkedInAt: true },
    }),
    prisma.city_run_rsvps.count({
      where: { athleteId, status: 'going' },
    }),
    prisma.city_run_rsvps.count({
      where: {
        athleteId,
        status: 'going',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.city_run_rsvps.count({
      where: {
        athleteId,
        status: 'going',
        city_runs: { date: { gte: now } },
      },
    }),
    prisma.run_club_event_rsvps.count({
      where: { athleteId, status: 'going' },
    }),
    prisma.athlete_race_signups.count({ where: { athleteId } }),
    prisma.athlete_race_results.count({ where: { athleteId } }),
    prisma.athlete_activities.count({
      where: {
        athleteId,
        startTime: { gte: thirtyDaysAgo },
      },
    }),
    countUnreadAppNotifications(athleteId),
    countReadAppNotificationsSince(athleteId, thirtyDaysAgo),
  ]);

  return {
    athleteId: athlete.id,
    lastSeenAt: athlete.lastSeenAt?.toISOString() ?? null,
    avgWeeklyMilesSnapshot: athlete.avgWeeklyMilesSnapshot ?? null,
    mileageSnapshotUpdatedAt: athlete.mileageSnapshotUpdatedAt?.toISOString() ?? null,
    runClubMemberships: runClubMemberships.map((m) => ({
      clubId: m.run_clubs.id,
      clubSlug: m.run_clubs.slug,
      clubName: m.run_clubs.name,
      joinedAt: m.joinedAt.toISOString(),
      status: m.status,
    })),
    runsAttended: {
      lifetime: runsAttendedLifetime,
      last30d: runsAttendedLast30d,
      lastAttendedAt: lastCheckin?.checkedInAt?.toISOString() ?? null,
    },
    runsRsvpdGoing: {
      lifetime: runsRsvpdLifetime,
      last30d: runsRsvpdLast30d,
      upcoming: upcomingRunsGoing,
    },
    clubEventsRsvpd,
    raceSignups,
    raceResults,
    activityCountLast30d,
    notifications: {
      unread: notificationsUnread,
      readLast30d: notificationsReadLast30d,
    },
  };
}

export type ClubMemberEngagementRow = {
  athleteId: string;
  name: string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  age: number | null;
  joinedAt: string;
  engagement: AthleteEngagement;
};

export async function getClubMembersWithEngagement(runClubId: string) {
  const memberships = await prisma.run_club_memberships.findMany({
    where: { runClubId, status: 'active' },
    include: {
      Athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          state: true,
          gender: true,
          birthday: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const members: ClubMemberEngagementRow[] = [];
  let attendedRunLast30d = 0;
  const mileageSnapshots: number[] = [];

  for (const membership of memberships) {
    const engagement = await getAthleteEngagement(membership.athleteId);
    if (!engagement) continue;

    attendedRunLast30d += engagement.runsAttended.last30d;
    if (engagement.avgWeeklyMilesSnapshot != null) {
      mileageSnapshots.push(engagement.avgWeeklyMilesSnapshot);
    }

    const name = [membership.Athlete.firstName, membership.Athlete.lastName]
      .filter(Boolean)
      .join(' ') || null;

    members.push({
      athleteId: membership.athleteId,
      name,
      city: membership.Athlete.city,
      state: membership.Athlete.state,
      gender: membership.Athlete.gender,
      age: computeAge(membership.Athlete.birthday),
      joinedAt: membership.joinedAt.toISOString(),
      engagement,
    });
  }

  const avgWeeklyMilesAcrossMembers =
    mileageSnapshots.length > 0
      ? mileageSnapshots.reduce((sum, v) => sum + v, 0) / mileageSnapshots.length
      : null;

  return {
    members,
    totals: {
      members: members.length,
      attendedRunLast30d,
      avgWeeklyMilesAcrossMembers,
    },
  };
}

export { computeAge };
