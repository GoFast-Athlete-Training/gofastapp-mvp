import { Prisma, PublicTrainingPlanVisibility } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import { loadPublicAthletePage, normalizeHandle } from '@/lib/server/load-public-athlete-page';
import {
  computeAllPublicPlanWeeks,
  getPublicPlanBySlug,
  listPublicPlansForAthlete,
} from '@/lib/training/public-plan-service';
import { effectiveTrainingWeekCount } from '@/lib/training/plan-utils';
import type { PublicPlanWeek } from '@/lib/training/public-plan-service';
import {
  athleteCommunityRelationship,
} from '@/lib/gofast-with-me/athlete-community-access';
import {
  containerMessageInclude,
  mapContainerMessageRow,
  type MappedContainerMessage,
} from '@/lib/gofast-with-me/container-message-map';
import {
  listPublishedAthleteTips,
  type AthleteTipPayload,
} from '@/lib/gofast-with-me/athlete-tips';
import {
  listPublishedAthleteRunRoutes,
  type AthleteRunRoutePayload,
} from '@/lib/gofast-with-me/athlete-run-routes';
import {
  listPublishedActivityPosts,
  type ActivityPostPayload,
} from '@/lib/gofast-with-me/activity-posts';
import {
  listPublicInstagramMedia,
  type AthleteInstagramMediaPayload,
} from '@/lib/gofast-with-me/instagram-hydration';
import type {
  GoFastWithMeChasingGoal,
  GoFastWithMeTrainingFor,
  GoFastWithMeTrainingSummary,
} from '@/lib/gofast-with-me/training-for-types';
import { parseAthleteRaceMainSnap } from '@/lib/training/plan-race-snapshots';

export type ContainerHubMessage = MappedContainerMessage;
export type { GoFastWithMeChasingGoal, GoFastWithMeTrainingFor, GoFastWithMeTrainingSummary };

export type ContainerHubPayload = {
  /** Owner of this athlete community. */
  isOwner: boolean;
  /** Caller follows this athlete (not enrollment in a training plan). */
  isFollowing: boolean;
  /** Can post Chatter and use follower interactions. */
  canParticipate: boolean;
  /** @deprecated use isOwner */
  isHost: boolean;
  /** @deprecated use isFollowing */
  isMember: boolean;
  /** @deprecated use canParticipate */
  canAccessFeed: boolean;
  host: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
    instagramUsername: string | null;
  };
  memberCount: number;
  members: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
    joinedAt: string;
  }[];
  upcomingRuns: {
    id: string;
    title: string;
    date: string;
    citySlug: string;
    meetUpPoint: string;
    gorunPath: string;
  }[];
  publishedPlan: {
    slug: string;
    name: string;
    totalWeeks: number;
    weeks: PublicPlanWeek[];
    /** False when owner-only preview of an unpublished active plan. */
    isPublic: boolean;
  } | null;
  trainingFor: GoFastWithMeTrainingFor;
  messages: ContainerHubMessage[];
  tips: AthleteTipPayload[];
  runRoutes: AthleteRunRoutePayload[];
  instagramMedia: AthleteInstagramMediaPayload[];
  activityPosts: ActivityPostPayload[];
};

export type AthleteCommunityPayload = ContainerHubPayload & {
  handle: string;
};

type HubPlanStrip = NonNullable<ContainerHubPayload['publishedPlan']>;

type PlanWeekRace = {
  name: string;
  raceDate: Date;
  distanceMeters: number | null;
};

function raceForPlanWeeks(plan: {
  athlete_race?: PlanWeekRace | null;
  athleteRaceMainSnap?: unknown;
  race_registry: PlanWeekRace | null;
}): PlanWeekRace | null {
  const snap = plan.athlete_race;
  if (snap) {
    return {
      name: snap.name,
      raceDate: snap.raceDate,
      distanceMeters: snap.distanceMeters,
    };
  }
  const mainSnap = parseAthleteRaceMainSnap(plan.athleteRaceMainSnap);
  if (mainSnap) {
    return {
      name: mainSnap.name,
      raceDate: new Date(mainSnap.raceDate),
      distanceMeters: mainSnap.distanceMeters,
    };
  }
  return plan.race_registry;
}

async function buildPlanStripFromTrainingPlan(plan: {
  id: string;
  name: string;
  publicSlug: string | null;
  publicVisibility: PublicTrainingPlanVisibility | null;
  startDate: Date;
  totalWeeks: number;
  planSchedule: unknown;
  race_registry: PlanWeekRace | null;
  athlete_race?: PlanWeekRace | null;
  athleteRaceMainSnap?: unknown;
}): Promise<HubPlanStrip | null> {
  if (!plan.planSchedule) return null;

  const race = raceForPlanWeeks(plan);
  const raceDate = race?.raceDate ?? null;
  const effectiveWeeks = effectiveTrainingWeekCount(
    plan.startDate,
    plan.totalWeeks,
    raceDate
  );
  const weeks = await computeAllPublicPlanWeeks({
    planSchedule: plan.planSchedule,
    startDate: plan.startDate,
    totalWeeks: plan.totalWeeks,
    race_registry: race,
  });
  if (weeks.length === 0) return null;

  return {
    slug: plan.publicSlug?.trim() || plan.id,
    name: plan.name,
    totalWeeks: effectiveWeeks,
    weeks,
    isPublic: plan.publicVisibility === PublicTrainingPlanVisibility.PUBLIC,
  };
}

