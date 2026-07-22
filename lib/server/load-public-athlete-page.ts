import { prisma } from '@/lib/prisma';
import { getJoinableCohortForHost } from '@/lib/training/cohort-service';
import { listPublicPlansForAthlete, mapPublishedPlanCard } from '@/lib/training/public-plan-service';
import {
  ensureGoFastWithMeForAthlete,
  getGoFastWithMeBySlug,
  normalizeGoFastWithMeSlug,
} from '@/lib/gofast-with-me/gofast-with-me-service';
import { resolvePublicActions } from '@/lib/gofast-with-me/resolve-public-actions';

const METERS_PER_MILE = 1609.344;

export type PublicAthletePayload = Awaited<ReturnType<typeof loadPublicAthletePage>>;

export function normalizeHandle(raw: string): string {
  return normalizeGoFastWithMeSlug(raw);
}

function startOfWeekMonday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // Monday = start of week. JS getDay: Sun=0, Mon=1, ...
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * Load every piece of data the public profile page needs in a single shaped payload.
 * Used by both the RSC page (`/u/[handle]`) and the public API route.
 *
 * Returns null when the handle does not resolve to an athlete.
 */
export async function loadPublicAthletePage(rawHandle: string) {
  const handle = normalizeHandle(rawHandle || '');
  if (!handle) return null;

  let gwmRow = await getGoFastWithMeBySlug(handle);
  if (!gwmRow) {
    const legacyAthlete = await prisma.athlete.findFirst({
      where: { gofastHandle: { equals: handle, mode: 'insensitive' } },
    });
    if (!legacyAthlete?.gofastHandle?.trim()) return null;
    await ensureGoFastWithMeForAthlete(legacyAthlete.id, legacyAthlete.gofastHandle, {
      seedBioFromAthlete: legacyAthlete.bio,
      seedPhotoFromAthlete: legacyAthlete.myBestRunPhotoURL,
    });
    gwmRow = await getGoFastWithMeBySlug(handle);
    if (!gwmRow) return null;
  }

  const athlete = gwmRow.athlete;

  const gofastWithMe = {
    id: gwmRow.id,
    gofastSlugSnapshot: gwmRow.gofastSlugSnapshot,
    welcome: gwmRow.welcome,
    gofastWithMeBio: gwmRow.gofastWithMeBio,
    whatYoullSeeHere: gwmRow.whatYoullSeeHere,
    sportFocus: gwmRow.sportFocus,
    modelFocus: gwmRow.modelFocus,
    myAchievements: gwmRow.myAchievements,
    gofastWithMePhotoUrl:
      gwmRow.gofastWithMePhotoUrl?.trim() ||
      athlete.myBestRunPhotoURL?.trim() ||
      null,
    creatorType: gwmRow.creatorType,
    coachSpecialty: gwmRow.coachSpecialty,
  };

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekStart = startOfWeekMonday(now);

  const [
    raceSignupRows,
    upcomingRunsRaw,
    plan,
    chasing,
    lastActivity,
    workoutRows,
    weeklyAggregate,
  ] = await Promise.all([
    prisma.athlete_race_signups.findMany({
      where: { athleteId: athlete.id },
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            slug: true,
            raceDate: true,
            city: true,
            state: true,
            distanceMeters: true,
            distanceLabel: true,
            isActive: true,
            isCancelled: true,
          },
        },
      },
      orderBy: { race_registry: { raceDate: 'asc' } },
      take: 24,
    }),
    prisma.city_runs.findMany({
      where: {
        athleteGeneratedId: athlete.id,
        date: { gte: now },
        published: true,
      },
      orderBy: { date: 'asc' },
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        citySlug: true,
        meetUpPoint: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        workoutId: true,
      },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId: athlete.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        name: true,
        startDate: true,
        totalWeeks: true,
        race_registry: {
          select: {
            name: true,
            slug: true,
            raceDate: true,
            city: true,
            state: true,
            distanceLabel: true,
            distanceMeters: true,
          },
        },
      },
    }),
    prisma.athleteGoal.findFirst({
      where: { athleteId: athlete.id, status: 'ACTIVE' },
      orderBy: { targetByDate: 'asc' },
      include: {
        race_registry: {
          select: {
            name: true,
            slug: true,
            raceDate: true,
            city: true,
            state: true,
            distanceLabel: true,
            distanceMeters: true,
          },
        },
      },
    }),
    prisma.athlete_activities.findFirst({
      where: { athleteId: athlete.id, ingestionStatus: 'MATCHED' },
      orderBy: { startTime: 'desc' },
      select: {
        activityName: true,
        startTime: true,
        distance: true,
        duration: true,
        activityType: true,
        source: true,
        summaryPolyline: true,
      },
    }),
    prisma.workouts.findMany({
      where: { athleteId: athlete.id, date: { gte: startOfToday } },
      orderBy: { date: 'asc' },
      take: 12,
      select: { id: true, title: true, workoutType: true, date: true },
    }),
    prisma.athlete_activities.aggregate({
      where: {
        athleteId: athlete.id,
        ingestionStatus: 'MATCHED',
        startTime: { gte: weekStart },
      },
      _sum: { distance: true },
    }),
  ]);

  const signedUpRaces = raceSignupRows
    .filter((row) => row.race_registry?.isActive && !row.race_registry.isCancelled)
    .map((row) => {
      const r = row.race_registry;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        raceDate: r.raceDate.toISOString(),
        city: r.city,
        state: r.state,
        distanceMeters: r.distanceMeters,
        distanceLabel: r.distanceLabel,
      };
    });

  // Pull RSVP stats for the upcoming runs in a single round-trip
  const runIds = upcomingRunsRaw.map((r) => r.id);
  const goingRsvps = runIds.length
    ? await prisma.city_run_rsvps.findMany({
        where: { runId: { in: runIds }, status: 'going' },
        include: {
          Athlete: {
            select: {
              id: true,
              firstName: true,
              gofastHandle: true,
              photoURL: true,
            },
          },
        },
      })
    : [];

  const rsvpsByRun = new Map<
    string,
    { count: number; avatars: { id: string; firstName: string | null; gofastHandle: string | null; photoURL: string | null }[] }
  >();
  for (const r of goingRsvps) {
    const bucket = rsvpsByRun.get(r.runId) ?? { count: 0, avatars: [] };
    bucket.count += 1;
    if (bucket.avatars.length < 4) {
      bucket.avatars.push({
        id: r.Athlete.id,
        firstName: r.Athlete.firstName,
        gofastHandle: r.Athlete.gofastHandle,
        photoURL: r.Athlete.photoURL,
      });
    }
    rsvpsByRun.set(r.runId, bucket);
  }

  const upcomingRuns = upcomingRunsRaw.map((r) => {
    const stats = rsvpsByRun.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      date: r.date.toISOString(),
      citySlug: r.citySlug,
      meetUpPoint: r.meetUpPoint,
      startTimeHour: r.startTimeHour,
      startTimeMinute: r.startTimeMinute,
      startTimePeriod: r.startTimePeriod,
      workoutId: r.workoutId,
      gorunPath: `/gorun/${r.id}`,
      goingCount: stats?.count ?? 0,
      goingAvatars: (stats?.avatars ?? []).slice(0, 3),
    };
  });

  const trainingSummary = plan
    ? {
        planName: plan.name,
        startDate: plan.startDate.toISOString(),
        totalWeeks: plan.totalWeeks,
        raceName: plan.race_registry?.name ?? null,
        raceDate: plan.race_registry?.raceDate?.toISOString() ?? null,
        raceCity: plan.race_registry?.city ?? null,
        raceState: plan.race_registry?.state ?? null,
        raceDistanceLabel: plan.race_registry?.distanceLabel ?? null,
      }
    : null;

  const primaryChasingGoal =
    !trainingSummary && chasing
      ? {
          id: chasing.id,
          name: chasing.name,
          distance: chasing.distance,
          goalTime: chasing.goalTime,
          targetByDate: chasing.targetByDate.toISOString(),
          raceName: chasing.race_registry?.name ?? null,
          raceSlug: chasing.race_registry?.slug ?? null,
          raceDate: chasing.race_registry?.raceDate?.toISOString() ?? null,
          raceCity: chasing.race_registry?.city ?? null,
          raceState: chasing.race_registry?.state ?? null,
          raceDistanceLabel: chasing.race_registry?.distanceLabel ?? null,
        }
      : null;

  const lastRun =
    lastActivity?.startTime != null
      ? {
          activityName: lastActivity.activityName,
          startTime: lastActivity.startTime.toISOString(),
          distanceMiles:
            lastActivity.distance != null && lastActivity.distance > 0
              ? lastActivity.distance / METERS_PER_MILE
              : null,
          durationSeconds: lastActivity.duration ?? null,
          activityType: lastActivity.activityType,
          source: lastActivity.source ?? null,
          summaryPolyline: lastActivity.summaryPolyline ?? null,
        }
      : null;

  const upcomingWorkouts = workoutRows.map((w) => ({
    id: w.id,
    title: w.title,
    workoutType: w.workoutType,
    date: w.date ? w.date.toISOString() : null,
  }));

  const weeklyMeters = weeklyAggregate?._sum?.distance ?? 0;
  const weeklyMilesThisWeek = weeklyMeters > 0 ? weeklyMeters / METERS_PER_MILE : 0;

  // Container preview (only when athlete has opted in)
  let containerMemberCount = 0;
  let containerRecentMembers: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
  }[] = [];

  if (athlete.isGoFastContainer) {
    const [count, memberRows] = await Promise.all([
      prisma.gofast_container_memberships.count({
        where: { containerAthleteId: athlete.id },
      }),
      prisma.gofast_container_memberships.findMany({
        where: { containerAthleteId: athlete.id },
        orderBy: { joinedAt: 'desc' },
        take: 6,
        include: {
          memberAthlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoURL: true,
              gofastHandle: true,
            },
          },
        },
      }),
    ]);
    containerMemberCount = count;
    containerRecentMembers = memberRows.map((r) => ({
      id: r.memberAthlete.id,
      firstName: r.memberAthlete.firstName,
      lastName: r.memberAthlete.lastName,
      photoURL: r.memberAthlete.photoURL,
      gofastHandle: r.memberAthlete.gofastHandle,
    }));
  }

  const joinableGroupTrainingRaw = await getJoinableCohortForHost(athlete.id);
  const publishedPlanRows = await listPublicPlansForAthlete(athlete.id);
  const publishedPlans = publishedPlanRows
    .map(mapPublishedPlanCard)
    .filter((p) => p.slug.length > 0);
  const joinableGroupTraining = joinableGroupTrainingRaw
    ? {
        id: joinableGroupTrainingRaw.id,
        handle: joinableGroupTrainingRaw.handle,
        cohortName: joinableGroupTrainingRaw.cohortName,
        defaultPlanStartDate: joinableGroupTrainingRaw.defaultPlanStartDate,
        currentWeekNumber: joinableGroupTrainingRaw.currentWeekNumber,
        memberCount: joinableGroupTrainingRaw.memberCount,
        race: {
          name: joinableGroupTrainingRaw.race.name,
          distanceLabel: joinableGroupTrainingRaw.race.distanceLabel,
        },
        hostFirstName: athlete.firstName,
      }
    : null;

  const nextRace = (() => {
    if (trainingSummary?.raceName && trainingSummary.raceDate) {
      const raceDate = new Date(trainingSummary.raceDate);
      if (!Number.isNaN(raceDate.getTime()) && raceDate >= now) {
        return {
          source: 'plan' as const,
          name: trainingSummary.raceName,
          raceDate: trainingSummary.raceDate,
          city: trainingSummary.raceCity,
          state: trainingSummary.raceState,
          distanceLabel: trainingSummary.raceDistanceLabel,
          planName: trainingSummary.planName,
        };
      }
    }
    if (primaryChasingGoal?.raceName && primaryChasingGoal.raceDate) {
      const raceDate = new Date(primaryChasingGoal.raceDate);
      if (!Number.isNaN(raceDate.getTime()) && raceDate >= now) {
        return {
          source: 'goal' as const,
          name: primaryChasingGoal.raceName,
          raceDate: primaryChasingGoal.raceDate,
          city: primaryChasingGoal.raceCity,
          state: primaryChasingGoal.raceState,
          distanceLabel: primaryChasingGoal.raceDistanceLabel,
          goalName: primaryChasingGoal.name,
        };
      }
    }
    const upcomingSignup = signedUpRaces.find((race) => new Date(race.raceDate) >= now);
    if (upcomingSignup) {
      return {
        source: 'signup' as const,
        name: upcomingSignup.name,
        raceDate: upcomingSignup.raceDate,
        city: upcomingSignup.city,
        state: upcomingSignup.state,
        distanceLabel: upcomingSignup.distanceLabel,
        slug: upcomingSignup.slug,
      };
    }
    return null;
  })();

  return {
    isGoFastContainer: athlete.isGoFastContainer,
    hostAthleteId: athlete.isGoFastContainer ? athlete.id : null,
    containerMemberCount,
    containerRecentMembers,
    joinableGroupTraining,
    publishedPlans,
    gofastWithMe,
    nextRace,
    publicActions: resolvePublicActions({
      gofastSlugSnapshot: gofastWithMe?.gofastSlugSnapshot ?? null,
      gofastHandle: athlete.gofastHandle,
      hostFirstName: athlete.firstName,
      upcomingRuns,
      publishedPlans,
      joinableGroupTraining,
    }),
    athlete: {
      id: athlete.id,
      gofastHandle: athlete.gofastHandle,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      photoURL: athlete.photoURL,
      myBestRunPhotoURL: athlete.myBestRunPhotoURL,
      bio: athlete.bio,
      city: athlete.city,
      state: athlete.state,
      primarySport: athlete.primarySport,
      fiveKPace: athlete.fiveKPace,
      weeklyMileage: athlete.weeklyMileage,
    },
    trainingSummary,
    primaryChasingGoal,
    lastRun,
    weeklyMilesThisWeek,
    signedUpRaces,
    upcomingWorkouts,
    upcomingRuns,
  };
}