/** Public published plan for followers; owner also sees active plan weeks when not published yet. */
async function loadHubPlanStrip(
  hostAthleteId: string,
  isOwner: boolean
): Promise<HubPlanStrip | null> {
  const publicRows = await listPublicPlansForAthlete(hostAthleteId);
  const firstPublic = publicRows.find((p) => p.publicSlug?.trim());
  if (firstPublic?.publicSlug) {
    const plan = await getPublicPlanBySlug(firstPublic.publicSlug);
    if (
      plan &&
      plan.publicVisibility !== PublicTrainingPlanVisibility.ARCHIVED &&
      plan.planSchedule
    ) {
      const strip = await buildPlanStripFromTrainingPlan(plan);
      if (strip) return strip;
    }
  }

  if (!isOwner) return null;

  const active = await prisma.training_plans.findFirst({
    where: {
      athleteId: hostAthleteId,
      planSchedule: { not: Prisma.JsonNull },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicVisibility: true,
      startDate: true,
      totalWeeks: true,
      planSchedule: true,
      race_registry: {
        select: { name: true, raceDate: true, distanceMeters: true },
      },
      athlete_race: {
        select: { name: true, raceDate: true, distanceMeters: true },
      },
    },
  });

  if (!active?.planSchedule) return null;
  return buildPlanStripFromTrainingPlan(active);
}

async function resolveFollowRelationship(
  hostAthleteId: string,
  callerAthleteId: string | null
): Promise<{ isOwner: boolean; isFollowing: boolean; canParticipate: boolean }> {
  if (!callerAthleteId || callerAthleteId === hostAthleteId) {
    return athleteCommunityRelationship({
      hostAthleteId,
      callerAthleteId,
      hasMembership: false,
    });
  }
  const membership = await prisma.gofast_container_memberships.findUnique({
    where: {
      containerAthleteId_memberAthleteId: {
        containerAthleteId: hostAthleteId,
        memberAthleteId: callerAthleteId,
      },
    },
  });
  return athleteCommunityRelationship({
    hostAthleteId,
    callerAthleteId,
    hasMembership: Boolean(membership),
  });
}

export async function loadAthleteCommunityForHost(
  hostAthleteId: string,
  callerAthleteId: string | null,
  options?: { messageTopic?: string; messageLimit?: number }
): Promise<ContainerHubPayload | null> {
  const host = await getAthleteById(hostAthleteId);
  if (!host?.isGoFastContainer) return null;

  const relationship = await resolveFollowRelationship(host.id, callerAthleteId);

  const handle = host.gofastHandle?.trim();
  const publicPage = handle ? await loadPublicAthletePage(handle) : null;

  const [memberRows, memberCount, publishedPlan, messageRows, tips, runRoutes, instagramMedia, activityPosts] =
    await Promise.all([
    prisma.gofast_container_memberships.findMany({
      where: { containerAthleteId: host.id },
      orderBy: { joinedAt: 'desc' },
      take: 24,
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
    prisma.gofast_container_memberships.count({ where: { containerAthleteId: host.id } }),
    loadHubPlanStrip(host.id, relationship.isOwner),
    prisma.gofast_container_messages.findMany({
      where: {
        containerAthleteId: host.id,
        ...(options?.messageTopic ? { topic: options.messageTopic } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.messageLimit ?? 40,
      include: containerMessageInclude,
    }),
    listPublishedAthleteTips(host.id, 6),
    listPublishedAthleteRunRoutes(host.id, 6),
    listPublicInstagramMedia(host.id, 5),
    listPublishedActivityPosts(host.id, 20),
  ]);

  return {
    isOwner: relationship.isOwner,
    isFollowing: relationship.isFollowing,
    canParticipate: relationship.canParticipate,
    isHost: relationship.isOwner,
    isMember: relationship.isFollowing,
    canAccessFeed: relationship.canParticipate,
    host: {
      id: host.id,
      firstName: host.firstName,
      lastName: host.lastName,
      gofastHandle: host.gofastHandle,
      photoURL: host.photoURL,
      instagramUsername: host.instagramUsername?.trim() || host.instagram?.trim() || null,
    },
    memberCount,
    members: memberRows.map((r) => ({
      id: r.memberAthlete.id,
      firstName: r.memberAthlete.firstName,
      lastName: r.memberAthlete.lastName,
      photoURL: r.memberAthlete.photoURL,
      gofastHandle: r.memberAthlete.gofastHandle,
      joinedAt: r.joinedAt.toISOString(),
    })),
    upcomingRuns: publicPage?.upcomingRuns ?? [],
    publishedPlan,
    trainingFor: {
      trainingSummary: publicPage?.trainingSummary ?? null,
      primaryChasingGoal: publicPage?.primaryChasingGoal ?? null,
    },
    messages: messageRows.map(mapContainerMessageRow),
    tips,
    runRoutes,
    instagramMedia,
    activityPosts,
  };
}

export async function loadAthleteCommunityByHandle(
  rawHandle: string,
  callerAthleteId: string | null,
  options?: { messageTopic?: string; messageLimit?: number }
): Promise<AthleteCommunityPayload | null> {
  const publicPage = await loadPublicAthletePage(rawHandle);
  if (!publicPage?.isGoFastContainer || !publicPage.athlete.id) return null;

  const payload = await loadAthleteCommunityForHost(
    publicPage.athlete.id,
    callerAthleteId,
    options
  );
  if (!payload) return null;

  const handle =
    publicPage.athlete.gofastHandle?.trim() ||
    normalizeHandle(rawHandle);

  return { ...payload, handle };
}

/** Authenticated hub boot — requires caller id. */
export async function loadContainerHubForHost(
  hostAthleteId: string,
  callerAthleteId: string,
  options?: { messageTopic?: string; messageLimit?: number }
): Promise<ContainerHubPayload | null> {
  return loadAthleteCommunityForHost(hostAthleteId, callerAthleteId, options);
}
